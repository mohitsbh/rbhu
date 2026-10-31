"use client";

// Global realtime notifications (Module 5). Connects once when a token
// exists; on shipment_status_changed it pops a toast and invalidates the
// relevant React Query caches so lists/dashboards refetch live.
import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { TOKEN_KEY } from "./api";
import type { ShipmentStatusChangedEvent } from "./types";
import { useToast } from "@/hooks/use-toast";

export function useRealtimeNotifications() {
  const qc = useQueryClient();
  const toast = useToast();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token || socketRef.current) return;

    const socket = io(process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000", {
      auth: { token },
      reconnectionDelayMax: 5000,
    });
    socketRef.current = socket;

    socket.on("shipment_status_changed", (e: ShipmentStatusChangedEvent) => {
      toast.toast({
        title: `Shipment ${e.trackingNumber}`,
        description: `${e.oldStatus ?? "—"} → ${e.status} · updated by ${e.actor}`,
        variant: "success",
      });
      void qc.invalidateQueries({ queryKey: ["shipments"] });
      void qc.invalidateQueries({ queryKey: ["shipmentsSummary"] });
      void qc.invalidateQueries({ queryKey: ["recentShipments"] });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [qc, toast]);
}
