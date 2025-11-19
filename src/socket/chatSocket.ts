// ...existing code...
import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 🔹 Mapeia usuários conectados (userId → socketId)
const userSocketMap = new Map<number, string>();

// 🔹 Mapeia conversa aberta por usuário (userId → contatoId)
const openConversationMap = new Map<number, number>();

// 🔹 Interface auxiliar para contatos
interface Contato {
  id: number;
  nome: string;
  avatar: string;
  online: boolean;
  naoLidas: number;
}

/**
 * 🔔 Emite para o usuário o total de contatos com mensagens não lidas
 *     - Ignora o contato cuja conversa está aberta para esse usuário
 */
async function emitirNotificacaoGlobal(io: Server, userId: number) {
  try {
    const naoLidasPorContato = await prisma.mensagem.groupBy({
      by: ["remetenteId"],
      where: { destinatarioId: userId, lida: false },
      _count: { _all: true },
    });

    // Se o usuário tem uma conversa aberta com alguém, filtramos esse remetente
    const aberto = openConversationMap.get(userId);
    const filtrado = aberto
      ? naoLidasPorContato.filter((c) => c.remetenteId !== aberto)
      : naoLidasPorContato;

    const totalContatosComNaoLidas = filtrado.length;
    const socketId = userSocketMap.get(userId);

    if (socketId) {
      io.to(socketId).emit("atualizar_notificacao_global", {
        totalContatos: totalContatosComNaoLidas,
        detalhes: filtrado,
      });
    }
  } catch (err) {
    console.error("❌ Erro ao emitir notificação global:", err);
  }
}

/**
 * 💬 Manipuladores principais de WebSocket do chat
 */
export function registerChatHandlers(io: Server, socket: Socket) {
  console.log(`💬 [ChatSocket] Nova conexão: ${socket.id}`);

  /**
   * 0️⃣ Eventos de conversa aberta/fechada (do cliente)
   */
  socket.on("conversa_aberta", ({ usuarioId, contatoId }: { usuarioId: number; contatoId: number }) => {
    try {
      if (typeof usuarioId === "number" && typeof contatoId === "number") {
        openConversationMap.set(usuarioId, contatoId);
        console.log(`🔎 conversa_aberta: usuário ${usuarioId} abriu conversa com ${contatoId}`);
      }
    } catch (err) {
      console.error("❌ erro em conversa_aberta:", err);
    }
  });

  socket.on("conversa_fechada", ({ usuarioId, contatoId }: { usuarioId: number; contatoId?: number }) => {
    try {
      if (typeof usuarioId === "number") {
        openConversationMap.delete(usuarioId);
        console.log(`🔒 conversa_fechada: usuário ${usuarioId} fechou conversa`);
      }
    } catch (err) {
      console.error("❌ erro em conversa_fechada:", err);
    }
  });

  /**
   * 1️⃣ Registrar usuário conectado
   */
  socket.on("registrar_usuario", async (userId: number) => {
    try {
      socket.data.userId = userId;
      userSocketMap.set(userId, socket.id);
      console.log(`✅ Usuário ${userId} vinculado ao socket ${socket.id}`);

      io.emit("user_online", { userId });

      // Envia contadores individuais
      const naoLidasPendentes = await prisma.mensagem.groupBy({
        by: ["remetenteId"],
        where: { destinatarioId: userId, lida: false },
        _count: { _all: true },
      });

      // Se houver conversa aberta, removemos esse remetente da lista enviada
      const aberto = openConversationMap.get(userId);
      const pendentesFiltrados = aberto ? naoLidasPendentes.filter(p => p.remetenteId !== aberto) : naoLidasPendentes;

      for (const pendente of pendentesFiltrados) {
        socket.emit("atualizar_nao_lidas", {
          remetenteId: pendente.remetenteId,
          total: pendente._count._all,
        });
      }

      // Atualiza contador global (já filtra conversa aberta internamente)
      await emitirNotificacaoGlobal(io, userId);

    } catch (err) {
      console.error("❌ Erro ao registrar usuário:", err);
    }
  });

  /**
   * 2️⃣ Lista usuários online
   */
  socket.on("get_online_users", () => {
    const onlineUserIds = Array.from(userSocketMap.keys());
    socket.emit("online_users_list", onlineUserIds);
  });

  /**
   * 3️⃣ Envio de mensagens privadas
   */
  socket.on(
    "enviar_mensagem",
    async (data: { remetenteId?: number; destinatarioId: number; conteudo: string }) => {
      try {
        const { destinatarioId, conteudo } = data;
        const remetenteId = socket.data.userId;

        if (!remetenteId)
          return socket.emit("erro_mensagem", { erro: "Usuário não registrado." });
        if (!conteudo?.trim())
          return socket.emit("erro_mensagem", { erro: "Mensagem vazia." });

        console.log(`📨 ${remetenteId} → ${destinatarioId}: ${conteudo}`);

        // 💾 Salva no banco (lida = false)
        const novaMensagem = await prisma.mensagem.create({
          data: { remetenteId, destinatarioId, conteudo, lida: false },
          include: {
            remetente: { select: { id: true, nome: true, avatarUrl: true } },
            destinatario: { select: { id: true, nome: true, avatarUrl: true } },
          },
        });

        const remetenteSocketId = userSocketMap.get(remetenteId);
        const destinatarioSocketId = userSocketMap.get(destinatarioId);

        // 🔹 Envia "nova_mensagem" para remetente e destinatário (conteúdo completo)
        if (remetenteSocketId) io.to(remetenteSocketId).emit("nova_mensagem", novaMensagem);
        if (destinatarioSocketId) io.to(destinatarioSocketId).emit("nova_mensagem", novaMensagem);

        // 🔹 Atualiza contador individual do destinatário, contatos e notificações
        if (destinatarioSocketId) {
          // conta não-lidas do remetente para este destinatário (após inserir a nova mensagem)
          let naoLidas = await prisma.mensagem.count({
            where: { remetenteId, destinatarioId, lida: false },
          });

          // Se destinatário tem a conversa aberta com o remetente, considerar 0 para emissões
          const destinatarioAbertoCom = openConversationMap.get(destinatarioId);
          const deveOcultarContador = destinatarioAbertoCom === remetenteId;

          const naoLidasParaEmitir = deveOcultarContador ? 0 : naoLidas;

          io.to(destinatarioSocketId).emit("atualizar_nao_lidas", {
            remetenteId,
            total: naoLidasParaEmitir,
          });

          // Atualiza contador global do destinatário (função já filtra conversa aberta)
          await emitirNotificacaoGlobal(io, destinatarioId);

          // Atualiza lista de contatos do destinatário
          try {
            const conversas = await prisma.mensagem.findMany({
              where: { OR: [{ remetenteId: destinatarioId }, { destinatarioId: destinatarioId }] },
              include: {
                remetente: { select: { id: true, nome: true, avatarUrl: true } },
                destinatario: { select: { id: true, nome: true, avatarUrl: true } },
              },
              orderBy: { criadoEm: "desc" },
            });

            const contatosMap = new Map<number, Contato>();

            await Promise.all(
              conversas.map(async (msg) => {
                const outro =
                  msg.remetente.id === destinatarioId
                    ? msg.destinatario
                    : msg.remetente;

                let naoLidasOutro = await prisma.mensagem.count({
                  where: { remetenteId: outro.id, destinatarioId, lida: false },
                });

                // Se a conversa aberta do destinatário for justamente esse "outro", escondemos o contador
                if (openConversationMap.get(destinatarioId) === outro.id) naoLidasOutro = 0;

                contatosMap.set(outro.id, {
                  id: outro.id,
                  nome: outro.nome,
                  avatar:
                    outro.avatarUrl || `https://i.pravatar.cc/100?u=${outro.id}`,
                  online: userSocketMap.has(outro.id),
                  naoLidas: naoLidasOutro,
                });
              })
            );

            io.to(destinatarioSocketId).emit(
              "contatos_atualizados",
              Array.from(contatosMap.values())
            );
          } catch (err) {
            console.error("❌ Erro ao emitir contatos atualizados:", err);
          }

          // 🔔 Popup de notificação para o destinatário (apenas se conversa não estiver aberta)
          if (!deveOcultarContador) {
            io.to(destinatarioSocketId).emit("notificacao_mensagem", {
              titulo: "💬 Nova mensagem recebida",
              conteudo,
              remetente: novaMensagem.remetente.nome,
              remetenteId,
              timestamp: novaMensagem.criadoEm,
            });
          }
        } else {
          console.log(`📦 Usuário ${destinatarioId} offline. Mensagem salva.`);
        }

        // 🔁 Emite "nova_mensagem_lista" uma única vez para cada usuário (remetente e destinatário)
        //    O payload é construído com o "outro" (nome/avatar) apropriado para cada receptor.
        [remetenteId, destinatarioId].forEach((id) => {
          const socketId = userSocketMap.get(id);
          if (!socketId) return;

          const outro =
            id === remetenteId
              ? novaMensagem.destinatario
              : novaMensagem.remetente;

          io.to(socketId).emit("nova_mensagem_lista", {
            remetenteId,
            destinatarioId,
            conteudo,
            criadoEm: novaMensagem.criadoEm,
            nome: outro.nome,
            avatar:
              outro.avatarUrl || `https://i.pravatar.cc/100?u=${outro.id}`,
          });
        });

      } catch (err) {
        console.error("❌ Erro ao enviar mensagem:", err);
      }
    }
  );

  /**
   * 4️⃣ Digitação
   */
  socket.on("digitando", ({ remetenteId, destinatarioId }) => {
    const destSocket = userSocketMap.get(destinatarioId);
    if (destSocket) io.to(destSocket).emit("usuario_digitando", remetenteId);
  });

  socket.on("parou_digitando", ({ remetenteId, destinatarioId }) => {
    const destSocket = userSocketMap.get(destinatarioId);
    if (destSocket)
      io.to(destSocket).emit("usuario_parou_digitando", remetenteId);
  });

  /**
   * 5️⃣ Carregar histórico + marcar como lidas
   */
  socket.on(
    "carregar_historico",
    async ({ usuarioA, usuarioB }: { usuarioA: number; usuarioB: number }) => {
      try {
        await prisma.mensagem.updateMany({
          where: { remetenteId: usuarioB, destinatarioId: usuarioA, lida: false },
          data: { lida: true },
        });

        // Atualiza notificações globais e individuais depois de marcar como lidas
        await emitirNotificacaoGlobal(io, usuarioA);

        const naoLidas = await prisma.mensagem.count({
          where: { remetenteId: usuarioB, destinatarioId: usuarioA, lida: false },
        });

        const socketId = userSocketMap.get(usuarioA);
        if (socketId)
          io.to(socketId).emit("atualizar_nao_lidas", {
            remetenteId: usuarioB,
            total: naoLidas,
          });

        const mensagens = await prisma.mensagem.findMany({
          where: {
            OR: [
              { remetenteId: usuarioA, destinatarioId: usuarioB },
              { remetenteId: usuarioB, destinatarioId: usuarioA },
            ],
          },
          orderBy: { criadoEm: "asc" },
        });

        socket.emit("historico_carregado", mensagens);

      } catch (err) {
        console.error("❌ Erro ao carregar histórico:", err);
        socket.emit("erro_historico", { erro: "Falha ao carregar histórico." });
      }
    }
  );

  /**
   * 6️⃣ Listar contatos
   */
  socket.on("listar_contatos", async ({ userId }: { userId: number }) => {
    try {
      const conversas = await prisma.mensagem.findMany({
        where: { OR: [{ remetenteId: userId }, { destinatarioId: userId }] },
        include: {
          remetente: { select: { id: true, nome: true, avatarUrl: true } },
          destinatario: { select: { id: true, nome: true, avatarUrl: true } },
        },
        orderBy: { criadoEm: "desc" },
      });

      const contatosMap = new Map<number, Contato>();

      await Promise.all(
        conversas.map(async (msg) => {
          const outro =
            msg.remetente.id === userId ? msg.destinatario : msg.remetente;

          let naoLidas = await prisma.mensagem.count({
            where: { remetenteId: outro.id, destinatarioId: userId, lida: false },
          });

          // Se a conversa do usuário estiver aberta com esse contato, mostrar 0
          if (openConversationMap.get(userId) === outro.id) naoLidas = 0;

          contatosMap.set(outro.id, {
            id: outro.id,
            nome: outro.nome,
            avatar:
              outro.avatarUrl || `https://i.pravatar.cc/100?u=${outro.id}`,
            online: userSocketMap.has(outro.id),
            naoLidas,
          });
        })
      );

      socket.emit("contatos_atualizados", Array.from(contatosMap.values()));

    } catch (err) {
      console.error("❌ Erro ao listar contatos:", err);
      socket.emit("erro_contatos", { erro: "Falha ao listar contatos." });
    }
  });

  /**
   * 7️⃣ Desconexão
   */
  socket.on("disconnect", () => {
    const userId = socket.data.userId;

    if (userId) {
      userSocketMap.delete(userId);
      openConversationMap.delete(userId);
      io.emit("user_offline", { userId });
      console.log(`🔴 Usuário ${userId} desconectado`);
    } else {
      console.log(`🔴 Socket anônimo desconectado: ${socket.id}`);
    }
  });
}
// ...existing code...