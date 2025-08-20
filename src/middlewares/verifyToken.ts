// src/middlewares/verifyToken.ts
import { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

/** Payload esperado (email/nome/tipo são opcionais) */
export type TokenPayload = JwtPayload & {
  id: number;
  email?: string;
  nome?: string;
  tipo?: string;
};

/** Augment do Express p/ habilitar req.user */
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email?: string; nome?: string; tipo?: string };
    }
  }
}

/** Extrai o token Bearer de forma resiliente */
function extractBearerToken(header?: string): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req.header("authorization"));
  if (!token) {
    return res.status(401).json({ error: "Token não fornecido" });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET não definido no ambiente");
    return res.status(500).json({ error: "JWT mal configurado" });
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;

    // sanity check mínimo: exigimos apenas 'id'
    if (!decoded || typeof decoded !== "object" || !decoded.id) {
      return res.status(401).json({ error: "Token inválido" });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      nome: decoded.nome,
      tipo: decoded.tipo,
    };

    return next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expirado" });
    }
    return res.status(401).json({ error: "Token inválido" });
  }
}
