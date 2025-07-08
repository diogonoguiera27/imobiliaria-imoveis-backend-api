import { Router } from "express"
import { propertyRouter } from "./property.routes";

const routes = Router()

routes.use("/property", propertyRouter);

export default routes;