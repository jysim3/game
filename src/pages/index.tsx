import { Navigate } from "react-router-dom";

const newRoomId = () => Math.random().toString(36).substring(2, 7);

const isAllowedRoomPath = (path: string) =>
  path.startsWith("/dice/") || path.startsWith("/kingjoker/");

const Home = () => {
  const lastRoomPath = sessionStorage.getItem("lastRoomPath");

  // If the user has a last visited room this session, take them back there.
  if (lastRoomPath && isAllowedRoomPath(lastRoomPath)) {
    return <Navigate to={lastRoomPath} replace />;
  }

  // Otherwise, drop them into a fresh room (default game: dice).
  return <Navigate to={`/dice/${newRoomId()}`} replace />;
};

export default Home;
