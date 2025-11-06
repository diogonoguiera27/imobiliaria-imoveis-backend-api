import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { verifyToken } from "../middlewares/verifyToken";
import { isAdmin } from "../middlewares/isAdmin";
import { subDays, eachDayOfInterval, isValid } from "date-fns";
import { format, formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";

export const dashboardRouter = Router();
const prisma = new PrismaClient();

/* ======================================================
   ✅ ROTA 1 — RESUMO GERAL (CARDS)
   ====================================================== */
dashboardRouter.get("/summary", verifyToken, isAdmin, async (req, res) => {
  try {
    const totalImoveis = await prisma.property.count();

    const valorPatrimonial = await prisma.property.aggregate({
      _sum: { preco: true },
    });

    const usuariosAtivos = await prisma.user.count();
    const corretores = await prisma.user.count({ where: { role: "CORRETOR" } });
    const vendedores = await prisma.user.count({
      where: { role: "ADMIN", properties: { some: {} } },
    });
    const ativos = await prisma.property.count({ where: { ativo: true } });
    const inativos = await prisma.property.count({ where: { ativo: false } });

    return res.json({
      totalImoveis,
      ativos,
      inativos,
      usuariosAtivos,
      corretores,
      vendedores,
      valorPatrimonialTotal: valorPatrimonial._sum.preco || 0,
    });
  } catch (error) {
    console.error("Erro no /dashboard/summary:", error);
    return res.status(500).json({ error: "Erro ao carregar o resumo do dashboard" });
  }
});

/* ======================================================
   ✅ ROTA 2 — GRÁFICO (IMÓVEIS CADASTRADOS POR DIA)
   ====================================================== */
dashboardRouter.get("/chart", verifyToken, isAdmin, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;

    const startDate = from ? new Date(from as string) : subDays(new Date(), 7);
    const endDate = to ? new Date(to as string) : new Date();
    endDate.setHours(23, 59, 59, 999);

    if (!isValid(startDate) || !isValid(endDate)) {
      console.error("Datas inválidas recebidas:", { from, to });
      return res.status(400).json({ error: "Intervalo de datas inválido." });
    }

    const imoveis = await prisma.property.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: { createdAt: true },
    });

    const contagemPorDia: Record<string, number> = {};
    imoveis.forEach((imovel) => {
      if (!isValid(imovel.createdAt)) return;
      const dia = format(imovel.createdAt, "dd/MM", { locale: ptBR });
      contagemPorDia[dia] = (contagemPorDia[dia] || 0) + 1;
    });

    const diasNoIntervalo = eachDayOfInterval({ start: startDate, end: endDate });

    const chartData = diasNoIntervalo.map((dia) => {
      const label = format(dia, "dd/MM", { locale: ptBR });
      return {
        day: label,
        imoveis: contagemPorDia[label] || 0,
      };
    });

    return res.json(chartData);
  } catch (error) {
    console.error("Erro no /dashboard/chart:", error);
    return res.status(500).json({ error: "Erro ao gerar gráfico do dashboard" });
  }
});

