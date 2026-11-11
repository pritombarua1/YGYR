import { useCallback, useEffect, useRef, useState } from "react";
import type { GameState, ServerMsg, Setup } from "./types";

// Empty in dev (Vite proxies /api). In production, set VITE_API_URL to the Worker's URL.
const API = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/$/, "");

export async function createGame(password: string, winners: number, setup: Setup): Promise<{ pin: string; hostKey: string }> {
  const res = await fetch(`${API}/api/create`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ password, winners, setup }),
  });
  if (res.status === 401) throw new Error("Wrong host password.");
  if (!res.ok) throw new Error("Could not create a game. Is the game server running?");
  return res.json();
}

function wsUrl(pin: string) {
  const base = API ? API.replace(/^http/, "ws") : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
  return `${base}/api/game/${pin}/ws`;
}

export const store = {
  get<T>(key: string): T | null {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown) {
    try {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // private mode etc. Not fatal.
    }
  },
};

/**
 * Keeps a WebSocket open to the game, reconnecting whenever it drops
 * (phone locked, Wi-Fi blip). `hello` is re-sent on every connect so the
 * server knows who we are and replies with the full current state.
 */
export function useGame(pin: string | null, hello: () => object, onMsg: (m: ServerMsg) => void) {
  const [state, setState] = useState<GameState | null>(null);
  const [online, setOnline] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const outbox = useRef<string[]>([]);
  const helloRef = useRef(hello);
  const onMsgRef = useRef(onMsg);
  helloRef.current = hello;
  onMsgRef.current = onMsg;

  useEffect(() => {
    if (!pin) return;
    outbox.current = []; // never carry taps over to a different game
    let stopped = false;
    let retry = 0;
    let retryTimer: number | undefined;
    let lastSeen = Date.now();

    const connect = () => {
      wsRef.current?.close();
      const ws = new WebSocket(wsUrl(pin));
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        lastSeen = Date.now();
        setOnline(true);
        ws.send(JSON.stringify(helloRef.current()));
        for (const m of outbox.current.splice(0)) ws.send(m);
      };
      ws.onmessage = (e) => {
        lastSeen = Date.now();
        if (e.data === "pong") return;
        const m = JSON.parse(e.data) as ServerMsg;
        if (m.t === "state") setState(m.state);
        if (m.t === "nogame") stopped = true;
        onMsgRef.current(m);
      };
      ws.onclose = () => {
        if (wsRef.current !== ws) return; // an older socket we already replaced
        setOnline(false);
        if (!stopped) retryTimer = window.setTimeout(connect, Math.min(500 * 2 ** retry++, 6000));
      };
    };

    // Ping every 15s; if nothing has come back for 40s the socket is dead, so start over.
    const heartbeat = window.setInterval(() => {
      const ws = wsRef.current;
      if (ws?.readyState === WebSocket.OPEN) ws.send("ping");
      if (!stopped && Date.now() - lastSeen > 40000) {
        lastSeen = Date.now();
        connect();
      }
    }, 15000);

    // Phones pause sockets when locked: reconnect straight away when they come back.
    const onWake = () => {
      if (document.visibilityState !== "visible" || stopped) return;
      const s = wsRef.current?.readyState;
      if (s !== WebSocket.OPEN && s !== WebSocket.CONNECTING) {
        // (a connection already on its way is left alone, or it would be cut off and restarted)
        clearTimeout(retryTimer);
        connect();
      }
    };
    document.addEventListener("visibilitychange", onWake);

    connect();
    return () => {
      stopped = true;
      clearTimeout(retryTimer);
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onWake);
      const ws = wsRef.current;
      wsRef.current = null;
      ws?.close();
    };
  }, [pin]);

  // Taps made while the connection is down are kept and sent as soon as it's back (after the hello).
  const send = useCallback((m: object) => {
    const ws = wsRef.current;
    if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(m));
    else if (outbox.current.length < 50) outbox.current.push(JSON.stringify(m));
  }, []);

  return { state, online, send };
}
