import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function getUserOverviewService(userId: number) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      nome: true,
      email: true,
      telefone: true,
      cidade: true,
      avatarUrl: true,
      createdAt: true,
      ultimoAcesso: true,
      role: true,
    },
  });

  if (!user) {
    throw new Error("NOT_FOUND");
  }

  const favoritosCount = await prisma.favorite.count({ where: { userId } });
  const simulations = await prisma.simulation.findMany({ where: { userId } });

  return { user, favoritosCount, simulations };
}
