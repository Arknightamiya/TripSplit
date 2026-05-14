import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  createExpenseForTrip,
  deleteExpenseFromTrip
} from "../services/expenses.js";

export function createExpensesRouter() {
  const router = Router({ mergeParams: true });

  router.use(requireAuth);

  router.post("/", (req, res, next) => {
    try {
      res
        .status(201)
        .json(createExpenseForTrip(req.user.id, req.params.tripId, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:expenseId", (req, res, next) => {
    try {
      res
        .status(200)
        .json(
          deleteExpenseFromTrip(
            req.user.id,
            req.params.tripId,
            req.params.expenseId
          )
        );
    } catch (error) {
      next(error);
    }
  });

  return router;
}
