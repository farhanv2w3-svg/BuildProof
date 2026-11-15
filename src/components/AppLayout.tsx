import { Outlet, NavLink, Link, Navigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Compass,
  ShieldCheck,
  ClipboardCheck,
  Building2,
  Bell,
  ChevronLeft,
  Puzzle,
  Award,
  Briefcase,
  Cpu,
  CalendarDays,
  Settings2,
  Trophy,
} from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { Badge, Button, LoadingBlock } from "./ui";
import { SignOutButton } from "./layout";
import { useAuth } from "../lib/auth";
import { hasRoleAccess, rolesSummary } from "../lib/rbac";
import { listNotifications, markNotificationRead } from "../lib/api";
import type { AppRole } from "../types/database";
import { cn } from "../lib/utils";

/* App shell: sidebar nav (desktop) + topbar, role-aware */
export function AppLayout() {
  const { user, profile, roles, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="min-h-screen"><LoadingBlock label="Checking your session…" /></div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <AppSidebar roles={roles} name={profile?.full_name ?? ""} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <div className="h-0 min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[76rem] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

function AppSidebar({ roles, name }: { roles: AppRole[]; name: string }) {
  const [open, setOpen] = useState(false);

  const items: { to: string; label: string; icon: typeof Compass; show: boolean }[] = [
    { to: "/app", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/app/problems", label: "Problems", icon: Compass, show: true },
    { to: "/app/events", label: "Events", icon: CalendarDays, show: true },
    { to: "/app/eventspace", label: "EventSpace", icon: Trophy, show: true },
    { to: "/app/my-proof", label: "My Proof", icon: Award, show: true },
    { to: "/app/opportunities", label: "Opportunities", icon: Briefcase, show: true },
    { to: "/app/hardware", label: "Hardware", icon: Cpu, show: true },
    { to: "/app/organizations", label: "Organisations", icon: Puzzle, show: true },
    { to: "/app/mentor", label: "Mentoring", icon: ClipboardCheck, show: hasRoleAccess(roles, ["mentor"]) },
    { to: "/app/institution", label: "Institution", icon: Building2, show: hasRoleAccess(roles, ["institution_admin", "faculty_coordinator", "facilitator"]) },
    { to: "/app/admin", label: "Admin", icon: ShieldCheck, show: hasRoleAccess(roles, ["platform_admin"]) },
    { to: "/app/notification-preferences", label: "Notifications", icon: Settings2, show: true },
  ];

  const link = (it: (typeof items)[number]) => (
    <NavLink
      key={it.to}
      to={it.to}
      end={it.to === "/app"}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-[background-color,color] duration-200",
          isActive
            ? "bg-brand-700 text-white"
            : "text-ink-soft hover:bg-brand-100/70 hover:text-ink"
        )
      }
    >
      <it.icon className="h-4 w-4" />
      {it.label}
    </NavLink>
  );

  return (    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="border-b border-line px-4 py-4">
          <Link to="/"><Logo /></Link>
        </div>
        <nav aria-label="App" className="flex flex-1 flex-col gap-1 p-3">
          {items.filter((i) => i.show).map(link)}
        </nav>
        <div className="border-t border-line p-3">
          <p className="px-3 text-[12px] font-semibold text-ink">{name}</p>
          <p className="px-3 pb-2 pt-0.5 text-[11px] text-ink-soft">{rolesSummary(roles)}</p>
          <SignOutButton />
        </div>
      </aside>

      {/* Mobile drawer trigger handled in TopBar */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true">
          <button
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-surface shadow-lift">
            <div className="flex items-center justify-between border-b border-line px-4 py-4">
              <Logo />
              <button aria-label="Close" onClick={() => setOpen(false)} className="p-1 text-ink-soft">
                <ChevronLeft className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-1 flex-col gap-1 p-3">
              {items.filter((i) => i.show).map(link)}
            </nav>
            <div className="border-t border-line p-3">
              <p className="px-3 text-[12px] font-semibold text-ink">{name}</p>
              <p className="px-3 pb-2 pt-0.5 text-[11px] text-ink-soft">{rolesSummary(roles)}</p>
              <SignOutButton />
            </div>
          </aside>
        </div>
      )}

      {/* expose open state to TopBar */}
      <DrawerToggle onOpen={() => setOpen(true)} />
    </>
  );
}

/** Compact hamburger rendered inside the top bar (mobile only). */
let setDrawerOpen: (() => void) | null = null;
function DrawerToggle({ onOpen }: { onOpen: () => void }) {
  setDrawerOpen = onOpen;
  return null;
}
export function triggerDrawer() {
  setDrawerOpen?.();
}

function TopBar() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data: notifications } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: () => listNotifications(user!.id),
    enabled: !!user,
    // A12: the bell must not go stale. The app-wide default keeps
    // refetchOnWindowFocus off (analytics, dashboards); the bell re-validates
    // whenever the tab regains focus so unread counts stay honest. No polling.
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const unread = (notifications ?? []).filter((n) => !n.read).length;

  return (
    <header className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex items-center gap-2">
        <button
          className="rounded-md p-2 text-ink-soft md:hidden"
          aria-label="Open menu"
          onClick={() => triggerDrawer()}
        >
          <span className="block h-0.5 w-5 rounded bg-current shadow-[0_5px_0_currentColor,0_-5px_0_currentColor]" />
        </button>
        <Badge tone="brand">BuildProof workspace</Badge>
      </div>
      <div className="relative">
        <button
          className="relative rounded-lg p-2 text-ink-soft hover:bg-line/40 hover:text-ink"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          onClick={() => setOpen((value) => !value)}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-lime-400 px-1 text-[10px] font-bold text-ink">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </button>
        {open && (
          <div className="absolute right-0 z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-card border border-line bg-surface p-3 shadow-lift">
            <p className="px-1 pb-2 text-[12px] font-bold uppercase tracking-wide text-ink-soft">
              Notifications
            </p>
            {(notifications ?? []).length === 0 ? (
              <p className="px-1 pb-1 text-[13px] text-ink-soft">
                Nothing yet. Activity on your teams and submissions will appear here.
              </p>
            ) : (
              <ul className="max-h-80 space-y-1 overflow-y-auto">
                {notifications!.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <button
                      className={cn(
                        "w-full rounded-md px-2 py-2 text-left text-[13px]",
                        n.read ? "text-ink-soft" : "bg-brand-50 text-ink"
                      )}
                      onClick={async () => {
                        setOpen(false);
                        if (!n.read) {
                          await markNotificationRead(n.id).catch(() => undefined);
                          // A12: reflect the change in the unread count immediately.
                          await qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
                        }
                      }}
                    >
                      <span className="block font-semibold">{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-[12px]">{n.body}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {unread > 0 && (
              <div className="pt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={async () => {
                    const unreadList = (notifications ?? []).filter((n) => !n.read);
                    for (const n of unreadList) await markNotificationRead(n.id).catch(() => undefined);
                    // A12: unread badge updates without waiting for a refocus.
                    await qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
                  }}
                >
                  Mark all read
                </Button>
              </div>
            )}
            <Link to="/app/notifications" onClick={() => setOpen(false)} className="mt-2 block text-center text-[12px] font-semibold text-brand-700">
              View all notifications
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
