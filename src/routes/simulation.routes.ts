import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";
import { verifyToken } from "../middlewares/verifyToken";

export const simulationRouter = Router();
const prisma = new PrismaClient();


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
      error: "Dados inválidos. Esperado: { title: string, entry: number, installments: number, installmentValue: number }"
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
    });

    res.status(201).json(newSimulation);
  } catch (error) {
    console.error("Erro ao salvar simulação:", error);
    res.status(500).json({ error: "Erro ao salvar simulação" });
  }
});


simulationRouter.get("/users/:id/simulations", verifyToken, async (req, res) => {
  const requestedUserId = Number(req.params.id);
  const loggedUserId = req.user.id;

  if (!requestedUserId || requestedUserId !== loggedUserId) {
    return res.status(403).json({ error: "Acesso negado." });
  }

  try {
    const simulations = await prisma.simulation.findMany({
      where: { userId: requestedUserId },
      orderBy: { date: "desc" },
    });

    res.json(simulations);
  } catch (error) {
    console.error("Erro ao buscar simulações:", error);
    res.status(500).json({ error: "Erro ao buscar simulações" });
  }
});
