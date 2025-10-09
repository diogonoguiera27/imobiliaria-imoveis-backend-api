import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

export async function updateUserPasswordService(
  userId: number,
  currentPassword: string,
  newPassword: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("NOT_FOUND");
  }

  const isMatch = await bcrypt.compare(currentPassword, user.senha);
  if (!isMatch) {
    throw new Error("INVALID_PASSWORD");
  }

  const hashedNewPassword = await bcrypt.hash(newPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { senha: hashedNewPassword },
  });

  return true;
}
