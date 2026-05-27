import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getCurrentUserProfile,
  updateCurrentUserProfile
} from "../services/users.js";

export function createUsersRouter() {
  const router = Router();

  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      res.status(200).json(await getCurrentUserProfile(req.user.id));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/", async (req, res, next) => {
    try {
      res.status(200).json(await updateCurrentUserProfile(req.user.id, req.body));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
