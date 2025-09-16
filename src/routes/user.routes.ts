import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import path from "path";
import { uploadAvatar } from "../middlewares/upload";
import { verifyToken } from "../middlewares/verifyToken";

export const userRouter = Router();
const prisma = new PrismaClient();

userRouter.post("/register", async (req, res) => {
  try {
    const { nome, telefone, email, senha, cidade } = req.body;

    
    if (
      !nome || typeof nome !== "string" ||
      !email || typeof email !== "string" ||
      !senha || typeof senha !== "string" ||
      !cidade || typeof cidade !== "string" ||
      !telefone || typeof telefone !== "string"
    ) {
      return res.status(400).json({ error: "Dados inválidos ou incompletos." });
    }

    
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(400).json({ error: "Email já cadastrado." });
    }

    
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

    
    const { senha: _, ...userWithoutPassword } = novo;

    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    res.status(500).json({ error: "Erro ao criar usuário" });
  }
});

userRouter.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ error: "Email e senha são obrigatórios." });

  try {
    const emailNorm = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({ where: { email: emailNorm } });
    if (!user) return res.status(401).json({ error: "Credenciais inválidas." });

    const ok = await bcrypt.compare(senha, user.senha);
    if (!ok) return res.status(401).json({ error: "Credenciais inválidas." });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: "JWT_SECRET ausente" });

    const now = new Date();
    await prisma.user.update({ where: { id: user.id }, data: { ultimoAcesso: now } });

    
    const token = jwt.sign({ id: user.id, email: user.email }, secret, { expiresIn: "2h" });

    return res.json({
      message: "Login bem-sucedido",
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email,
        cidade: user.cidade,
        telefone: user.telefone,
        avatarUrl: user.avatarUrl,
        createdAt: user.createdAt,
        ultimoAcesso: now.toISOString(),
      },
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return res.status(500).json({ error: "Erro no login" });
  }
});



userRouter.get("/", verifyToken, async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nome: true,
        email: true,
        cidade: true,
        telefone: true,
        avatarUrl: true,
        createdAt: true,
      },
    });

    res.json(users);
  } catch (error) {
    
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});


userRouter.delete("/:id", verifyToken, async (req, res) => {
  const id = Number(req.params.id);

  
  if (!req.user || req.user.id !== id) {
    return res.status(403).json({ error: "Acesso negado." });
  }

  try {
    await prisma.user.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar usuário:", error);
    res.status(500).json({ error: "Erro ao deletar usuário" });
  }
});


interface MulterRequest extends Request {
  file: Express.Multer.File;
}

userRouter.post(
  "/upload/avatar/:id",
  verifyToken, 
  uploadAvatar.single("avatar"),
  async (req: MulterRequest, res: Response) => {
    const id = Number(req.params.id);
    const file = req.file;

    // Proteção de acesso
    if (!req.user || req.user.id !== id) {
      return res.status(403).json({ error: "Acesso negado." });
    }

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

    if (!newEmail || typeof newEmail !== "string" || !newEmail.includes("@")) {
      return res.status(400).json({ error: "Email novo inválido ou ausente." });
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

userRouter.put("/:id", verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const { nome, telefone, cidade, avatarUrl } = req.body;

  if (!req.user || req.user.id !== id) {
    return res.status(403).json({ error: "Acesso negado." });
  }

  
  if (
    (nome && typeof nome !== "string") ||
    (telefone && typeof telefone !== "string") ||
    (cidade && typeof cidade !== "string") ||
    (avatarUrl && typeof avatarUrl !== "string")
  ) {
    return res.status(400).json({ error: "Dados inválidos no corpo da requisição." });
  }

  
  const data: any = {};
  if (nome) data.nome = nome;
  if (telefone) data.telefone = telefone;
  if (cidade) data.cidade = cidade;
  if (avatarUrl) data.avatarUrl = avatarUrl;

  try {
    const updatedUser = await prisma.user.update({
      where: { id },
      data,
    });

    return res.status(200).json({ message: "Usuário atualizado", user: updatedUser });
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    return res.status(500).json({ error: "Erro interno ao atualizar usuário" });
  }
});




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
        createdAt: true,
        ultimoAcesso: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    const favoritosCount = await prisma.favorite.count({
      where: { userId },
    });

    const simulations = await prisma.simulation.findMany({
      where: { userId },
    });

    return res.status(200).json({
      user,
      favoritosCount,
      simulations, 
    });
  } catch (error) {
    console.error("Erro ao buscar overview:", error);
    return res.status(500).json({ error: "Erro ao carregar visão geral" });
  }
});


// 👇 Adicione logo após o POST /login, por exemplo
userRouter.get("/me", verifyToken, async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Não autenticado" });
    }

    const me = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nome: true,
        email: true,
        cidade: true,
        telefone: true,
        avatarUrl: true,
        createdAt: true,
        ultimoAcesso: true, 
      },
    });

    if (!me) {
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    return res.status(200).json(me);
  } catch (error) {
    console.error("GET /users/me error:", error);
    return res.status(500).json({ error: "Erro ao carregar perfil" });
  }
});


