import { Card, Col, Flex, Row, Space, Typography } from "antd";
import { useEffect, useState } from "react";
import personLogo from "../../assets/jysim.png";

import { List, Segmented } from "antd-mobile";
import { useParams } from "react-router-dom";
import { createGameStore } from "../../api/gamestore";
import ActionButton from "../../components/ActionButton";
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
    return subscribe(roomId);
  }, [subscribe, roomId]);

  return (
    <Flex
      vertical
      flex={1}
      style={{ backgroundColor: "#eee", overflow: "scroll" }}
    >
      <Flex
        vertical
        gap={10}
        flex={1}
        style={{ backgroundColor: "#eee", overflow: "scroll" }}
      >
        <Flex vertical>
          <Flex justify="center">
            <a
              href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
              target="_blank"
            >
              <img src={personLogo} style={{ width: 100 }} />
            </a>
          </Flex>
          <Typography.Title style={{ textAlign: "center" }}>
            Dice v2.0
          </Typography.Title>
        </Flex>
        <Flex vertical flex={1} style={{ margin: 10 }}>
          <Card>
            <Typography.Title level={4} style={{ textAlign: "center" }}>
              Players ready: {userCount}
            </Typography.Title>
            <Gameboard />
          </Card>
        </Flex>
      </Flex>

      <Flex vertical>
        <Card
          style={{
            boxShadow: "0px -10px 10px -10px rgba(50, 50, 50, 0.75)",
          }}
        >
          <PlayerHand />
        </Card>
      </Flex>
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
    <Flex align="center" vertical>
      <List>
        {status === "open" ? (
          <Flex vertical align="center">
            <Segmented
              options={["With One", "Without One"]}
              onChange={(v) => setWithOne(v === "With One")}
              value={["With One", "Without One"][withOne ? 0 : 1]}
            />
            <Row justify="space-between" style={{ alignSelf: "stretch" }}>
              {[1, 2, 3, 4, 5, 6].map((die) => (
                <Col key={die}>
                  <Flex vertical>
                    <img src={dieImages[die]} style={{ width: 50 }} />
                    <Typography.Text style={{ textAlign: "center" }}>
                      {gameDiceSum[die as 1 | 2 | 3 | 4 | 5 | 6]}
                      {bonus[die] ? `+${bonus[die]}` : null}
                    </Typography.Text>
                  </Flex>
                </Col>
              ))}
            </Row>

            {allUserData.map(({ dice, nickname }, index) => (
              <List.Item prefix={nickname} key={index}>
                <Row justify="center" style={{ marginLeft: 10 }}>
                  {dice?.map((die, yIndex) => (
                    <Col
                      key={yIndex}
                      span={8}
                      style={{
                        display: "flex",
                        alignContent: "center",
                      }}
                    >
                      <img
                        src={dieImages[die]}
                        style={{ width: 50, margin: 5 }}
                      />
                    </Col>
                  ))}
                </Row>
              </List.Item>
            ))}
          </Flex>
        ) : (
          <List.Item>Running...</List.Item>
        )}
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
