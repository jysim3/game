import { CrownOutlined } from "@ant-design/icons";
import { Button, Card, Divider, Flex, Space, Tag, Typography } from "antd";
import { List, Segmented } from "antd-mobile";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { createGameStore } from "../../../api/gamestore";

type RouletteGameData = {
  hostUsername?: string;
  hostNickname?: string;
  lastSpin?: {
    round: number;
    winningNumber: number;
  };
};

type BetType =
  | { kind: "straight"; number: number }
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

const ROULETTE_NUMBERS = Array.from({ length: 37 }, (_, i) => i); // 0-36, no 00

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
    case "straight":
      return `Straight ${bet.number}`;
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
    case "straight":
      return n === bet.number;
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
        updateGameData({
          hostUsername: username,
          hostNickname: gameData.users?.[username]?.nickname,
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
        updateGameData({
          status: "result",
          lastSpin: {
            round: gameData.round,
            winningNumber,
          },
        });
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

  return (
    <Flex vertical flex={1} style={{ minHeight: 0 }}>
      <div className="page-header">
        <div>
          <Typography.Title className="page-title" level={3}>
            Roulette wheel
          </Typography.Title>
          <div className="page-subtitle">Room: {roomLabel}</div>
          <div className="page-subtitle">
            Round {round} · {status === "betting" ? "Place your bets" : "Result"}
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
              <WheelPanel winningNumber={lastSpin?.round === round ? lastSpin.winningNumber : undefined} />
            </Card>

            <Card styles={{ body: { padding: 12 } }}>
              <HostPanel isHost={isHost} />
            </Card>

            <Card styles={{ body: { padding: 12 } }}>
              <BetsPanel isHost={isHost} />
            </Card>
          </Flex>
        </div>

        <div className="fixed-bottom-spacer" />
      </div>

      <div className="fixed-bottom">
        <div className="fixed-bottom-inner">
          <Card>
            <YourBetPanel disabled={status !== "betting"} />
          </Card>
        </div>
      </div>
    </Flex>
  );
}

const WheelPanel = ({ winningNumber }: { winningNumber?: number }) => {
  const color = winningNumber === undefined ? "" : getColor(winningNumber);
  const bg =
    winningNumber === undefined
      ? "rgba(255,255,255,0.06)"
      : color === "red"
        ? "rgba(231, 76, 60, 0.18)"
        : color === "black"
          ? "rgba(0, 0, 0, 0.28)"
          : "rgba(46, 204, 113, 0.18)";

  return (
    <Flex justify="space-between" align="center" wrap gap={12}>
      <div>
        <Typography.Title level={5} style={{ margin: 0 }}>
          Spin result
        </Typography.Title>
        <Typography.Text className="page-subtitle">
          Numbers: 0–36 (no 00)
        </Typography.Text>
      </div>

      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 999,
          background: bg,
          border: "1px solid rgba(255,255,255,0.18)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 28,
        }}
      >
        {winningNumber === undefined ? "—" : winningNumber}
      </div>
    </Flex>
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

  const [mode, setMode] = useState<
    "Number" | "Color" | "Even/Odd" | "Low/High" | "Dozen"
  >("Number");

  const currentBet = userData?.round === round ? userData?.bet : undefined;

  const setStraight = (n: number) => placeBet({ kind: "straight", number: n });

  return (
    <Flex vertical gap={10}>
      <Flex justify="space-between" align="center" wrap>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>
            Your bet
          </Typography.Title>
          <Typography.Text className="page-subtitle">
            {disabled ? "Betting is closed for this round." : "Pick a bet type, then select."}
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

      <Segmented
        options={["Number", "Color", "Even/Odd", "Low/High", "Dozen"]}
        value={mode}
        onChange={(v) => setMode(v as any)}
      />

      <div style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? "none" : "auto" }}>
        {mode === "Number" ? (
          <Flex wrap gap={8}>
            {ROULETTE_NUMBERS.map((n) => (
              <Button
                key={n}
                onClick={() => setStraight(n)}
                style={{
                  width: 54,
                  background:
                    n === 0
                      ? "rgba(46, 204, 113, 0.18)"
                      : getColor(n) === "red"
                        ? "rgba(231, 76, 60, 0.18)"
                        : "rgba(0, 0, 0, 0.22)",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              >
                {n}
              </Button>
            ))}
          </Flex>
        ) : null}

        {mode === "Color" ? (
          <Space wrap>
            <Button type="primary" onClick={() => placeBet({ kind: "color", color: "red" })}>
              Red
            </Button>
            <Button onClick={() => placeBet({ kind: "color", color: "black" })}>Black</Button>
          </Space>
        ) : null}

        {mode === "Even/Odd" ? (
          <Space wrap>
            <Button type="primary" onClick={() => placeBet({ kind: "parity", parity: "even" })}>
              Even
            </Button>
            <Button onClick={() => placeBet({ kind: "parity", parity: "odd" })}>Odd</Button>
          </Space>
        ) : null}

        {mode === "Low/High" ? (
          <Space wrap>
            <Button type="primary" onClick={() => placeBet({ kind: "range", range: "low" })}>
              1–18
            </Button>
            <Button onClick={() => placeBet({ kind: "range", range: "high" })}>19–36</Button>
          </Space>
        ) : null}

        {mode === "Dozen" ? (
          <Space wrap>
            <Button type="primary" onClick={() => placeBet({ kind: "dozen", dozen: 1 })}>
              1–12
            </Button>
            <Button onClick={() => placeBet({ kind: "dozen", dozen: 2 })}>13–24</Button>
            <Button onClick={() => placeBet({ kind: "dozen", dozen: 3 })}>25–36</Button>
          </Space>
        ) : null}
      </div>

      <Typography.Text className="page-subtitle">
        Your bet is saved to the room instantly, so the host can see it.
      </Typography.Text>
    </Flex>
  );
};

export default RouletteRoom;
