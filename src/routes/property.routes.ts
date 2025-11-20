import { Router, Request } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { verifyToken, verifyTokenOptional } from "@/middlewares/verifyToken";
import { z } from "zod";
import fs from "fs";
import multer from "multer";
import path from "path";
import { authorizeRoles } from "@/middlewares/authorizeRoles";



const prisma = new PrismaClient();

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

function normalize(str: string) {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isUuid(str: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(str)
  );
}

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


propertyRouter.get("/", verifyTokenOptional, async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const {
      cidade,
      tipo,
      precoMax,
      categoria,
      page = "1",
      take = "10",
    } = req.query;

    const pageNum = Math.max(1, parseInt(page as string, 10));
    const takeNum = Math.max(1, parseInt(take as string, 10));
    const skip = (pageNum - 1) * takeNum;

    const filters: any = { ativo: true };

    if (tipo && typeof tipo === "string") {
      filters.tipo = { equals: tipo, mode: "insensitive" };
    }

    if (categoria && typeof categoria === "string") {
      filters.categoria = { equals: categoria, mode: "insensitive" };
    }

    if (precoMax && !isNaN(Number(precoMax))) {
      filters.preco = { gte: 50_000, lte: Number(precoMax) };
    }

    // =========================================================
    // 🔥 CAPTURA FAVORITOS (SE O TOKEN ESTIVER PRESENTE)
    // =========================================================
    let favoritosMap: Record<number, boolean> = {};

    if (req.user?.id) {
      const favoritos = await prisma.favorite.findMany({
        where: { userId: req.user.id },
        select: { propertyId: true },
      });

      favoritosMap = Object.fromEntries(favoritos.map((f) => [f.propertyId, true]));
    }

    // =========================================================
    // 🔍 FILTRO DE CIDADE (MANUAL)
    // =========================================================
    if (cidade && typeof cidade === "string") {
      const normalizado = cidade
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

      const all = await prisma.property.findMany({
        where: filters,
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { id: true, uuid: true, nome: true, telefone: true } },
        },
      });

      const filtrados = all.filter(
        (p) =>
          p.cidade &&
          p.cidade
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim() === normalizado
      );

      const paginated = filtrados.slice(skip, skip + takeNum);

      return res.json({
        data: paginated.map((imovel) => ({
          ...imovel,
          isFavorito: !!favoritosMap[imovel.id],
        })),
        pagination: {
          total: filtrados.length,
          page: pageNum,
          take: takeNum,
          totalPages: Math.ceil(filtrados.length / takeNum),
        },
      });
    }

    // =========================================================
    // 🔍 CONSULTA NORMAL SEM FILTRO DE CIDADE
    // =========================================================
    const [total, list] = await Promise.all([
      prisma.property.count({ where: filters }),
      prisma.property.findMany({
        where: filters,
        orderBy: { createdAt: "desc" },
        skip,
        take: takeNum,
        include: {
          user: { select: { id: true, uuid: true, nome: true, telefone: true } },
        },
      }),
    ]);

    const data = list.map((imovel) => ({
      ...imovel,
      isFavorito: !!favoritosMap[imovel.id],
    }));

    return res.json({
      data,
      pagination: {
        total,
        page: pageNum,
        take: takeNum,
        totalPages: Math.ceil(total / takeNum),
      },
    });
  } catch (err) {
    console.error("Erro GET /property:", err);
    res.status(500).json({ error: "Erro ao buscar imóveis" });
  }
});




propertyRouter.post("/busca", async (req, res) => {
  try {
    const { tipo, cidade } = req.body as { tipo?: string; cidade?: string };

    let list = await prisma.property.findMany({
      where: { ativo: true },
      include: {
        user: { select: { id: true, uuid: true, nome: true, telefone: true } },
      },
    });

    if (tipo) {
      list = list.filter((p) => normalize(p.tipo) === normalize(tipo));
    }
    if (cidade) {
      const normalizado = normalize(cidade);
      list = list.filter(
        (p) => p.cidade && normalize(p.cidade) === normalizado
      );
    }

    res.json(list);
  } catch (err) {
    console.error("Erro POST /property/busca:", err);
    res.status(500).json({ error: "Erro ao buscar imóveis" });
  }
});


propertyRouter.get("/mine", verifyToken, async (req: Request, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");

  try {
    const { cidade, tipo, negocio, ativo, page = "1", take = "8" } = req.query;

    const filters: Prisma.PropertyWhereInput = { userId: req.user!.id };

    
    if (cidade && typeof cidade === "string") {
      filters.cidade = { contains: cidade, mode: "insensitive" };
    }

    
    if (tipo && typeof tipo === "string") {
      filters.tipo = { equals: tipo, mode: "insensitive" };
    }

    
    if (negocio && typeof negocio === "string") {
      filters.tipoNegocio = { equals: negocio, mode: "insensitive" };
    }

    
    if (ativo !== undefined) {
      if (ativo === "true") filters.ativo = true;
      if (ativo === "false") filters.ativo = false;
    }

    
    const pageNum = Math.max(1, parseInt(page as string, 10));
    const takeNum = Math.max(1, parseInt(take as string, 10));
    const skip = (pageNum - 1) * takeNum;

    
    const [total, list] = await Promise.all([
      prisma.property.count({ where: filters }),
      prisma.property.findMany({
        where: filters,
        orderBy: { createdAt: "desc" },
        skip,
        take: takeNum,
        include: {
          user: {
            select: { id: true, uuid: true, nome: true, telefone: true },
          },
        },
      }),
    ]);

    res.json({
      data: list,
      pagination: {
        total,
        page: pageNum,
        take: takeNum,
        totalPages: Math.ceil(total / takeNum),
      },
    });
  } catch (err) {
    console.error("Erro GET /property/mine:", err);
    res.status(500).json({ error: "Erro ao listar meus imóveis" });
  }
});


propertyRouter.get("/similares/:identifier", async (req, res) => {
  const { identifier } = req.params;
  try {
    const whereUnique: any = /^\d+$/.test(identifier)
      ? { id: Number(identifier) }
      : isUuid(identifier)
      ? { uuid: identifier }
      : null;

    if (!whereUnique) return res.status(400).json({ error: "Identificador inválido" });

    const current = await prisma.property.findUnique({ where: whereUnique });
    if (!current)
      return res.status(404).json({ error: "Imóvel não encontrado" });

    const normalizadoCidade = current.cidade ? normalize(current.cidade) : null;
    const normalizadoTipo = normalize(current.tipo);

    const similares = await prisma.property.findMany({
      where: {
        id: { not: current.id },
        ativo: true,
        preco: { gte: current.preco * 0.5, lte: current.preco * 1.5 },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: {
        user: { select: { id: true, uuid: true, nome: true, telefone: true } },
      },
    });

    const filtrados = similares.filter(
      (p) =>
        normalize(p.tipo) === normalizadoTipo &&
        p.cidade &&
        normalizadoCidade &&
        normalize(p.cidade) === normalizadoCidade
    );

    res.json(filtrados);
  } catch (err) {
    console.error("Erro /similares:", err);
    res.status(500).json({ error: "Erro ao buscar similares" });
  }
});

propertyRouter.get("/:identifier", async (req, res) => {
  const { identifier } = req.params;
  const whereUnique: any = /^\d+$/.test(identifier)
    ? { id: Number(identifier) }
    : isUuid(identifier)
    ? { uuid: identifier }
    : null;

  if (!whereUnique) return res.status(400).json({ error: "Identificador inválido" });

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

propertyRouter.post(
  "/",
  verifyToken,
  authorizeRoles("ADMIN", "CORRETOR"),
  upload.single("imagem"),
  async (req: Request, res) => {
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
          return res
            .status(400)
            .json({
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
          .json({
            message: "Dados inválidos",
            errors: fieldErrors(parsed.error),
          });
      }

      const data = { ...parsed.data, userId: req.user!.id };

      const created = await prisma.property.create({ data });
      res.status(201).json(created);
    } catch (err) {
      console.error("Erro ao criar imóvel:", err);
      res.status(500).json({ message: "Erro ao criar imóvel" });
    }
  }
);

propertyRouter.put(
  "/:identifier",
  verifyToken,
  authorizeRoles("ADMIN", "CORRETOR"),
  upload.single("imagem"),
  async (req: Request, res) => {
    const { identifier } = req.params;
    const whereUnique = /^\d+$/.test(identifier)
      ? { id: Number(identifier) }
      : { uuid: identifier };

    try {
      const property = await prisma.property.findUnique({ where: whereUnique });
      if (!property)
        return res.status(404).json({ message: "Imóvel não encontrado" });
      if (property.userId !== req.user!.id)
        return res.status(403).json({ message: "Sem permissão" });

      // 🔹 Tratar 'caracteristicas' tanto como string JSON quanto array
      let caracteristicas: string[] | undefined;
      if (req.body.caracteristicas) {
        try {
          if (typeof req.body.caracteristicas === "string") {
            const arr = JSON.parse(req.body.caracteristicas);
            if (!Array.isArray(arr) || !arr.every((c) => typeof c === "string"))
              throw new Error();
            caracteristicas = arr;
          } else if (Array.isArray(req.body.caracteristicas)) {
            caracteristicas = req.body.caracteristicas.filter(
              (c: any) => typeof c === "string"
            );
          }
        } catch {
          return res.status(400).json({
            message:
              "Campo 'caracteristicas' deve ser um array ou string JSON válido",
          });
        }
      }

      const imagem = req.file
        ? `/uploads/${req.file.filename}`
        : property.imagem;

      const parsed = updateSchema.safeParse({
        ...req.body,
        caracteristicas,
        imagem,
      });

      if (!parsed.success) {
        return res.status(400).json({
          message: "Dados inválidos",
          errors: fieldErrors(parsed.error),
        });
      }

      const updated = await prisma.property.update({
        where: whereUnique,
        data: parsed.data,
      });

      res.json(updated);
    } catch (err) {
      console.error("Erro ao atualizar imóvel:", err);
      res.status(500).json({ message: "Erro ao atualizar imóvel" });
    }
  }
);

propertyRouter.patch(
  "/:identifier/ativo",
  verifyToken,
  authorizeRoles("ADMIN", "CORRETOR"),
  async (req: Request, res) => {
    const { identifier } = req.params;
    const { ativo } = req.body as { ativo?: boolean };

    if (typeof ativo !== "boolean")
      return res
        .status(400)
        .json({ error: "Campo 'ativo' é obrigatório e boolean" });

    const whereUnique = /^\d+$/.test(identifier)
      ? { id: Number(identifier) }
      : { uuid: identifier };

    try {
      const property = await prisma.property.findFirst({
        where: { ...whereUnique, userId: req.user!.id },
      });
      if (!property)
        return res.status(404).json({ error: "Imóvel não encontrado" });

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
  }
);

/* =========================================================
   Registrar visualização
   ========================================================= */
propertyRouter.post("/:identifier/view", async (req: Request, res) => {
  const { identifier } = req.params;
  const userId = req.user?.id ?? null;

  try {
    const property = await prisma.property.findUnique({
      where: /^\d+$/.test(identifier)
        ? { id: Number(identifier) }
        : { uuid: identifier },
    });
    if (!property)
      return res.status(404).json({ error: "Imóvel não encontrado" });

    const recent = await prisma.propertyView.findFirst({
      where: {
        propertyId: property.id,
        userId,
        viewedAt: { gte: new Date(Date.now() - 2000) },
      },
    });

    if (!recent) {
      await prisma.propertyView.create({
        data: { propertyId: property.id, userId },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Erro /view:", err);
    res.status(500).json({ error: "Erro ao registrar visualização" });
  }
});

/* =========================================================
   Registrar contato
   ========================================================= */
propertyRouter.post("/:identifier/contact", async (req: Request, res) => {
  const { identifier } = req.params;
  const userId = req.user?.id ?? null;
  const { nome, email, telefone, mensagem } = req.body;

  try {
    const property = await prisma.property.findUnique({
      where: /^\d+$/.test(identifier)
        ? { id: Number(identifier) }
        : { uuid: identifier },
    });
    if (!property || !property.ativo)
      return res
        .status(404)
        .json({ error: "Imóvel não encontrado ou inativo" });

    await prisma.propertyContact.create({
      data: {
        propertyId: property.id,
        userId,
        nome,
        email,
        telefone,
        mensagem,
      },
    });

    res.status(201).json({ success: true });
  } catch (err) {
    console.error("Erro /contact:", err);
    res.status(500).json({ error: "Erro ao registrar contato" });
  }
});




  
propertyRouter.get("/mine/cities", verifyToken, async (req: Request, res) => {
  try {
    const cidadesRaw = await prisma.property.findMany({
      where: { userId: req.user!.id },
      select: { cidade: true },
    });

    
    const cidades = Array.from(
      new Map(
        cidadesRaw
          .filter((c) => c.cidade)
          .map((c) => {
            const normalizada = c.cidade!
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "") 
              .toLowerCase()
              .trim();
            return [normalizada, c.cidade!.trim()]; 
          })
      ).values()
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    res.json(cidades);
  } catch (err) {
    console.error("Erro GET /mine/cities:", err);
    res.status(500).json({ error: "Erro ao buscar cidades" });
  }
});

propertyRouter.get("/:identifier/corretor", async (req, res) => {
  const { identifier } = req.params;

  try {
    // 🔍 Permite tanto ID numérico quanto UUID
    const whereUnique = /^\d+$/.test(identifier)
      ? { id: Number(identifier) }
      : { uuid: identifier };

    // 🔹 Busca o imóvel + o usuário dono
    const property = await prisma.property.findUnique({
      where: whereUnique,
      include: {
        user: {
          select: {
            id: true,
            nome: true,
            email: true,
            telefone: true,
            avatarUrl: true,
            role: true,
          },
        },
      },
    });

    // ⚠️ Caso o imóvel não exista
    if (!property) {
      return res.status(404).json({ error: "Imóvel não encontrado." });
    }

    // ⚠️ Caso o imóvel não tenha usuário vinculado
    if (!property.user) {
      return res
        .status(404)
        .json({ error: "Este imóvel não possui corretor vinculado." });
    }

    // ✅ Monta os dados do corretor (ou responsável)
    const corretor = {
      id: property.user.id,
      nome: property.user.nome,
      email: property.user.email,
      telefone: property.user.telefone,
      avatarUrl:
        property.user.avatarUrl ||
        `https://i.pravatar.cc/150?u=${property.user.id}`,
      role: property.user.role,
    };

    // 🟢 Log mais explícito (útil para debug)
    console.log(
      `📡 Corretor encontrado para imóvel ${identifier}: ${corretor.nome} (${corretor.role})`
    );

    // ✅ Retorna sempre, mesmo que não seja "CORRETOR"
    return res.json({ corretor });
  } catch (error) {
    console.error("❌ Erro ao buscar corretor:", error);
    return res.status(500).json({ error: "Erro interno ao buscar corretor." });
  }
});


export default propertyRouter;
