const USER_STATUS = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  AWAY: "AWAY",
};

const SOCKET_HANDLERS = {
  CHAT: {
    JoinRoom: "newChatRequestedRoom",
    NewMessage: "chatUpdate/message",
    TypingUpdate: "chatUpdate/typingStatus",
    NewRequest: "newChatRequest",
    NewRequest_Success: "newChatRequestSuccess",
    SeenUpdate: "newSeenUpdate",
    ClearAll: "removeAllMessages",
  },
  CONNECTION: {
    ConnectionData: "connectionsWithChat",
    RemoveConnection: "RemoveConnection",
    StatusUpdate: "lastSeenUpdate",
    PictureUpdate: "profilePicUpdate",
  },
};

const REGEXP = {
  email: /^[\w.!#$%&'*+/=?^_`{|}~-]+@[\w-]+(\.[\w-]+)+$/,
};

module.exports = { SOCKET_HANDLERS, REGEXP, USER_STATUS };
