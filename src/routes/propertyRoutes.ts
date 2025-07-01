
import { Router } from 'express';
import { PrismaClient } from '../../generated/prisma';

const router = Router();
const prisma = new PrismaClient();

// GET /properties - listar todos
router.get('/', async (req, res) => {
  try {
    const properties = await prisma.property.findMany();
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar imóveis' });
  }
});



router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) return res.status(404).json({ error: 'Imóvel não encontrado' });
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar imóvel' });
  }
});

// POST /properties - criar novo imóvel
router.post('/', async (req, res) => {
  try {
    const data = req.body;
    const newProperty = await prisma.property.create({ data });
    res.status(201).json(newProperty);
  } catch (error) {
    console.error('Erro ao criar imóvel:', error);
    res.status(500).json({ error: 'Erro ao criar imóvel' });
  }
});

// PUT /properties/:id - atualizar imóvel
router.put('/:id', async (req, res) => {
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

// DELETE /properties/:id - deletar imóvel
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  try {
    await prisma.property.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar imóvel' });
  }
});

export default router;
