import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../middlewares/verifyToken';

import { Request } from "express";

export interface AuthRequest extends Request {
  user: {
    id: number;
    nome: string;
    email: string;
    tipo: string;
  };
}


export const propertyRouter = Router();
const prisma = new PrismaClient();

/**
 * ✅ NOVA ROTA: Buscar múltiplos imóveis por array de IDs
 * POST /property/by-ids
 * Exemplo de body: { ids: [1, 2, 3] }
 */
propertyRouter.post('/by-ids', async (req, res) => {
  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'Lista de IDs inválida ou vazia' });
  }

  try {
    const properties = await prisma.property.findMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    res.json(properties);
  } catch (error) {
    console.error('Erro ao buscar imóveis por IDs:', error);
    res.status(500).json({ error: 'Erro ao buscar imóveis' });
  }
});

/**
 * ✅ ROTA ATUALIZADA: GET /property
 * Retorna os imóveis da cidade do usuário (se informado ?cidade=...) no topo da lista
 */
propertyRouter.get('/', async (req, res) => {
  const { cidade } = req.query;

  try {
    let properties;

    if (cidade && typeof cidade === "string") {
      const propriedadesCidade = await prisma.property.findMany({
        where: {
          cidade: {
            equals: cidade,
            mode: "insensitive",
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      const outrasPropriedades = await prisma.property.findMany({
        where: {
          cidade: {
            not: cidade,
            mode: "insensitive",
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      properties = [...propriedadesCidade, ...outrasPropriedades];
    } else {
      properties = await prisma.property.findMany({
        orderBy: {
          createdAt: "desc",
        },
      });
    }

    res.json(properties);
  } catch (error) {
    console.error('Erro ao buscar imóveis:', error);
    res.status(500).json({ error: 'Erro ao buscar imóveis' });
  }
});

/**
 * GET /property/:id - Buscar um imóvel por ID
 */
propertyRouter.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return res.status(404).json({ error: 'Imóvel não encontrado' });
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar imóvel' });
  }
});

/**
 * POST /property - Criar novo imóvel
 */
propertyRouter.post('/', async (req, res) => {
  try {
    const data = req.body;
    const newProperty = await prisma.property.create({ data });
    res.status(201).json(newProperty);
  } catch (error) {
    console.error('Erro ao criar imóvel:', error);
    res.status(500).json({ error: 'Erro ao criar imóvel' });
  }
});

/**
 * PUT /property/:id - Atualizar imóvel
 */
propertyRouter.put('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const data = req.body;

  try {
    const updated = await prisma.property.update({
      where: { id },
      data,
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar imóvel' });
  }
});

/**
 * DELETE /property/:id - Deletar imóvel
 */
propertyRouter.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.property.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar imóvel' });
  }
});




