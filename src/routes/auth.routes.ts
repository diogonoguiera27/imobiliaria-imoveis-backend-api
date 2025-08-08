import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sendEmail } from "../utils/sendEmail";

export const authRouter = Router();
const prisma = new PrismaClient();

// helpers
function generate6DigitCode() {
  return String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
}
const CODE_EXP_MIN = Number(process.env.RESET_CODE_EXP_MIN || 10);

// 1) Enviar código para o e-mail
authRouter.post("/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };

  if (!email) {
    return res.status(400).json({ error: "E-mail é obrigatório." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    // resposta genérica para não vazar existência do e-mail
    if (!user) {
      return res.json({ message: "Se houver conta, enviaremos um código." });
    }

    // invalida resets pendentes não usados (higiene)
    await prisma.passwordReset.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const code = generate6DigitCode();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + CODE_EXP_MIN * 60 * 1000);

    await prisma.passwordReset.create({
      data: {
        userId: user.id,
        codeHash,
        expiresAt,
      },
    });

    await sendEmail({
      to: email,
      subject: "Código para redefinição de senha",
      html: `
        <p>Seu código de verificação é:</p>
        <h2 style="font-size:22px;letter-spacing:2px">${code}</h2>
        <p>Ele expira em ${CODE_EXP_MIN} minutos.</p>
      `,
    });

    return res.json({ message: "Se houver conta, enviaremos um código." });
  } catch (error) {
    console.error("forgot-password error:", error);
    return res.status(500).json({ error: "Erro ao enviar código." });
  }
});

// 2) Verificar código
authRouter.post("/verify-reset-code", async (req, res) => {
  const { email, code } = req.body as { email?: string; code?: string };

  if (!email || !code) {
    return res.status(400).json({ error: "E-mail e código são obrigatórios." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(400).json({ error: "Código inválido." });
    }

    const reset = await prisma.passwordReset.findFirst({
      where: { userId: user.id, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!reset) {
      return res.status(400).json({ error: "Código inválido ou expirado." });
    }

    if (reset.expiresAt < new Date()) {
      return res.status(400).json({ error: "Código expirado." });
    }

    const ok = await bcrypt.compare(code, reset.codeHash);
    if (!ok) {
      return res.status(400).json({ error: "Código inválido." });
    }

    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { verifiedAt: new Date() },
    });

    return res.json({ message: "Código verificado com sucesso." });
  } catch (error) {
    console.error("verify-reset-code error:", error);
    return res.status(500).json({ error: "Erro ao verificar código." });
  }
});

// 3) Redefinir senha (requer código verificado)
authRouter.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body as { email?: string; newPassword?: string };

  if (!email || !newPassword) {
    return res.status(400).json({ error: "E-mail e nova senha são obrigatórios." });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: "Senha muito curta (mínimo 6)." });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const reset = await prisma.passwordReset.findFirst({
      where: { userId: user.id, verifiedAt: { not: null }, usedAt: null },
      orderBy: { createdAt: "desc" },
    });
    if (!reset) {
      return res.status(400).json({ error: "Nenhum código verificado encontrado." });
    }
    if (reset.expiresAt < new Date()) {
      return res.status(400).json({ error: "Código expirado." });
    }

    const senhaHash = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: { senha: senhaHash }, // campo do seu schema
    });

    await prisma.passwordReset.update({
      where: { id: reset.id },
      data: { usedAt: new Date() },
    });

    // higiene extra: apaga resets pendentes não usados
    await prisma.passwordReset.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    return res.json({ message: "Senha redefinida com sucesso." });
  } catch (error) {
    console.error("reset-password error:", error);
    return res.status(500).json({ error: "Erro ao redefinir senha." });
  }
});
