import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/verifyToken";

export const favoriteRouter = Router();
const prisma = new PrismaClient();

/* =========================================================
   🔹 Adicionar imóvel aos favoritos (ID ou UUID)
   ========================================================= */
favoriteRouter.post("/", verifyToken, async (req, res) => {
  const userId = req.user!.id;
  let { propertyUuid, propertyId } = req.body as {
    propertyUuid?: string;
    propertyId?: number;
  };

  try {
    if (typeof propertyUuid === "string") {
      propertyUuid = propertyUuid.trim().toLowerCase();

      if (
        propertyUuid === "" ||
        propertyUuid === "null" ||
        propertyUuid === "undefined" ||
        propertyUuid.length !== 36
      ) {
        propertyUuid = undefined;
      }
    }

    if (!propertyUuid && !propertyId) {
      
      return res.status(400).json({
        error: "Informe propertyUuid ou propertyId válido.",
      });
    }

    let property;

    if (propertyUuid) {
      property = await prisma.property.findUnique({
        where: { uuid: propertyUuid },
      });
    } else {
      property = await prisma.property.findUnique({
        where: { id: Number(propertyId) },
      });
    }

    if (!property) {
      return res.status(404).json({ error: "Imóvel não encontrado." });
    }

    const existing = await prisma.favorite.findFirst({
      where: { userId, propertyId: property.id },
    });
    
    if (existing) {
      
      return res.status(200).json(existing); 
    }

    const favorito = await prisma.favorite.create({
      data: { userId, propertyId: property.id },
      select: {
        id: true,
        uuid: true,
        propertyId: true,
      },
    });

    return res.status(201).json(favorito);
  } catch (error) {

    return res.status(500).json({
      error: "Erro ao adicionar favorito.",
    });
  }
});


favoriteRouter.delete("/:identifier", verifyToken, async (req, res) => {
  const userId = req.user!.id;
  const identifier = req.params.identifier;

  try {
    let propertyId: number | null = null;

    // 1️⃣ Se identifier é número → pode ser favoriteId ou propertyId
    if (/^\d+$/.test(identifier)) {
      const favId = Number(identifier);

      const fav = await prisma.favorite.findUnique({
        where: { id: favId },
        select: { propertyId: true },
      });

      if (fav) {
        propertyId = fav.propertyId;
      } else {
        propertyId = favId;
      }
    }

    // 2️⃣ Se for UUID do property
    else if (/^[0-9a-fA-F-]{36}$/.test(identifier)) {
      const property = await prisma.property.findUnique({
        where: { uuid: identifier },
        select: { id: true },
      });
      if (!property) {
        return res.status(404).json({ error: "Imóvel não encontrado." });
      }
      propertyId = property.id;
    }

    // 3️⃣ Identificador inválido
    else {
      return res.status(400).json({ error: "Identificador inválido." });
    }

    await prisma.favorite.deleteMany({
      where: { userId, propertyId },
    });

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ error: "Erro ao remover favorito." });
  }
});


favoriteRouter.get("/", verifyToken, async (req, res) => {
  const userId = req.user!.id;
  const page = parseInt(req.query.page as string) || 1;
  const take = parseInt(req.query.take as string) || 6;
  const skip = (page - 1) * take;

  try {
    const [favoritos, total] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId },
        skip,
        take,
        include: {
          property: {
            select: {
              id: true,
              uuid: true,
              endereco: true,
              bairro: true,
              cidade: true,
              tipo: true,
              tipoNegocio: true,
              preco: true,
              imagem: true,
              user: { select: { id: true, nome: true, email: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.favorite.count({ where: { userId } }),
    ]);

    return res.json({
      data: favoritos.map((f) => f.property),
      pagination: {
        total,
        page,
        take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    
    return res.status(500).json({ error: "Erro ao buscar favoritos." });
  }
});
