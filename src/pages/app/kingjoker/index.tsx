import { Navigate } from "react-router-dom";

const newRoomId = () => {
  return Math.random().toString(36).substring(2, 7);
};
const New = () => <Navigate to={`/app/kingjoker/${newRoomId()}`} />;
export default New;
