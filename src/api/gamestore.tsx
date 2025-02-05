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

export type GameStoreType<GameSpecificDataType, T> = {
  username: string;
  roomId: string;
  lastUpdated: number;
  gameId: string;
  gameData: GenericGameDataType<GameSpecificDataType, T>;
};

type GenericGameDataType<GameSpecificDataType, T> = {
  status: string;
  round: number;
  users?: { [username: string]: T };
} & GameSpecificDataType;

export type GameActions<
  GameSpecificDataType,
  UserGameDataType,
  GameSpecificActions,
> = {
  setUserData: (data: UserGameDataType) => void;
  updateUserData: (data: Partial<UserGameDataType>) => void;
  updateGameData: (
    data: Partial<GenericGameDataType<GameSpecificDataType, UserGameDataType>>,
  ) => void;
  subscribe: (roomId: string) => Unsubscribe;
} & GameSpecificActions;

export function createGameStore<
  GameSpecificDataType,
  UserGameDataType,
  GameSpecificActions,
>({
  gameId,
  initialData,
  actions,
}: {
  gameId: string;
  actions: (
    set: StoreApi<
      GameStoreType<GameSpecificDataType, UserGameDataType> &
        GameActions<GameSpecificDataType, UserGameDataType, GameSpecificActions>
    >["setState"],
    get: () => GameStoreType<GameSpecificDataType, UserGameDataType> &
      GameActions<GameSpecificDataType, UserGameDataType, GameSpecificActions>,
  ) => GameSpecificActions;
  initialData: GenericGameDataType<GameSpecificDataType, UserGameDataType>;
}) {
  return create<
    GameStoreType<GameSpecificDataType, UserGameDataType> &
      GameActions<GameSpecificDataType, UserGameDataType, GameSpecificActions>
  >()(
    persist(
      (set, get) => ({
        gameData: initialData,

        gameId,
        lastUpdated: 0,

        username: useNicknameStore.getState().username,
        roomId: "",

        updateUserData: (data) =>
          get().roomId
            ? updateDatabase(
                ref(database, `room/${get().roomId}/users/` + get().username),
                {
                  ...data,
                  nickname: useNicknameStore.getState().nickname,
                },
              )
            : null,
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
                ...initialData,
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
        ...actions(set, get),
      }),
      {
        name:gameId, // name of the item in the storage (must be unique)
        storage: createJSONStorage(() => sessionStorage), // (optional) by default, 'localStorage' is used
      },
    ),
  );
}
