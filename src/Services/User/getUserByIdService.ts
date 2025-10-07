// src/Services/User/getUserByIdService.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getUserByIdService(userId: number) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nome: true,
      email: true,
      cidade: true,
      telefone: true,
      avatarUrl: true,
      createdAt: true,
      ultimoAcesso: true,
      role: true,
    },
  });
}
