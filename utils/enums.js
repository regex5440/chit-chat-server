const SOCKET_HANDLERS = {
  CHAT: {
    NewMessage: "chatUpdate/message",
    TypingUpdate: "chatUpdate/typingStatus",
    NewRequest: "newChatRequest",
    NewRequest_Success: "newChatRequestSuccess",
    SeenUpdate: "newSeenUpdate",
  },
  CONNECTION_DATA: "connectionsData_from_socket",
};

const REGEXP = {
  email: /^[\w.!#$%&'*+/=?^_`{|}~-]+@[\w-]+(\.[\w-]+)+$/,
};

module.exports = { SOCKET_HANDLERS, REGEXP };
