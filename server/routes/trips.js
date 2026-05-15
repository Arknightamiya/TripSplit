import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  addParticipantToTrip,
  createTripForUser,
  getTripForUser,
  listTripsForUser,
  setTripBudget
} from "../services/trips.js";

export function createTripsRouter() {
  const router = Router();

  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      res.status(200).json(await listTripsForUser(req.user.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      res.status(201).json(await createTripForUser(req.user.id, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:tripId", async (req, res, next) => {
    try {
      res.status(200).json(await getTripForUser(req.user.id, req.params.tripId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:tripId/participants", async (req, res, next) => {
    try {
      res
        .status(200)
        .json(await addParticipantToTrip(req.user.id, req.params.tripId, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:tripId/budget", async (req, res, next) => {
    try {
      res
        .status(200)
        .json(await setTripBudget(req.user.id, req.params.tripId, req.body));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
