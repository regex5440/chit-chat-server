const SOCKET_HANDLERS = {
  CHAT: {
    newMessage: "chatUpdate/message",
    typingStatusUpdate: "chatUpdate/typingStatus",
  },
};

const REGEXP = {
  email: /^[\w.!#$%&'*+/=?^_`{|}~-]+@[\w-]+(\.[\w-]+)+$/,
};

export { SOCKET_HANDLERS, REGEXP };
