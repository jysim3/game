
export type GameStoreType<T = object> = {
  userName: string;
  roomId: string;
  lastUpdated: number;
  gameId: string;
  gameData: {
    status?: string;
    round?: number;
    users?: { [username: string]: T };
  };
};
