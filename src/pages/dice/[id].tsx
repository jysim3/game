import { Button, Card, Col, Flex, Row, Space, Typography } from "antd";
import {
  Unsubscribe,
  onValue,
  ref,
  serverTimestamp,
  set as setDatabase,
  update as updateDatabase,
} from "firebase/database";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { database } from "../../api/firebaseConfig";
import personLogo from "../../assets/jysim.png";

import { Dialog, List, Segmented } from "antd-mobile";
import { useParams } from "react-router-dom";
import { GameStoreType } from "../../api/gamestore";
import { useNicknameStore } from "../_app";
import dieImages from "./_assets";

type DieType = 1 | 2 | 3 | 4 | 5 | 6;

type UserDiceType = {
  dice: DieType[];
  round: number;
  nickname?: string;
};

type GameActions<UserGameDataType, GameDataType = object> = {
  setUserData: (data: UserGameDataType) => void;
  updateGameData: (data: GameDataType) => void;
  subscribe: (roomId: string) => Unsubscribe;
};

type DiceGameActions = {
  open: () => void;
  startNew: () => void;
} & GameActions<UserDiceType>;

const rollDice = () => {
  return Array(5)
    .fill(0)
    .map(() => Math.random() * 5 + 1)
    .map((x) => Math.round(x) as 1 | 2 | 3 | 4 | 5 | 6);
};

const useGameStore = create<DiceGameActions & GameStoreType<UserDiceType>>()(
  persist(
    (set, get) => ({
      open: () => {},
      startNew: () => {},
      gameData: { status: "open", round: 0, users: {} },
      lastUpdated: 0,
      gameId: "dice",

      userName: useNicknameStore.getState().username,
      roomId: "",

      setUserData: (data: UserDiceType) =>
        get().roomId
          ? setDatabase(
              ref(database, `room/${get().roomId}/users/` + get().userName),
              {
                ...data,
                nickname: useNicknameStore.getState().nickname,
              },
            )
          : null,
      subscribe: (roomId: string = "hello") => {
        set((state) => ({ ...state, roomId }));
        return onValue(ref(database, `/room/${roomId}/`), (snapshot) => {
          const data = snapshot.val() || {};
          if (!data.round) {
            updateDatabase(ref(database, `room/${roomId}`), {
              round: 0,
              status: "running",
              gameId: "dice",
              lastUpdated: serverTimestamp(),
            });
            setDatabase(
              ref(database, `room/${roomId}/users/` + get().userName),
              { round: -1 },
            );
          } else if (!data?.users?.[get().userName]) {
            setDatabase(
              ref(database, `room/${roomId}/users/` + get().userName),
              { round: -1 },
            );
          } else {
            set((state) => ({ ...state, gameData: data }));
          }
        });
      },
      updateGameData: (data) =>
        updateDatabase(ref(database, `room/${get().roomId}`), {
          ...data,
          gameId: "dice",
          lastUpdated: serverTimestamp(),
        }),
    }),
    {
      name: "gameData", // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
    },
  ),
);

function App() {
  const gameData = useGameStore((state) => state.gameData) || {};
  const userName = useGameStore((state) => state.userName);
  const userData = gameData.users?.[userName] as undefined | UserDiceType;

  const status = useGameStore((state) => state.gameData?.status);
  const round = useGameStore((state) => state.gameData?.round);
  const setUserData = useGameStore((state) => state.setUserData);
  const subscribe = useGameStore((state) => state.subscribe);
  const updateGameData = useGameStore((state) => state.updateGameData);
  const roomId = useParams().id;

  const [withOne, setWithOne] = useState(true);

  const allUserData = Object.values(gameData.users || {}).filter(
    (user) => user.round === round,
  );

  useEffect(() => {
    if (!roomId) {
      return;
    }
    return subscribe(roomId);
  }, [subscribe, roomId]);
  if (!userData) {
    return "hello";
  }

  const diceFlush =
    userData?.dice &&
    Object.values(diceSum(userData?.dice, false)).every((e) => e <= 1);
  const gameDiceSum = diceSum(
    allUserData.map(({ dice }) => dice).reduce((a, c) => a.concat(c), []),
    withOne,
  );

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
              Players ready: {allUserData.length}
            </Typography.Title>
            <Flex align="center" vertical>
              <List>
                {status === "open" ? (
                  <Flex vertical align="center">
                    <Row
                      justify="space-between"
                      style={{ alignSelf: "stretch" }}
                    >
                      {[1, 2, 3, 4, 5, 6].map((die) => (
                        <Col key={die}>
                          <Flex vertical>
                            <img src={dieImages[die]} style={{ width: 50 }} />
                            <Typography.Text style={{ textAlign: "center" }}>
                              {gameDiceSum[die as 1 | 2 | 3 | 4 | 5 | 6]}
                            </Typography.Text>
                          </Flex>
                        </Col>
                      ))}
                    </Row>
                    <Segmented
                      options={["With One", "Without One"]}
                      onChange={(v) => setWithOne(v === "With One")}
                      value={["With One", "Without One"][withOne ? 0 : 1]}
                    />

                    {allUserData.map(({ dice, nickname }, index) => (
                      <List.Item prefix={nickname} key={index}>
                        <Row justify="center" style={{ marginLeft: 10 }}>
                          {dice.map((die, yIndex) => (
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
          </Card>
        </Flex>
      </Flex>

      <Flex vertical>
        <Card
          style={{
            boxShadow: "0px -10px 10px -10px rgba(50, 50, 50, 0.75)",
          }}
        >
          <Flex align="center" vertical gap={10}>
            <Typography.Title level={3}>Your dice</Typography.Title>
            <Row>
              {userData.round === round
                ? userData.dice.map((die, index) => (
                    <Col key={index}>
                      <img src={dieImages[die]} style={{ width: 50 }} />
                    </Col>
                  ))
                : null}
            </Row>
            {!status || status === "open" ? (
              <Button
                onClick={() => {
                  updateGameData({
                    round: round ? round + 1 : 1,
                    status: "running",
                  });
                  setUserData({
                    round: round ? round + 1 : 1,
                    dice: rollDice(),
                  });
                }}
                type="primary"
              >
                Start game and roll
              </Button>
            ) : userData.round === round ? (
              <Space>
                {diceFlush ? (
                  <Button
                    onClick={() =>
                      setUserData({
                        round,
                        dice: rollDice(),
                      })
                    }
                    variant="solid"
                    color="green"
                  >
                    Roll
                  </Button>
                ) : (
                  <Button
                    onClick={() =>
                      Dialog.confirm({
                        content: "Open?",
                        onConfirm: () => updateGameData({ status: "open" }),
                      })
                    }
                    danger
                  >
                    Open
                  </Button>
                )}
              </Space>
            ) : (
              <Button
                onClick={() =>
                  setUserData({ round: round || -1, dice: rollDice() })
                }
              >
                roll
              </Button>
            )}
          </Flex>
        </Card>
      </Flex>
    </Flex>
  );
}
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
