"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerForm } from "@/lib/schemas";
import { api, apiErrorMessage } from "@/lib/api";
import type { Customer } from "@/lib/types";
import { Button, ErrorBanner, Field, Input, Modal, Select, Spinner } from "@/components/ui";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
  customer: Customer | null; // null = create
}

export function CustomerFormModal({ open, onClose, customer }: Props) {
  const qc = useQueryClient();
  const toast = useToast();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(customerForm),
    defaultValues: {
      name: customer?.name ?? "",
      email: customer?.email ?? "",
      company: customer?.company ?? "",
      status: customer?.status ?? "Active",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: { name: string; email: string; company: string; status: "Active" | "Inactive" }) => {
      if (customer) await api.patch(`/customers/${customer.id}`, values);
      else await api.post("/customers", values);
      return customer ? "updated" : "created";
    },
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customerCount"] });
      onClose();
      toast.toast({ title: `Customer ${result}`, variant: "success" });
    },
    onError: (err) => setServerError(apiErrorMessage(err)),
  });

  return (
    <Modal open={open} onClose={onClose} title={customer ? "Edit customer" : "Add customer"}>
      <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4" noValidate>
        {serverError ? <ErrorBanner message={serverError} /> : null}
        <Field label="Name" required error={errors.name?.message}>
          <Input placeholder="Full name" {...register("name")} />
        </Field>
        <Field label="Email" required error={errors.email?.message}>
          <Input type="email" placeholder="name@company.in" {...register("email")} />
        </Field>
        <Field label="Company" required error={errors.company?.message}>
          <Input placeholder="Company name" {...register("company")} />
        </Field>
        <Field label="Status" required error={errors.status?.message}>
          <Select {...register("status")}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </Select>
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {customer ? "Save changes" : "Create customer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function useCustomerModal(onDone: () => void) {
  const [state, setState] = useState<{ open: boolean; customer: Customer | null }>({ open: false, customer: null });
  return {
    modal: state.open ? (
      <CustomerFormModal
        open
        onClose={() => {
          setState({ open: false, customer: null });
          onDone();
        }}
        customer={state.customer}
      />
    ) : null,
    edit: (c: Customer) => setState({ open: true, customer: c }),
    create: () => setState({ open: true, customer: null }),
    close: () => setState({ open: false, customer: null }),
  };
}

export function useCustomerDelete(onDone?: () => void) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`/customers/${id}`)).data,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["customers"] });
      void qc.invalidateQueries({ queryKey: ["customerCount"] });
      toast.toast({ title: "Customer soft-deleted", description: "deletedAt stamped, kept for audit", variant: "success" });
      onDone?.();
    },
    onError: (err) => toast.toast({ title: "Delete failed", description: apiErrorMessage(err), variant: "error" }),
  });
}

export function CustomersLoading() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner className="h-8 w-8 text-indigo-700" />
    </div>
  );
}
