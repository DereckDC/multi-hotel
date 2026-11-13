import { io, Socket } from "socket.io-client";
import { isNativeApp, PRODUCTION_ORIGIN } from "../utils/platform";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket && typeof window !== 'undefined') {
    // En la app nativa el origen es https://localhost y no hay servidor de sockets: se apunta a producción
    const url = isNativeApp() ? PRODUCTION_ORIGIN : window.location.origin;
    socket = io(url, {
      transports: ['polling', 'websocket'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 2000,
      timeout: 8000,
    });

    socket.on('connect', () => {
      // Clean connection
    });

    socket.on('connect_error', () => {
      // Gracefully silent connection fallback to avoid unhandled red errors in console
    });
  }
  return socket!;
}
