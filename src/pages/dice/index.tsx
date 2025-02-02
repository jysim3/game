import { Navigate } from "react-router-dom";

const newRoomId = () => {
  return Math.random().toString(36).substring(2, 7);
};
const New = () => <Navigate to={`/dice/${newRoomId()}`} />;
export default New;
