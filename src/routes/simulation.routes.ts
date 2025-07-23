import { Router } from "express";
import { PrismaClient } from "../../generated/prisma";

export const simulationRouter = Router();
const prisma = new PrismaClient();

// Criar nova simulação
simulationRouter.post("/", async (req, res) => {
  const { userId, title, entry, installments, installmentValue } = req.body;

  if (!userId || !title || !entry || !installments || !installmentValue) {
    return res.status(400).json({ error: "Dados incompletos" });
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

// Listar simulações de um usuário
simulationRouter.get("/users/:id/simulations", async (req, res) => {
  const userId = Number(req.params.id);

  try {
    const simulations = await prisma.simulation.findMany({
      where: { userId },
      orderBy: { date: "desc" },
    });

    res.json(simulations);
  } catch (error) {
    console.error("Erro ao buscar simulações:", error);
    res.status(500).json({ error: "Erro ao buscar simulações" });
  }
});
