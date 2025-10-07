
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/verifyToken";

export const simulationRouter = Router();
const prisma = new PrismaClient();


simulationRouter.post("/", verifyToken, async (req, res) => {
  const userId = req.user!.id;
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
        id: true,              
        uuid: true,            
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


simulationRouter.get("/users/:idOrUuid/simulations", verifyToken, async (req, res) => {
  const { idOrUuid } = req.params;
  const loggedUserId = req.user!.id;

  try {
    let userIdToFetch: number | null = null;

    
    if (/^\d+$/.test(idOrUuid)) {
      const requestedUserId = Number(idOrUuid);
      if (requestedUserId !== loggedUserId) {
        return res.status(403).json({ error: "Acesso negado." });
      }
      userIdToFetch = requestedUserId;
    } else {
      
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
        id: true,              
        uuid: true,            
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
