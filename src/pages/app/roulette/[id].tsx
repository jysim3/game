import { CrownOutlined } from "@ant-design/icons";
import { Button, Card, Divider, Flex, Tag, Typography } from "antd";
import { List } from "antd-mobile";
import { ref, runTransaction, serverTimestamp, update } from "firebase/database";
import { QRCodeCanvas } from "qrcode.react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { database } from "../../../api/firebaseConfig";
import { createGameStore } from "../../../api/gamestore";

type RouletteGameData = {
  hostUsername?: string;
  hostNickname?: string;
  spin?: {
    round: number;
    winningNumber: number;
    startedAt?: number;
  };
  lastSpin?: {
    round: number;
    winningNumber: number;
  };
};

type BetType =
  | { kind: "color"; color: "red" | "black" }
  | { kind: "parity"; parity: "odd" | "even" }
  | { kind: "range"; range: "low" | "high" }
  | { kind: "dozen"; dozen: 1 | 2 | 3 };

type RouletteUserData = {
  round: number;
  bet?: BetType;
  nickname?: string;
};

type RouletteActions = {
  claimHost: () => void;
  placeBet: (bet: BetType) => void;
  clearBet: () => void;
  spin: () => void;
  nextRound: () => void;
};

// European single-zero wheel order (clockwise), 0–36 (no 00)
const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
  10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3,
  26,
] as const;

// (Straight number selection UI removed)

const RED_NUMBERS = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18,
  19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

const getColor = (n: number): "green" | "red" | "black" => {
  if (n === 0) return "green";
  return RED_NUMBERS.has(n) ? "red" : "black";
};

const describeBet = (bet?: BetType) => {
  if (!bet) return "—";
  switch (bet.kind) {
    case "color":
      return bet.color === "red" ? "Red" : "Black";
    case "parity":
      return bet.parity === "odd" ? "Odd" : "Even";
    case "range":
      return bet.range === "low" ? "1–18" : "19–36";
    case "dozen":
      return bet.dozen === 1
        ? "1st dozen (1–12)"
        : bet.dozen === 2
          ? "2nd dozen (13–24)"
          : "3rd dozen (25–36)";
  }
};

const betWins = (bet: BetType | undefined, n: number) => {
  if (!bet) return false;
  switch (bet.kind) {
    case "color":
      return n !== 0 && getColor(n) === bet.color;
    case "parity":
      return n !== 0 && (n % 2 === 0 ? "even" : "odd") === bet.parity;
    case "range":
      return bet.range === "low" ? n >= 1 && n <= 18 : n >= 19 && n <= 36;
    case "dozen":
      return bet.dozen === 1
        ? n >= 1 && n <= 12
        : bet.dozen === 2
          ? n >= 13 && n <= 24
          : n >= 25 && n <= 36;
  }
};

const useGameStore = createGameStore<RouletteGameData, RouletteUserData, RouletteActions>(
  {
    gameId: "roulette",
    initialData: {
      status: "betting",
      round: 1,
      users: {},
    },
    actions: (_, get) => ({
      claimHost: () => {
        const { gameData, username, roomId } = get();
        if (!roomId) return;
        if (gameData.hostUsername) return;

        // IMPORTANT: multiple clients may load at the same time.
        // Use a transaction so "first writer wins" and later joiners can't steal host.
        const hostUsernameRef = ref(database, `room/${roomId}/hostUsername`);
        runTransaction(hostUsernameRef, (current) => current || username).then(
          (res) => {
            if (!res.committed) return;
            if (res.snapshot.val() !== username) return;

            const hostNickname = gameData.users?.[username]?.nickname;
            if (!hostNickname) return;

            // Only set nickname if it's not already set.
            const hostNicknameRef = ref(database, `room/${roomId}/hostNickname`);
            runTransaction(hostNicknameRef, (cur) => cur || hostNickname);

            // Ensure room metadata is up to date (without overwriting host fields).
            update(ref(database, `room/${roomId}`), {
              gameId: "roulette",
              lastUpdated: serverTimestamp(),
            });
          },
        );
      },
      placeBet: (bet) => {
        const { gameData, setUserData, roomId } = get();
        if (!roomId) return;
        setUserData({ round: gameData.round, bet });
      },
      clearBet: () => {
        const { gameData, setUserData, roomId } = get();
        if (!roomId) return;
        setUserData({ round: gameData.round, bet: undefined });
      },
      spin: () => {
        const { gameData, updateGameData, roomId } = get();
        if (!roomId) return;
        const winningNumber = Math.floor(Math.random() * 37); // 0-36

        // Phase 1: start animation across all clients.
        updateGameData({
          status: "spinning",
          spin: {
            round: gameData.round,
            winningNumber,
            startedAt: serverTimestamp() as unknown as number,
          },
        });

        // Phase 2: reveal after the spin completes.
        const REVEAL_MS = 21600;
        setTimeout(() => {
          updateGameData({
            status: "result",
            lastSpin: {
              round: gameData.round,
              winningNumber,
            },
          });
        }, REVEAL_MS);
      },
      nextRound: () => {
        const { gameData, updateGameData, roomId } = get();
        if (!roomId) return;
        updateGameData({
          status: "betting",
          round: (gameData.round || 1) + 1,
        });
      },
    }),
  },
);

function RouletteRoom() {
  const subscribe = useGameStore((s) => s.subscribe);
  const claimHost = useGameStore((s) => s.claimHost);

  const location = useLocation();
  const roomId = useParams().id;

  useEffect(() => {
    if (!roomId) return;
    sessionStorage.setItem("lastRoomPath", location.pathname);
    const unsub = subscribe(roomId);
    return unsub;
  }, [subscribe, roomId, location.pathname]);

  const hostUsername = useGameStore((s) => s.gameData.hostUsername);

  // Try to claim host ASAP (first person in the room wins).
  useEffect(() => {
    if (!roomId) return;
    if (hostUsername) return;
    claimHost();
  }, [claimHost, roomId, hostUsername]);

  const roomLabel = useMemo(() => (roomId ? roomId.toUpperCase() : ""), [roomId]);

  const round = useGameStore((s) => s.gameData.round);
  const status = useGameStore((s) => s.gameData.status);
  const spinData = useGameStore((s) => s.gameData.spin);
  const lastSpin = useGameStore((s) => s.gameData.lastSpin);

  const hostNickname = useGameStore((s) => s.gameData.hostNickname);
  const username = useGameStore((s) => s.username);
  const isHost = hostUsername === username;

  const users = useGameStore((s) => s.gameData.users || {});
  const currentRoundUsers = useMemo(
    () =>
      Object.entries(users)
        .map(([u, data]) => ({ username: u, ...data }))
        .filter((u) => u.round === round),
    [users, round],
  );

  const playersReady = currentRoundUsers.filter((u) => !!u.bet).length;

  const phaseLabel =
    status === "betting" ? "Place your bets" : status === "spinning" ? "Spinning…" : "Result";

  const winningNumberForWheel =
    status === "spinning" && spinData?.round === round
      ? spinData.winningNumber
      : lastSpin?.round === round
        ? lastSpin.winningNumber
        : undefined;

  return (
    <Flex vertical flex={1} style={{ minHeight: 0 }}>
      <div className="page-header">
        <div>
          <Typography.Title className="page-title" level={3}>
            Roulette wheel
          </Typography.Title>
          <div className="page-subtitle">Room: {roomLabel}</div>
          <div className="page-subtitle">
            Round {round} · {phaseLabel}
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div className="page-subtitle">Bets placed: {playersReady}</div>
          <div className="page-subtitle">
            Host: {hostNickname || hostUsername ? `${hostNickname || "(anon)"}` : "—"}{" "}
            {isHost ? <CrownOutlined /> : null}
          </div>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div className="page">
          {isHost ? (
            <div className="roulette-host-layout">
              <div className="roulette-host-left">
                <Card styles={{ body: { padding: 12 } }}>
                  <WheelPanel
                    status={status as any}
                    winningNumber={winningNumberForWheel}
                    startedAt={spinData?.round === round ? spinData.startedAt : undefined}
                  />
                </Card>
              </div>

              <div className="roulette-host-right">
                <Flex vertical gap={12}>
                  <Card styles={{ body: { padding: 12 } }}>
                    <HostPanel isHost={isHost} />
                  </Card>

                  <Card styles={{ body: { padding: 12 } }}>
                    <BetsPanel isHost={isHost} />
                  </Card>
                </Flex>
              </div>
            </div>
          ) : (
            <Flex vertical gap={12}>
              <Card styles={{ body: { padding: 12 } }}>
                <WheelPanel
                  status={status as any}
                  winningNumber={winningNumberForWheel}
                  startedAt={spinData?.round === round ? spinData.startedAt : undefined}
                />
              </Card>

              <Card styles={{ body: { padding: 12 } }}>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  Place your bet
                </Typography.Title>
                <Typography.Text className="page-subtitle">
                  Your controls are pinned to the bottom for quick access.
                </Typography.Text>
              </Card>
            </Flex>
          )}
        </div>

        <div className="roulette-bottom-spacer" />
      </div>

      <div className="fixed-bottom roulette-controls-bar">
        <div className="fixed-bottom-inner">
          <Card className="roulette-player-card">
            <YourBetPanel disabled={status !== "betting"} />
          </Card>
        </div>
      </div>
    </Flex>
  );
}

const WheelPanel = ({
  status,
  winningNumber,
  startedAt,
}: {
  status: "betting" | "spinning" | "result" | string;
  winningNumber?: number;
  startedAt?: number;
}) => {
  return (
    <Flex vertical gap={12}>
      <Flex justify="space-between" align="center" wrap gap={12}>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Wheel
          </Typography.Title>
          <Typography.Text className="page-subtitle">
            Classic casino colors · 0–36 (no 00)
          </Typography.Text>
        </div>

        <Tag
          color={
            status === "result" && winningNumber !== undefined
              ? getColor(winningNumber)
              : "default"
          }
        >
          {status === "spinning"
            ? "Spinning…"
            : status === "result" && winningNumber !== undefined
              ? `Winning: ${winningNumber}`
              : "Waiting…"}
        </Tag>
      </Flex>

      <RouletteWheel
        status={status}
        winningNumber={winningNumber}
        startedAt={startedAt}
      />
    </Flex>
  );
};

const RouletteWheel = ({
  status,
  winningNumber,
  startedAt,
}: {
  status: string;
  winningNumber?: number;
  startedAt?: number;
}) => {
  const slice = 360 / WHEEL_ORDER.length;

  const wheelRef = useRef<SVGSVGElement | null>(null);
  const rotationRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const [spinning, setSpinning] = useState(false);

  const applyRotation = (deg: number) => {
    rotationRef.current = deg;
    const el = wheelRef.current;
    if (!el) return;
    el.style.transform = `rotate(${deg}deg)`;
  };

  const stopIdle = () => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  // Idle rotation (imperative) to avoid React re-rendering at 60fps.
  useEffect(() => {
    if (status !== "betting" || spinning) {
      stopIdle();
      return;
    }

    let lastTs = 0;
    const speedDegPerSec = 14;

    const tick = (ts: number) => {
      if (!lastTs) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      applyRotation(rotationRef.current + dt * speedDegPerSec);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => stopIdle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, spinning]);

  // Spin animation (imperative) so it always animates, even after many rounds.
  useEffect(() => {
    if (status !== "spinning" || winningNumber === undefined) return;

    stopIdle();

    const el = wheelRef.current;
    if (!el) return;

    const current = rotationRef.current;
    const currentMod = ((current % 360) + 360) % 360;

    const winningIndex = Math.max(0, WHEEL_ORDER.indexOf(winningNumber as any));
    const targetCenterAngle = -90 + (winningIndex + 0.5) * slice;
    const desiredMod = (((-90 - targetCenterAngle) % 360) + 360) % 360;
    const delta = ((desiredMod - currentMod) + 360) % 360;

    const extraSpins = 12;
    const target = current + extraSpins * 360 + delta;

    setSpinning(true);

    // Set transition first, then apply transform on next frame.
    el.style.transition = "transform 21.6s cubic-bezier(0.07, 0.92, 0.04, 1)";
    requestAnimationFrame(() => {
      applyRotation(target);
    });

    const timer = setTimeout(() => {
      setSpinning(false);
      // Remove transition so idle feels immediate again.
      if (wheelRef.current) wheelRef.current.style.transition = "";
    }, 22000);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, winningNumber, startedAt]);

  const size = 240;
  const r = 105;
  const cx = size / 2;
  const cy = size / 2;

  const polarToCartesian = (angleDeg: number, radius: number = r) => {
    const a = (Math.PI / 180) * angleDeg;
    return {
      x: cx + radius * Math.cos(a),
      y: cy + radius * Math.sin(a),
    };
  };

  const segmentPath = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(startAngle, r);
    const end = polarToCartesian(endAngle, r);
    const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
  };

  const fillFor = (n: number) => {
    const c = getColor(n);
    if (c === "green") return "#1f8f5a";
    if (c === "red") return "#c0392b";
    return "#111418";
  };

  return (
    <div className="roulette-wheel-wrap">
      <div className="roulette-pointer" />
      <svg
        ref={wheelRef}
        width="100%"
        viewBox={`0 0 ${size} ${size}`}
        className="roulette-wheel"
        aria-label="Roulette wheel"
      >
        <defs>
          <radialGradient id="wheelGlow" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.02)" />
          </radialGradient>
        </defs>

        {/* Outer rim */}
        <circle cx={cx} cy={cy} r={r + 10} fill="url(#wheelGlow)" stroke="rgba(212,175,55,0.55)" strokeWidth={6} />

        {/* Segments */}
        {WHEEL_ORDER.map((num, idx) => {
          const start = -90 + idx * slice;
          const end = start + slice;
          return (
            <path
              key={num}
              d={segmentPath(start, end)}
              fill={fillFor(num)}
              stroke="rgba(212,175,55,0.28)"
              strokeWidth={1}
            />
          );
        })}

        {/* Numbers */}
        {WHEEL_ORDER.map((num, idx) => {
          const mid = -90 + (idx + 0.5) * slice;
          const p = polarToCartesian(mid, r * 0.78);
          const fill = num === 0 ? "rgba(255, 220, 140, 0.98)" : "rgba(255,255,255,0.92)";
          return (
            <text
              key={`t-${num}`}
              x={p.x}
              y={p.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={fill}
              stroke="rgba(0,0,0,0.65)"
              strokeWidth={2}
              paintOrder="stroke"
              fontSize={12}
              fontFamily="Cinzel, ui-serif, Georgia, serif"
              fontWeight={700}
              style={{ userSelect: "none" }}
              transform={`rotate(${mid + 90} ${p.x} ${p.y})`}
            >
              {num}
            </text>
          );
        })}

        {/* Inner ring */}
        <circle cx={cx} cy={cy} r={r * 0.48} fill="rgba(0,0,0,0.35)" stroke="rgba(212,175,55,0.35)" strokeWidth={4} />
        <circle cx={cx} cy={cy} r={r * 0.12} fill="rgba(255,255,255,0.85)" />
      </svg>
    </div>
  );
};

const HostPanel = ({ isHost }: { isHost: boolean }) => {
  const status = useGameStore((s) => s.gameData.status);
  const spin = useGameStore((s) => s.spin);
  const nextRound = useGameStore((s) => s.nextRound);

  const roomId = useGameStore((s) => s.roomId);

  const shareUrl = useMemo(() => {
    // Prefer current origin in case this is deployed to a custom domain.
    // Fall back to the canonical site if window is unavailable.
    const origin =
      typeof window !== "undefined" && window.location?.origin
        ? window.location.origin
        : "https://jysim3.com";
    return `${origin}/app/roulette/${roomId}`;
  }, [roomId]);

  return (
    <Flex justify="space-between" align="center" wrap gap={12}>
      <div>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Host controls
        </Typography.Title>
        <Typography.Text className="page-subtitle">
          Host sees everyone’s bet and can spin (best on laptop).
        </Typography.Text>
      </div>

      {!isHost ? (
        <Tag>Only the host can spin</Tag>
      ) : (
        <Flex align="center" gap={12} wrap>
          <div className="roulette-qr">
            <QRCodeCanvas
              value={shareUrl}
              size={92}
              includeMargin={false}
              bgColor="rgba(0,0,0,0)"
              fgColor="rgba(255,255,255,0.92)"
            />
            <div className="roulette-qr-caption">Scan to join</div>
          </div>

          <div>
            {status === "betting" ? (
              <Button type="primary" onClick={spin}>
                Spin
              </Button>
            ) : (
              <Button type="primary" onClick={nextRound}>
                Next round
              </Button>
            )}
          </div>
        </Flex>
      )}
    </Flex>
  );
};

const BetsPanel = ({ isHost }: { isHost: boolean }) => {
  const round = useGameStore((s) => s.gameData.round);
  const lastSpin = useGameStore((s) => s.gameData.lastSpin);
  const users = useGameStore((s) => s.gameData.users || {});

  const currentRoundUsers = useMemo(
    () =>
      Object.entries(users)
        .map(([username, data]) => ({ username, ...data }))
        .filter((u) => u.round === round)
        .sort((a, b) => (a.nickname || a.username).localeCompare(b.nickname || b.username)),
    [users, round],
  );

  const showResult = lastSpin?.round === round;
  const winningNumber = showResult ? lastSpin!.winningNumber : undefined;

  return (
    <Flex vertical gap={10}>
      <Flex justify="space-between" align="center" wrap>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Bets
          </Typography.Title>
          <Typography.Text className="page-subtitle">
            {isHost
              ? "You can see everyone’s picks."
              : "Only the host can see all bets before the spin."}
          </Typography.Text>
        </div>

        {winningNumber !== undefined ? (
          <Tag color={getColor(winningNumber)}>
            Winning: {winningNumber} ({getColor(winningNumber)})
          </Tag>
        ) : (
          <Tag>Waiting for spin…</Tag>
        )}
      </Flex>

      <List mode="card">
        {currentRoundUsers.length === 0 ? (
          <List.Item description="Share the room link and start betting.">No players yet</List.Item>
        ) : (
          currentRoundUsers.map((u) => {
            const canSee = isHost || false;
            const betText = canSee ? describeBet(u.bet) : u.bet ? "(bet placed)" : "—";
            const win =
              winningNumber !== undefined && canSee ? betWins(u.bet, winningNumber) : false;

            return (
              <List.Item
                key={u.username}
                prefix={
                  <div style={{ minWidth: 110, fontWeight: 700 }}>
                    {u.nickname || "(anon)"}
                  </div>
                }
                description={betText}
                extra={
                  winningNumber !== undefined && canSee ? (
                    win ? <Tag color="green">WIN</Tag> : <Tag>—</Tag>
                  ) : null
                }
              />
            );
          })
        )}
      </List>

      {!isHost ? (
        <Typography.Text className="page-subtitle">
          Tip: if you’re the host, open this on your laptop to manage spins.
        </Typography.Text>
      ) : null}
    </Flex>
  );
};

const YourBetPanel = ({ disabled }: { disabled: boolean }) => {
  const round = useGameStore((s) => s.gameData.round);
  const username = useGameStore((s) => s.username);
  const userData = useGameStore((s) => s.gameData.users?.[username]);

  const placeBet = useGameStore((s) => s.placeBet);
  const clearBet = useGameStore((s) => s.clearBet);

  const currentBet = userData?.round === round ? userData?.bet : undefined;

  const storageKey = "roulette:controlsCollapsed";
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "1";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(storageKey, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <Flex vertical gap={10}>
      <Flex justify="space-between" align="center" wrap>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Your bet
          </Typography.Title>
          <Typography.Text className="page-subtitle">
            {disabled ? "Betting is closed for this round." : "Tap a chip on the felt to place your bet."}
          </Typography.Text>
        </div>

        <div className="roulette-control-row">
          <div className="roulette-bet-pill" aria-label="Current bet">
            <span className="roulette-bet-pill-label">{describeBet(currentBet)}</span>
          </div>

          <button
            type="button"
            className="roulette-felt-btn roulette-felt-btn-ghost"
            onClick={toggleCollapsed}
          >
            {collapsed ? "Show" : "Hide"}
          </button>

          <button
            type="button"
            className="roulette-felt-btn roulette-felt-btn-ghost"
            disabled={!currentBet || disabled}
            onClick={clearBet}
          >
            Clear
          </button>
        </div>
      </Flex>

      <Divider style={{ margin: "4px 0" }} />

      {collapsed ? null : (
        <div
          className="roulette-bet-panel roulette-felt-panel"
          style={{
            opacity: disabled ? 0.55 : 1,
            pointerEvents: disabled ? "none" : "auto",
          }}
        >
          <div className="roulette-felt-section">
            <div className="roulette-felt-label">Color</div>
            <div className="roulette-felt-grid">
              <button
                type="button"
                className="roulette-felt-btn roulette-felt-btn-red"
                onClick={() => placeBet({ kind: "color", color: "red" })}
              >
                Red
              </button>
              <button
                type="button"
                className="roulette-felt-btn roulette-felt-btn-black"
                onClick={() => placeBet({ kind: "color", color: "black" })}
              >
                Black
              </button>
            </div>
          </div>

          <div className="roulette-felt-section">
            <div className="roulette-felt-label">Even / Odd</div>
            <div className="roulette-felt-grid">
              <button
                type="button"
                className="roulette-felt-btn"
                onClick={() => placeBet({ kind: "parity", parity: "even" })}
              >
                Even / 偶
              </button>
              <button
                type="button"
                className="roulette-felt-btn"
                onClick={() => placeBet({ kind: "parity", parity: "odd" })}
              >
                Odd / 奇
              </button>
            </div>
          </div>

          <div className="roulette-felt-section">
            <div className="roulette-felt-label">Low / High</div>
            <div className="roulette-felt-grid">
              <button
                type="button"
                className="roulette-felt-btn"
                onClick={() => placeBet({ kind: "range", range: "low" })}
              >
                1–18
              </button>
              <button
                type="button"
                className="roulette-felt-btn"
                onClick={() => placeBet({ kind: "range", range: "high" })}
              >
                19–36
              </button>
            </div>
          </div>

          <div className="roulette-felt-section">
            <div className="roulette-felt-label">Dozens</div>
            <div className="roulette-felt-grid roulette-felt-grid-3">
              <button
                type="button"
                className="roulette-felt-btn"
                onClick={() => placeBet({ kind: "dozen", dozen: 1 })}
              >
                1–12
              </button>
              <button
                type="button"
                className="roulette-felt-btn"
                onClick={() => placeBet({ kind: "dozen", dozen: 2 })}
              >
                13–24
              </button>
              <button
                type="button"
                className="roulette-felt-btn"
                onClick={() => placeBet({ kind: "dozen", dozen: 3 })}
              >
                25–36
              </button>
            </div>
          </div>
        </div>
      )}

      <Typography.Text className="page-subtitle">
        Your bet is saved to the room instantly, so the host can see it.
      </Typography.Text>
    </Flex>
  );
};

export default RouletteRoom;
