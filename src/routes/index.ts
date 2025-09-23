import { Router } from "express";
import { propertyRouter } from "./property.routes";
import { userRouter } from "./user.routes";
import { simulationRouter } from "./simulation.routes";
import { notificationRouter } from "./notification.routes";
import { favoriteRouter } from "./favorite.routes";
import { authRouter } from "./auth.routes";
import { dashboardRouter } from "./dashboard.routes";



const routes = Router();

routes.use("/property", propertyRouter);
routes.use("/users", userRouter);
routes.use("/simulations", simulationRouter);
routes.use("/notifications", notificationRouter); 
routes.use("/favorites", favoriteRouter);
routes.use("/auth", authRouter);
routes.use("/dashboard", dashboardRouter);


export default routes;
