import { Button, Card, Flex, Space, Typography } from "antd";
import { List } from "antd-mobile";
import { get, query, ref } from "firebase/database";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { database } from "../api/firebaseConfig";
import { GameStoreType } from "../api/gamestore";

const newRoomId = () => Math.random().toString(36).substring(2, 7);

const Home = () => {
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<{
    [id: string]: GameStoreType<object, object>;
  }>({});

  useEffect(() => {
    get(query(ref(database, "room/"))).then((snapshot) => {
      const data = (snapshot.val() || {}) as {
        [id: string]: GameStoreType<object, object>;
      };
      setRooms(data);
    });
  }, []);

  const sortedRooms = useMemo(
    () =>
      Object.entries(rooms)
        .map(([id, gameData]) => ({
          ...gameData,
          id,
        }))
        .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0)),
    [rooms],
  );

  return (
    <div className="page">
      <Flex vertical gap={14}>
        <div>
          <Typography.Title level={2} style={{ margin: 0 }}>
            jysim3 game rooms
          </Typography.Title>
          <Typography.Text className="page-subtitle">
            Quick little realtime multiplayer rooms (Dice + King Joker) powered by
            Firebase.
          </Typography.Text>
        </div>

        <Card styles={{ body: { padding: 14 } }}>
          <Flex vertical gap={10}>
            <Typography.Title level={4} style={{ margin: 0 }}>
              Start
            </Typography.Title>
            <Space wrap>
              <Button type="primary" onClick={() => navigate(`/app/dice/${newRoomId()}`)}>
                New Dice room
              </Button>
              <Button onClick={() => navigate(`/app/kingjoker/${newRoomId()}`)}>
                New King Joker room
              </Button>
              <Button onClick={() => navigate(`/app/roulette/${newRoomId()}`)}>
                New Roulette room
              </Button>
            </Space>
          </Flex>
        </Card>

        <Card styles={{ body: { padding: 14 } }}>
          <Flex vertical gap={10}>
            <Flex justify="space-between" align="center">
              <Typography.Title level={4} style={{ margin: 0 }}>
                Rooms
              </Typography.Title>
              <Button
                onClick={() =>
                  get(query(ref(database, "room/"))).then((snapshot) => {
                    const data = (snapshot.val() || {}) as {
                      [id: string]: GameStoreType<object, object>;
                    };
                    setRooms(data);
                  })
                }
              >
                Refresh
              </Button>
            </Flex>

            <List>
              {sortedRooms.length === 0 ? (
                <List.Item description="Create a new room to get started.">
                  No rooms yet
                </List.Item>
              ) : (
                sortedRooms.map((room) => (
                  <List.Item
                    key={room.id}
                    description={room.gameId}
                    onClick={() => navigate(`/app/${room.gameId}/${room.id}`)}
                  >
                    {room.id.toUpperCase()}
                  </List.Item>
                ))
              )}
            </List>
          </Flex>
        </Card>
      </Flex>
    </div>
  );
};

export default Home;
