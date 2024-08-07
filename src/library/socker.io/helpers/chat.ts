import {
  addConnection,
  clearChatMessageCount,
  deleteChatConnections,
  getConnectionData,
  getProfileById,
  isUserRestricted,
  updateUnseenMsgCount,
} from "@controllers/account";
import {
  acceptMessageRequest,
  addMessage,
  deleteChat,
  deleteMessage,
  emptyChatMessages,
  getChat,
  getMessages,
  provideSignedURL,
  updateMessage,
  updateSeenMessages,
} from "@controllers/chat";
import { SOCKET_HANDLERS } from "@utils/enums";
import { removeDirectory } from "@lib/cloudflare";
import { Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { MessageObject, MessageUpdate } from "@types";

export async function attachmentURLRequestHandler(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  socket.on(SOCKET_HANDLERS.CHAT.AttachmentURL, async (chat_id: string, fileInfo: { name: string; size: number }[]) => {
    if (chat_id && fileInfo.length > 0) {
      const data = await provideSignedURL(chat_id, fileInfo);
      socket.emit(SOCKET_HANDLERS.CHAT.AttachmentURL, data);
    }
  });
}

export async function newMessageRequestHandler(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  socket.on(
    SOCKET_HANDLERS.CHAT.NewRequest,
    async ({ receiverId, messageObject }: { receiverId: string; messageObject: MessageObject & { tempId?: string } }) => {
      const senderId = messageObject.sender_id;
      const isBlocked = await isUserRestricted(senderId, receiverId);
      if (isBlocked) {
        socket.emit(SOCKET_HANDLERS.CHAT.NewRequest_Failed, "You can no longer message this contact");
        return;
      }
      delete messageObject.tempId;

      const { chat_id } = await addConnection(senderId, receiverId, messageObject);
      socket.join(chat_id.toString());
      if (chat_id) {
        const [chats, [profile1, profile2], senderConnectionData, receiverConnectionData] = await Promise.all(
          [
            getChat([chat_id]),
            getProfileById([senderId, receiverId]),
            getConnectionData(senderId, receiverId),
            getConnectionData(receiverId, senderId),
          ].filter(Boolean),
        );

        socket.emit(SOCKET_HANDLERS.CHAT.NewRequest_Success, {
          chat: chats[0],
          connectionProfile: {
            ...(profile1.id.toString() === senderId ? profile2 : profile1),
            ...senderConnectionData,
          },
        });
        socket.to(`${receiverId}-req`).emit(SOCKET_HANDLERS.CHAT.NewRequest_Success, {
          chat: chats[0],
          connectionProfile: {
            ...(profile1.id.toString() !== senderId ? profile2 : profile1),
            ...receiverConnectionData,
          },
        });
      }
    },
  );
}

export async function newMessageRequest_AcceptedHandler(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  socket.on(SOCKET_HANDLERS.CHAT.NewRequest_Accepted, async (chatId, fromId) => {
    await acceptMessageRequest(chatId, fromId);
    socket.to(chatId).emit(SOCKET_HANDLERS.CHAT.NewRequest_Accepted, chatId, fromId);
  });
}

export async function chatRoomHandler(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  socket.on(SOCKET_HANDLERS.CHAT.JoinRoom, (chatId) => {
    socket.join(chatId);
  });

  socket.on(SOCKET_HANDLERS.CHAT.LeaveRoom, (chat_id) => {
    socket.leave(chat_id);
  });
}

export async function typingStatusHandler(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  socket.on(SOCKET_HANDLERS.CHAT.TypingUpdate, (chat_id, author) => {
    if (chat_id && author) {
      socket.to(chat_id).emit(SOCKET_HANDLERS.CHAT.TypingUpdate, chat_id, author);
      /*
       * // TODO: It should be a throttling update from client.
       * Because if the user is just logged in and one of it's connections was typing then it won't be send to the logged in user. Because typing update was sent before they were logged in
       */
      // if (author.isTyping) {
      //   chatsCollection.updateOne(
      //     { _id: new ObjectId(chat_id) },
      //     { $addToSet: { authors_typing: new ObjectId(author.authorId) } }
      //   );
      // } else {
      //   chatsCollection.updateOne(
      //     { _id: new ObjectId(chat_id) },
      //     { $pull: { authors_typing: new ObjectId(author.authorId) } }
      //   );
      // }
    }
  });
}

export async function loadMoreMessagesRequestHandler(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  socket.on(SOCKET_HANDLERS.CHAT.LoadMore, async (chatId, { size = 50, dataCount = 0 }) => {
    const data = await getMessages(chatId, dataCount, size);
    socket.emit(SOCKET_HANDLERS.CHAT.MoreMessages, chatId, data);
  });
}

export async function messageActionHandler(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  socket.on(SOCKET_HANDLERS.CHAT.NewMessage, async ({ chat_id, receiverId, messageObject }) => {
    const currentTime = new Date();
    messageObject.timestamp = currentTime;
    messageObject.seenByRecipients = [];
    try {
      const messageTempId = messageObject.tempId;
      delete messageObject.tempId;
      const data = await Promise.all([addMessage(chat_id, messageObject), updateUnseenMsgCount(messageObject.sender_id, receiverId)]);
      socket.emit(SOCKET_HANDLERS.CHAT.NewMessage, chat_id, currentTime, { ...messageObject, id: data[0], tempId: messageTempId });
      socket.to(chat_id).emit(SOCKET_HANDLERS.CHAT.NewMessage, chat_id, currentTime, { ...messageObject, id: data[0], tempId: messageTempId });
    } catch (e) {
      console.log("MessageTransferFailed:", e);
      socket.emit(SOCKET_HANDLERS.CHAT.NewMessage_Failed, chat_id);
    }
  });

  socket.on(SOCKET_HANDLERS.CHAT.SeenUpdate, async (chat_id: string, seenByUserId: string, toReceiverId: string, messageId: string) => {
    await Promise.all([updateSeenMessages(chat_id, seenByUserId, messageId), updateUnseenMsgCount(toReceiverId, seenByUserId, false)]);
    socket.to(chat_id).emit(SOCKET_HANDLERS.CHAT.SeenUpdate, chat_id, seenByUserId, messageId);
  });

  socket.on(
    SOCKET_HANDLERS.CHAT.MESSAGE.Delete,
    async (
      { chatId, messageId, fromId, attachments }: { chatId: string; messageId: string; fromId: string; attachments: string[] },
      forAll = false,
    ) => {
      await deleteMessage(chatId, messageId, fromId, forAll, attachments); //assetKey for attachment message
      if (forAll) {
        socket.emit(SOCKET_HANDLERS.CHAT.MESSAGE.Delete, chatId, messageId);
        socket.to(chatId).emit(SOCKET_HANDLERS.CHAT.MESSAGE.Delete, chatId, messageId);
      }
    },
  );

  socket.on(SOCKET_HANDLERS.CHAT.MESSAGE.Edit, async (chat_id: string, messageId: string, update: MessageUpdate, fromId: string) => {
    await updateMessage(chat_id, messageId, update, fromId);
    socket.emit(SOCKET_HANDLERS.CHAT.MESSAGE.Edit, chat_id, messageId, update);
    socket.to(chat_id).emit(SOCKET_HANDLERS.CHAT.MESSAGE.Edit, chat_id, messageId, update);
  });
}

export async function chatActionHandler(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  socket.on(SOCKET_HANDLERS.CHAT.ClearAll, async ({ chatId, fromId, toId }) => {
    await Promise.all([clearChatMessageCount(fromId, toId), emptyChatMessages(chatId), removeDirectory(`chat_${chatId}`)]);
    socket.to(chatId).emit(SOCKET_HANDLERS.CHAT.ClearAll, chatId, fromId);
  });
  socket.on(SOCKET_HANDLERS.CONNECTION.RemoveConnection, async (chatId, { fromUserId, toUserId, toBlock }) => {
    await Promise.all([deleteChatConnections(fromUserId, toUserId, toBlock), deleteChat(chatId), removeDirectory(`chat_${chatId}`)]);
    socket.to(chatId).emit(SOCKET_HANDLERS.CONNECTION.RemoveConnection, fromUserId, chatId);
    socket.leave(chatId);
  });
}
