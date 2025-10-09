import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

export async function updateUserProfileService(
  userId: number,
  data: Partial<Pick<User, "nome" | "telefone" | "cidade" | "avatarUrl">>
) {
  return prisma.user.update({
    where: { id: userId },
    data,
  });
}
