import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/verifyToken";

export const favoriteRouter = Router();
const prisma = new PrismaClient();

/**
 * POST /favorites
 * Adiciona um imóvel aos favoritos do usuário autenticado
 * Body: { propertyId: number }
 */
favoriteRouter.post("/", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const propertyId = Number(req.body.propertyId);

  if (!propertyId || isNaN(propertyId)) {
    return res.status(400).json({ error: "propertyId inválido ou ausente." });
  }

  try {
    const exists = await prisma.favorite.findFirst({
      where: { userId, propertyId },
    });

    if (exists) {
      return res.status(400).json({ message: "Imóvel já está nos favoritos" });
    }

    const favorito = await prisma.favorite.create({
      data: { userId, propertyId },
    });

    return res.status(201).json(favorito);
  } catch (error) {
    console.error("Erro ao adicionar favorito:", error);
    return res.status(500).json({ error: "Erro ao adicionar favorito" });
  }
});

/**
 * DELETE /favorites/:propertyId
 * Remove um imóvel dos favoritos do usuário
 */
favoriteRouter.delete("/:propertyId", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const propertyId = Number(req.params.propertyId);

  try {
    await prisma.favorite.deleteMany({
      where: { userId, propertyId },
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao remover favorito:", error);
    return res.status(500).json({ error: "Erro ao remover favorito" });
  }
});

/**
 * GET /favorites
 * Retorna os IDs dos imóveis favoritados pelo usuário
 */
favoriteRouter.get("/", verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const favoritos = await prisma.favorite.findMany({
      where: { userId },
      select: { propertyId: true },
    });

    const ids = favoritos.map((f) => f.propertyId);
    return res.json(ids);
  } catch (error) {
    console.error("Erro ao buscar favoritos:", error);
    return res.status(500).json({ error: "Erro ao buscar favoritos" });
  }
});
