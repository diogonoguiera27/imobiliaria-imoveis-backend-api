
import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();


const userSocketMap = new Map<number, string>();


const openConversationMap = new Map<number, number>();


interface Contato {
  id: number;
  nome: string;
  avatar: string;
  online: boolean;
  naoLidas: number;
}


async function emitirNotificacaoGlobal(io: Server, userId: number) {
  try {
    const naoLidasPorContato = await prisma.mensagem.groupBy({
      by: ["remetenteId"],
      where: { destinatarioId: userId, lida: false },
      _count: { _all: true },
    });

    
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


export function registerChatHandlers(io: Server, socket: Socket) {
  console.log(`💬 [ChatSocket] Nova conexão: ${socket.id}`);

  
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

  
  socket.on("registrar_usuario", async (userId: number) => {
    try {
      socket.data.userId = userId;
      userSocketMap.set(userId, socket.id);
      console.log(`✅ Usuário ${userId} vinculado ao socket ${socket.id}`);

      io.emit("user_online", { userId });

      
      const naoLidasPendentes = await prisma.mensagem.groupBy({
        by: ["remetenteId"],
        where: { destinatarioId: userId, lida: false },
        _count: { _all: true },
      });

      
      const aberto = openConversationMap.get(userId);
      const pendentesFiltrados = aberto ? naoLidasPendentes.filter(p => p.remetenteId !== aberto) : naoLidasPendentes;

      for (const pendente of pendentesFiltrados) {
        socket.emit("atualizar_nao_lidas", {
          remetenteId: pendente.remetenteId,
          total: pendente._count._all,
        });
      }

      
      await emitirNotificacaoGlobal(io, userId);

    } catch (err) {
      console.error("❌ Erro ao registrar usuário:", err);
    }
  });

  socket.on("get_online_users", () => {
    const onlineUserIds = Array.from(userSocketMap.keys());
    socket.emit("online_users_list", onlineUserIds);
  });

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

        
        const novaMensagem = await prisma.mensagem.create({
          data: { remetenteId, destinatarioId, conteudo, lida: false },
          include: {
            remetente: { select: { id: true, nome: true, avatarUrl: true } },
            destinatario: { select: { id: true, nome: true, avatarUrl: true } },
          },
        });

        const remetenteSocketId = userSocketMap.get(remetenteId);
        const destinatarioSocketId = userSocketMap.get(destinatarioId);

        
        if (remetenteSocketId) io.to(remetenteSocketId).emit("nova_mensagem", novaMensagem);
        if (destinatarioSocketId) io.to(destinatarioSocketId).emit("nova_mensagem", novaMensagem);

        
        if (destinatarioSocketId) {
          
          let naoLidas = await prisma.mensagem.count({
            where: { remetenteId, destinatarioId, lida: false },
          });

          
          const destinatarioAbertoCom = openConversationMap.get(destinatarioId);
          const deveOcultarContador = destinatarioAbertoCom === remetenteId;

          const naoLidasParaEmitir = deveOcultarContador ? 0 : naoLidas;

          io.to(destinatarioSocketId).emit("atualizar_nao_lidas", {
            remetenteId,
            total: naoLidasParaEmitir,
          });

          
          await emitirNotificacaoGlobal(io, destinatarioId);

          
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

  
  socket.on("digitando", ({ remetenteId, destinatarioId }) => {
    const destSocket = userSocketMap.get(destinatarioId);
    if (destSocket) io.to(destSocket).emit("usuario_digitando", remetenteId);
  });

  socket.on("parou_digitando", ({ remetenteId, destinatarioId }) => {
    const destSocket = userSocketMap.get(destinatarioId);
    if (destSocket)
      io.to(destSocket).emit("usuario_parou_digitando", remetenteId);
  });

  socket.on(
    "carregar_historico",
    async ({ usuarioA, usuarioB }: { usuarioA: number; usuarioB: number }) => {
      try {
        await prisma.mensagem.updateMany({
          where: { remetenteId: usuarioB, destinatarioId: usuarioA, lida: false },
          data: { lida: true },
        });

        
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
