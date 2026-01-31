import { Card, Col, Divider, Flex, Row, Space, Typography } from "antd";
import { useEffect, useMemo, useState } from "react";

import { List, Segmented } from "antd-mobile";
import { useLocation, useParams } from "react-router-dom";
import { createGameStore } from "../../../api/gamestore";
import ActionButton from "../../../components/ActionButton";
import dieImages from "./_assets";

type DieType = 1 | 2 | 3 | 4 | 5 | 6;

type UserDiceType = {
  dice: DieType[];
  round: number;
  nickname?: string;
};

type DiceGameActions = {
  open: () => void;
  startNew: () => void;
  reroll: () => void;
};

const rollDice = () => {
  return Array(5)
    .fill(0)
    .map(() => Math.random() * 6 + 1)
    .map((x) => Math.floor(x) as 1 | 2 | 3 | 4 | 5 | 6);
};

const useGameStore = createGameStore<object, UserDiceType, DiceGameActions>({
  gameId: "dice",
  initialData: { status: "open", round: 0, users: {} },
  actions: (_, get) => ({
    open: () => get().updateGameData({ status: "open" }),
    startNew: () => {
      const {
        gameData: { round },
        updateGameData,
        setUserData,
      } = get();
      updateGameData({
        round: round ? round + 1 : 1,
        status: "running",
      });
      setUserData({
        round: round ? round + 1 : 1,
        dice: rollDice(),
      });
    },
    reroll: () =>
      get().setUserData({
        dice: rollDice(),
        round: get().gameData.round,
      }),
  }),
});

function App() {
  const subscribe = useGameStore((state) => state.subscribe);
  const location = useLocation();
  const roomId = useParams().id;
  const userCount = useGameStore(
    (state) =>
      Object.values(state.gameData.users || {}).filter(
        (u) => u.round === state.gameData.round,
      ).length,
  );

  useEffect(() => {
    if (!roomId) {
      return;
    }
    sessionStorage.setItem("lastRoomPath", location.pathname);
    return subscribe(roomId);
  }, [subscribe, roomId, location.pathname]);

  const roomLabel = useMemo(
    () => (roomId ? roomId.toUpperCase() : ""),
    [roomId],
  );

  return (
    <Flex vertical flex={1} style={{ overflow: "auto" }}>
      <div className="page-header">
        <div>
          <Typography.Title className="page-title" level={3}>
            Dice
          </Typography.Title>
          <div className="page-subtitle">Room: {roomLabel}</div>
        </div>

        <div className="page-subtitle">Players ready: {userCount}</div>
      </div>

      <div className="page">
        <Card styles={{ body: { padding: 14 } }}>
          <Gameboard />
        </Card>
      </div>

      <div className="sticky-bottom">
        <Card styles={{ body: { padding: 14 } }}>
          <PlayerHand />
        </Card>
      </div>
    </Flex>
  );
}

const Gameboard = () => {
  const usersData = useGameStore((state) => state.gameData.users);
  const round = useGameStore((state) => state.gameData?.round);
  const status = useGameStore((state) => state.gameData?.status);
  const [withOne, setWithOne] = useState(true);

  const allUserData = Object.values(usersData || {}).filter(
    (user) => user.round === round,
  );
  const gameDiceSum = diceSum(
    allUserData.map(({ dice }) => dice).reduce((a, c) => a.concat(c), []),
    withOne,
  );
  const bonus = allUserData
    .map(({ dice }) => new Set(dice))
    .map((d) => {
      if (withOne) {
        d.delete(1);
      }
      return d;
    })
    .filter((d) => d.size === 1)
    .reduce((a, c) => {
      a[c.values().next().value!] += 1;
      return a;
    }, Array(7).fill(0));

  return (
    <Flex vertical gap={12}>
      <Flex justify="space-between" align="center" wrap>
        <div>
          <Typography.Title level={5} style={{ margin: 0 }}>
            Lobby
          </Typography.Title>
          <div className="page-subtitle">
            Configure whether 1 counts as a wildcard for 2–6
          </div>
        </div>
        <Segmented
          options={["With One", "Without One"]}
          onChange={(v) => setWithOne(v === "With One")}
          value={["With One", "Without One"][withOne ? 0 : 1]}
        />
      </Flex>

      {status !== "open" ? (
        <Card styles={{ body: { padding: 12 } }}>
          <Typography.Text className="page-subtitle">Game running…</Typography.Text>
        </Card>
      ) : null}

      <div className="dice-grid">
        <Row gutter={[10, 10]} justify="space-between">
          {[1, 2, 3, 4, 5, 6].map((die) => (
            <Col key={die} flex="1 1 90px">
              <div className="dice-tile">
                <Flex vertical align="center" gap={6}>
                  <img src={dieImages[die]} style={{ width: 42, height: 42 }} />
                  <div className="dice-tile-count">
                    {gameDiceSum[die as 1 | 2 | 3 | 4 | 5 | 6]}
                    {bonus[die] ? `+${bonus[die]}` : null}
                  </div>
                </Flex>
              </div>
            </Col>
          ))}
        </Row>
      </div>

      <Divider style={{ margin: "4px 0" }} />

      <Typography.Title level={5} style={{ margin: 0 }}>
        Players
      </Typography.Title>

      <List>
        {allUserData.map(({ dice, nickname }, index) => (
          <List.Item prefix={nickname || "(anon)"} key={index}>
            <Row justify="center" style={{ marginLeft: 10 }}>
              {dice?.map((die, yIndex) => (
                <Col key={yIndex} span={8} style={{ display: "flex" }}>
                  <img src={dieImages[die]} style={{ width: 46, margin: 4 }} />
                </Col>
              ))}
            </Row>
          </List.Item>
        ))}
      </List>
    </Flex>
  );
};

const PlayerHand = () => {
  const userData = useGameStore(
    (state) => state.gameData.users?.[state.username],
  );
  const round = useGameStore((state) => state.gameData?.round);
  const [fakeDice, setDice] = useState<DieType[]>([]);

  const isAdmin = userData?.nickname === "JY";
  const setUserData = useGameStore((state) => state.setUserData);
  const updateDice = (dice: DieType[]) =>
    setUserData({
      round,
      dice,
    });
  if (!userData) {
    return null;
  }
  const dice = fakeDice.length > 0 ? fakeDice : userData.dice;
  return (
    <Flex align="center" vertical gap={10}>
      <Typography.Title level={3}>Your dice</Typography.Title>
      <Row>
        {userData && userData.round === round && dice
          ? dice.map((die, index) => (
              <Col
                key={index}
                onClick={() => {
                  if (!isAdmin) {
                    return;
                  }
                  dice[index] = ((dice[index] % 6) + 1) as DieType;
                  console.log(dice);
                  setDice([...dice]);
                }}
              >
                <img src={dieImages[die]} style={{ width: 50 }} />
              </Col>
            ))
          : null}
      </Row>
      <PlayerActions />
      {fakeDice.length > 0 ? (
        <Space>
          <ActionButton
            onClick={() => {
              updateDice(dice);
              setDice([]);
            }}
            label="Send"
          />
          <ActionButton onClick={() => setDice([])} label="Clear" />
        </Space>
      ) : null}
    </Flex>
  );
};

const PlayerActions = () => {
  const userData = useGameStore(
    (state) => state.gameData.users?.[state.username],
  );
  const status = useGameStore((state) => state.gameData.status);
  const round = useGameStore((state) => state.gameData.round);

  const setUserData = useGameStore((state) => state.setUserData);
  const open = useGameStore((state) => state.open);
  const startNew = useGameStore((state) => state.startNew);

  const diceFlush =
    userData?.dice &&
    Object.values(diceSum(userData?.dice, false)).every((e) => e <= 1);

  if (!status || status === "open") {
    return (
      <ActionButton
        type="primary"
        onClick={startNew}
        label="Start game and roll"
      />
    );
  }
  if (!userData || userData.round !== round) {
    return (
      <ActionButton
        onClick={() =>
          setUserData({
            round,
            dice: rollDice(),
          })
        }
        label="Join and roll"
      />
    );
  }
  if (diceFlush) {
    return (
      <ActionButton
        onClick={() =>
          setUserData({
            round,
            dice: rollDice(),
          })
        }
        color="green"
        label="Re-roll"
      />
    );
  }
  return <ActionButton onClick={open} color="red" label="Open" />;
};

function diceSum(dice: (1 | 2 | 3 | 4 | 5 | 6)[], withOnes: boolean) {
  return dice.reduce(
    (resultArray, item) => {
      if (item === 1 && withOnes) {
        resultArray[2] += 1;
        resultArray[3] += 1;
        resultArray[4] += 1;
        resultArray[5] += 1;
        resultArray[6] += 1;
      }
      resultArray[item] += 1;
      return resultArray;
    },
    { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  );
}

export default App;
