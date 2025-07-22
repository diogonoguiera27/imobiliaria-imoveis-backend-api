import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { uploadAvatar } from "../middlewares/upload";
import path from "path";
import { Request, Response } from "express";

export const userRouter = Router();
const prisma = new PrismaClient();

// Criar usuário
userRouter.post("/register", async (req, res) => {
  try {
    const { nome, telefone, email, senha, cidade } = req.body;
    const hashedPassword = await bcrypt.hash(senha, 10);
    const novo = await prisma.user.create({
      data: {
        nome,
        telefone,
        email,
        senha: hashedPassword,
        cidade,
      },
    });
    res.status(201).json(novo);
  } catch (error) {
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

// Login
userRouter.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const senhaCorreta = await bcrypt.compare(senha, user.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ error: "Senha inválida" });
    }

    // Gerar token JWT
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      process.env.JWT_SECRET as string,
      { expiresIn: "2h" }
    );

    res.json({
      message: "Login bem-sucedido",
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cidade: user.cidade,
        telefone: user.telefone,
        avatarUrl: user.avatarUrl, 
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    res.status(500).json({ error: "Erro no login" });
  }
});

// Listar usuários (admin)
userRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

// Deletar usuário
userRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Erro ao deletar usuário" });
  }
});

// Atualizar usuário
userRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { nome, telefone, email, cidade, avatarUrl } = req.body; // ✅ incluído aqui

  try {
    const usuarioAtualizado = await prisma.user.update({
      where: { id },
      data: {
        nome,
        telefone,
        email,
        cidade,
        ...(avatarUrl && { avatarUrl }), // ✅ opcionalmente atualiza se existir
      },
    });

    res.json(usuarioAtualizado);
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    res.status(500).json({ error: "Erro ao atualizar usuário" });
  }
});

interface MulterRequest extends Request {
  file: Express.Multer.File;
}

userRouter.post(
  "/upload/avatar/:id",
  uploadAvatar.single("avatar"),
  async (req: MulterRequest, res: Response) => {
    const id = Number(req.params.id);
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: "Arquivo de imagem não enviado." });
    }

    const avatarUrl = `/uploads/avatars/${file.filename}`;

    try {
      const user = await prisma.user.update({
        where: { id },
        data: { avatarUrl },
      });

      res.json({ avatarUrl }); // <- ✅ compatível com o frontend
    } catch (error) {
      console.error("Erro ao salvar avatar:", error);
      res.status(500).json({ error: "Erro ao atualizar avatar" });
    }
  }
);
