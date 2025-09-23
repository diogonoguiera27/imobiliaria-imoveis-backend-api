// src/routes/property.routes.ts
import { Router, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/verifyToken";
import { z } from "zod";
import fs from "fs";
import multer from "multer";
import path from "path";

export interface AuthRequest extends Request {
  user: { id: number; nome?: string; email: string };
}

const prisma = new PrismaClient();

/* -------------------- Upload config -------------------- */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dest = path.join(process.cwd(), "uploads");
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  },
});
export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Formato inválido (use JPG, PNG ou WEBP)"));
    }
    cb(null, true);
  },
});

/* -------------------- Schemas -------------------- */
const baseSchema = z.object({
  imagem: z.string().min(1),
  endereco: z.string().min(3),
  bairro: z.string().min(2),
  cidade: z.string().min(2),
  tipo: z.string().min(2),
  tipoNegocio: z.string().min(2),
  categoria: z.string().min(2),
  metragem: z.coerce.number().int().positive(),
  areaConstruida: z.coerce.number().int().positive().optional(),
  quartos: z.coerce.number().int().min(0),
  suites: z.coerce.number().int().min(0).optional(),
  banheiros: z.coerce.number().int().min(0),
  vagas: z.coerce.number().int().min(0),
  preco: z.coerce.number().positive(),
  caracteristicas: z.array(z.string()).optional(),
  descricao: z.string().optional(),
});
const createSchema = baseSchema;
const updateSchema = baseSchema.partial();
const fieldErrors = (err: z.ZodError) => err.flatten().fieldErrors;

export const propertyRouter = Router();

/* =========================================================
   Buscar vários imóveis por IDs (numéricos) OU UUIDs
   ========================================================= */
propertyRouter.post("/by-ids", async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Lista de IDs inválida ou vazia" });
  }

  try {
    const numeric = ids.filter((v: any) => /^\d+$/.test(v)).map(Number);
    const uuids = ids.filter((v: any) => !/^\d+$/.test(v));

    const properties = await prisma.property.findMany({
      where: {
        OR: [
          numeric.length ? { id: { in: numeric } } : undefined,
          uuids.length ? { uuid: { in: uuids } } : undefined,
        ].filter(Boolean) as any,
      },
      include: {
        user: { select: { id: true, uuid: true, nome: true, telefone: true } },
      },
    });

    res.json(properties);
  } catch (err) {
    console.error("Erro /by-ids:", err);
    res.status(500).json({ error: "Erro ao buscar imóveis" });
  }
});

/* =========================================================
   Listagem geral (opcional filtro por cidade)
   ========================================================= */
propertyRouter.get("/", async (req, res) => {
  const { cidade } = req.query;

  try {
    const baseInclude = {
      user: { select: { id: true, uuid: true, nome: true, telefone: true } },
    };

    if (cidade && typeof cidade === "string") {
      const daCidade = await prisma.property.findMany({
        where: { cidade: { equals: cidade, mode: "insensitive" }, ativo: true },
        orderBy: { createdAt: "desc" },
        include: baseInclude,
      });
      const outras = await prisma.property.findMany({
        where: { cidade: { not: cidade, mode: "insensitive" }, ativo: true },
        orderBy: { createdAt: "desc" },
        include: baseInclude,
      });
      return res.json([...daCidade, ...outras]);
    }

    const all = await prisma.property.findMany({
      where: { ativo: true },
      orderBy: { createdAt: "desc" },
      include: baseInclude,
    });
    res.json(all);
  } catch (err) {
    console.error("Erro GET /property:", err);
    res.status(500).json({ error: "Erro ao buscar imóveis" });
  }
});

/* =========================================================
   Meus imóveis
   ========================================================= */
propertyRouter.get("/mine", verifyToken, async (req: AuthRequest, res) => {
  try {
    const list = await prisma.property.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, uuid: true, nome: true, telefone: true } },
      },
    });
    res.json(list);
  } catch (err) {
    console.error("Erro /mine:", err);
    res.status(500).json({ error: "Erro ao listar meus imóveis" });
  }
});

/* =========================================================
   Imóveis similares (aceita id ou uuid)
   ========================================================= */
propertyRouter.get("/similares/:identifier", async (req, res) => {
  const { identifier } = req.params;
  try {
    const whereUnique = /^\d+$/.test(identifier)
      ? { id: Number(identifier) }
      : { uuid: identifier };

    const current = await prisma.property.findUnique({ where: whereUnique });
    if (!current) return res.status(404).json({ error: "Imóvel não encontrado" });

    let similares = await prisma.property.findMany({
      where: {
        id: { not: current.id },
        cidade: current.cidade,
        tipo: current.tipo,
        ativo: true,
        preco: { gte: current.preco * 0.5, lte: current.preco * 1.5 },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: {
        user: { select: { id: true, uuid: true, nome: true, telefone: true } },
      },
    });

    if (similares.length < 4) {
      similares = await prisma.property.findMany({
        where: {
          id: { not: current.id },
          cidade: current.cidade,
          tipo: current.tipo,
          ativo: true,
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: {
          user: { select: { id: true, uuid: true, nome: true, telefone: true } },
        },
      });
    }

    res.json(similares);
  } catch (err) {
    console.error("Erro /similares:", err);
    res.status(500).json({ error: "Erro ao buscar similares" });
  }
});

/* =========================================================
   Buscar imóvel único (aceita id ou uuid)
   ========================================================= */
propertyRouter.get("/:identifier", async (req, res) => {
  const { identifier } = req.params;
  const whereUnique = /^\d+$/.test(identifier)
    ? { id: Number(identifier) }
    : { uuid: identifier };

  try {
    const imovel = await prisma.property.findUnique({
      where: whereUnique,
      include: {
        user: { select: { id: true, uuid: true, nome: true, telefone: true } },
      },
    });
    if (!imovel || !imovel.ativo)
      return res.status(404).json({ error: "Imóvel não encontrado" });

    res.json(imovel);
  } catch (err) {
    console.error("Erro /:identifier:", err);
    res.status(500).json({ error: "Erro ao buscar imóvel" });
  }
});

/* =========================================================
   Criar imóvel (retorna id e uuid)
   ========================================================= */
propertyRouter.post(
  "/",
  verifyToken,
  upload.single("imagem"),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file)
        return res.status(400).json({ message: "Imagem é obrigatória" });

      let caracteristicas: string[] | undefined;
      if (req.body.caracteristicas) {
        try {
          const arr = JSON.parse(req.body.caracteristicas);
          if (!Array.isArray(arr) || !arr.every((c) => typeof c === "string"))
            throw new Error();
          caracteristicas = arr;
        } catch {
          return res.status(400).json({
            message: "Campo 'caracteristicas' deve ser um array JSON válido",
          });
        }
      }

      const parsed = createSchema.safeParse({
        ...req.body,
        caracteristicas,
        imagem: `/uploads/${req.file.filename}`,
      });
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Dados inválidos", errors: fieldErrors(parsed.error) });
      }

      const created = await prisma.property.create({
        data: { ...parsed.data, userId: req.user.id },
        select: { id: true, uuid: true, ...Object.fromEntries(Object.keys(parsed.data).map(k => [k, true])) },
      });

      res.status(201).json(created);
    } catch (err) {
      console.error("Erro ao criar imóvel:", err);
      res.status(500).json({ message: "Erro ao criar imóvel" });
    }
  }
);

/* =========================================================
   Atualizar imóvel (aceita id ou uuid)
   ========================================================= */
propertyRouter.put(
  "/:identifier",
  verifyToken,
  upload.single("imagem"),
  async (req: AuthRequest, res) => {
    const { identifier } = req.params;
    const whereUnique = /^\d+$/.test(identifier)
      ? { id: Number(identifier) }
      : { uuid: identifier };

    try {
      const property = await prisma.property.findUnique({ where: whereUnique });
      if (!property) return res.status(404).json({ message: "Imóvel não encontrado" });
      if (property.userId !== req.user.id)
        return res.status(403).json({ message: "Sem permissão" });

      let caracteristicas: string[] | undefined;
      if (req.body.caracteristicas) {
        try {
          const arr = JSON.parse(req.body.caracteristicas);
          if (!Array.isArray(arr) || !arr.every((c) => typeof c === "string"))
            throw new Error();
          caracteristicas = arr;
        } catch {
          return res.status(400).json({
            message: "Campo 'caracteristicas' deve ser um array JSON válido",
          });
        }
      }

      const imagem = req.file ? `/uploads/${req.file.filename}` : property.imagem;

      const parsed = updateSchema.safeParse({
        ...req.body,
        caracteristicas,
        imagem,
      });
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Dados inválidos", errors: fieldErrors(parsed.error) });
      }

      const updated = await prisma.property.update({
        where: whereUnique,
        data: parsed.data,
        select: { id: true, uuid: true, ...Object.fromEntries(Object.keys(parsed.data).map(k => [k, true])) },
      });

      res.json(updated);
    } catch (err) {
      console.error("Erro ao atualizar imóvel:", err);
      res.status(500).json({ message: "Erro ao atualizar imóvel" });
    }
  }
);

/* =========================================================
   Alterar status ativo/inativo (aceita id ou uuid)
   ========================================================= */
propertyRouter.patch("/:identifier/ativo", verifyToken, async (req: AuthRequest, res) => {
  const { identifier } = req.params;
  const { ativo } = req.body as { ativo?: boolean };

  if (typeof ativo !== "boolean")
    return res.status(400).json({ error: "Campo 'ativo' é obrigatório e boolean" });

  const whereUnique = /^\d+$/.test(identifier)
    ? { id: Number(identifier) }
    : { uuid: identifier };

  try {
    const property = await prisma.property.findFirst({
      where: { ...whereUnique, userId: req.user.id },
    });
    if (!property) return res.status(404).json({ error: "Imóvel não encontrado" });

    const updated = await prisma.property.update({
      where: whereUnique,
      data: { ativo },
      select: { id: true, uuid: true, ativo: true },
    });

    res.json(updated);
  } catch (err) {
    console.error("Erro PATCH /ativo:", err);
    res.status(500).json({ error: "Erro ao atualizar status" });
  }
});

/* =========================================================
   Registrar visualização (aceita id ou uuid)
   ========================================================= */
propertyRouter.post("/:identifier/view", async (req: AuthRequest, res) => {
  const { identifier } = req.params;
  const userId = req.user?.id ?? null;

  try {
    const property = await prisma.property.findUnique({
      where: /^\d+$/.test(identifier) ? { id: Number(identifier) } : { uuid: identifier },
    });
    if (!property) return res.status(404).json({ error: "Imóvel não encontrado" });

    const recent = await prisma.propertyView.findFirst({
      where: {
        propertyId: property.id,
        userId,
        viewedAt: { gte: new Date(Date.now() - 2000) },
      },
    });

    if (!recent) {
      await prisma.propertyView.create({ data: { propertyId: property.id, userId } });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Erro /view:", err);
    res.status(500).json({ error: "Erro ao registrar visualização" });
  }
});

/* =========================================================
   Registrar contato (aceita id ou uuid)
   ========================================================= */
propertyRouter.post("/:identifier/contact", async (req: AuthRequest, res) => {
  const { identifier } = req.params;
  const userId = req.user?.id ?? null;
  const { nome, email, telefone, mensagem } = req.body;

  try {
    const property = await prisma.property.findUnique({
      where: /^\d+$/.test(identifier) ? { id: Number(identifier) } : { uuid: identifier },
    });
    if (!property || !property.ativo)
      return res.status(404).json({ error: "Imóvel não encontrado ou inativo" });

    await prisma.propertyContact.create({
      data: { propertyId: property.id, userId, nome, email, telefone, mensagem },
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Erro /contact:", err);
    res.status(500).json({ error: "Erro ao registrar contato" });
  }
});

/* =========================================================
   Exclusão lógica (aceita id ou uuid)
   ========================================================= */
propertyRouter.delete("/:identifier", verifyToken, async (req: AuthRequest, res) => {
  const { identifier } = req.params;
  const whereUnique = /^\d+$/.test(identifier)
    ? { id: Number(identifier) }
    : { uuid: identifier };

  try {
    const property = await prisma.property.findUnique({ where: whereUnique });
    if (!property) return res.status(404).json({ message: "Imóvel não encontrado" });
    if (property.userId !== req.user.id)
      return res.status(403).json({ message: "Sem permissão" });

    await prisma.property.update({ where: whereUnique, data: { ativo: false } });
    await prisma.favorite.deleteMany({ where: { propertyId: property.id } });

    res.json({ message: "Imóvel desativado com sucesso" });
  } catch (err) {
    console.error("Erro DELETE /property:", err);
    res.status(500).json({ message: "Erro ao desativar imóvel" });
  }
});
