// src/routes/dashboard.routes.ts
import { Router } from "express";
import { PrismaClient } from "@prisma/client";
import { subDays } from "date-fns";
import { verifyToken } from "../middlewares/verifyToken";

export const dashboardRouter = Router();
const prisma = new PrismaClient();

dashboardRouter.get("/summary", verifyToken, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Usuário não autenticado" });
    }

    // 📌 Total de imóveis do usuário
    const totalImoveis = await prisma.property.count({
      where: { userId },
    });

    // 📌 Ativos e inativos
    const ativos = await prisma.property.count({
      where: { userId, ativo: true },
    });
    const inativos = await prisma.property.count({
      where: { userId, ativo: false },
    });

    // 📌 Tipos de imóveis
    const tiposDeImoveis = await prisma.property.groupBy({
      by: ["tipo"],
      where: { userId },
      _count: { tipo: true },
    });

    // 📌 Distribuição por faixa de preço
    const faixaDePreco = await prisma.property.findMany({
      where: { userId },
      select: { preco: true },
    });

    const distribuicaoPorFaixa = {
      "Até 200k": 0,
      "200k - 500k": 0,
      "500k - 1M": 0,
      "+1M": 0,
    };

    faixaDePreco.forEach((p) => {
      const preco = p.preco;
      if (preco <= 200_000) distribuicaoPorFaixa["Até 200k"]++;
      else if (preco <= 500_000) distribuicaoPorFaixa["200k - 500k"]++;
      else if (preco <= 1_000_000) distribuicaoPorFaixa["500k - 1M"]++;
      else distribuicaoPorFaixa["+1M"]++;
    });

    // 📌 Top 5 bairros do usuário
    const imoveisPorBairro = await prisma.property.groupBy({
      by: ["bairro"],
      where: { userId },
      _count: { bairro: true },
      orderBy: { _count: { bairro: "desc" } },
      take: 5,
    });

    // 📌 Top 5 imóveis mais visualizados nos últimos 30 dias
    const viewsAgrupadas = await prisma.propertyView.groupBy({
      by: ["propertyId"],
      where: {
        property: { userId },
        viewedAt: { gte: subDays(new Date(), 30) },
      },
      _count: { propertyId: true },
      orderBy: { _count: { propertyId: "desc" } },
      take: 5,
    });

    const propriedadesMaisVistas = await prisma.property.findMany({
      where: {
        id: { in: viewsAgrupadas.map((v) => v.propertyId) },
        userId,
      },
      select: { id: true, tipo: true, bairro: true },
    });

    const topVisualizados = viewsAgrupadas.map((view) => {
      const prop = propriedadesMaisVistas.find((p) => p.id === view.propertyId);
      return {
        id: view.propertyId,
        titulo: prop ? `${prop.tipo} · ${prop.bairro}` : "Imóvel desconhecido",
        visualizacoes: view._count.propertyId,
      };
    });

    // 📌 Total de visualizações e contatos do usuário
    const totalVisualizacoes = await prisma.propertyView.count({
      where: { property: { userId } },
    });

    const totalContatos = await prisma.propertyContact.count({
      where: { property: { userId } },
    });

    // ✅ Retorno final
    return res.json({
      totalImoveis,
      ativos,
      inativos,
      tiposDeImoveis: tiposDeImoveis.map((t) => ({
        tipo: t.tipo,
        total: t._count.tipo,
      })),
      distribuicaoPorFaixa,
      topBairros: imoveisPorBairro.map((b) => ({
        bairro: b.bairro,
        total: b._count.bairro,
      })),
      topVisualizados,
      totalVisualizacoes,
      contatosRecebidos: totalContatos,
    });
  } catch (error) {
    console.error("Erro no dashboard summary:", error);
    return res
      .status(500)
      .json({ error: "Erro ao carregar o resumo do dashboard" });
  }
});
