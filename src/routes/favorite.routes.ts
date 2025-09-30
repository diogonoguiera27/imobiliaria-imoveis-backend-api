import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/verifyToken";

export const favoriteRouter = Router();
const prisma = new PrismaClient();

/* =========================================================
   🔹 Adicionar imóvel aos favoritos
   ========================================================= */
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
    const property = propertyUuid
      ? await prisma.property.findUnique({ where: { uuid: propertyUuid } })
      : await prisma.property.findUnique({ where: { id: Number(propertyId) } });

    if (!property) {
      return res.status(404).json({ error: "Imóvel não encontrado." });
    }

    // Verifica duplicado
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
        uuid: true,
        propertyId: true,
      },
    });

    return res.status(201).json(favorito);
  } catch (error) {
    console.error("Erro ao adicionar favorito:", error);
    return res.status(500).json({ error: "Erro ao adicionar favorito." });
  }
});

/* =========================================================
   🔹 Remover imóvel dos favoritos
   ========================================================= */
favoriteRouter.delete("/:identifier", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const identifier = req.params.identifier;

  try {
    let propertyId: number | null = null;

    // Se for UUID
    if (/^[0-9a-fA-F-]{36}$/.test(identifier)) {
      const property = await prisma.property.findUnique({
        where: { uuid: identifier },
        select: { id: true },
      });
      if (!property) {
        return res.status(404).json({ error: "Imóvel não encontrado." });
      }
      propertyId = property.id;
    }
    // Se for ID numérico
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

/* =========================================================
   🔹 Listar imóveis favoritos (com paginação)
   ========================================================= */
favoriteRouter.get("/", verifyToken, async (req, res) => {
  const userId = req.user.id;
  const page = parseInt(req.query.page as string) || 1;
  const take = parseInt(req.query.take as string) || 6; // padrão 6 por página
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
              user: {
                select: { id: true, nome: true, email: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.favorite.count({ where: { userId } }),
    ]);

    const list = favoritos.map((f) => f.property);

    return res.json({
      data: list,
      pagination: {
        total,
        page,
        take,
        totalPages: Math.ceil(total / take),
      },
    });
  } catch (error) {
    console.error("Erro ao buscar favoritos:", error);
    return res.status(500).json({ error: "Erro ao buscar favoritos." });
  }
});
