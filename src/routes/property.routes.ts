// src/routes/property.routes.ts
import { Router, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/verifyToken";
import { z } from "zod";

export interface AuthRequest extends Request {
  user: {
    id: number;
    nome?: string;
    email: string;
    tipo?: string;
  };
}

export const propertyRouter = Router();
const prisma = new PrismaClient();

/* ------------------------- Validações (Zod) ------------------------- */
const createPropertySchema = z.object({
  imagem: z.string().url(),
  endereco: z.string().min(3),
  bairro: z.string().min(2),
  cidade: z.string().min(2),
  tipo: z.string().min(2),
  tipoNegocio: z.string().min(2),
  categoria: z.string().min(2),

  // números obrigatórios
  metragem: z.coerce.number().int().positive(),
  areaConstruida: z.coerce.number().int().positive(),
  quartos: z.coerce.number().int().min(0),
  suites: z.coerce.number().int().min(0),
  banheiros: z.coerce.number().int().min(0),
  vagas: z.coerce.number().int().min(0),
  preco: z.coerce.number().positive(),

  infoExtra: z.string().optional(),
  descricao: z.string().optional(),
});

const updatePropertySchema = createPropertySchema.partial();

function zodFieldErrors(err: z.ZodError) {
  // Retorna no formato { campo: ["mensagem"] } para o front mapear com setError(...)
  return err.flatten().fieldErrors;
}

/* ----------------------------- Rotas ----------------------------- */

// 📦 Buscar por lista de IDs
propertyRouter.post("/by-ids", async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Lista de IDs inválida ou vazia" });
  }

  try {
    const properties = await prisma.property.findMany({
      where: { id: { in: ids } },
    });
    res.json(properties);
  } catch (error) {
    console.error("Erro ao buscar imóveis por IDs:", error);
    res.status(500).json({ error: "Erro ao buscar imóveis" });
  }
});

// 🧭 Listar (com filtro por cidade)
propertyRouter.get("/", async (req, res) => {
  const { cidade } = req.query;

  try {
    let properties;

    if (cidade && typeof cidade === "string") {
      const propriedadesCidade = await prisma.property.findMany({
        where: { cidade: { equals: cidade, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
      });

      const outrasPropriedades = await prisma.property.findMany({
        where: { cidade: { not: cidade, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
      });

      properties = [...propriedadesCidade, ...outrasPropriedades];
    } else {
      properties = await prisma.property.findMany({
        orderBy: { createdAt: "desc" },
      });
    }

    res.json(properties);
  } catch (error) {
    console.error("Erro ao buscar imóveis:", error);
    res.status(500).json({ error: "Erro ao buscar imóveis" });
  }
});

// 🔐 Lista SOMENTE os imóveis do usuário autenticado
// ⚠️ IMPORTANTE: esta rota vem ANTES das rotas com :id
propertyRouter.get("/mine", verifyToken, async (req: AuthRequest, res) => {
  try {
    const list = await prisma.property.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json(list);
  } catch (err) {
    console.error("GET /property/mine error:", err);
    return res.status(500).json({ message: "Erro ao listar meus imóveis" });
  }
});

// 🔎 Buscar por ID (somente números)
propertyRouter.get("/:id(\\d+)", async (req, res) => {
  const id = Number(req.params.id);

  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return res.status(404).json({ error: "Imóvel não encontrado" });
    res.json(property);
  } catch (error) {
    console.error("Erro ao buscar imóvel:", error);
    res.status(500).json({ error: "Erro ao buscar imóvel" });
  }
});

// ➕ Criar (AUTENTICADO) -> valida e vincula ao usuário do token
propertyRouter.post("/", verifyToken, async (req: AuthRequest, res) => {
  try {
    const parsed = createPropertySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Dados inválidos", errors: zodFieldErrors(parsed.error) });
    }

    const data = parsed.data;

    const created = await prisma.property.create({
      data: {
        ...data,
        userId: req.user.id, // 🔗 vínculo ao usuário autenticado
      },
    });

    return res.status(201).json(created);
  } catch (error) {
    console.error("Erro ao criar imóvel:", error);
    return res.status(500).json({ message: "Erro ao criar imóvel" });
  }
});

// ✏️ Atualizar (AUTENTICADO) -> opcional: checa se é dono
propertyRouter.put("/:id(\\d+)", verifyToken, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);

  try {
    const parsed = updatePropertySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Dados inválidos", errors: zodFieldErrors(parsed.error) });
    }

    const exists = await prisma.property.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: "Imóvel não encontrado" });

    // se já houver owner e for diferente, bloqueia
    if (exists.userId && exists.userId !== req.user.id) {
      return res.status(403).json({ message: "Sem permissão para alterar este imóvel" });
    }

    const updated = await prisma.property.update({
      where: { id },
      data: parsed.data,
    });

    res.json(updated);
  } catch (error) {
    console.error("Erro ao atualizar imóvel:", error);
    res.status(500).json({ message: "Erro ao atualizar imóvel" });
  }
});

// 🗑️ Deletar (AUTENTICADO) -> opcional: checa se é dono
propertyRouter.delete("/:id(\\d+)", verifyToken, async (req: AuthRequest, res) => {
  const id = Number(req.params.id);

  try {
    const exists = await prisma.property.findUnique({ where: { id } });
    if (!exists) return res.status(404).json({ message: "Imóvel não encontrado" });

    if (exists.userId && exists.userId !== req.user.id) {
      return res.status(403).json({ message: "Sem permissão para deletar este imóvel" });
    }

    await prisma.property.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error("Erro ao deletar imóvel:", error);
    res.status(500).json({ message: "Erro ao deletar imóvel" });
  }
});
