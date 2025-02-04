import {
  Unsubscribe,
  onValue,
  ref,
  serverTimestamp,
  set as setDatabase,
  update as updateDatabase,
} from "firebase/database";
import { StoreApi, create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { useNicknameStore } from "../pages/_app";
import { database } from "./firebaseConfig";

export type GameStoreType<T = object> = {
  username: string;
  roomId: string;
  lastUpdated: number;
  gameId: string;
  gameData: GameDataType<T>;
};

type GameDataType<T> = {
  status: string;
  round: number;
  users?: { [username: string]: T };
};

export type GameActions<UserGameDataType, GameSpecificActions> = {
  setUserData: (data: UserGameDataType) => void;
  updateGameData: (data: Partial<GameDataType<UserGameDataType>>) => void;
  subscribe: (roomId: string) => Unsubscribe;
} & GameSpecificActions;

export function createGameStore<UserGameDataType, GameSpecificActions>({
  gameId,
  initialData,
  actions,
}: {
  gameId: string;
  actions: (
    set: StoreApi<
      GameStoreType<UserGameDataType> &
        GameActions<UserGameDataType, GameSpecificActions>
    >["setState"],
    get: () => GameStoreType<UserGameDataType> &
      GameActions<UserGameDataType, GameSpecificActions>,
  ) => GameSpecificActions;
  initialData: GameDataType<UserGameDataType>;
}) {
  return create<
    GameStoreType<UserGameDataType> &
      GameActions<UserGameDataType, GameSpecificActions>
  >()(
    persist(
      (set, get) => ({
        gameData: initialData,

        gameId,
        lastUpdated: 0,

        username: useNicknameStore.getState().username,
        roomId: "",

        setUserData: (data) =>
          get().roomId
            ? setDatabase(
                ref(database, `room/${get().roomId}/users/` + get().username),
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
                initialData,
                gameId,
                lastUpdated: serverTimestamp(),
                round: 1
              });
              setDatabase(
                ref(database, `room/${roomId}/users/` + get().username),
                { round: 1 },
              );
            } else if (!data?.users?.[get().username]) {
              setDatabase(
                ref(database, `room/${roomId}/users/` + get().username),
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
            gameId,
            lastUpdated: serverTimestamp(),
          }),
        ...actions(set,get),
      }),
      {
        name: "gameData", // name of the item in the storage (must be unique)
        storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
      },
    ),
  );
}
