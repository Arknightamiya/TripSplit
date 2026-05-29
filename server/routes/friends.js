import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import {
  getFriendProfile,
  getFriendPublicTrips,
  getFriendsOverview,
  removeFriend,
  requestToJoinPublicTrip,
  respondToIncomingFriendRequest,
  respondToIncomingTripInvitation,
  respondToIncomingTripJoinRequest,
  searchFriends,
  sendFriendRequest
} from "../services/friends.js";

export function createFriendsRouter() {
  const router = Router();

  router.use(requireAuth);

  router.get("/", async (req, res, next) => {
    try {
      res.status(200).json(await getFriendsOverview(req.user.id));
    } catch (error) {
      next(error);
    }
  });

  router.get("/search", async (req, res, next) => {
    try {
      res.status(200).json(await searchFriends(req.user.id, req.query.query));
    } catch (error) {
      next(error);
    }
  });

  router.get("/public-trips", async (req, res, next) => {
    try {
      res.status(200).json(await getFriendPublicTrips(req.user.id));
    } catch (error) {
      next(error);
    }
  });

  router.post("/requests", async (req, res, next) => {
    try {
      res.status(201).json(await sendFriendRequest(req.user.id, req.body));
    } catch (error) {
      next(error);
    }
  });

  router.post("/requests/:requestId/accept", async (req, res, next) => {
    try {
      res
        .status(200)
        .json(await respondToIncomingFriendRequest(req.user.id, req.params.requestId, "accepted"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/requests/:requestId/decline", async (req, res, next) => {
    try {
      res
        .status(200)
        .json(await respondToIncomingFriendRequest(req.user.id, req.params.requestId, "declined"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/trips/:tripId/join-requests", async (req, res, next) => {
    try {
      res.status(201).json(await requestToJoinPublicTrip(req.user.id, req.params.tripId));
    } catch (error) {
      next(error);
    }
  });

  router.post("/trip-join-requests/:requestId/accept", async (req, res, next) => {
    try {
      res
        .status(200)
        .json(await respondToIncomingTripJoinRequest(req.user.id, req.params.requestId, "accepted"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/trip-join-requests/:requestId/decline", async (req, res, next) => {
    try {
      res
        .status(200)
        .json(await respondToIncomingTripJoinRequest(req.user.id, req.params.requestId, "declined"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/trip-invitations/:tripId/accept", async (req, res, next) => {
    try {
      res
        .status(200)
        .json(await respondToIncomingTripInvitation(req.user.id, req.params.tripId, "accepted"));
    } catch (error) {
      next(error);
    }
  });

  router.post("/trip-invitations/:tripId/decline", async (req, res, next) => {
    try {
      res
        .status(200)
        .json(await respondToIncomingTripInvitation(req.user.id, req.params.tripId, "declined"));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:friendId", async (req, res, next) => {
    try {
      res.status(200).json(await getFriendProfile(req.user.id, req.params.friendId));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/:friendId", async (req, res, next) => {
    try {
      res.status(200).json(await removeFriend(req.user.id, req.params.friendId));
    } catch (error) {
      next(error);
    }
  });

  return router;
}
