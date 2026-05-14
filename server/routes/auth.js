import { Router } from "express";
import { loginUser, registerUser } from "../services/auth.js";

export function createAuthRouter() {
  const router = Router();

  router.post("/register", (req, res, next) => {
    try {
      res.status(201).json(registerUser(req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/login", (req, res, next) => {
    try {
      res.status(200).json(loginUser(req.body));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
