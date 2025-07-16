import { Router } from "express"
import { propertyRouter } from "./property.routes";
import { userRouter } from "./user.routes";

const routes = Router()

routes.use("/property", propertyRouter);
routes.use('/users', userRouter);

export default routes;