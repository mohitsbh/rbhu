import bcrypt from "bcryptjs";
import { prisma } from "../../lib/prisma.js";
import { Unauthorized } from "../../middleware/errors.js";
import { signToken, type AuthPrincipal } from "../../middleware/auth.js";
import type { LoginInput } from "./schemas.js";

export const authService = {
  /** Mock authentication flow (per assignment): seeded users in DB, signed JWT. */
  async login(input: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
      throw Unauthorized("Invalid email or password");
    }
    const principal: AuthPrincipal = { sub: user.id, email: user.email, name: user.name, role: user.role };
    return {
      token: signToken(principal),
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  },

  async me(principal: AuthPrincipal) {
    const user = await prisma.user.findUnique({
      where: { id: principal.sub },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw Unauthorized("User no longer exists");
    return user;
  },
};
