import { Router } from "express";
import { loginSchema } from "./schemas.js";
import { authService } from "./service.js";
import { validate } from "../../middleware/validate.js";
import { requireAuth } from "../../middleware/auth.js";
import { HttpError } from "../../middleware/errors.js";

export const authRouter = Router();

authRouter.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (e) {
    if (e instanceof HttpError) return next(e);
    next(e);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    res.json(await authService.me(req.principal!));
  } catch (e) {
    next(e);
  }
});
