
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


const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    
    const dest = path.join(process.cwd(), "uploads");
    fs.mkdirSync(dest, { recursive: true }); 
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
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


export const propertyRouter = Router();
const prisma = new PrismaClient();


const createPropertySchema = z.object({
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

const updatePropertySchema = createPropertySchema.partial();

function zodFieldErrors(err: z.ZodError) {
  return err.flatten().fieldErrors;
}




propertyRouter.post("/by-ids", async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "Lista de IDs inválida ou vazia" });
  }

  try {
    const properties = await prisma.property.findMany({
      where: { id: { in: ids } },
      include: {
        user: { select: { id: true, nome: true, telefone: true } },
      },
    });
    res.json(properties);
  } catch (error) {
    console.error("Erro ao buscar imóveis por IDs:", error);
    res.status(500).json({ error: "Erro ao buscar imóveis" });
  }
});


propertyRouter.get("/", async (req, res) => {
  const { cidade } = req.query;

  try {
    let properties;

    if (cidade && typeof cidade === "string") {
      const propriedadesCidade = await prisma.property.findMany({
        where: { 
          cidade: { equals: cidade, mode: "insensitive" },
          ativo: true, 
        },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, nome: true, telefone: true } } }
      });

      const outrasPropriedades = await prisma.property.findMany({
        where: { 
          cidade: { not: cidade, mode: "insensitive" },
          ativo: true, 
        },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, nome: true, telefone: true } } }
      });

      properties = [...propriedadesCidade, ...outrasPropriedades];
    } else {
      properties = await prisma.property.findMany({
        where: { ativo: true }, 
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, nome: true, telefone: true } } }
      });
    }

    res.json(properties);
  } catch (error) {
    console.error("Erro ao buscar imóveis:", error);
    res.status(500).json({ error: "Erro ao buscar imóveis" });
  }
});


propertyRouter.get("/mine", verifyToken, async (req: AuthRequest, res) => {
  try {
    const list = await prisma.property.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "desc" },
      include: { user: { select: { id: true, nome: true, telefone: true } } }
    });
    return res.json(list);
  } catch (err) {
    console.error("GET /property/mine error:", err);
    return res.status(500).json({ message: "Erro ao listar meus imóveis" });
  }
});


propertyRouter.get("/similares/:id(\\d+)", async (req, res) => {
  const id = Number(req.params.id);

  try {
    const imovelAtual = await prisma.property.findUnique({ where: { id } });

    if (!imovelAtual) {
      return res.status(404).json({ error: "Imóvel não encontrado" });
    }

    
    let similares = await prisma.property.findMany({
      where: {
        id: { not: id },
        cidade: imovelAtual.cidade,
        tipo: imovelAtual.tipo,
         ativo: true, 
        preco: {
          gte: imovelAtual.preco * 0.5,
          lte: imovelAtual.preco * 1.5,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 4,
      include: { user: { select: { id: true, nome: true, telefone: true } } }
    
    });

    
    if (similares.length < 4) {
      similares = await prisma.property.findMany({
        where: {
          id: { not: id },
          cidade: imovelAtual.cidade,
          tipo: imovelAtual.tipo,
           ativo: true, 
        },
        orderBy: { createdAt: "desc" },
        take: 4,
        include: { user: { select: { id: true, nome: true, telefone: true } } }
      });
    }

    return res.json(similares);
  } catch (error) {
    console.error("Erro ao buscar imóveis similares:", error);
    return res.status(500).json({ error: "Erro ao buscar similares" });
  }
});


propertyRouter.get("/:id(\\d+)", async (req, res) => {
  const id = Number(req.params.id);

  try {
    const imovel = await prisma.property.findUnique({
      where: { id },
      include: { user: { select: { nome: true, telefone: true } } },
    });

    if (!imovel || !imovel.ativo) {  
      return res.status(404).json({ error: "Imóvel não encontrado" });
    }

    return res.json(imovel);
  } catch (error) {
    console.error("Erro ao buscar imóvel:", error);
    return res.status(500).json({ error: "Erro ao buscar imóvel" });
  }
});


propertyRouter.patch("/:id(\\d+)/ativo", verifyToken, async (req: AuthRequest, res) => {
  try {
    const id = Number(req.params.id);
    const { ativo } = req.body as { ativo?: boolean };

    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: "ID inválido" });
    }
    if (typeof ativo !== "boolean") {
      return res.status(400).json({ error: "Campo 'ativo' é obrigatório e boolean" });
    }

    
    const found = await prisma.property.findFirst({
      where: { id, userId: req.user.id },
      select: { id: true },
    });
    if (!found) {
      return res.status(404).json({ error: "Imóvel não encontrado" });
    }

    const updated = await prisma.property.update({
      where: { id },
      data: { ativo },
      select: { id: true, ativo: true },
    });

    return res.json(updated);
  } catch (err) {
    console.error("Erro ao atualizar status do imóvel:", err);
    return res.status(500).json({ error: "Erro ao atualizar status do imóvel" });
  }
});

propertyRouter.post("/:id/view", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.id);
  const userId = req.user?.id ?? null;

  try {
   
    const duplicada = await prisma.propertyView.findFirst({
      where: {
        propertyId,
        userId,
        viewedAt: {
          gte: new Date(Date.now() - 2000), 
        },
      },
    });

    if (!duplicada) {
      await prisma.propertyView.create({
        data: { propertyId, userId },
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("Erro ao registrar visualização:", error);
    return res.status(500).json({ error: "Erro ao registrar visualização" });
  }
});

propertyRouter.post("/:id/contact", async (req: AuthRequest, res) => {
  const propertyId = Number(req.params.id);
  console.log("🟢 [DEBUG] Contato recebido para propertyId:", propertyId);

  const userId = req.user?.id ?? null;
  const { nome, email, telefone, mensagem } = req.body;
  console.log("🟡 [DEBUG] Dados recebidos do formulário:", { nome, email, telefone, mensagem });

  try {
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      include: { user: { select: { id: true, nome: true, telefone: true } } }
    });

    console.log("🔵 [DEBUG] Property encontrado no banco:", property);

    if (!property || !property.ativo) {
      console.warn("🔴 [DEBUG] Imóvel não encontrado ou inativo:", propertyId);
      return res
        .status(404)
        .json({ error: "Imóvel não encontrado ou está inativo" });
    }

    await prisma.propertyContact.create({
      data: {
        propertyId,
        userId,
        nome,
        email,
        telefone,
        mensagem,
      },
    });

    console.log("✅ [DEBUG] Contato salvo com sucesso para propertyId:", propertyId);

    return res.status(201).json({
      success: true,
      message: "Contato registrado com sucesso",
    });
  } catch (error) {
    console.error("❌ [DEBUG] Erro ao registrar contato:", error);
    return res.status(500).json({ error: "Erro ao registrar contato" });
  }
});

propertyRouter.post(
  "/",
  verifyToken,
  upload.single("imagem"),
  async (req: AuthRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Imagem é obrigatória" });
      }

      let caracteristicas: string[] | undefined = undefined;

      try {
        if (req.body.caracteristicas) {
          caracteristicas = JSON.parse(req.body.caracteristicas);

          if (
            !Array.isArray(caracteristicas) ||
            !caracteristicas.every((c) => typeof c === "string")
          ) {
            throw new Error("Formato inválido");
          }
        }
      } catch (err) {
        return res
          .status(400)
          .json({
            message:
              "Campo 'caracteristicas' mal formatado. Envie um array JSON válido.",
          });
      }

      const parsed = createPropertySchema.safeParse({
        ...req.body,
        caracteristicas,
        imagem: `/uploads/${req.file.filename}`,
      });

      if (!parsed.success) {
        return res
          .status(400)
          .json({
            message: "Dados inválidos",
            errors: zodFieldErrors(parsed.error),
          });
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

propertyRouter.put(
  "/:id(\\d+)",
  verifyToken,
  upload.single("imagem"),
  async (req: AuthRequest, res) => {
    const id = Number(req.params.id);

    try {
      const exists = await prisma.property.findUnique({ where: { id } });
      if (!exists)
        return res.status(404).json({ message: "Imóvel não encontrado" });

      if (exists.userId && exists.userId !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Sem permissão para alterar este imóvel" });
      }

      
      let caracteristicas: string[] | undefined = undefined;
      try {
        if (req.body.caracteristicas) {
          caracteristicas = JSON.parse(req.body.caracteristicas);
          if (
            !Array.isArray(caracteristicas) ||
            !caracteristicas.every((c) => typeof c === "string")
          ) {
            throw new Error("Formato inválido");
          }
        }
      } catch (err) {
        return res
          .status(400)
          .json({
            message:
              "Campo 'caracteristicas' mal formatado. Envie um array JSON válido.",
          });
      }

      
      const imagem = req.file ? `/uploads/${req.file.filename}` : exists.imagem;

      const parsed = updatePropertySchema.safeParse({
        ...req.body,
        caracteristicas,
        imagem,
      });

      if (!parsed.success) {
        return res
          .status(400)
          .json({
            message: "Dados inválidos",
            errors: zodFieldErrors(parsed.error),
          });
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
  }
);


propertyRouter.delete(
  "/:id(\\d+)",
  verifyToken,
  async (req: AuthRequest, res) => {
    const id = Number(req.params.id);

    try {
      const exists = await prisma.property.findUnique({ where: { id } });
      if (!exists)
        return res.status(404).json({ message: "Imóvel não encontrado" });

      if (exists.userId && exists.userId !== req.user.id) {
        return res
          .status(403)
          .json({ message: "Sem permissão para deletar este imóvel" });
      }

      await prisma.property.delete({ where: { id } });
      res.status(204).send();
    } catch (error) {
      console.error("Erro ao deletar imóvel:", error);
      res.status(500).json({ message: "Erro ao deletar imóvel" });
    }
  }
);
