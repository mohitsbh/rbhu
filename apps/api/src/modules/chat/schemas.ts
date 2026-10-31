import { z } from "zod";

export const chatRequestSchema = z.object({
  message: z.string().trim().min(1, "Message is required").max(4000),
  sessionId: z.string().min(1).optional(), // nullable ⇒ create new session
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
