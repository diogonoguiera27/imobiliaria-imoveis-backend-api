import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const prisma = new PrismaClient();

interface PostLoginInput {
  email: string;
  senha: string;
}

export async function postLoginUserService({ email, senha }: PostLoginInput) {
  const emailNorm = String(email).trim().toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const ok = await bcrypt.compare(senha, user.senha);
  if (!ok) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("MISSING_SECRET");
  }

  // Atualiza último acesso
  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { ultimoAcesso: now },
  });

  // Normaliza role (em maiúsculo)
  const role = user.role?.toUpperCase() || "USER";

  // Gera token JWT
  const token = jwt.sign(
    { id: user.id, email: user.email, role },
    secret,
    { expiresIn: "2h" }
  );

  // Retorna para o frontend
  return {
    message: `Login bem-sucedido como ${role}`,
    token,
    user: {
      id: user.id,
      nome: user.nome,
      email: user.email,
      cidade: user.cidade,
      telefone: user.telefone,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
      ultimoAcesso: now.toISOString(),
      role,
    },
  };
}
