import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { uploadAvatar } from "@/middlewares/upload";
import { verifyToken } from "@/middlewares/verifyToken";
import { isAdmin } from "@/middlewares/isAdmin";
import UserController from "@/Controllers/User";

export const userRouter = Router();
const prisma = new PrismaClient();
const userController = new UserController(); 


userRouter.post("/register", userController.postRegister.bind(userController));
userRouter.post("/login", userController.postLogin.bind(userController) );
userRouter.get("/me", verifyToken, userController.getMe.bind(userController))
userRouter.get("/", verifyToken, isAdmin, userController.getUsers.bind(userController));
userRouter.delete("/:id", verifyToken, userController.deleteUser.bind(userController));
userRouter.post("/upload/avatar/:id",verifyToken,uploadAvatar.single("avatar"),userController.uploadAvatar.bind(userController))
userRouter.put("/:id/email",verifyToken, userController.updateEmail.bind(userController))
userRouter.put("/:id/password", verifyToken, userController.updatePassword.bind(userController))
userRouter.put("/:id", verifyToken, userController.updateProfile.bind(userController));
userRouter.get("/:id/overview", verifyToken, userController.getOverview.bind(userController));

export default userRouter;
