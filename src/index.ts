import pkg from "websocket"; // CommonJS package: import default, then destructure value exports
import type { connection as WSConnection } from "websocket"; // <-- instance type, not typeof
import http from "http";

import {
  SupportedMessage as InType,
  type IncomingMessage,
} from "./messages/incomingMessages.js";

import {
  SupportedMessage as OutType,
  type OutgoingMessage,
} from "./messages/outgoingMessages.js";

import { UserManager } from "./UserManager.js";
import { InMemoryStore } from "./inMemoryStore.js";

const { server: WebSocketServer } = pkg;

const server = http.createServer((request: any, response: any) => {
  console.log(new Date(), "HTTP request for", request.url);
  response.writeHead(404);
  response.end();
});

const userManager = new UserManager();
const store = new InMemoryStore();

const PORT = 3000;
server.listen(PORT, () => {
  console.log(new Date(), `Server listening on :${PORT}`);
});

const wsServer = new WebSocketServer({
  httpServer: server,
  autoAcceptConnections: false,
});

function originIsAllowed(_origin: string) {
  // tighten for production
  return true;
}

wsServer.on("request", (request) => {
  if (!originIsAllowed(request.origin)) {
    request.reject();
    console.log(new Date(), "Rejected WS from", request.origin);
    return;
  }

  // Accept with `null` unless your client explicitly requests a subprotocol
  const conn = request.accept(null, request.origin);
  console.log(new Date(), "WebSocket accepted from", request.origin);

  conn.on("message", (message) => {
    if (message.type !== "utf8") return; // only handle text frames

    try {
      const parsed = JSON.parse(message.utf8Data as string);
      // TS now knows conn is an instance of `connection`
      messageRouter(conn, parsed);
    } catch (err) {
      console.error("Bad JSON from client:", err);
    }
  });

  conn.on("close", () => {
    userManager.removeConnection(conn);
    console.log(new Date(), "Peer disconnected");
  });
});

// ---- Message routing ----

function messageRouter(ws: WSConnection, message: IncomingMessage) {
  if (message.type === InType.joinRoom) {
    const { name, userId, roomId } = message.payload;
    userManager.addUser(name, userId, roomId, ws);
    return;
  }

  if (message.type === InType.sendMessage) {
    const { userId, roomId, message: body } = message.payload;
    const user = userManager.getUser(userId, roomId);
    if (!user) {
      console.error("User not found in room for SEND_MESSAGE");
      return;
    }

    const chat = store.addChat(userId, user.name, roomId, body);

    const outgoing: OutgoingMessage = {
      type: OutType.AddChat,
      payload: {
        chatId: chat.id,
        roomId,
        message: body,
        name: user.name,
        upvotes: 0,
      },
    };

    // broadcast to everyone EXCEPT sender
    userManager.broadcast(roomId, userId, outgoing);
    return;
  }

  if (message.type === InType.upVoteMessage) {
    const { userId, roomId, chatId } = message.payload;
    const chat = store.upVote(userId, roomId, chatId);
    if (!chat) return;

    const outgoing: OutgoingMessage = {
      type: OutType.UpdateChat,
      payload: {
        chatId,
        roomId,
        upvotes: chat.upVotes.length,
      },
    };

    // broadcast to everyone EXCEPT the upvoter
    userManager.broadcast(roomId, userId, outgoing);

    // optional milestones:
    // if (chat.upVotes.length === 3) { /* highlight logic */ }
    // if (chat.upVotes.length === 10) { /* admin alert logic */ }

    return;
  }
}