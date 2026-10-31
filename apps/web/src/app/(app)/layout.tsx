"use client";

// Protected app shell: guard + sidebar nav + main content.
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useEffect } from "react";
import clsx from "clsx";
import { LayoutDashboard, Users, Package, MessageSquareText, Megaphone, BarChart3, LogOut, Truck } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useRealtimeNotifications } from "@/lib/use-notifications";
import { Spinner } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/shipments", label: "Shipments", icon: Package },
  { href: "/analytics", label: "Sales Analytics", icon: BarChart3 },
  { href: "/assistant", label: "AI Assistant", icon: MessageSquareText },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, ready, logout } = useAuth();
  useRealtimeNotifications();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8 text-indigo-700" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col bg-indigo-950 text-white lg:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 font-bold">R</div>
          <div>
            <p className="text-sm font-semibold">RBHU Operations</p>
            <p className="text-[11px] text-indigo-300">internal platform</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="Primary">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                pathname.startsWith(href) ? "bg-white/10 font-semibold text-white" : "text-indigo-200 hover:bg-white/5 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-[11px] text-indigo-300">{user.email}</p>
          <button onClick={logout} className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-indigo-200 hover:bg-white/5 hover:text-white">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-indigo-900" />
            <span className="font-semibold text-indigo-950">RBHU Operations</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto">
            {NAV.map(({ href, label }) => (
              <Link key={href} href={href} className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100">
                {label}
              </Link>
            ))}
            <button onClick={logout} className="rounded px-2 py-1 text-xs text-rose-600 hover:bg-rose-50">
              Sign out
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
