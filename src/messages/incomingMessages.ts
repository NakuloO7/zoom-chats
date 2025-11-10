// What the server accepts from clients

export enum SupportedMessage {
  joinRoom = "JOIN_ROOM",
  sendMessage = "SEND_MESSAGE",
  upVoteMessage = "UPVOTE_MESSAGE",
}

export type JoinRoomPayload = {
  name: string;
  userId: string;
  roomId: string;
};

export type SendMessagePayload = {
  userId: string;
  roomId: string;
  message: string;
};

export type UpvoteMessagePayload = {
  userId: string;
  roomId: string;
  chatId: string;
};

export type IncomingMessage =
  | { type: SupportedMessage.joinRoom; payload: JoinRoomPayload }
  | { type: SupportedMessage.sendMessage; payload: SendMessagePayload }
  | { type: SupportedMessage.upVoteMessage; payload: UpvoteMessagePayload };