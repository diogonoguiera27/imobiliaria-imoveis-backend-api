import { Server, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 🔹 Mapeia usuários conectados (userId → socketId)
const userSocketMap = new Map<number, string>();

// 🔹 Interface para contatos (frontend usa para listar conversas)
interface Contato {
  id: number;
  nome: string;
  avatar: string;
  online: boolean;
  naoLidas: number;
}

export function registerChatHandlers(io: Server, socket: Socket) {
  console.log(`💬 [ChatSocket] Nova conexão ativa: ${socket.id}`);

  /**
   * 1️⃣ Registrar usuário conectado
   */
  socket.on("registrar_usuario", async (userId: number) => {
    socket.data.userId = userId;
    userSocketMap.set(userId, socket.id);

    console.log(`✅ Usuário ${userId} vinculado ao socket ${socket.id}`);

    // Notifica todos que este usuário ficou online
    io.emit("user_online", { userId });
  });

  /**
   * 2️⃣ Sincronizar usuários online
   */
  socket.on("get_online_users", () => {
    const onlineUserIds = Array.from(userSocketMap.keys());
    socket.emit("online_users_list", onlineUserIds);
  });

  /**
   * 3️⃣ Enviar mensagem privada (entre usuários/corretores)
   */
  socket.on(
    "enviar_mensagem",
    async (data: {
      remetenteId?: number;
      destinatarioId: number;
      conteudo: string;
    }) => {
      try {
        const { destinatarioId, conteudo } = data;
        const remetenteId = socket.data.userId;

        if (!remetenteId) {
          return socket.emit("erro_mensagem", { erro: "Usuário não registrado." });
        }
        if (!conteudo?.trim()) {
          return socket.emit("erro_mensagem", { erro: "Mensagem vazia." });
        }

        console.log(`📩 ${remetenteId} → ${destinatarioId}: ${conteudo}`);

        // 💾 Salva no banco
        const novaMensagem = await prisma.mensagem.create({
          data: {
            remetenteId,
            destinatarioId,
            conteudo,
            lida: false,
          },
          include: {
            remetente: { select: { id: true, nome: true, avatarUrl: true, role: true } },
            destinatario: { select: { id: true, nome: true, avatarUrl: true, role: true } },
          },
        });

        const remetenteSocketId = userSocketMap.get(remetenteId);
        const destinatarioSocketId = userSocketMap.get(destinatarioId);

        // 🔹 Envia a mensagem para ambos (em tempo real)
        if (remetenteSocketId)
          io.to(remetenteSocketId).emit("nova_mensagem", novaMensagem);

        if (destinatarioSocketId) {
          io.to(destinatarioSocketId).emit("nova_mensagem", novaMensagem);

          // Atualiza contador de não lidas para o destinatário
          const naoLidas = await prisma.mensagem.count({
            where: { remetenteId, destinatarioId, lida: false },
          });

          io.to(destinatarioSocketId).emit("atualizar_nao_lidas", {
            remetenteId,
            total: naoLidas,
          });

          // 🔔 Envia notificação global (visível em qualquer tela)
          io.to(destinatarioSocketId).emit("notificacao_mensagem", {
            titulo: "Nova mensagem recebida",
            conteudo,
            remetente: novaMensagem.remetente.nome,
            remetenteId,
            timestamp: novaMensagem.criadoEm,
          });
        } else {
          console.log(`⚠️ Usuário ${destinatarioId} está offline.`);
        }

        // 🔁 Atualiza lista de conversas (para ambos)
        [remetenteId, destinatarioId].forEach((id) => {
          const socketId = userSocketMap.get(id);
          if (socketId) {
            const outro =
              id === remetenteId ? novaMensagem.destinatario : novaMensagem.remetente;

            io.to(socketId).emit("nova_mensagem_lista", {
              remetenteId,
              destinatarioId,
              conteudo,
              criadoEm: novaMensagem.criadoEm,
              nome: outro.nome,
              avatar: outro.avatarUrl || `https://i.pravatar.cc/100?u=${outro.id}`,
            });
          }
        });
      } catch (error) {
        console.error("❌ Erro ao enviar mensagem:", error);
        socket.emit("erro_mensagem", { erro: "Falha ao enviar mensagem." });
      }
    }
  );

  /**
   * 4️⃣ Indicação de digitação
   */
  socket.on("digitando", (data: { remetenteId: number; destinatarioId: number }) => {
    const { remetenteId, destinatarioId } = data;
    const destinatarioSocketId = userSocketMap.get(destinatarioId);
    if (destinatarioSocketId)
      io.to(destinatarioSocketId).emit("usuario_digitando", remetenteId);
  });

  socket.on("parou_digitando", (data: { remetenteId: number; destinatarioId: number }) => {
    const { remetenteId, destinatarioId } = data;
    const destinatarioSocketId = userSocketMap.get(destinatarioId);
    if (destinatarioSocketId)
      io.to(destinatarioSocketId).emit("usuario_parou_digitando", remetenteId);
  });

  /**
   * 5️⃣ Carregar histórico + marcar como lidas
   */
  socket.on("carregar_historico", async ({ usuarioA, usuarioB }: { usuarioA: number; usuarioB: number }) => {
    try {
      const mensagens = await prisma.mensagem.findMany({
        where: {
          OR: [
            { remetenteId: usuarioA, destinatarioId: usuarioB },
            { remetenteId: usuarioB, destinatarioId: usuarioA },
          ],
        },
        orderBy: { criadoEm: "asc" },
      });

      // Marca mensagens como lidas
      await prisma.mensagem.updateMany({
        where: { remetenteId: usuarioB, destinatarioId: usuarioA, lida: false },
        data: { lida: true },
      });

      // Atualiza contagem de não lidas
      const naoLidas = await prisma.mensagem.count({
        where: { remetenteId: usuarioB, destinatarioId: usuarioA, lida: false },
      });

      const socketId = userSocketMap.get(usuarioA);
      if (socketId)
        io.to(socketId).emit("atualizar_nao_lidas", {
          remetenteId: usuarioB,
          total: naoLidas,
        });

      socket.emit("historico_carregado", mensagens);
    } catch (error) {
      console.error("❌ Erro ao carregar histórico:", error);
      socket.emit("erro_historico", { erro: "Falha ao carregar histórico." });
    }
  });

  /**
   * 6️⃣ Listar contatos com contador e status
   */
  socket.on("listar_contatos", async ({ userId }: { userId: number }) => {
    try {
      const conversas = await prisma.mensagem.findMany({
        where: { OR: [{ remetenteId: userId }, { destinatarioId: userId }] },
        include: {
          remetente: { select: { id: true, nome: true, role: true, avatarUrl: true } },
          destinatario: { select: { id: true, nome: true, role: true, avatarUrl: true } },
        },
        orderBy: { criadoEm: "desc" },
      });

      const contatosMap = new Map<number, Contato>();

      for (const msg of conversas) {
        const outro = msg.remetente.id === userId ? msg.destinatario : msg.remetente;

        const naoLidas = await prisma.mensagem.count({
          where: { remetenteId: outro.id, destinatarioId: userId, lida: false },
        });

        contatosMap.set(outro.id, {
          id: outro.id,
          nome: outro.nome,
          avatar: outro.avatarUrl || `https://i.pravatar.cc/100?u=${outro.id}`,
          online: userSocketMap.has(outro.id),
          naoLidas,
        });
      }

      socket.emit("contatos_atualizados", Array.from(contatosMap.values()));
    } catch (error) {
      console.error("❌ Erro ao listar contatos:", error);
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
      io.emit("user_offline", { userId });
      console.log(`🔴 Usuário ${userId} desconectado`);
    } else {
      console.log(`🔴 Socket anônimo desconectado: ${socket.id}`);
    }
  });
}
