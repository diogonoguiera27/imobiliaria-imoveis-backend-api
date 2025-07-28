import { Router } from "express";
import { propertyRouter } from "./property.routes";
import { userRouter } from "./user.routes";
import { simulationRouter } from "./simulation.routes";
import { notificationRouter } from "./notification.routes";

const routes = Router();

routes.use("/property", propertyRouter);
routes.use("/users", userRouter);
routes.use("/simulations", simulationRouter);
routes.use("/notifications", notificationRouter); // ✅ adiciona a rota

export default routes;
