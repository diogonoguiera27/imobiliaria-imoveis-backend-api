import io from "socket.io-client";

// URL do servidor WebSocket
const socket = io("http://localhost:3333", {
  transports: ["websocket"], // força o uso direto do protocolo WS
});

// Evento: quando conectar com sucesso
socket.on("connect", () => {
  console.log(`🟢 Conectado ao servidor WebSocket com id: ${socket.id}`);
});

// Evento: quando desconectar
socket.on("disconnect", (reason: any) => {
  console.log(`🔴 Desconectado: ${reason}`);
});

// Evento: erro de conexão
socket.on("connect_error", (err: any) => {
  console.error("❌ Erro de conexão com servidor WebSocket:", err.message);
});

// Receber resposta do servidor
socket.on("server_reply", (data: any) => {
  console.log("📨 Resposta do servidor:", data);
});

// Enviar teste após conectar
setTimeout(() => {
  console.log("📤 Enviando mensagem de teste para o servidor...");
  socket.emit("test_message", { content: "Olá servidor, conexão funcionando!" });
}, 2000);
