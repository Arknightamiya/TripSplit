import { Router } from "express";
import { loginUser, registerUser } from "../services/auth.js";

export function createAuthRouter() {
  const router = Router();

  router.post("/register", async (req, res, next) => {
    try {
      res.status(201).json(await registerUser(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", async (req, res, next) => {
    try {
      res.status(200).json(await loginUser(req.body));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
