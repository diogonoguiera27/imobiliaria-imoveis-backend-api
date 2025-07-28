import { Router, Request, Response } from "express";
import { PrismaClient } from "../../generated/prisma";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { uploadAvatar } from "../middlewares/upload";
import { verifyToken } from "../middlewares/verifyToken";

export const userRouter = Router();
const prisma = new PrismaClient();

// 📌 Criar usuário
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

// 🔐 Login
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

    const payload = { id: user.id, email: user.email };
    const secret = process.env.JWT_SECRET as string;
    const token = jwt.sign(payload, secret, { expiresIn: "2h" });

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

// 🔍 Listar usuários (admin)
userRouter.get("/", async (_req, res) => {
  const users = await prisma.user.findMany();
  res.json(users);
});

// 🗑️ Deletar usuário
userRouter.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);

  try {
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: "Erro ao deletar usuário" });
  }
});

// 📤 Upload de avatar
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
      await prisma.user.update({
        where: { id },
        data: { avatarUrl },
      });

      res.json({ avatarUrl });
    } catch (error) {
      console.error("Erro ao salvar avatar:", error);
      res.status(500).json({ error: "Erro ao atualizar avatar" });
    }
  }
);

// ✉️ Atualizar e-mail
userRouter.put("/:id/email", verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const { newEmail, motivo } = req.body;

  try {
    if (!req.user || req.user.id !== id) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    if (!motivo || motivo.trim().length < 3) {
      return res.status(400).json({ error: "Motivo da alteração é obrigatório" });
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: { email: newEmail },
    });

    res.json({ message: "Email alterado com sucesso", user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: "Erro interno ao alterar email" });
  }
});

// 🔒 Atualizar senha
userRouter.put("/:id/password", verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const { currentPassword, newPassword } = req.body;

  try {
    if (!req.user || req.user.id !== id) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: "Usuário não encontrado" });

    const isMatch = await bcrypt.compare(currentPassword, user.senha);
    if (!isMatch) {
      return res.status(401).json({ error: "Senha atual incorreta" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { senha: hashedNewPassword },
    });

    return res.status(200).json({ message: "Senha alterada com sucesso" });
  } catch (err) {
    console.error("Erro ao alterar senha:", err);
    return res.status(500).json({ error: "Erro interno ao alterar senha" });
  }
});

// ✅ 🔄 Atualizar dados do usuário (única rota correta)
userRouter.put("/:id", verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const { nome, telefone, cidade, avatarUrl } = req.body;

  if (!req.user || req.user.id !== id) {
    return res.status(403).json({ error: "Acesso negado." });
  }

  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        nome,
        telefone,
        cidade,
        avatarUrl,
      },
    });

    return res.status(200).json({ message: "Usuário atualizado", user: updatedUser });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return res.status(500).json({ error: "Erro interno ao atualizar usuário" });
  }
});



// GET /users/:id/overview → visão geral da conta
userRouter.get("/:id/overview", verifyToken, async (req, res) => {
  const userId = Number(req.params.id);

  if (!req.user || req.user.id !== userId) {
    return res.status(403).json({ error: "Acesso negado." });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nome: true,
        email: true,
        telefone: true,
        cidade: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const simulations = await prisma.simulation.findMany({
      where: { userId },
      select: {
        id: true,
        title: true,
        entry: true,
        installments: true,
        installmentValue: true,
        date: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    return res.status(200).json({
      user,
      simulations,
    });
  } catch (error) {
    console.error("Erro ao buscar overview:", error);
    return res.status(500).json({ error: "Erro ao carregar visão geral" });
  }
});
