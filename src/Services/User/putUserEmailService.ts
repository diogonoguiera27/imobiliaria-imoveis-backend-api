import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function updateUserEmailService(userId: number, newEmail: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { email: newEmail },
  });
}
