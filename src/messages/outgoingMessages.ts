// What the server broadcasts to clients

export enum SupportedMessage {
  AddChat = "ADD_CHAT",
  UpdateChat = "UPDATE_CHAT"
}

export type AddChatPayload = {
  chatId: string;
  roomId: string;
  message: string;
  name: string;
  upvotes: number;
};

export type UpdateChatPayload = {
  chatId: string;
  roomId: string;
  upvotes: number;
};

export type OutgoingMessage =
  | { type: SupportedMessage.AddChat; payload: AddChatPayload }
  | { type: SupportedMessage.UpdateChat; payload: UpdateChatPayload };