import { Router } from "express";

import { userRouter }  from "@/routes/user.routes";
import { simulationRouter } from "@/routes/simulation.routes";
import { notificationRouter } from "@/routes/notification.routes";
import { favoriteRouter } from "@/routes/favorite.routes";
import { authRouter } from "@/routes/auth.routes";
import { dashboardRouter } from "@/routes/dashboard.routes";
import { propertyRouter } from "@/routes/property.routes";



const routes = Router();

routes.use("/property", propertyRouter);
routes.use("/users", userRouter);
routes.use("/simulations", simulationRouter);
routes.use("/notifications", notificationRouter); 
routes.use("/favorites", favoriteRouter);
routes.use("/auth", authRouter);
routes.use("/dashboard", dashboardRouter);


export default routes;
