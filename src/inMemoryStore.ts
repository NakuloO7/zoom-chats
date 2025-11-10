import { randomUUID } from "node:crypto";

export type Chat = {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  message: string;
  upVotes: string[]; // userIds who upvoted
};

export class InMemoryStore {
  private chatsByRoom: Map<string, Map<string, Chat>>; // roomId -> chatId -> Chat

  constructor() {
    this.chatsByRoom = new Map();
  }

  addChat(userId: string, name: string, roomId: string, message: string): Chat {
    const id = randomUUID();
    const chat: Chat = { id, roomId, userId, name, message, upVotes: [] };
    if (!this.chatsByRoom.get(roomId)) {
      this.chatsByRoom.set(roomId, new Map());
    }
    this.chatsByRoom.get(roomId)!.set(id, chat);
    return chat;
  }

  upVote(userId: string, roomId: string, chatId: string): Chat | undefined {
    const room = this.chatsByRoom.get(roomId);
    if (!room) return;
    const chat = room.get(chatId);
    if (!chat) return;

    // toggle behavior: add if missing
    if (!chat.upVotes.includes(userId)) {
      chat.upVotes.push(userId);
    }
    return chat;
  }

  getChat(roomId: string, chatId: string) {
    return this.chatsByRoom.get(roomId)?.get(chatId);
  }

  getRoomChats(roomId: string) {
    return Array.from(this.chatsByRoom.get(roomId)?.values() ?? []);
  }
}