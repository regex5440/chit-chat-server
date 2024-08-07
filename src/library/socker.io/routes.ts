import { SOCKET_HANDLERS, USER_STATUS } from "@utils/enums";
import { getRData } from "../redis";
import authenticateSocket from "./auth";
import RTCSignalingHandler from "./helpers/call";
import {
  attachmentURLRequestHandler,
  chatActionHandler,
  chatRoomHandler,
  loadMoreMessagesRequestHandler,
  messageActionHandler,
  newMessageRequest_AcceptedHandler,
  newMessageRequestHandler,
  typingStatusHandler,
} from "./helpers/chat";
import { initialSocketAction, statusUpdateHandler } from "./helpers/connection";
import { updateStatus } from "@controllers/account";
import { Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

export default async function socketHandlers(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  // socket.onAny((event, ...rest) => {
  //   console.log("Socket Rooms:", socket.rooms, "\nevent:", event, "\nrest:", rest);
  // });
  const loggedInUserId = await authenticateSocket(socket);
  if (!loggedInUserId) {
    return;
  }

  initialSocketAction(socket, loggedInUserId);
  // Profile related socket handlers
  statusUpdateHandler(socket);

  // Chat Handlers
  chatRoomHandler(socket);
  chatActionHandler(socket);

  newMessageRequestHandler(socket);
  newMessageRequest_AcceptedHandler(socket);
  messageActionHandler(socket);

  typingStatusHandler(socket);
  loadMoreMessagesRequestHandler(socket);

  attachmentURLRequestHandler(socket);

  // RTC Signaling Handlers
  RTCSignalingHandler(socket);

  socket.on("disconnect", async (reason: string) => {
    const rData = await getRData(socket.handshake.headers.authorization?.split(" ")[1] || "");
    if (rData) {
      const parsedD = await JSON.parse(rData);
      socket
        .to(socket.rooms as any)
        .emit(SOCKET_HANDLERS.CONNECTION.StatusUpdate, (parsedD.id, { status: USER_STATUS.OFFLINE, last_active: new Date() }, reason));
      updateStatus(parsedD.id, {
        code: "OFFLINE",
        update_type: "auto",
      });
    }
  });
}
