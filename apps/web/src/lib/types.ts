// Shared client types (mirror of the API contract; see apps/api/src/openapi.ts).
export type CustomerStatus = "Active" | "Inactive";
export type ShipmentStatus = "Pending" | "InTransit" | "Delivered" | "Cancelled";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "Admin" | "Staff";
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  company: string;
  status: CustomerStatus;
  createdAt: string;
  updatedAt: string;
  _count?: { shipments: number };
}

export interface CustomerOption {
  id: string;
  name: string;
  company: string;
}

export interface Shipment {
  id: string;
  trackingNumber: string;
  customerId: string;
  origin: string;
  destination: string;
  status: ShipmentStatus;
  createdAt: string;
  updatedAt: string;
  customer: { id: string; name: string; company: string };
}

export interface ShipmentDetail extends Shipment {
  customer: { id: string; name: string; company: string; email: string };
  events: { id: string; fromStatus: ShipmentStatus | null; toStatus: ShipmentStatus; createdAt: string; actor: string | null }[];
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface ShipmentSummary {
  Pending: number;
  InTransit: number;
  Delivered: number;
  Cancelled: number;
}

export interface ChatMessageEntry {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatReply {
  sessionId: string;
  messageId: string;
  content: string;
  provider: "live" | "mock" | "error";
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  author: string;
  publishedAt: string;
  source: string;
}

export interface AnalyzeResult {
  summary: {
    count: number;
    salespeople: number;
    regions: number;
    total: number;
    mean: number;
    median: number;
    min: number;
    max: number;
    std: number;
  };
  charts: {
    revenueByRegion: PlotlyFigure;
    topSalespeople: PlotlyFigure;
  };
  rowsAnalyzed: number;
  pngExportAvailable: boolean;
  png?: { revenueByRegion: string | null; topSalespeople: string | null };
}

export interface PlotlyFigure {
  data: unknown[];
  layout: Record<string, unknown>;
}

export interface ShipmentStatusChangedEvent {
  event: "shipment_status_changed";
  shipmentId: string;
  trackingNumber: string;
  oldStatus: string | null;
  status: ShipmentStatus;
  changedAt: string;
  actor: string;
}
