import { Request, Response, NextFunction } from "express";


export function authorizeRoles(...allowedRoles: ("ADMIN" | "USER" | "CORRETOR")[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    if (!allowedRoles.includes(user.role as any)) {
      return res.status(403).json({ error: "Acesso negado para este tipo de usuário" });
    }

    next();
  };
}
