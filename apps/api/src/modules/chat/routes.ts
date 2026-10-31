import { Router } from "express";
import { chatService } from "./service.js";
import { chatRequestSchema } from "./schemas.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";

export const chatRouter = Router();

chatRouter.get("/sessions", async (req, res, next) => {
  try {
    res.json(await chatService.listSessions(req.principal!.sub));
  } catch (e) {
    next(e);
  }
});

const msgParams = z.object({ sessionId: z.string().min(1) });

// Verify session ownership before reading messages
chatRouter.get(
  "/sessions/:sessionId/messages",
  async (req, res, next) => {
    try {
      msgParams.parse(req.params);
      const owned = await chatService.listSessions(req.principal!.sub);
      if (!owned.some((s) => s.id === req.params.sessionId)) {
        return void res.status(404).json({ error: "Chat session not found", code: "NOT_FOUND", statusCode: 404 });
      }
      res.json(await chatService.getMessages(req.principal!.sub, req.params.sessionId, (req.query.before as string) || undefined));
    } catch (e) {
      next(e);
    }
  },
);

chatRouter.post("/chat", validate(chatRequestSchema), async (req, res, next) => {
  try {
    res.json(await chatService.chat(req.principal!, req.body));
  } catch (e) {
    next(e);
  }
});
