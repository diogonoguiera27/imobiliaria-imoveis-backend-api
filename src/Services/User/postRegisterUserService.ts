import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

interface PostRegisterUserInput {
  nome: string;
  telefone: string;
  email: string;
  senha: string;
  cidade: string;
}

export async function postRegisterUserService(input: PostRegisterUserInput) {
  const { nome, telefone, email, senha, cidade } = input;

  // verificar se já existe
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("EMAIL_IN_USE");
  }

  // gerar hash da senha
  const hashedPassword = await bcrypt.hash(senha, 10);

  const novo = await prisma.user.create({
    data: {
      nome,
      telefone,
      email,
      senha: hashedPassword,
      cidade,
      role: "USER", // sempre cria como USER
    },
  });

  // remover senha da resposta
  const { senha: _, ...userWithoutPassword } = novo;
  return userWithoutPassword;
}
