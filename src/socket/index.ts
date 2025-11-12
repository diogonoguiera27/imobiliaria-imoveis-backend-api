// src/socket/index.ts
import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { registerChatHandlers } from "./chatSocket";

let io: Server;

export function setupWebSocket(
  server: HttpServer,
  config: {
    corsOptions: {
      origin: string;
      methods: string[];
      credentials: boolean;
      allowedHeaders: string[];
    };
  }
) {
  io = new Server(server, {
    cors: config.corsOptions, // ✅ Usa exatamente as mesmas opções do server.ts
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  io.on("connection", (socket) => {
    console.log(`🟢 Cliente conectado: ${socket.id}`);
    registerChatHandlers(io, socket);

    socket.on("disconnect", (reason) => {
      console.log(`🔴 Cliente desconectado: ${socket.id} (${reason})`);
    });

    socket.on("error", (err) => {
      console.error(`⚠️ Erro no socket ${socket.id}:`, err);
    });
  });

  console.log("📡 Servidor WebSocket configurado e ativo!");
}

export function getIO(): Server {
  if (!io) throw new Error("❌ Socket.IO não inicializado. Chame setupWebSocket primeiro.");
  return io;
}

export { io };
