import { PrismaClient } from "@prisma/client";

export async function getAllUsersService(page: number, take: number) {
  const skip = (page - 1) * take;

  const prisma = new PrismaClient();

  const totalUsers = await prisma.user.count();

  const users = await prisma.user.findMany({
      skip,
      take,
      orderBy: {
        properties: {
          _count: "desc", // ✅ ordena pelo total de imóveis
        },
      },
      include: {
        _count: { select: { properties: true } },
      },
    });

  const formattedUsers = users.map((u) => ({
    id: u.id,
    nome: u.nome,
    email: u.email,
    cidade: u.cidade,
    telefone: u.telefone,
    avatarUrl: u.avatarUrl,
    createdAt: u.createdAt,
    role: u.role,
    quantidadeImoveis: u._count.properties,
  }));

  return {
    data: formattedUsers,
    pagination: {
      total: totalUsers,
      page,
      take,
      totalPages: Math.ceil(totalUsers / take),
    },
  };
}
