import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket && typeof window !== 'undefined') {
    const url = window.location.origin;
    socket = io(url, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[WebSocket Client] Conectado exitosamente al servidor de chat live. ID:', socket?.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[WebSocket Client] Error de conexión WebSocket:', err.message);
    });
  }
  return socket!;
}
