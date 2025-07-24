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

userRouter.post("/login", async (req, res) => {
  const { email, senha } = req.body;

  console.log("📩 [LOGIN] Requisição recebida:");
  console.log("📧 E-mail recebido:", email);
  console.log("🔐 Senha recebida:", senha);

  try {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      console.log("❌ [LOGIN] Usuário não encontrado com e-mail:", email);
      return res.status(404).json({ error: "Usuário não encontrado" });
    }

    console.log("✅ [LOGIN] Usuário encontrado:", {
      id: user.id,
      email: user.email,
    });

    const senhaCorreta = await bcrypt.compare(senha, user.senha);
    console.log("🔎 [LOGIN] Resultado da comparação de senha:", senhaCorreta);

    if (!senhaCorreta) {
      console.log("❌ [LOGIN] Senha incorreta para o usuário:", email);
      return res.status(401).json({ error: "Senha inválida" });
    }

    // Gerar token com payload
    const payload = { id: user.id, email: user.email };
    const secret = process.env.JWT_SECRET as string;
    const token = jwt.sign(payload, secret, { expiresIn: "2h" });

    console.log("🔐 [LOGIN] Token JWT gerado:", token);

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

    console.log("✅ [LOGIN] Resposta enviada com sucesso!");
  } catch (error) {
    console.error("🔥 [LOGIN] Erro interno no login:", error);
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

// ✏️ Atualizar usuário
userRouter.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const { nome, telefone, email, cidade, avatarUrl } = req.body;

  try {
    const usuarioAtualizado = await prisma.user.update({
      where: { id },
      data: {
        nome,
        telefone,
        email,
        cidade,
        ...(avatarUrl && { avatarUrl }),
      },
    });

    res.json(usuarioAtualizado);
  } catch (error) {
    console.error("Erro ao atualizar usuário:", error);
    res.status(500).json({ error: "Erro ao atualizar usuário" });
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

userRouter.put("/:id/email", verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const { newEmail, motivo } = req.body;

  try {
    // Verifica se o usuário do token é o mesmo da rota
    if (!req.user || req.user.id !== id) {
      return res.status(403).json({ error: "Acesso negado." });
    }

    // Validação do motivo
    if (!motivo || motivo.trim().length < 3) {
      return res.status(400).json({ error: "Motivo da alteração é obrigatório" });
    }

    // Atualiza o e-mail
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { email: newEmail },
    });

    res.json({ message: "Email alterado com sucesso", user: updatedUser });
  } catch (err) {
    res.status(500).json({ error: "Erro interno ao alterar email" });
  }
});



// Rota protegida com verifyToken
userRouter.put("/:id/password", verifyToken, async (req, res) => {
  const id = Number(req.params.id);
  const { currentPassword, newPassword } = req.body;

  try {
    // Verifica se o usuário do token é o mesmo da rota
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

