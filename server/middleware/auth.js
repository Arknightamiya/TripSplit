import { AUTH_HEADER } from "../../shared/contracts.js";
import { getUserFromToken } from "../services/auth.js";
import { unauthorized } from "../utils/errors.js";

export function requireAuth(req, _res, next) {
  try {
    const header = req.get(AUTH_HEADER);

    if (!header?.startsWith("Bearer ")) {
      throw unauthorized();
    }

    const token = header.slice("Bearer ".length).trim();
    req.user = getUserFromToken(token);
    next();
  } catch (error) {
    next(error);
  }
}
