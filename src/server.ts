import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import http from "http";
import { PrismaClient } from "@prisma/client";
import { errors, isCelebrateError } from "celebrate";
import routes from "./routes";
import { setupWebSocket } from "./socket";

dotenv.config();

const app = express();
const prisma = new PrismaClient();

/* ============================================================
   🌐 CORS (Express + Socket.IO)
============================================================ */
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

const corsOptions = {
  origin: FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // 🔥 responde automaticamente pré-flight OPTIONS

/* ============================================================
   🧱 Arquivos estáticos
============================================================ */
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

/* ============================================================
   🧩 Middlewares principais
============================================================ */
app.use(express.json());
app.use(routes);
app.use(errors());

/* ============================================================
   🧪 Rota de teste simples
============================================================ */
app.get("/", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", FRONTEND_URL);
  res.send("✅ API funcionando com CORS!");
});

/* ============================================================
   ⚠️ Middleware global de tratamento de erros
============================================================ */
app.use((err: Error, req: Request, res: Response, _: NextFunction) => {
  if (isCelebrateError(err)) {
    const validationError =
      err.details.get("body") ||
      err.details.get("params") ||
      err.details.get("query");
    const message = validationError?.message || "Validation error";
    return res.status(400).json({ status: "error", message });
  }

  console.error("❌ Erro interno:", err);
  return res.status(500).json({ status: "error", message: "Internal server error" });
});

/* ============================================================
   ⚡ Criação do servidor HTTP + inicialização do WebSocket
============================================================ */
const server = http.createServer(app);

// Configura WebSocket com o mesmo CORS
setupWebSocket(server, {
  corsOptions: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  },
});

/* ============================================================
   🚀 Inicialização
============================================================ */
const PORT = process.env.PORT || 3333;
server.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
  console.log(`🌍 CORS liberado para: ${FRONTEND_URL}`);
});
