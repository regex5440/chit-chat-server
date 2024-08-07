import { SOCKET_HANDLERS } from "@utils/enums";
import { Socket } from "socket.io";
import { DefaultEventsMap } from "socket.io/dist/typed-events";

export default async function RTCSignalingHandler(socket: Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) {
  socket.on(SOCKET_HANDLERS.RTC_SIGNALING.Offer, (chatId: string, desc) => {
    socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.Offer, desc);
  });
  socket.on(SOCKET_HANDLERS.RTC_SIGNALING.Answer, (chatId: string, msg: object) => {
    socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.Answer, msg);
  });
  socket.on(SOCKET_HANDLERS.RTC_SIGNALING.Candidate, (chatId: string, msg: object) => {
    socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.Candidate, msg);
  });
  socket.on(SOCKET_HANDLERS.RTC_SIGNALING.End, (chatId: string) => {
    socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.End);
  });
  socket.on(SOCKET_HANDLERS.RTC_SIGNALING.Reconnect, (chatId: string) => {
    socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.Reconnect);
  });
  socket.on(SOCKET_HANDLERS.RTC_SIGNALING.Reconnect_RESP, (chatId: string, userId: string) => {
    socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.Reconnect_RESP, userId);
  });
  socket.on(SOCKET_HANDLERS.RTC_SIGNALING.CallInitiator, (chatId: string, ...args) => {
    socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.CallInitiator, chatId, ...args);
  });
  socket.on(SOCKET_HANDLERS.RTC_SIGNALING.CallInitiator_RESP, (chatId: string, responseFromUserId: string) => {
    socket.broadcast.to(chatId).emit(SOCKET_HANDLERS.RTC_SIGNALING.CallInitiator_RESP, responseFromUserId);
  });
}
