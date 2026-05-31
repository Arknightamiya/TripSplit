import { Router } from "express";
import { listSupportedCurrencies } from "../services/currencies.js";

export function createCurrenciesRouter() {
  const router = Router();

  router.get("/", async (_req, res, next) => {
    try {
      res.status(200).json(await listSupportedCurrencies());
    } catch (error) {
      next(error);
    }
  });

  return router;
}
