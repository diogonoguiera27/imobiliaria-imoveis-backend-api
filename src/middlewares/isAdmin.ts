import { Request, Response, NextFunction } from "express";

export function isAdmin(req: Request, res: Response, next: NextFunction) {
  // Confere se o usuário logado existe e tem role = "ADMIN"
  if (!req.user || req.user.role !== "ADMIN") {
    return res
      .status(403)
      .json({ error: "Acesso restrito a administradores." });
  }

  next();
}
