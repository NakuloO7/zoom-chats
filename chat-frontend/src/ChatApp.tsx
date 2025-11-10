import { useEffect, useMemo, useRef, useState } from "react";


export const InType = {
  joinRoom: "JOIN_ROOM",
  sendMessage: "SEND_MESSAGE",
  upVoteMessage: "UPVOTE_MESSAGE",
} as const;
export type InTypeValue = typeof InType[keyof typeof InType];

export const OutType = {
  AddChat: "ADD_CHAT",
  UpdateChat: "UPDATE_CHAT",
} as const;
export type OutTypeValue = typeof OutType[keyof typeof OutType];

// ------------------- Payload types -------------------
interface JoinRoomPayload {
  name: string;
  userId: string;
  roomId: string;
}
interface SendMessagePayload {
  userId: string;
  roomId: string;
  message: string;
}
interface UpvotePayload {
  userId: string;
  roomId: string;
  chatId: string;
}

interface AddChatPayload {
  chatId: string;
  roomId: string;
  message: string;
  name: string;
  upvotes: number;
}
interface UpdateChatPayload {
  chatId: string;
  roomId: string;
  upvotes: number;
}

// Discriminated union using the value object types
type IncomingFromServer =
  | { type: typeof OutType.AddChat; payload: AddChatPayload }
  | { type: typeof OutType.UpdateChat; payload: UpdateChatPayload };

interface ChatItem {
  chatId: string;
  roomId: string;
  name: string;
  message: string;
  upvotes: number;
  fromSelf?: boolean;
  ts: number;
}

function uid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return (crypto as any).randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export default function ChatApp() {
  // Connection and user identity
  const [serverUrl, setServerUrl] = useState("ws://localhost:3000");
  const [roomId, setRoomId] = useState("room-1");
  const [name, setName] = useState("");
  const [userId] = useState(uid);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Chat state
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [participants, setParticipants] = useState<string[]>([]);
  const [text, setText] = useState("");
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // Track which chats I've already upvoted (prevents double-press locally)
  const myVotesRef = useRef<Set<string>>(new Set());

  // Auto-scroll on new messages
  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [chats.length]);

  const canJoin = useMemo(
    () => !!serverUrl && !!roomId && !!name && !connected,
    [serverUrl, roomId, name, connected]
  );

  // Connect and join
  function join() {
    setError(null);
    wsRef.current?.close();

    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      const msg = {
        type: InType.joinRoom,
        payload: { name, userId, roomId } as JoinRoomPayload,
      };
      ws.send(JSON.stringify(msg));
    };

    ws.onmessage = (ev) => {
      try {
        const data: IncomingFromServer = JSON.parse(ev.data);
        if (data.type === OutType.AddChat) {
          const { chatId, roomId: r, message, name, upvotes } = data.payload;
          setChats((prev) => [
            ...prev,
            { chatId, roomId: r, message, name, upvotes, ts: Date.now() },
          ]);
          setParticipants((prev) =>
            prev.includes(name) ? prev : [...prev, name]
          );
        } else if (data.type === OutType.UpdateChat) {
          const { chatId, upvotes } = data.payload;
          setChats((prev) =>
            prev.map((c) => (c.chatId === chatId ? { ...c, upvotes } : c))
          );
          // If server reduced count (edge cases), free the local lock
          if (upvotes === 0) myVotesRef.current.delete(chatId);
        }
      } catch (e) {
        console.error("Bad message from server:", e);
      }
    };

    ws.onerror = (e: any) => {
      console.error("WebSocket error", e);
      setError(
        "WebSocket error: check the server URL and that the server is running."
      );
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };
  }

  function disconnect() {
    wsRef.current?.close();
  }

  // Send & Upvote
  function sendMessage() {
    const body = text.trim();
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    if (!body) return;

    const payload: SendMessagePayload = { userId, roomId, message: body };
    wsRef.current.send(JSON.stringify({ type: InType.sendMessage, payload }));

    // Let the server echo ADD_CHAT (include-sender broadcast on backend)
    // so we receive the real chatId. No optimistic add here.
    setText("");
  }

  function upvote(chatId: string) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

    // Optimistic UI: increment locally if I haven't already upvoted
    if (!myVotesRef.current.has(chatId)) {
      myVotesRef.current.add(chatId);
      setChats((prev) =>
        prev.map((c) =>
          c.chatId === chatId ? { ...c, upvotes: c.upvotes + 1 } : c
        )
      );
    }

    const payload: UpvotePayload = { userId, roomId, chatId };
    wsRef.current.send(JSON.stringify({ type: InType.upVoteMessage, payload }));
    // Server will broadcast UPDATE_CHAT; our UI will reconcile to the authoritative count.
  }

  // ------------------- UI -------------------
  return (
    <div className="min-h-screen w-full bg-gray-100 text-gray-900">
      {/* Centered content column */}
      <div className="max-w-3xl mx-auto px-4 py-8">
        <header className="flex items-center justify-between mb-5">
          <h1 className="text-3xl font-bold tracking-tight">Realtime Chat</h1>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-full ${
                connected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
              }`}
            >
              {connected ? "Connected" : "Disconnected"}
            </span>
            {connected && (
              <button
                onClick={disconnect}
                className="text-xs rounded-xl px-3 py-1 bg-gray-900 text-white hover:opacity-90"
              >
                Disconnect
              </button>
            )}
          </div>
        </header>

        {/* Connect + Participants */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Connect card */}
          <div className="md:col-span-2 bg-white shadow-sm rounded-2xl p-4">
            <h2 className="font-semibold mb-3">Connect</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm mb-1">WebSocket URL</label>
                <input
                  className="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="ws://localhost:8080"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm mb-1">Room ID</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value)}
                    placeholder="room-1"
                  />
                </div>
                <div>
                  <label className="block text-sm mb-1">Your name</label>
                  <input
                    className="w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Alice"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={join}
                  disabled={!canJoin}
                  className={`rounded-xl px-4 py-2 font-medium transition ${
                    canJoin
                      ? "bg-black text-white hover:opacity-90"
                      : "bg-gray-200 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {connected ? "Rejoin" : "Join room"}
                </button>
                <p className="text-xs text-gray-500">
                  userId: <span className="font-mono">{userId}</span>
                </p>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </div>

          {/* Participants card */}
          <div className="bg-white shadow-sm rounded-2xl p-4">
            <h2 className="font-semibold mb-2">Participants</h2>
            {participants.length === 0 ? (
              <div className="text-sm text-gray-500">No participants yet.</div>
            ) : (
              <ul className="text-sm space-y-1">
                {participants.map((p) => (
                  <li key={p} className="flex items-center gap-2">
                    <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Chat card */}
        <div className="bg-white shadow-sm rounded-2xl overflow-hidden">
          <div className="border-b p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-gray-500">Room</div>
              <div className="font-semibold">{roomId || "(not joined)"}</div>
            </div>
            <div className="text-xs text-gray-500">{new Date().toLocaleString()}</div>
          </div>

          <div ref={scrollerRef} className="h-[58vh] overflow-y-auto p-4 space-y-3 bg-gray-50">
            {chats.length === 0 && (
              <div className="text-center text-gray-400 text-sm">
                No messages yet. Say hi 👋
              </div>
            )}
            {chats.map((c) => {
              const iVoted = myVotesRef.current.has(c.chatId);
              return (
                <div
                  key={c.chatId}
                  className={`rounded-2xl border p-3 transition ${
                    c.upvotes >= 3 ? "bg-yellow-50 border-yellow-200" : "bg-white border-gray-200"
                  } ${c.fromSelf ? "ring-1 ring-blue-200" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium flex items-center gap-2">
                        <span className="truncate">
                          {c.name}
                          {c.fromSelf ? " (you)" : ""}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {new Date(c.ts).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="mt-1 text-gray-800 break-words">{c.message}</div>
                    </div>

                    {/* Upvote control */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => upvote(c.chatId)}
                        disabled={iVoted}
                        className={`h-9 w-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                          iVoted
                            ? "bg-blue-600 text-white border-2 border-blue-600 shadow-md"
                            : "bg-gray-50 border-2 border-gray-300 text-gray-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600 active:scale-95"
                        }`}
                        title={iVoted ? "You upvoted" : "Upvote"}
                        aria-label="Upvote"
                      >
                        {/* UP ARROW ICON */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          className="h-5 w-5"
                          fill={iVoted ? "currentColor" : "none"}
                          stroke="currentColor"
                          strokeWidth={iVoted ? "0" : "2.5"}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 5l-7 7h4v7h6v-7h4l-7-7z" />
                        </svg>
                      </button>
                      <span className={`inline-flex items-center justify-center min-w-8 px-2 h-9 rounded-xl border-2 text-sm font-medium ${
                        c.upvotes > 0 
                          ? "bg-blue-50 border-blue-200 text-blue-700" 
                          : "bg-white border-gray-200 text-gray-600"
                      }`}>
                        {c.upvotes}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t p-3 flex items-center gap-2 bg-white">
            <input
              className="flex-1 rounded-xl border px-3 py-2 focus:outline-none focus:ring"
              placeholder={connected ? "Type a message…" : "Join the room to chat"}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") sendMessage();
              }}
              disabled={!connected}
            />
            <button
              onClick={sendMessage}
              disabled={!connected || !text.trim()}
              className={`rounded-xl px-4 py-2 font-medium transition ${
                connected && text.trim()
                  ? "bg-black text-white hover:opacity-90"
                  : "bg-gray-200 text-gray-500 cursor-not-allowed"
              }`}
            >
              Send
            </button>
          </div>
        </div>

        <footer className="text-center text-xs text-gray-400 mt-4">
          Tip: open this page in a second tab with a different name to simulate another user.
        </footer>
      </div>
    </div>
  );
}