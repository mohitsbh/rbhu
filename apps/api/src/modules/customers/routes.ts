import { Router } from "express";
import { customerService } from "./service.js";
import {
  createCustomerSchema,
  listCustomersQuery,
  updateCustomerSchema,
} from "./schemas.js";
import { validate } from "../../middleware/validate.js";
import { z } from "zod";

export const customerRouter = Router();

// All customer routes are behind requireAuth (mounted with it in app.ts).
const idParam = z.object({ id: z.string().min(1) });

customerRouter.get(
  "/",
  async (req, res, next) => {
    try {
      res.json(await customerService.list(listCustomersQuery.parse(req.query)));
    } catch (e) {
      next(e);
    }
  },
);

customerRouter.get(
  "/options",
  async (_req, res, next) => {
    try {
      res.json(await customerService.options());
    } catch (e) {
      next(e);
    }
  },
);

customerRouter.get(
  "/:id",
  async (req, res, next) => {
    try {
      idParam.parse(req.params);
      res.json(await customerService.getById(req.params.id));
    } catch (e) {
      next(e);
    }
  },
);

customerRouter.post(
  "/",
  validate(createCustomerSchema),
  async (req, res, next) => {
    try {
      const created = await customerService.create(req.body, req.principal!.email);
      res.status(201).json(created);
    } catch (e) {
      next(e);
    }
  },
);

customerRouter.patch(
  "/:id",
  validate(updateCustomerSchema),
  async (req, res, next) => {
    try {
      idParam.parse(req.params);
      res.json(await customerService.update(req.params.id, req.body, req.principal!.email));
    } catch (e) {
      next(e);
    }
  },
);

customerRouter.delete(
  "/:id",
  async (req, res, next) => {
    try {
      idParam.parse(req.params);
      res.json(await customerService.softDelete(req.params.id, req.principal!.email));
    } catch (e) {
      next(e);
    }
  },
);
