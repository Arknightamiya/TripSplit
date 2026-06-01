import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  addParticipantToTrip,
  createTripForUser,
  deleteTripForUser,
  endTripForUser,
  getTripForUser,
  inviteParticipantToTrip,
  listTripsForUser,
  removeParticipantFromTrip,
  setTripBudget,
  startTripForUser,
  updateTripForUser
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

  router.delete("/:tripId", async (req, res, next) => {
    try {
      res.status(200).json(await deleteTripForUser(req.user.id, req.params.tripId));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:tripId", async (req, res, next) => {
    try {
      res.status(200).json(await updateTripForUser(req.user.id, req.params.tripId, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:tripId/start", async (req, res, next) => {
    try {
      res.status(200).json(await startTripForUser(req.user.id, req.params.tripId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/:tripId/end", async (req, res, next) => {
    try {
      res.status(200).json(await endTripForUser(req.user.id, req.params.tripId));
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

  router.post("/:tripId/invitations", async (req, res, next) => {
    try {
      res
        .status(200)
        .json(await inviteParticipantToTrip(req.user.id, req.params.tripId, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:tripId/participants/:participantId", async (req, res, next) => {
    try {
      res
        .status(200)
        .json(await removeParticipantFromTrip(
          req.user.id,
          req.params.tripId,
          req.params.participantId
        ));
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
