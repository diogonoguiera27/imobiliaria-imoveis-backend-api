// src/routes/property.routes.ts
import { Router, Request } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/verifyToken";
import { z } from "zod";
import fs from "fs";
import multer from "multer";
import path from "path";

export interface AuthRequest extends Request {
  user: {
    id: number;
    nome?: string;
    email: string;
    tipo?: string;
  };
}

// -------------------- Multer config --------------------
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Salvar na pasta "uploads" da raiz do projeto
    const dest = path.join(process.cwd(), "uploads");
    fs.mkdirSync(dest, { recursive: true }); // garante que a pasta exista
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Formato inválido (use JPG, PNG ou WEBP)"));
    }
    cb(null, true);
  },
});

// -------------------- Prisma + Router --------------------
export const propertyRouter = Router();
const prisma = new PrismaClient();

/* ------------------------- Validações (Zod) ------------------------- */
const createPropertySchema = z.object({
  imagem: z.string().min(1), // agora aceita path salvo
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

  // ✅ Novo campo substituindo infoExtra
  caracteristicas: z.array(z.string()).optional(),

  descricao: z.string().optional(),
});

const updatePropertySchema = createPropertySchema.partial();

function zodFieldErrors(err: z.ZodError) {
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
      include: {
        user: { select: { nome: true } }, // 👈 inclui nome do proprietário
      },
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
        include: { user: { select: { id: true, nome: true } } }, // ✅ pega o nome do proprietário
      });

      const outrasPropriedades = await prisma.property.findMany({
        where: { cidade: { not: cidade, mode: "insensitive" } },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, nome: true } } }, // ✅ aqui também
      });

      properties = [...propriedadesCidade, ...outrasPropriedades];
    } else {
      properties = await prisma.property.findMany({
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, nome: true } } }, // ✅ aqui também
      });
    }

    res.json(properties);
  } catch (error) {
    console.error("Erro ao buscar imóveis:", error);
    res.status(500).json({ error: "Erro ao buscar imóveis" });
  }
});

// 🔐 Lista SOMENTE os imóveis do usuário autenticado
propertyRouter.get("/mine", verifyToken, async (req: AuthRequest, res) => {
  try {
    const list = await prisma.property.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, nome: true } } }, // ✅ inclui nome do proprietário
    });
    return res.json(list);
  } catch (err) {
    console.error("GET /property/mine error:", err);
    return res.status(500).json({ message: "Erro ao listar meus imóveis" });
  }
});
// src/routes/propertyRouter.ts

propertyRouter.get("/similares/:id(\\d+)", async (req, res) => {
  const id = Number(req.params.id);

  try {
    const imovelAtual = await prisma.property.findUnique({ where: { id } });

    if (!imovelAtual) {
      return res.status(404).json({ error: "Imóvel não encontrado" });
    }

    // Tentativa 1: aplicar todos os critérios (incluindo preço)
    let similares = await prisma.property.findMany({
      where: {
        id: { not: id },
        cidade: imovelAtual.cidade,
        tipo: imovelAtual.tipo,
        preco: {
          gte: imovelAtual.preco * 0.5,
          lte: imovelAtual.preco * 1.5,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
    });

    // Tentativa 2: remover o filtro de preço se encontrou poucos ou nenhum
    if (similares.length < 4) {
      similares = await prisma.property.findMany({
        where: {
          id: { not: id },
          cidade: imovelAtual.cidade,
          tipo: imovelAtual.tipo,
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      });
    }

    return res.json(similares);
  } catch (error) {
    console.error("Erro ao buscar imóveis similares:", error);
    return res.status(500).json({ error: "Erro ao buscar similares" });
  }
});


// 🔎 Buscar por ID
propertyRouter.get("/:id(\\d+)", async (req, res) => {
  const id = Number(req.params.id);

  try {
    const imovel = await prisma.property.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            nome: true,
            telefone: true,
          },
        },
      },
    });

    if (!imovel) {
      return res.status(404).json({ error: "Imóvel não encontrado" });
    }

    return res.json(imovel);
  } catch (error) {
    console.error("Erro ao buscar imóvel:", error);
    return res.status(500).json({ error: "Erro ao buscar imóvel" });
  }
});

// ➕ Criar imóvel com upload de imagem
propertyRouter.post(
  "/",
  verifyToken,
  upload.single("imagem"),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Imagem é obrigatória" });
      }

      // 🧠 Corrigir o campo `caracteristicas` se ele vier como string
      let caracteristicas: string[] | undefined = undefined;

      try {
        if (req.body.caracteristicas) {
          // Se vier string do tipo '["x", "y"]'
          caracteristicas = JSON.parse(req.body.caracteristicas);

          // Validar se de fato virou array de strings
          if (!Array.isArray(caracteristicas) || !caracteristicas.every(c => typeof c === "string")) {
            throw new Error("Formato inválido");
          }
        }
      } catch (err) {
        return res.status(400).json({ message: "Campo 'caracteristicas' mal formatado. Envie um array JSON válido." });
      }

      const parsed = createPropertySchema.safeParse({
        ...req.body,
        caracteristicas, // <- Corrigido aqui
        imagem: `/uploads/${req.file.filename}`,
      });

      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: "Dados inválidos", errors: zodFieldErrors(parsed.error) });
      }

      const created = await prisma.property.create({
        data: {
          ...parsed.data,
          userId: req.user.id,
        },
      });

      return res.status(201).json(created);
    } catch (error) {
      console.error("Erro ao criar imóvel:", error);
      return res.status(500).json({ message: "Erro ao criar imóvel" });
    }
  }
);

// ✏️ Atualizar imóvel
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

// 🗑️ Deletar imóvel
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
