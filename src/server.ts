import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

import path from "path";
import { errors, isCelebrateError } from 'celebrate';
import routes from './routes';


dotenv.config();

const app = express();
const prisma = new PrismaClient();


app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

app.use(cors());
app.use(express.json());
app.use(routes);
app.use(errors());


app.get('/', (req, res) => {
  res.send('API funcionando! 🚀');
});


app.use((err: Error, request: Request, response: Response, _: NextFunction) => {
  if (isCelebrateError(err)) {
    const validationError =
      err.details.get("body") ||
      err.details.get("params") ||
      err.details.get("query");
    const message = validationError?.message || "Validation error";

    return response.status(400).json({
      status: "error",
      message,
    });
  }

  return response.status(500).json({
    status: "error",
    message: "Internal server error",
  });
});


const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT} 🚀`);
});
