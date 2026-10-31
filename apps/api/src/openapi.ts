// OpenAPI 3.0 – hand-authored contract so reviewers get docs at /docs
// (Swagger UI). Sources of truth: PRD §4 and routes/*.ts.
import type { Request, Response } from "express";
import { env } from "./env.js";

const bearer = [{ bearerAuth: [] }] as const;

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "RBHU Platform API",
    version: "1.0.0",
    description:
      "Customer & Shipment Management API (Module 1) + Auth, AI assistant (Module 4), realtime WS (Module 5), announcements (Bonus 3). " +
      "All business routes require `Authorization: Bearer <jwt>` from POST /auth/login. Validation errors return 422 with per-field details.",
  },
  servers: [{ url: `http://localhost:${env.PORT}` }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Customer: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          company: { type: "string" },
          status: { type: "string", enum: ["Active", "Inactive"] },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      Shipment: {
        type: "object",
        properties: {
          id: { type: "string" },
          trackingNumber: { type: "string", example: "RBHU-00012" },
          customerId: { type: "string" },
          origin: { type: "string" },
          destination: { type: "string" },
          status: { type: "string", enum: ["Pending", "InTransit", "Delivered", "Cancelled"] },
        },
      },
      Error: {
        type: "object",
        properties: {
          error: { type: "string" },
          code: { type: "string" },
          statusCode: { type: "integer" },
          details: { type: "object", nullable: true },
        },
      },
    },
  },
  paths: {
    "/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login (mock flow, seeded users) – issues JWT",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email", example: "admin@rbhu.in" },
                  password: { type: "string", example: "Admin@12345" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "JWT + user profile" },
          "401": { description: "Invalid credentials" },
        },
      },
    },
    "/auth/me": { get: { tags: ["Auth"], summary: "Current user", security: bearer, responses: { "200": { description: "User profile" }, "401": { description: "Unauthorized" } } } },
    "/customers": {
      get: {
        tags: ["Customers"],
        summary: "List customers (paginated, filtered)",
        security: bearer,
        parameters: [
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10, maximum: 100 } },
          { name: "q", in: "query", schema: { type: "string" }, description: "Free-text search on name/company/email" },
          { name: "status", in: "query", schema: { type: "string", enum: ["Active", "Inactive"] } },
        ],
        responses: { "200": { description: "Paged customers" }, "401": { description: "Unauthorized" } },
      },
      post: {
        tags: ["Customers"],
        summary: "Create customer",
        security: bearer,
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/Customer" } } } },
        responses: {
          "201": { description: "Created" },
          "409": { description: "Duplicate email+company" },
          "422": { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
        },
      },
    },
    "/customers/options": { get: { tags: ["Customers"], summary: "Active customers (for shipment picker)", security: bearer, responses: { "200": { description: "id/name/company list" } } } },
    "/customers/{id}": {
      get: { tags: ["Customers"], summary: "Get one", security: bearer, parameters: [{ $ref: "#/components/parameters/Id" }], responses: { "200": { description: "Customer" }, "404": { description: "Not found" } } },
      patch: { tags: ["Customers"], summary: "Update (partial)", security: bearer, parameters: [{ $ref: "#/components/parameters/Id" }], responses: { "200": { description: "Updated" }, "404": { description: "Not found" }, "422": { description: "Validation" } } },
      delete: { tags: ["Customers"], summary: "Soft delete (stamps deletedAt)", security: bearer, parameters: [{ $ref: "#/components/parameters/Id" }], responses: { "200": { description: "Soft deleted" }, "404": { description: "Not found" } } },
    },
    "/shipments": {
      get: {
        tags: ["Shipments"],
        summary: "List shipments (paginated)",
        security: bearer,
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["Pending", "InTransit", "Delivered", "Cancelled"] } },
          { name: "customerId", in: "query", schema: { type: "string" } },
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", schema: { type: "integer", default: 1 } },
          { name: "limit", in: "query", schema: { type: "integer", default: 10 } },
        ],
        responses: { "200": { description: "Paged shipments", content: { "application/json": { schema: { type: "object", properties: { items: { type: "array", items: { $ref: "#/components/schemas/Shipment" } }, total: { type: "integer" }, page: { type: "integer" }, pages: { type: "integer" } } } } } } },
      },
      post: { tags: ["Shipments"], summary: "Create shipment (starts Pending + first audit event)", security: bearer, responses: { "201": { description: "Created" }, "404": { description: "Unknown customer" }, "409": { description: "Duplicate tracking number" } } },
    },
    "/shipments/summary": { get: { tags: ["Shipments"], summary: "Status distribution counts", security: bearer, responses: { "200": { description: "{Pending,InTransit,Delivered,Cancelled}" } } } },
    "/shipments/recent": { get: { tags: ["Shipments"], summary: "Most recent 5 shipments", security: bearer, responses: { "200": { description: "Array" } } } },
    "/shipments/{id}": {
      get: { tags: ["Shipments"], summary: "Details + audit trail", security: bearer, parameters: [{ $ref: "#/components/parameters/Id" }], responses: { "200": { description: "Shipment incl. customer + events" }, "404": { description: "Not found" } } },
    },
    "/shipments/{id}/status": {
      patch: {
        tags: ["Shipments"],
        summary: "Update status – broadcasts shipment_status_changed over WS",
        security: bearer,
        parameters: [{ $ref: "#/components/parameters/Id" }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["status"], properties: { status: { type: "string", enum: ["Pending", "InTransit", "Delivered", "Cancelled"] } } } } } },
        responses: { "200": { description: "Updated + event emitted" }, "404": { description: "Not found" } },
      },
    },
    "/chat/sessions": { get: { tags: ["Chat"], summary: "List AI chat sessions", security: bearer, responses: { "200": { description: "Sessions" } } } },
    "/chat/sessions/{id}/messages": {
      get: { tags: ["Chat"], summary: "Conversation history", security: bearer, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "before", in: "query", schema: { type: "string", format: "date-time" }, description: "Pagination cursor" }], responses: { "200": { description: "Messages (desc, max 50)" }, "404": { description: "Not found" } } },
    },
    "/chat": {
      post: {
        tags: ["Chat"],
        summary: "Send a message to the AI assistant (creates/continues a session)",
        security: bearer,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["message"], properties: { message: { type: "string", example: "How many shipments are in transit?" }, sessionId: { type: "string", description: "omit to start a new conversation" } } } } } },
        responses: { "200": { description: "Assistant reply + sessionId" }, "401": { description: "Unauthorized" } },
      },
    },
    "/announcements": { get: { tags: ["Announcements"], summary: "Intranet announcements (Bonus 3, mocked SharePoint preview)", security: bearer, responses: { "200": { description: "{ items, meta }" } } } },
    "/health": { get: { tags: ["Ops"], summary: "Health check", responses: { "200": { description: "ok (+ db state)" } } } },
  },
  componentsParameters: undefined as never,
} as unknown as Record<string, unknown>;

openApiDocument["components" as keyof typeof openApiDocument] = {
  ...((openApiDocument.components as Record<string, unknown>) ?? {}),
  parameters: {
    Id: { name: "id", in: "path", required: true, schema: { type: "string" } },
  },
};

export function serveOpenApi(_req: Request, res: Response) {
  res.json(openApiDocument);
}
