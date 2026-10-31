"use client";

// Login screen (Module 2 – mock authentication flow).
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginForm } from "@/lib/schemas";
import { useAuth } from "@/lib/auth-context";
import { apiErrorMessage } from "@/lib/api";
import { Button, ErrorBanner, Field, Input } from "@/components/ui";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const { login, user, ready } = useAuth();
  const toast = useToast();
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
    setError,
  } = useForm({
    resolver: zodResolver(loginForm),
    defaultValues: { email: "", password: "" },
  });

  useEffect(() => {
    if (ready && user) router.replace("/dashboard");
  }, [ready, user, router]);

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login(values.email, values.password);
      toast.toast({ title: "Signed in", variant: "success" });
      router.replace("/dashboard");
    } catch (err) {
      setError("root", { message: apiErrorMessage(err) });
    }
  });

  const fillDemo = (role: "admin" | "staff") => {
    setValue("email", role === "admin" ? "admin@rbhu.in" : "staff@rbhu.in");
    setValue("password", role === "admin" ? "Admin@12345" : "Staff@12345");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-950 via-indigo-900 to-slate-900 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-900 text-lg font-bold text-white">
            R
          </div>
          <h1 className="text-xl font-bold text-slate-900">RBHU Operations</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to the internal platform</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {typeof errors.root?.message === "string" ? <ErrorBanner message={errors.root.message} /> : null}
          <Field label="Email" required error={errors.email?.message}>
            <Input type="email" autoComplete="email" placeholder="admin@rbhu.in" {...register("email")} />
          </Field>
          <Field label="Password" required error={errors.password?.message}>
            <Input type="password" autoComplete="current-password" placeholder="••••••••" {...register("password")} />
          </Field>
          <Button type="submit" loading={isSubmitting} className="w-full">
            Sign in
          </Button>
        </form>

        <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
          <p className="mb-1 font-medium text-slate-600">Demo accounts (mock auth)</p>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="w-full text-xs" onClick={() => fillDemo("admin")}>
              admin@rbhu.in
            </Button>
            <Button type="button" variant="secondary" className="w-full text-xs" onClick={() => fillDemo("staff")}>
              staff@rbhu.in
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
