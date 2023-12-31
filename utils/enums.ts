const USER_STATUS = {
  ONLINE: "ONLINE",
  OFFLINE: "OFFLINE",
  AWAY: "AWAY",
};

const SOCKET_HANDLERS = {
  CHAT: {
    JoinRoom: "newChatRequestedRoom",
    LeaveRoom: "leaveDeleteChatRoom",
    NewMessage: "chatUpdate/message",
    NewMessage_Failed: "chatUpdate/messageFailed",
    TypingUpdate: "chatUpdate/typingStatus",
    NewRequest: "newChatRequest",
    NewRequest_Success: "newChatRequestSuccess",
    NewRequest_Accepted: "newMessageRequestAccepted",
    NewRequest_Failed: "cannotSendRequest",
    SeenUpdate: "newSeenUpdate",
    ClearAll: "removeAllMessages",
    MESSAGE: {
      Delete: "deleteMessage",
      Edit: "editMessage",
    },
    AttachmentURL: "getSignedURL",
    LoadMore: "loadMoreMessages",
    MoreMessages: "moreMessageFromServer",
  },
  CONNECTION: {
    ConnectionData: "connectionsWithChat",
    RemoveConnection: "RemoveConnection",
    StatusUpdate: "lastSeenUpdate",
    PictureUpdate: "profilePicUpdate",
  },
  RTC_SIGNALING: {
    Offer: "Offer",
    Answer: "Answer",
    Candidate: "iceCandidate",
    End: "endRTCConnection",
    Reconnect: "reconnectionRequest",
    Reconnect_RESP: "reconnectionResponse",
    CallInitiator: "callInitiator",
    CallInitiator_RESP: "responseToCallInitiator",
  },
};

const REGEXP = {
  email: /^[\w.!#$%&'*+/=?^_`{|}~-]+@[\w-]+(\.[\w-]+)+$/,
};

export { SOCKET_HANDLERS, REGEXP, USER_STATUS };
