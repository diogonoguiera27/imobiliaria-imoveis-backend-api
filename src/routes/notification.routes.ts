import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/verifyToken";
import { sendEmail } from "../utils/sendEmail";

export const notificationRouter = Router();
const prisma = new PrismaClient();

notificationRouter.post("/", verifyToken, async (req, res) => {
  const { tipo, porEmail, porPush } = req.body;
  const userId = req.user.id;

  if (
    typeof tipo !== "string" ||
    typeof porEmail !== "boolean" ||
    typeof porPush !== "boolean"
  ) {
    return res
      .status(400)
      .json({
        error:
          "Dados inválidos. Esperado: { tipo: string, porEmail: boolean, porPush: boolean }",
      });
  }

  try {
    const preferencia = await prisma.notificacaoPreferencia.upsert({
      where: { userId_tipo: { userId, tipo } },
      update: { porEmail, porPush, updatedAt: new Date() },
      create: { userId, tipo, porEmail, porPush },
    });

    if (porEmail) {
      const user = await prisma.user.findUnique({ where: { id: userId } });

      if (user?.email) {
        try {
          await sendEmail({
            to: user.email,
            subject: "Notificações ativadas",
            html: `<p>Você ativou notificações por e-mail para: <strong>${tipo}</strong></p>`,
          });
          console.log(`[EMAIL] Enviado para ${user.email}`);
        } catch (emailError) {
          console.error("Erro ao enviar e-mail:", emailError);
        }
      }
    }

    return res.status(200).json(preferencia);
  } catch (error) {
    console.error("Erro ao salvar preferências:", error);
    return res.status(500).json({ error: "Erro ao salvar preferências" });
  }
});

notificationRouter.get("/", verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const preferencias = await prisma.notificacaoPreferencia.findMany({
      where: { userId },
    });
    return res.status(200).json(preferencias);
  } catch (error) {
    console.error("Erro ao buscar preferências:", error);
    return res.status(500).json({ error: "Erro ao buscar preferências" });
  }
});
