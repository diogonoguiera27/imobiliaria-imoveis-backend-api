import { Router } from "express";
import { uploadAvatar } from "@/middlewares/upload";
import { verifyToken } from "@/middlewares/verifyToken";
import { isAdmin } from "@/middlewares/isAdmin";
import UserController from "@/Controllers/User";
import { authorizeRoles } from "@/middlewares/authorizeRoles";

export const userRouter = Router();
const userController = new UserController(); 


userRouter.post("/register", userController.postRegister.bind(userController));
userRouter.post("/login", userController.postLogin.bind(userController) );
userRouter.get("/me", verifyToken, userController.getMe.bind(userController))
userRouter.get("/", verifyToken, isAdmin,authorizeRoles("ADMIN"), userController.getUsers.bind(userController));
userRouter.delete("/:id", verifyToken,authorizeRoles("ADMIN", "USER", "CORRETOR"), userController.deleteUser.bind(userController));
userRouter.post("/upload/avatar/:id",verifyToken,authorizeRoles("ADMIN", "USER", "CORRETOR"),uploadAvatar.single("avatar"),userController.uploadAvatar.bind(userController))
userRouter.put("/:id/email",verifyToken,authorizeRoles("ADMIN", "USER", "CORRETOR"), userController.updateEmail.bind(userController))
userRouter.put("/:id/password", verifyToken,authorizeRoles("ADMIN", "USER", "CORRETOR"), userController.updatePassword.bind(userController))
userRouter.put("/:id", verifyToken,authorizeRoles("ADMIN", "USER", "CORRETOR"), userController.updateProfile.bind(userController));
userRouter.get("/:id/overview", verifyToken,authorizeRoles("ADMIN", "USER", "CORRETOR"), userController.getOverview.bind(userController));

export default userRouter;
