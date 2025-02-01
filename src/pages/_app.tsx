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
import { get, query, ref } from "firebase/database";
import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { database } from "../api/firebaseConfig";
import { GameStoreType } from "../api/gamestore";
import personLogo from "../assets/jysim.png";
import dieImages from "./dice/_assets";

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

const Layout = () => {
  const [visible, setVisible] = useState(false);

  const cancelDirtyNickname = useNicknameStore(
    (state) => state.cancelDirtyNickname,
  );
  const confirmDirtyNickname = useNicknameStore(
    (state) => state.confirmDirtyNickname,
  );
  const nickname = useNicknameStore((state) => state.nickname);
  useEffect(() => {
    if (!nickname) {
      Dialog.confirm({
        content: <EditNickname />,
        onConfirm: () => confirmDirtyNickname(),
        onCancel: () => cancelDirtyNickname(),
      });
    }
  }, [nickname, cancelDirtyNickname, confirmDirtyNickname]);

  setDefaultConfig({
    locale: enUS,
  });

  return (
    <ConfigProvider locale={enUS}>
      <NavBar
        onBack={() => setVisible(true)}
        style={{ height: 60, margin: 15 }}
      >
        <Flex justify="center">
          <a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ" target="_blank">
            <img src={personLogo} style={{ width: 50 }} alt="Person logo" />
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
      <Outlet />
    </ConfigProvider>
  );
};

const NavContent = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [rooms, setRooms] = useState<{ [id: string]: GameStoreType }>({});
  const sortedRooms = Object.entries(rooms)
    .map(([id, gameData]) => ({
      ...gameData,
      id,
      active: location.pathname.includes(id),
    }))
    .sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
  const cancelDirtyNickname = useNicknameStore(
    (state) => state.cancelDirtyNickname,
  );
  const confirmDirtyNickname = useNicknameStore(
    (state) => state.confirmDirtyNickname,
  );

  const nickname = useNicknameStore((state) => state.nickname);

  useEffect(() => {
    get(query(ref(database, "room/"))).then((snapshot) => {
      const data = snapshot.val();
      setRooms(data);
    });
  }, []);

  return (
    <Flex vertical style={{ backgroundColor: "#eee" }}>
      <Typography.Title style={{ margin: 10 }}>jysim3.com</Typography.Title>
      <Typography.Title style={{ textAlign: "center" }} level={4}>
        Your name: {nickname}
      </Typography.Title>
      <Button
        type="primary"
        style={{ margin: 10 }}
        onClick={() =>
          Dialog.confirm({
            content: <EditNickname />,
            onConfirm: () => confirmDirtyNickname(),
            onCancel: () => cancelDirtyNickname(),
          })
        }
      >
        Edit name
      </Button>
      <List
        header={
          <Space>
            <img style={{ width: 30 }} src={dieImages[6]} />
            Dice game
          </Space>
        }
        mode="card"
      >
        <List.Item onClick={() => navigate("/dice/")}>Create new</List.Item>
        {sortedRooms
          .filter(({ gameId }) => gameId === "dice")
          .map(({ id, active }: { id: string; active: boolean }) => (
            <List.Item onClick={() => navigate(`/dice/${id}`)} key={id}>
              {id.toUpperCase()}{" "}
              {active ? <Badge content="current" color="green" /> : null}
            </List.Item>
          ))}
      </List>
    </Flex>
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
