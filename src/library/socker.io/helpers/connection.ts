import { getConnectionsData, updateStatus } from "@controllers/account";
import { getChat } from "@controllers/chat";
import { SOCKET_HANDLERS, USER_STATUS } from "@utils/enums";
import { ObjectId } from "mongodb";
import { Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

export async function initialSocketAction(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>, loggedInUserId: string) {
  const connections = await getConnectionsData(loggedInUserId);
  const chatIds = Object.values(connections).map((chat) => new ObjectId((chat as { chat_id: string }).chat_id));
  const chatsArray = await getChat(chatIds);
  socket.emit(SOCKET_HANDLERS.CONNECTION.ConnectionData, {
    hasData: chatsArray.length > 0,
    chats: chatsArray,
    connections,
  });
  if (chatIds.length > 0) {
    socket.join(chatIds.map((chatId) => chatId.toString()));
  }
  socket.join(`${loggedInUserId}-req`); //New Request Room
}

export async function statusUpdateHandler(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  socket.on(SOCKET_HANDLERS.CONNECTION.StatusUpdate, (userId, { code, update_type }) => {
    if (!code || !update_type) return;
    if (socket.rooms.size > 2) {
      const roomIds = new Set(socket.rooms);
      roomIds.delete(`${userId}-req`);
      socket.to([...roomIds]).emit(SOCKET_HANDLERS.CONNECTION.StatusUpdate, userId, {
        code,
        lastActive: code === USER_STATUS.OFFLINE ? new Date().toISOString() : "",
      });
    }
    updateStatus(userId, { code, update_type });
  });
}
