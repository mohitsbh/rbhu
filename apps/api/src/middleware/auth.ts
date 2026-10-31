// JWT authentication: verify bearer tokens issued by /auth/login and attach
// the authenticated principal to the request. Guard for WebSocket upgrades too.
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { StringValue } from "jsonwebtoken";
import { env } from "../env.js";
import { Unauthorized, Forbidden } from "./errors.js";

export interface AuthPrincipal {
  sub: string; // user id
  email: string;
  name: string;
  role: "Admin" | "Staff";
}

declare module "express-serve-static-core" {
  interface Request {
    principal?: AuthPrincipal;
  }
}

export function signToken(p: AuthPrincipal) {
  return jwt.sign(p, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as StringValue, issuer: "rbhu-api" });
}

export function verifyToken(token: string): AuthPrincipal | null {
  try {
    return jwt.verify(token, env.JWT_SECRET, { issuer: "rbhu-api" }) as unknown as AuthPrincipal;
  } catch {
    return null;
  }
}

function extractBearer(req: Request): string | null {
  const h = req.headers.authorization;
  if (h?.startsWith("Bearer ")) return h.slice(7);
  return null;
}

/** Strict guard – 401 without a valid token. */
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractBearer(req);
  const p = token && verifyToken(token);
  if (!p) return next(Unauthorized());
  req.principal = p;
  return next();
}

/** Role guard – use after requireAuth. */
export const requireRole = (...roles: AuthPrincipal["role"][]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.principal) return next(Unauthorized());
    if (!roles.includes(req.principal.role)) return next(Forbidden());
    return next();
  };
