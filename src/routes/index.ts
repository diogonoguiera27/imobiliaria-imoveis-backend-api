import { Router } from "express"
import { propertyRouter } from "./property.routes";
import { userRouter } from "./user.routes";
import { simulationRouter } from "./simulation.routes";

const routes = Router()

routes.use("/property", propertyRouter);
routes.use('/users', userRouter);
routes.use("/simulations", simulationRouter); 

export default routes;