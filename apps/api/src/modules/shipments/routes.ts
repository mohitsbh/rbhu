import { Router } from "express";
import { shipmentService } from "./service.js";
import {
  createShipmentSchema,
  listShipmentsQuery,
  shipmentStatusUpdateSchema,
} from "./schemas.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";

export const shipmentRouter = Router();

const idParam = z.object({ id: z.string().min(1) });

shipmentRouter.get("/summary", async (_req, res, next) => {
  try {
    res.json(await shipmentService.statusSummary());
  } catch (e) {
    next(e);
  }
});

shipmentRouter.get("/recent", async (_req, res, next) => {
  try {
    res.json(await shipmentService.recent());
  } catch (e) {
    next(e);
  }
});

shipmentRouter.get("/", async (req, res, next) => {
  try {
    res.json(await shipmentService.list(listShipmentsQuery.parse(req.query)));
  } catch (e) {
    next(e);
  }
});

shipmentRouter.get("/:id", async (req, res, next) => {
  try {
    idParam.parse(req.params);
    res.json(await shipmentService.getById(req.params.id));
  } catch (e) {
    next(e);
  }
});

shipmentRouter.post("/", validate(createShipmentSchema), async (req, res, next) => {
  try {
    const created = await shipmentService.create(req.body, req.principal!.email);
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

shipmentRouter.patch(
  "/:id/status",
  validate(shipmentStatusUpdateSchema),
  async (req, res, next) => {
    try {
      idParam.parse(req.params);
      const updated = await shipmentService.updateStatus(
        req.params.id,
        req.body.status,
        req.principal!.email,
      );
      res.json(updated);
    } catch (e) {
      next(e);
    }
  },
);
