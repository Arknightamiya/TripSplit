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

  router.get("/", (req, res, next) => {
    try {
      res.status(200).json(listTripsForUser(req.user.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/", (req, res, next) => {
    try {
      res.status(201).json(createTripForUser(req.user.id, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:tripId", (req, res, next) => {
    try {
      res.status(200).json(getTripForUser(req.user.id, req.params.tripId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:tripId/participants", (req, res, next) => {
    try {
      res
        .status(200)
        .json(addParticipantToTrip(req.user.id, req.params.tripId, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:tripId/budget", (req, res, next) => {
    try {
      res.status(200).json(setTripBudget(req.user.id, req.params.tripId, req.body));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
