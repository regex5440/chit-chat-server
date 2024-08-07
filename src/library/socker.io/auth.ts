import { Socket } from "socket.io";
import { validateToken } from "../jwt";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

export default async function authenticateSocket(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  //TODO: Optimize Authorization if possible
  const authToken = socket.handshake.headers.authorization?.split(" ")[1] || "";
  try {
    if (authToken.length < 10) {
      throw new Error("Invalid Auth Token");
    }
    const data = await validateToken(authToken, "login");
    if (data) {
      return data.id;
    }
  } catch (e) {
    if (e) {
      socket.disconnect(true);
      return;
    }
  }
}
