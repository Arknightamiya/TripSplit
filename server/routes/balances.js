import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getBalancesForTrip } from "../services/expenses.js";

export function createBalancesRouter() {
  const router = Router({ mergeParams: true });

  router.use(requireAuth);

  router.get("/", (req, res, next) => {
    try {
      res.status(200).json(getBalancesForTrip(req.user.id, req.params.tripId));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
