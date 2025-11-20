
import { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";


export type TokenPayload = JwtPayload & {
  id: number;
  email?: string;
  nome?: string;
  role?: "ADMIN" | "USER" | "CORRETOR";
};


declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email?: string; nome?: string; role?: "ADMIN" | "USER"| "CORRETOR"; };
    }
  }
}


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

    
    if (!decoded || typeof decoded !== "object" || !decoded.id) {
      return res.status(401).json({ error: "Token inválido" });
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      nome: decoded.nome,
      role: decoded.role,
    };

    return next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Token expirado" });
    }
    return res.status(401).json({ error: "Token inválido" });
  }
}

export function verifyTokenOptional(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const token = extractBearerToken(req.header("authorization"));

  // NENHUM token enviado → segue como visitante
  if (!token) {
    return next();
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET não definido");
    return next(); // Não quebra rota pública
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;

    if (decoded && typeof decoded === "object" && decoded.id) {
      req.user = {
        id: decoded.id,
        email: decoded.email,
        nome: decoded.nome,
        role: decoded.role,
      };
    }
  } catch {
    // Token inválido → simplesmente ignora
    console.warn("⚠ Token opcional ignorado (inválido ou expirado)");
  }

  return next();
}