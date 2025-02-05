import { Card, Flex, Typography } from "antd";
import { useEffect, useState } from "react";
import personLogo from "../../assets/jysim.png";

import { List } from "antd-mobile";
import { useParams } from "react-router-dom";
import { createGameStore } from "../../api/gamestore";
import ActionButton from "../../components/ActionButton";
import icons from "./_assets";

type CardType = "J" | "K" | "N";

type KingJokerBoardType = {
  turn: number;
  jokerUser?: string;
  kingUser?: string;
};

type UserGameType = {
  round: number;
  nickname?: string;
  normalPlayed: number;
  specialPlayed: boolean;
  cardsPlayed?: CardType[];
};

type KingJokerActions = {
  startNew: () => void;
  send: (special: boolean) => void;
  join: () => void;
  forceJoin: (asKing: boolean) => void;
};

const useGameStore = createGameStore<
  KingJokerBoardType,
  UserGameType,
  KingJokerActions
>({
  gameId: "kingjoker",
  initialData: {
    status: "open",
    turn: 1,
    round: 0,
    jokerUser: "",
    kingUser: "",
    users: {},
  },
  actions: (_, get) => ({
    forceJoin: (asKing: boolean) => {
      if (asKing) {
        get().updateGameData({
          kingUser: get().username,
        });
      } else {
        get().updateGameData({
          jokerUser: get().username,
        });
      }
    },
    join: () => {
      if (!get().gameData.kingUser) {
        get().updateGameData({
          kingUser: get().username,
        });
      } else if (!get().gameData.jokerUser) {
        get().updateGameData({
          jokerUser: get().username,
        });
      }
    },
    startNew: () => {
      const { jokerUser, kingUser, round } = get().gameData;
      const { updateGameData } = get();
      if (!kingUser || !jokerUser) {
        return;
      }
      updateGameData({
        jokerUser: kingUser,
        kingUser: jokerUser,
        round: (round || 0) + 1,
        users: {
          [kingUser]: {
            normalPlayed: 0,
            specialPlayed: false,
            cardsPlayed: [],
            round: (round || 0) + 1,
          },
          [jokerUser]: {
            normalPlayed: 0,
            cardsPlayed: [],
            specialPlayed: false,
            round: (round || 0) + 1,
          },
        },
      });
    },
    send: (special: boolean) => {
      const { gameData, username } = get();
      const userData = gameData.users?.[username];
      if (!userData) {
        return;
      }
      userData.cardsPlayed = userData.cardsPlayed || [];
      if (special) {
        get().updateUserData({
          round: gameData.round,
          specialPlayed: true,
          cardsPlayed: [
            ...userData.cardsPlayed,
            gameData.jokerUser === username ? "J" : "K",
          ],
        });
      } else {
        get().updateUserData({
          round: gameData.round,
          cardsPlayed: [...userData.cardsPlayed, "N"],
        });
      }
    },
  }),
});

function App() {
  const subscribe = useGameStore((state) => state.subscribe);
  const roomId = useParams().id;

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
            King Joker 2.0
          </Typography.Title>
        </Flex>
        <Flex vertical flex={1} style={{ margin: 10 }}>
          <Card>
            <Typography.Title level={4} style={{ textAlign: "center" }}>
              Joker: {""}
              King: {""}
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

const ListCards = ({
  hidden = 6,
  cardsPlayed,
}: {
  hidden?: number;
  cardsPlayed?: CardType[];
}) => {
  if (!cardsPlayed) {
    return Array(5)
      .fill(0)
      .map((_, index) => (
        <Card key={index}>
          <div />
        </Card>
      ));
  }
  const userCards = cardsPlayed.map((card, index) => (
    <Card key={index} style={{ flex: 1 }}>
      <img
        src={index < hidden ? icons[card] : icons["E"]}
        style={{ width: "100%", maxWidth: 30 }}
      />
    </Card>
  ));
  return userCards
    .concat(
      Array(5)
        .fill(0)
        .map((_, index) => (
          <Card key={index}>
            <div />
          </Card>
        )),
    )
    .slice(0, 5);
};
const Gameboard = () => {
  const gameData = useGameStore((state) => state.gameData);
  const kingUser = useGameStore((state) => state.gameData.kingUser);
  const jokerUser = useGameStore((state) => state.gameData.jokerUser);

  const userData = [kingUser, jokerUser]
    .filter((v) => v)
    .map((user) => gameData?.users?.[user!]);

  const amKing = useGameStore(
    (state) => state.gameData.kingUser === state.username,
  );
  const cards = [];

  if (amKing) {
    userData.reverse();
  }
  if (userData.length !== 2) {
    return (
      <Flex align="center" vertical>
        <List></List>
      </Flex>
    );
  }
  cards.push(
    <ListCards
      cardsPlayed={userData[0]!.cardsPlayed}
      hidden={userData[1]!.cardsPlayed?.length || 0}
    />,
  );
  cards.push(<ListCards cardsPlayed={userData[1]?.cardsPlayed || []} />);

  return (
    <Flex align="center" vertical>
      <List>
        <Flex vertical align="center" gap={10}>
          {cards.map((card) => (
            <Flex align="stretch">{card}</Flex>
          ))}
        </Flex>
      </List>
    </Flex>
  );
};

const PlayerHand = () => {
  const kingUser = useGameStore((state) => state.gameData.kingUser);
  const jokerUser = useGameStore((state) => state.gameData.jokerUser);
  const username = useGameStore((state) => state.username);
  const startNew = useGameStore((state) => state.startNew);
  const gameEnd = useGameEnd();

  const normalCardAvailable = useGameStore(
    (state) =>
      4 -
      (state.gameData.users?.[state.username]?.cardsPlayed?.filter(
        (c) => c === "N",
      ).length || 0),
  );
  const specialPlayed = useGameStore(
    (state) => state.gameData.users?.[state.username]?.specialPlayed,
  );

  const [selectedCard, selectCard] = useState(-1);
  const send = useGameStore((state) => state.send);

  if (kingUser !== username && jokerUser !== username) {
    return <JoinActions />;
  }
  if (gameEnd) {
    return <ActionButton type="primary" onClick={startNew} label="New game" />;
  }
  if (!kingUser || !jokerUser) {
    return (
      <Flex align="center" vertical gap={10}>
        <Typography.Title level={3}>Waiting for others...</Typography.Title>
      </Flex>
    );
  }

  return (
    <Flex align="center" vertical gap={10}>
      <Typography.Title level={3}>Your dice</Typography.Title>
      <Flex align="flex-end">
        {specialPlayed ? null : (
          <Card
            onClick={() => selectCard(9)}
            styles={{
              body: { padding: 20 },
            }}
            style={{
              marginBottom: selectedCard === 9 ? 15 : 0,
            }}
          >
            <img
              src={icons[username === kingUser ? "K" : "J"]}
              style={{ width: 30 }}
            />
          </Card>
        )}
        {Array(Math.max(normalCardAvailable, 0))
          .fill(0)
          .map((_, index) => (
            <Card
              onClick={() => selectCard(index)}
              styles={{
                body: { padding: 20 },
              }}
              style={{
                marginBottom: selectedCard === index ? 15 : 0,
              }}
            >
              <img src={icons["N"]} style={{ width: 30 }} />
            </Card>
          ))}
      </Flex>

      <ActionButton
        type="primary"
        onClick={() => {
          if (selectedCard === -1) {
            return;
          }
          send(selectedCard === 9);
          selectCard(-1);
        }}
        label="send"
      />
    </Flex>
  );
};

const JoinActions = () => {
  const kingUser = useGameStore((state) => state.gameData.kingUser);
  const jokerUser = useGameStore((state) => state.gameData.jokerUser);
  const join = useGameStore((state) => state.join);
  const forceJoin = useGameStore((state) => state.forceJoin);
  if (!kingUser || !jokerUser) {
    return (
      <Flex align="center" vertical gap={10}>
        <ActionButton type="primary" onClick={join} label="Join" />
      </Flex>
    );
  }
  return (
    <Flex align="center" vertical gap={10}>
      <ActionButton
        type="primary"
        onClick={() => forceJoin(true)}
        label="Replace King"
      />
      <ActionButton
        type="primary"
        onClick={() => forceJoin(false)}
        label="Replace Joker"
      />
    </Flex>
  );
};

export default App;

const useKingUserData = () =>
  useGameStore((state) =>
    state.gameData.kingUser
      ? state.gameData?.users?.[state.gameData.kingUser]
      : undefined,
  );
const useJokerUserData = () =>
  useGameStore((state) =>
    state.gameData.jokerUser
      ? state.gameData?.users?.[state.gameData.jokerUser]
      : undefined,
  );

const useGameEnd = () => {
  const kingData = useKingUserData();
  const jokerData = useJokerUserData();
  const users = [kingData, jokerData];

  const gameTurn =
    Math.min(...users.map((v) => v?.cardsPlayed?.length || 0)) - 1;

  const kingPlayed = users[0]?.cardsPlayed?.findIndex((v) => v === "K");
  const jokerPlayed = users[1]?.cardsPlayed?.findIndex((v) => v === "J");

  const gameEnd =
    kingPlayed !== undefined &&
    jokerPlayed !== undefined &&
    ((kingPlayed >= 0 && kingPlayed <= gameTurn) ||
      (jokerPlayed >= 0 && jokerPlayed <= gameTurn));

  return gameEnd;
};
