import type { connection as WSConnection } from "websocket";

export interface User {
  id: string;
  name: string;
  ws: WSConnection;
}

export interface Room {
  users: User[];
}

export class UserManager {
  private rooms: Map<string, Room>;

  constructor() {
    this.rooms = new Map<string, Room>();
  }

  addUser(name: string, userId: string, roomId: string, ws: WSConnection) {
    if (!this.rooms.get(roomId)) {
      this.rooms.set(roomId, { users: [] });
    }

    const room = this.rooms.get(roomId)!;

    // avoid duplicates by userId
    if (!room.users.find((u) => u.id === userId)) {
      room.users.push({ id: userId, name, ws });
    }
  }

  removeUser(userId: string, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.users = room.users.filter((u) => u.id !== userId);
    if (room.users.length === 0) {
      this.rooms.delete(roomId);
    }
  }

  getUser(userId: string, roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    return room.users.find((u) => u.id === userId);
  }

  // Broadcast to everyone in the room except (optional) senderId
  broadcast<T extends object>(roomId: string, senderId: string | null, payload: T) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const json = JSON.stringify(payload);
    for (const u of room.users) {
      if (senderId && u.id === senderId) continue;
      try {
        u.ws.sendUTF(json);
      } catch {
        // ignore send errors; optionally clean up here
      }
    }
  }

  // Remove a closed connection from any room it belonged to
  removeConnection(ws: WSConnection) {
    for (const [roomId, room] of this.rooms.entries()) {
      const before = room.users.length;
      room.users = room.users.filter((u) => u.ws !== ws);
      if (before !== room.users.length && room.users.length === 0) {
        this.rooms.delete(roomId);
      }
    }
  }
}