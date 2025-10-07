import "express";

declare global {
  namespace Express {
    interface UserPayload {
      id: number;
      email: string;
      nome?: string;
      role?: string;
    }

    interface Request {
      user?: UserPayload; // ✅ Agora todas as rotas reconhecem req.user
    }
  }
}

export {};
