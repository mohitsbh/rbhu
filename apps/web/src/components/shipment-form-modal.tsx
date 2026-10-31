"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shipmentForm } from "@/lib/schemas";
import { api, apiErrorMessage } from "@/lib/api";
import type { CustomerOption } from "@/lib/types";
import { Button, ErrorBanner, Field, Input, Modal, Select } from "@/components/ui";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function ShipmentFormModal({ open, onClose }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const options = useQuery({
    queryKey: ["customerOptions"],
    queryFn: async () => (await api.get<CustomerOption[]>("/customers/options")).data,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(shipmentForm),
    defaultValues: { trackingNumber: "", customerId: "", origin: "", destination: "" },
  });

  const mutation = useMutation({
    mutationFn: async (values: { trackingNumber: string; customerId: string; origin: string; destination: string }) =>
      (await api.post("/shipments", values)).data,
    onSuccess: (created: { trackingNumber: string }) => {
      void qc.invalidateQueries({ queryKey: ["shipments"] });
      void qc.invalidateQueries({ queryKey: ["shipmentsSummary"] });
      void qc.invalidateQueries({ queryKey: ["recentShipments"] });
      onClose();
      toast.toast({ title: "Shipment created", description: created.trackingNumber, variant: "success" });
    },
    onError: (err) => setServerError(apiErrorMessage(err)),
  });

  return (
    <Modal open={open} onClose={onClose} title="Create shipment">
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        {serverError ? <ErrorBanner message={serverError} /> : null}
        <Field label="Tracking number" required error={errors.trackingNumber?.message}>
          <Input placeholder="RBHU-00042" {...register("trackingNumber")} />
        </Field>
        <Field label="Customer" required error={errors.customerId?.message}>
          <Select {...register("customerId")}>
            <option value="">Select customer…</option>
            {(options.data ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.company}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Origin" required error={errors.origin?.message}>
          <Input placeholder="e.g. Seawoods, Navi Mumbai" {...register("origin")} />
        </Field>
        <Field label="Destination" required error={errors.destination?.message}>
          <Input placeholder="e.g. Pune Hub" {...register("destination")} />
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Create shipment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
