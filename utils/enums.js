const SOCKET_HANDLERS = {
  CHAT: {
    newMessage: "chatUpdate/message",
    typingStatusUpdate: "chatUpdate/typingStatus",
    newRequest: "newChatRequest",
    newRequstSuccess: "newChatRequestSuccess",
  },
};

const REGEXP = {
  email: /^[\w.!#$%&'*+/=?^_`{|}~-]+@[\w-]+(\.[\w-]+)+$/,
};

module.exports = { SOCKET_HANDLERS, REGEXP };
