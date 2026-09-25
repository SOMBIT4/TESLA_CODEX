import { Router } from "express";

export const apiRouter = Router();

apiRouter.get("/", (_request, response) => {
  response.json({
    data: {
      service: "api",
      version: "0.1.0",
    },
  });
});
