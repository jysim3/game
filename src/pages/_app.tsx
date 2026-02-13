import { EditOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Flex, Input, Space, Typography } from "antd";
import {
  Badge,
  ConfigProvider,
  Dialog,
  List,
  NavBar,
  Popup,
  setDefaultConfig,
} from "antd-mobile";
import enUS from "antd-mobile/es/locales/en-US";
import { get, query, ref, remove } from "firebase/database";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { database } from "../api/firebaseConfig";
import { GameStoreType } from "../api/gamestore";
import personLogo from "../assets/jysim.png";
import dieImages from "./app/dice/_assets";
import kingJokerImages from "./app/kingjoker/_assets";

type NicknameStore = {
  nickname: string;
  dirtyNickname: string;
  setNickname: (data: string) => void;
  setDirtyNickname: (data: string) => void;
  username: string;

  cancelDirtyNickname: () => void;
  confirmDirtyNickname: () => void;
};
const newUsername = () => {
  return Math.random().toString(36).substring(2, 15);
};

// eslint-disable-next-line
export const useNicknameStore = create<NicknameStore>()(
  persist(
    (set) => ({
      username: newUsername(),

      dirtyNickname: "",
      setDirtyNickname: (data: string) =>
        set((state) => ({ ...state, dirtyNickname: data })),

      cancelDirtyNickname: () =>
        set((state) => ({ ...state, dirtyNickname: state.nickname })),
      confirmDirtyNickname: () =>
        set((state) => ({
          ...state,
          nickname: state.dirtyNickname,
        })),

      nickname: "",
      setNickname: (data: string) =>
        set((state) => ({ ...state, nickname: data })),
    }),
    {
      name: "nameData", // name of the item in the storage (must be unique)
      storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
    },
  ),
);

const CLEANUP_EVERY_MS = 1000 * 60 * 60 * 24; // 24 hours
const CLEANUP_KEY = "jysim3:lastRoomCleanupMs";

const Layout = () => {
  const [visible, setVisible] = useState(false);

  const cancelDirtyNickname = useNicknameStore(
    (state) => state.cancelDirtyNickname,
  );
  const confirmDirtyNickname = useNicknameStore(
    (state) => state.confirmDirtyNickname,
  );
  const nickname = useNicknameStore((state) => state.nickname);

  // Client-side cleanup: wipe all rooms occasionally (single-user site).
  useEffect(() => {
    try {
      const last = Number(localStorage.getItem(CLEANUP_KEY) || "0");
      if (Date.now() - last > CLEANUP_EVERY_MS) {
        localStorage.setItem(CLEANUP_KEY, String(Date.now()));
        remove(ref(database, "room/"));
      }
    } catch {
      // Ignore cleanup failures; it's non-critical.
    }
  }, []);

  useEffect(() => {
    if (!nickname) {
      Dialog.confirm({
        content: <EditNickname />,
        onConfirm: () => confirmDirtyNickname(),
        onCancel: () => cancelDirtyNickname(),
      });
    }
  }, [nickname, cancelDirtyNickname, confirmDirtyNickname]);
  const location = useLocation();
  useEffect(() => {
    setVisible(false);
  }, [location]);

  setDefaultConfig({
    locale: enUS,
  });

  return (
    <ConfigProvider locale={enUS}>
      <div className="app-shell">
        <div className="app-card">
          <NavBar onBack={() => setVisible(true)} className="app-navbar">
            <Flex justify="center">
              <a
                href="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                target="_blank"
                rel="noreferrer"
              >
                <img src={personLogo} className="app-logo" alt="Person logo" />
              </a>
            </Flex>
          </NavBar>

          <Popup
            visible={visible}
            onMaskClick={() => {
              setVisible(false);
            }}
            position="left"
            bodyStyle={{ width: "60vw" }}
          >
            <NavContent />
          </Popup>

          {/* Allow child pages to own scrolling */}
          <div style={{ flex: 1, minHeight: 0 }}>
            <Outlet />
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

const NavContent = () => {
  const cancelDirtyNickname = useNicknameStore(
    (state) => state.cancelDirtyNickname,
  );
  const confirmDirtyNickname = useNicknameStore(
    (state) => state.confirmDirtyNickname,
  );

  const nickname = useNicknameStore((state) => state.nickname);

  const [rooms, setRooms] = useState<{
    [id: string]: GameStoreType<object, object>;
  }>({});
  const location = useLocation();
  const sortedRooms = Object.entries(rooms)
    .map(([id, gameData]) => ({
      ...gameData,
      id,
      active: location.pathname.includes(id),
    }))
    .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
  const navigate = useNavigate();
  useEffect(() => {
    get(query(ref(database, "room/"))).then((snapshot) => {
      const data = (snapshot.val() || {}) as {
        [id: string]: GameStoreType<object, object>;
      };
      setRooms(data);
    });
  }, []);

  return (
    <Flex vertical className="nav-drawer">
      <Typography.Title style={{ margin: 0, padding: "12px 10px" }}>
        jysim3.com
      </Typography.Title>
      <Typography.Title style={{ textAlign: "center", marginTop: 8 }} level={4}>
        Your name: {nickname}{" "}
        <Button
          type="primary"
          style={{ margin: 10 }}
          icon={<EditOutlined />}
          onClick={() =>
            Dialog.confirm({
              content: <EditNickname />,
              onConfirm: () => confirmDirtyNickname(),
              onCancel: () => cancelDirtyNickname(),
            })
          }
        />
      </Typography.Title>
      <Button
        icon={<ReloadOutlined />}
        style={{ margin: "8px 10px 10px" }}
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
      <GameSection
        rooms={sortedRooms}
        basePath="/app/dice"
        gameId="dice"
        label="Dice game"
        icon={dieImages[6]}
      />
      <GameSection
        rooms={sortedRooms}
        basePath="/app/kingjoker"
        gameId="kingjoker"
        label="King Joker"
        icon={kingJokerImages["K"]}
      />


      <Button
        type="primary"
        danger
        style={{ margin: 10 }}
        onClick={() =>
          Dialog.confirm({
            content: "Remove all rooms?",
            onConfirm: () => {
              remove(ref(database, "room/"));
              navigate("/");
            },
          })
        }
      >
        Clear rooms
      </Button>
    </Flex>
  );
};

const GameSection = ({
  gameId,
  label,
  icon,
  rooms,
  basePath,
}: {
  icon: string;
  label: string;
  gameId: string;
  basePath: string;
  rooms: (GameStoreType<object, object> & {
    gameId: string;
    active: boolean;
    id: string;
  })[];
}) => {
  const navigate = useNavigate();
  return (
    <List
      header={
        <Space>
          <img style={{ width: 30 }} src={icon} />
          {label}
        </Space>
      }
      mode="card"
    >
      <List.Item onClick={() => navigate(`${basePath}/`)}>Create new</List.Item>
      {rooms
        .filter(({ gameId: roomGameId }) => gameId === roomGameId)
        .map(({ id, active }: { id: string; active: boolean }) => (
          <List.Item onClick={() => navigate(`${basePath}/${id}`)} key={id}>
            {id.toUpperCase()}{" "}
            {active ? <Badge content="current" color="green" /> : null}
          </List.Item>
        ))}
    </List>
  );
};

const EditNickname = () => {
  const setDirtyNickname = useNicknameStore((state) => state.setDirtyNickname);
  const dirtyNickname = useNicknameStore((state) => state.dirtyNickname);
  return (
    <Flex vertical>
      <Typography.Title level={5}>Name</Typography.Title>
      <Input
        size="large"
        onChange={(e) => setDirtyNickname(e.target.value)}
        value={dirtyNickname}
      />
    </Flex>
  );
};
export default Layout;
