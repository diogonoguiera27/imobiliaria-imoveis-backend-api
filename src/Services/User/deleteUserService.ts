import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function deleteUserService(userId: number) {
  return prisma.user.delete({
    where: { id: userId },
  });
}
