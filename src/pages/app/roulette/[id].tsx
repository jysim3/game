import { CrownOutlined } from "@ant-design/icons";
import { Button, Card, Divider, Flex, Space, Tag, Typography } from "antd";
import { List } from "antd-mobile";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { createGameStore } from "../../../api/gamestore";
import { serverTimestamp } from "firebase/database";

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
        const { gameData, username, updateGameData, roomId } = get();
        if (!roomId) return;
        if (gameData.hostUsername) return;

        const hostNickname = gameData.users?.[username]?.nickname;
        // Firebase rejects `undefined` values in update() payloads.
        updateGameData({
          hostUsername: username,
          ...(hostNickname ? { hostNickname } : {}),
        });
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
        setTimeout(() => {
          updateGameData({
            status: "result",
            lastSpin: {
              round: gameData.round,
              winningNumber,
            },
          });
        }, 4200);
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
          <Flex vertical gap={12}>
            <Card styles={{ body: { padding: 12 } }}>
              <WheelPanel
                status={status as any}
                winningNumber={winningNumberForWheel}
                startedAt={spinData?.round === round ? spinData.startedAt : undefined}
              />
            </Card>

            {isHost ? (
              <>
                <Card styles={{ body: { padding: 12 } }}>
                  <HostPanel isHost={isHost} />
                </Card>

                <Card styles={{ body: { padding: 12 } }}>
                  <BetsPanel isHost={isHost} />
                </Card>
              </>
            ) : (
              <Card styles={{ body: { padding: 12 } }}>
                <Typography.Title level={5} style={{ margin: 0 }}>
                  Place your bet
                </Typography.Title>
                <Typography.Text className="page-subtitle">
                  Your controls are pinned to the bottom for quick access.
                </Typography.Text>
              </Card>
            )}
          </Flex>
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

        <Tag color={winningNumber === undefined ? "default" : getColor(winningNumber)}>
          {winningNumber === undefined
            ? status === "spinning"
              ? "Spinning…"
              : "Waiting…"
            : `Winning: ${winningNumber}`}
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

  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);

  // Keep a gentle slow rotation while waiting for the host.
  useEffect(() => {
    if (status !== "betting" || spinning) return;

    let raf = 0;
    let lastTs = 0;
    const speedDegPerSec = 14; // slow, casino vibe

    const tick = (ts: number) => {
      if (!lastTs) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;
      setRotation((r) => r + dt * speedDegPerSec);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [status, spinning]);

  useEffect(() => {
    if (status !== "spinning" || winningNumber === undefined) return;

    const baseStart = rotation % 360;

    const winningIndex = Math.max(0, WHEEL_ORDER.indexOf(winningNumber as any));
    const targetCenterAngle = -90 + (winningIndex + 0.5) * slice; // segments start at top
    // Rotate wheel so the winning segment lands under the pointer at top.
    const desired = -targetCenterAngle;

    const extraSpins = 8;
    const target = baseStart + extraSpins * 360 + desired;

    setSpinning(true);
    setRotation(target);

    const timer = setTimeout(() => setSpinning(false), 4300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, winningNumber, startedAt]);

  const size = 240;
  const r = 105;
  const cx = size / 2;
  const cy = size / 2;

  const polarToCartesian = (angleDeg: number) => {
    const a = (Math.PI / 180) * angleDeg;
    return {
      x: cx + r * Math.cos(a),
      y: cy + r * Math.sin(a),
    };
  };

  const segmentPath = (startAngle: number, endAngle: number) => {
    const start = polarToCartesian(startAngle);
    const end = polarToCartesian(endAngle);
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
        width="100%"
        viewBox={`0 0 ${size} ${size}`}
        className="roulette-wheel"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: spinning
            ? "transform 4.2s cubic-bezier(0.12, 0.85, 0.1, 1)"
            : "none",
        }}
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
        <Space wrap>
          {status === "betting" ? (
            <Button type="primary" onClick={spin}>
              Spin
            </Button>
          ) : (
            <Button type="primary" onClick={nextRound}>
              Next round
            </Button>
          )}
        </Space>
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

  // No tabs: show all quick bets in one felt panel

  const currentBet = userData?.round === round ? userData?.bet : undefined;

  // Straight number bet UI removed (felt-style quick bets only)

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

        <Space wrap>
          <Tag color={currentBet ? "blue" : "default"}>{describeBet(currentBet)}</Tag>
          <Button disabled={!currentBet || disabled} onClick={clearBet}>
            Clear
          </Button>
        </Space>
      </Flex>

      <Divider style={{ margin: "4px 0" }} />

      <div
        className="roulette-bet-panel"
        style={{
          opacity: disabled ? 0.5 : 1,
          pointerEvents: disabled ? "none" : "auto",
        }}
      >
        <Flex vertical gap={10}>
          <Space wrap>
            <Button type="primary" onClick={() => placeBet({ kind: "color", color: "red" })}>
              Red
            </Button>
            <Button onClick={() => placeBet({ kind: "color", color: "black" })}>Black</Button>
          </Space>

          <Space wrap>
            <Button type="primary" onClick={() => placeBet({ kind: "parity", parity: "even" })}>
              Even
            </Button>
            <Button onClick={() => placeBet({ kind: "parity", parity: "odd" })}>Odd</Button>
          </Space>

          <Space wrap>
            <Button type="primary" onClick={() => placeBet({ kind: "range", range: "low" })}>
              1–18
            </Button>
            <Button onClick={() => placeBet({ kind: "range", range: "high" })}>19–36</Button>
          </Space>

          <Space wrap>
            <Button type="primary" onClick={() => placeBet({ kind: "dozen", dozen: 1 })}>
              1–12
            </Button>
            <Button onClick={() => placeBet({ kind: "dozen", dozen: 2 })}>13–24</Button>
            <Button onClick={() => placeBet({ kind: "dozen", dozen: 3 })}>25–36</Button>
          </Space>
        </Flex>
      </div>

      <Typography.Text className="page-subtitle">
        Your bet is saved to the room instantly, so the host can see it.
      </Typography.Text>
    </Flex>
  );
};

export default RouletteRoom;
