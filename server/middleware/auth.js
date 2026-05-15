import { AUTH_HEADER } from "../../shared/contracts.js";
import { getUserFromToken } from "../services/auth.js";
import { unauthorized } from "../utils/errors.js";

export async function requireAuth(req, _res, next) {
  try {
    const header = req.get(AUTH_HEADER);

    if (!header?.startsWith("Bearer ")) {
      throw unauthorized();
    }

    const token = header.slice("Bearer ".length).trim();
    req.user = await getUserFromToken(token);
    next();
  } catch (error) {
    next(error);
  }
}
