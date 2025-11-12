import { Router } from "express";
import { PrismaClient } from "@prisma/client";

const chatRouter = Router();
const prisma = new PrismaClient();

/**
 * ============================================================
 * 🗨️ LISTAR CONVERSAS (com filtro por tipo de usuário)
 * ============================================================
 * - Se o logado for USER → mostra somente CORRETORES
 * - Se o logado for CORRETOR → mostra somente USERS
 * - Evita duplicação e ignora o próprio usuário logado
 */
chatRouter.get("/conversas/:userId", async (req, res) => {
  const { userId } = req.params;
  const id = Number(userId);

  try {
    // 1️⃣ Busca o tipo (role) do usuário logado
    const usuarioAtual = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!usuarioAtual) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    // 2️⃣ Busca todas as mensagens em que o usuário participou
    const mensagens = await prisma.mensagem.findMany({
      where: {
        OR: [{ remetenteId: id }, { destinatarioId: id }],
      },
      orderBy: { criadoEm: "asc" },
    });

    if (mensagens.length === 0) {
      return res.json([]); // Nenhuma conversa ainda
    }

    // 3️⃣ Agrupa e mantém apenas a mensagem mais recente por conversa
    const conversasMap = new Map<number, any>();

    for (const msg of mensagens) {
      const outroId =
        msg.remetenteId === id ? msg.destinatarioId : msg.remetenteId;

      // ❌ Ignora se for o próprio usuário (evita “ver a si mesmo”)
      if (outroId === id) continue;

      const existente = conversasMap.get(outroId);
      if (!existente || new Date(msg.criadoEm) > new Date(existente.criadoEm)) {
        conversasMap.set(outroId, msg);
      }
    }

    // 4️⃣ Busca informações dos "outros usuários" aplicando filtro por papel
    const conversas = await Promise.all(
      Array.from(conversasMap.entries()).map(async ([outroId, ultimaMsg]) => {
        const usuarioOutro = await prisma.user.findUnique({
          where: { id: outroId },
          select: {
            id: true,
            nome: true,
            avatarUrl: true,
            role: true,
          },
        });

        if (!usuarioOutro) return null;

        // 🔍 Filtro inteligente: mostra apenas o tipo oposto
        const ehValido =
          (usuarioAtual.role === "USER" &&
            usuarioOutro.role === "CORRETOR") ||
          (usuarioAtual.role === "CORRETOR" &&
            usuarioOutro.role === "USER");

        if (!ehValido) return null;

        return {
          id: usuarioOutro.id,
          nome: usuarioOutro.nome || "Contato",
          avatar:
            usuarioOutro.avatarUrl ||
            `https://i.pravatar.cc/100?u=${usuarioOutro.id}`,
          role: usuarioOutro.role,
          ultimaMensagem: ultimaMsg.conteudo,
          horario: ultimaMsg.criadoEm,
        };
      })
    );

    // 5️⃣ Remove nulos e ordena do mais recente para o mais antigo
    const resultado = conversas
      .filter((c) => c !== null)
      .sort(
        (a, b) =>
          new Date(b!.horario).getTime() - new Date(a!.horario).getTime()
      );

    return res.json(resultado);
  } catch (error) {
    console.error("❌ Erro ao buscar conversas:", error);
    return res
      .status(500)
      .json({ error: "Erro interno ao buscar conversas." });
  }
});

/**
 * ============================================================
 * 💬 HISTÓRICO ENTRE DOIS USUÁRIOS
 * ============================================================
 * Retorna todas as mensagens trocadas entre usuarioA e usuarioB
 */
chatRouter.get("/mensagens/:usuarioA/:usuarioB", async (req, res) => {
  const { usuarioA, usuarioB } = req.params;

  try {
    const mensagens = await prisma.mensagem.findMany({
      where: {
        OR: [
          {
            remetenteId: Number(usuarioA),
            destinatarioId: Number(usuarioB),
          },
          {
            remetenteId: Number(usuarioB),
            destinatarioId: Number(usuarioA),
          },
        ],
      },
      orderBy: { criadoEm: "asc" },
    });

    return res.json(mensagens);
  } catch (error) {
    console.error("❌ Erro ao buscar histórico:", error);
    return res
      .status(500)
      .json({ error: "Erro interno ao buscar histórico." });
  }
});

export { chatRouter };
