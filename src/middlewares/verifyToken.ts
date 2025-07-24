import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Tipagem global para permitir req.user
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string }; // 🔒 Tipagem segura
    }
  }
}

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  // 🔒 Verifica se o header existe
  if (!authHeader) {
    console.warn("❌ Token não fornecido no header");
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const [bearer, token] = authHeader.split(" ");

  if (bearer !== "Bearer" || !token) {
    console.warn("❌ Token malformado ou ausente:", authHeader);
    return res.status(401).json({ error: "Formato de token inválido" });
  }

  try {
    // 🔐 Decodifica o token com tipagem segura
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secreto") as {
      id: number;
      email: string;
    };

    console.log("✅ Token decodificado com sucesso:", decoded);

    req.user = decoded;
    next();
  } catch (err) {
    console.error("❌ Erro ao verificar token:", err);
    return res.status(401).json({ error: "Token inválido" });
  }
}
