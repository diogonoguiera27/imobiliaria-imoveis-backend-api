import { deleteUserService } from "@/Services/User/deleteUserService";
import { getAllUsersService } from "@/Services/User/getAllUsersService";
import { getUserByIdService } from "@/Services/User/getUserByIdService";
import { getUserOverviewService } from "@/Services/User/getUserOverviewService";
import { postLoginUserService } from "@/Services/User/postLoginUserService";
import { postRegisterUserService } from "@/Services/User/postRegisterUserService";
import { updateUserAvatarService } from "@/Services/User/putUserAvatarService";
import { updateUserEmailService } from "@/Services/User/putUserEmailService";
import { updateUserPasswordService } from "@/Services/User/putUserPasswordService";
import { updateUserProfileService } from "@/Services/User/putUserProfileService";
import { Request, Response } from "express";


interface MulterRequest extends Request {
  file?: Express.Multer.File;
}


export default class UserController {
  async getUsers(req: Request, res: Response) {
    try {
      res.set(
        "Cache-Control",
        "no-store, no-cache, must-revalidate, proxy-revalidate"
      );
      res.set("Pragma", "no-cache");
      res.set("Expires", "0");
      res.set("Surrogate-Control", "no-store");

      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const take = Math.max(1, parseInt(req.query.take as string) || 10);

      const result = await getAllUsersService(page, take);

      res.json(result);
    } catch (error) {
      console.error("Erro ao buscar usuários:", error);
      res.status(500).json({ error: "Erro ao buscar usuários" });
    }
  }

  async getMe(req: Request, res: Response) {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Não autenticado" });
      }

      const userId = Number(req.user.id);

      const me = await getUserByIdService(userId);

      if (!me) {
        return res.status(404).json({ error: "Usuário não encontrado" });
      }

      return res.status(200).json(me);
    } catch (error) {
      console.error("Erro no GET /users/me:", error);
      return res.status(500).json({ error: "Erro ao carregar perfil" });
    }
  }

  async deleteUser(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);

      if (!req.user || req.user.id !== id) {
        return res.status(403).json({ error: "Acesso negado." });
      }
      
        await deleteUserService(id);

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao deletar usuário:", error);
      res.status(500).json({ error: "Erro ao deletar usuário" });
    }
  }

  async uploadAvatar(req: MulterRequest, res: Response) {
    try {
      const id = Number(req.params.id);
      const file = req.file;

      if (!req.user || req.user.id !== id) {
        return res.status(403).json({ error: "Acesso negado." });
      }

      if (!file) {
        return res.status(400).json({ error: "Arquivo de imagem não enviado." });
      }

      const avatarUrl = `/uploads/avatars/${file.filename}`;

      await updateUserAvatarService(id, avatarUrl);

      return res.json({ avatarUrl });
    } catch (error) {
      console.error("Erro ao salvar avatar:", error);
      return res.status(500).json({ error: "Erro ao atualizar avatar" });
    }
  }

  async updateEmail(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { newEmail, motivo } = req.body;

      if (!req.user || req.user.id !== id) {
        return res.status(403).json({ error: "Acesso negado." });
      }

      if (!motivo || motivo.trim().length < 3) {
        return res.status(400).json({ error: "Motivo da alteração é obrigatório" });
      }

      if (!newEmail || typeof newEmail !== "string" || !newEmail.includes("@")) {
        return res.status(400).json({ error: "Email novo inválido ou ausente." });
      }

      const updatedUser = await updateUserEmailService(id, newEmail);

      return res.json({
        message: "Email alterado com sucesso",
        user: updatedUser,
      });
    } catch (err) {
      console.error("Erro ao alterar email:", err);
      return res.status(500).json({ error: "Erro interno ao alterar email" });
    }
  }

  async updatePassword(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { currentPassword, newPassword } = req.body;

      if (!req.user || req.user.id !== id) {
        return res.status(403).json({ error: "Acesso negado." });
      }

      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: "Senha atual e nova são obrigatórias." });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
      }

      try {
        await updateUserPasswordService(id, currentPassword, newPassword);
        return res.status(200).json({ message: "Senha alterada com sucesso" });
      } catch (error: any) {
        if (error.message === "NOT_FOUND") {
          return res.status(404).json({ error: "Usuário não encontrado" });
        }
        if (error.message === "INVALID_PASSWORD") {
          return res.status(401).json({ error: "Senha atual incorreta" });
        }
        throw error;
      }
    } catch (err) {
      console.error("Erro ao alterar senha:", err);
      return res.status(500).json({ error: "Erro interno ao alterar senha" });
    }
  }

  async updateProfile(req: Request, res: Response) {
    try {
      const id = Number(req.params.id);
      const { nome, telefone, cidade, avatarUrl } = req.body;

      if (!req.user || req.user.id !== id) {
        return res.status(403).json({ error: "Acesso negado." });
      }

      const data: Record<string, any> = {};
      if (nome) data.nome = nome;
      if (telefone) data.telefone = telefone;
      if (cidade) data.cidade = cidade;
      if (avatarUrl) data.avatarUrl = avatarUrl;

      if (Object.keys(data).length === 0) {
        return res.status(400).json({ error: "Nenhum dado para atualizar." });
      }

      const updatedUser = await updateUserProfileService(id, data);

      return res.status(200).json({
        message: "Usuário atualizado com sucesso",
        user: updatedUser,
      });
    } catch (error) {
      console.error("Erro ao atualizar usuário:", error);
      return res.status(500).json({ error: "Erro interno ao atualizar usuário" });
    }
  }

  async getOverview(req: Request, res: Response) {
    try {
      const userId = Number(req.params.id);

      if (!req.user || req.user.id !== userId) {
        return res.status(403).json({ error: "Acesso negado." });
      }

      try {
        const overview = await getUserOverviewService(userId);
        return res.status(200).json(overview);
      } catch (error: any) {
        if (error.message === "NOT_FOUND") {
          return res.status(404).json({ error: "Usuário não encontrado" });
        }
        throw error;
      }
    } catch (error) {
      console.error("Erro ao buscar overview:", error);
      return res.status(500).json({ error: "Erro ao carregar visão geral" });
    }
  }

  async postRegister(req: Request, res: Response) {
    try {
      const { nome, telefone, email, senha, cidade } = req.body;

      if (
        !nome ||
        typeof nome !== "string" ||
        !email ||
        typeof email !== "string" ||
        !senha ||
        typeof senha !== "string" ||
        !telefone ||
        typeof telefone !== "string" ||
        !cidade
      ) {
        return res.status(400).json({ error: "Dados inválidos ou incompletos." });
      }

      try {
        const user = await postRegisterUserService({ nome, telefone, email, senha, cidade });
        return res.status(201).json(user);
      } catch (error: any) {
        if (error.message === "EMAIL_IN_USE") {
          return res.status(400).json({ error: "Email já cadastrado." });
        }
        throw error;
      }
    } catch (error) {
      console.error("Erro ao criar usuário:", error);
      return res.status(500).json({ error: "Erro interno ao criar usuário" });
    }
  }
  
  async postLogin(req: Request, res: Response) {

    try {
      const { email, senha } = req.body;

      if (!email || !senha) {
        return res.status(400).json({ error: "Email e senha são obrigatórios." });
      }

      try {
        const result = await postLoginUserService({ email, senha });;


        return res.json({
          message: "Login bem-sucedido",
          ...result,
        });
      } catch (error: any) {
        if (error.message === "INVALID_CREDENTIALS") {
          return res.status(401).json({ error: "Credenciais inválidas." });
        }
        if (error.message === "MISSING_SECRET") {
          return res.status(500).json({ error: "JWT_SECRET ausente." });
        }
        throw error;
      }
    } catch (error) {
      console.error("Erro no login:", error);
      return res.status(500).json({ error: "Erro no login." });
    }
  }
}
