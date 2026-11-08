import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket && typeof window !== 'undefined') {
    const url = window.location.origin;
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
