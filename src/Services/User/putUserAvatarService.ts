import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function updateUserAvatarService(userId: number, avatarUrl: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });
}
