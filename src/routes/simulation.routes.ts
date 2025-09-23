// src/routes/simulation.routes.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/verifyToken";

export const simulationRouter = Router();
const prisma = new PrismaClient();

/**
 * ✅ Criar nova simulação
 * Retorna também o `uuid` gerado (mas o acesso continua via id interno)
 */
simulationRouter.post("/", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { title, entry, installments, installmentValue } = req.body;

  if (
    !title || typeof title !== "string" ||
    typeof entry !== "number" ||
    typeof installments !== "number" ||
    typeof installmentValue !== "number"
  ) {
    return res.status(400).json({
      error:
        "Dados inválidos. Esperado: { title: string, entry: number, installments: number, installmentValue: number }",
    });
  }

  try {
    const newSimulation = await prisma.simulation.create({
      data: {
        userId,
        title,
        entry,
        installments,
        installmentValue,
      },
      select: {
        id: true,              // id interno (uso no painel)
        uuid: true,            // uuid apenas para exibição, se necessário
        title: true,
        entry: true,
        installments: true,
        installmentValue: true,
        date: true,
      },
    });

    return res.status(201).json(newSimulation);
  } catch (error) {
    console.error("Erro ao salvar simulação:", error);
    return res.status(500).json({ error: "Erro ao salvar simulação" });
  }
});

/**
 * ✅ Listar simulações do usuário logado
 * - Suporta acessar por id numérico OU uuid do usuário
 * - Mas nunca expõe dados de outros usuários
 */
simulationRouter.get("/users/:idOrUuid/simulations", verifyToken, async (req, res) => {
  const { idOrUuid } = req.params;
  const loggedUserId = req.user.id;

  try {
    let userIdToFetch: number | null = null;

    // 🔎 Detecta automaticamente se é id numérico ou uuid
    if (/^\d+$/.test(idOrUuid)) {
      const requestedUserId = Number(idOrUuid);
      if (requestedUserId !== loggedUserId) {
        return res.status(403).json({ error: "Acesso negado." });
      }
      userIdToFetch = requestedUserId;
    } else {
      // 🔒 Caso seja uuid, validamos que é do usuário logado
      const user = await prisma.user.findUnique({
        where: { uuid: idOrUuid },
        select: { id: true },
      });

      if (!user || user.id !== loggedUserId) {
        return res.status(403).json({ error: "Acesso negado." });
      }
      userIdToFetch = user.id;
    }

    if (!userIdToFetch) {
      return res.status(400).json({ error: "Usuário inválido." });
    }

    const simulations = await prisma.simulation.findMany({
      where: { userId: userIdToFetch },
      orderBy: { date: "desc" },
      select: {
        id: true,              // id interno (para uso no painel)
        uuid: true,            // uuid opcional para exibição
        title: true,
        entry: true,
        installments: true,
        installmentValue: true,
        date: true,
      },
    });

    return res.json(simulations);
  } catch (error) {
    console.error("Erro ao buscar simulações:", error);
    return res.status(500).json({ error: "Erro ao buscar simulações" });
  }
});
