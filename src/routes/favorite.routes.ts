// src/routes/favorite.routes.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/verifyToken";

export const favoriteRouter = Router();
const prisma = new PrismaClient();

/**
 * ➕ Adiciona imóvel aos favoritos
 * - Aceita `propertyUuid` (preferencial para front) ou `propertyId` (compatibilidade interna)
 * - Retorna também o `uuid` do favorite para eventual uso externo
 */
favoriteRouter.post("/", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const { propertyUuid, propertyId } = req.body as {
    propertyUuid?: string;
    propertyId?: number;
  };

  if (!propertyUuid && !propertyId) {
    return res
      .status(400)
      .json({ error: "Informe propertyUuid ou propertyId." });
  }

  try {
    // 🔎 Busca o imóvel pela chave recebida
    const property = propertyUuid
      ? await prisma.property.findUnique({ where: { uuid: propertyUuid } })
      : await prisma.property.findUnique({ where: { id: Number(propertyId) } });

    if (!property) {
      return res.status(404).json({ error: "Imóvel não encontrado." });
    }

    // ✅ Evita duplicidade
    const exists = await prisma.favorite.findFirst({
      where: { userId, propertyId: property.id },
    });
    if (exists) {
      return res
        .status(400)
        .json({ message: "Imóvel já está nos favoritos." });
    }

    const favorito = await prisma.favorite.create({
      data: { userId, propertyId: property.id },
      select: {
        id: true,
        uuid: true,      // uuid do registro de Favorite
        propertyId: true,
      },
    });

    return res.status(201).json(favorito);
  } catch (error) {
    console.error("Erro ao adicionar favorito:", error);
    return res.status(500).json({ error: "Erro ao adicionar favorito." });
  }
});

/**
 * ❌ Remove imóvel dos favoritos
 * - Aceita `propertyUuid` ou `propertyId` na URL
 * - Mantém busca interna pelo `id` real do Property
 */
favoriteRouter.delete("/:identifier", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const identifier = req.params.identifier;

  try {
    let propertyId: number | null = null;

    // UUID (formato padrão de 36 chars)
    if (/^[0-9a-fA-F-]{36}$/.test(identifier)) {
      const property = await prisma.property.findUnique({
        where: { uuid: identifier },
        select: { id: true },
      });
      if (!property)
        return res.status(404).json({ error: "Imóvel não encontrado." });
      propertyId = property.id;
    }
    // ID numérico
    else if (!isNaN(Number(identifier))) {
      propertyId = Number(identifier);
    } else {
      return res.status(400).json({ error: "Identificador inválido." });
    }

    await prisma.favorite.deleteMany({
      where: { userId, propertyId },
    });

    return res.status(204).send();
  } catch (error) {
    console.error("Erro ao remover favorito:", error);
    return res.status(500).json({ error: "Erro ao remover favorito." });
  }
});

/**
 * 📥 Lista favoritos do usuário logado
 * - Retorna **ambos**: `propertyId` (interno) e `propertyUuid` (público)
 * - Permite que o front use somente o UUID em URLs
 */
favoriteRouter.get("/", verifyToken, async (req, res) => {
  const userId = req.user.id;

  try {
    const favoritos = await prisma.favorite.findMany({
      where: { userId },
      include: {
        property: {
          select: {
            id: true,
            uuid: true, // ✅ UUID do imóvel para uso público
          },
        },
      },
    });

    const list = favoritos.map((f) => ({
      propertyId: f.property.id,
      propertyUuid: f.property.uuid,
    }));

    return res.json(list);
  } catch (error) {
    console.error("Erro ao buscar favoritos:", error);
    return res.status(500).json({ error: "Erro ao buscar favoritos." });
  }
});
