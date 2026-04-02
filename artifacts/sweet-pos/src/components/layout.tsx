import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Store, Package, Users, BarChart3, LogOut, Sun, Moon, Settings,
  Lock, Timer, LayoutDashboard, ShoppingCart, ChevronLeft, ChevronRight,
  Menu, X, Bell
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { LockScreen } from "@/components/lock-screen";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { useQuery } from "@tanstack/react-query";

const BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.BASE_URL).replace(/\/$/, "");

const PAGE_TITLES: Record<string, string> = {
  "/": "Point of Sale",
  "/dashboard": "Dashboard",
  "/orders": "Orders",
  "/inventory": "Inventory",
  "/staff": "Staff",
  "/reports": "Reports",
  "/timeclock": "Time Clock",
  "/settings": "Settings",
};

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isLoading, isLocked, lock } = useAuth();
  const { can } = usePermissions();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  useAutoLock(lock, !!user && !isLocked);

  const { data: alertData } = useQuery<{ totalAlertCount: number }>({
    queryKey: ["layout-inventory-alerts"],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/inventory/alerts`, { credentials: "include" });
      if (!r.ok) return { totalAlertCount: 0 };
      return r.json();
    },
    refetchInterval: 120000,
    enabled: !!user,
  });
  const inventoryAlertCount = alertData?.totalAlertCount ?? 0;

  useEffect(() => {
    if (!isLoading && !user && location !== "/login") {
      window.location.href = "/login";
    }
  }, [user, isLoading, location]);

  const toggleCollapsed = () => {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  };

  if (isLoading || (!user && location !== "/login")) {
    return <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">Loading…</div>;
  }

  if (location === "/login") return <>{children}</>;

  const allNavItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", permission: "dashboard" as const },
    { href: "/", icon: ShoppingCart, label: "POS", permission: "pos" as const },
    { href: "/inventory", icon: Package, label: "Inventory", permission: "inventory" as const },
    { href: "/staff", icon: Users, label: "Staff", permission: "staff" as const },
    { href: "/timeclock", icon: Timer, label: "Time Clock", permission: "timeclock" as const },
    { href: "/reports", icon: BarChart3, label: "Reports", permission: "reports" as const },
    { href: "/settings", icon: Settings, label: "Settings", permission: "settings" as const },
  ];

  const navItems = allNavItems.filter(item => can(item.permission));
  const pageTitle = PAGE_TITLES[location] ?? "SweetPOS";
  const userInitial = user?.name?.charAt(0)?.toUpperCase() ?? "?";

  return (
    <div className="flex h-screen overflow-hidden bg-background relative">
      {isLocked && <LockScreen />}

      {/* ── Mobile overlay when sidebar is open ─────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar (desktop always visible, mobile as drawer) ───── */}
      <aside
        className={[
          "flex-shrink-0 border-r bg-card flex flex-col z-40 transition-all duration-300",
          /* Mobile: full-height drawer, slides in/out */
          "fixed inset-y-0 left-0 md:relative md:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          /* Desktop width based on collapsed state */
          "md:flex",
          sidebarCollapsed ? "md:w-[68px]" : "md:w-60",
          /* Mobile always full 240px when open */
          "w-60",
        ].join(" ")}
      >
        {/* Sidebar header */}
        <div className={`flex items-center py-5 border-b flex-shrink-0 ${sidebarCollapsed ? "px-0 justify-center" : "px-4 gap-3"}`}>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm flex-shrink-0">
            <Store className="text-primary-foreground w-5 h-5" />
          </div>
          {!sidebarCollapsed && (
            <span className="font-bold text-lg tracking-tight">SweetPOS</span>
          )}
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-0.5 px-2">
          {navItems.map(item => {
            const isActive = location === item.href;
            const isInventory = item.permission === "inventory";
            const showBadge = isInventory && inventoryAlertCount > 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
              >
                <div
                  className={[
                    "flex items-center rounded-xl cursor-pointer transition-all duration-150 select-none",
                    sidebarCollapsed ? "justify-center px-0 py-3 mx-auto w-11 h-11" : "gap-3 px-3 py-3",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                  data-testid={`nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <div className="relative flex-shrink-0">
                    <item.icon className="w-5 h-5" />
                    {showBadge && (
                      <span
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-[9px] font-black min-w-[15px] h-[15px] rounded-full flex items-center justify-center px-0.5 leading-none"
                        data-testid="nav-inventory-badge"
                      >
                        {inventoryAlertCount > 99 ? "99+" : inventoryAlertCount}
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <span className="font-medium text-sm">{item.label}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar footer */}
        <div className="border-t py-3 px-2 space-y-0.5 flex-shrink-0">
          {/* User info */}
          {user && !sidebarCollapsed && (
            <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{userInitial}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className={`w-full flex items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-sm font-medium ${sidebarCollapsed ? "justify-center py-3 w-11 mx-auto" : "gap-3 px-3 py-2.5"}`}
            data-testid="button-theme-toggle"
            title={sidebarCollapsed ? (theme === "dark" ? "Light mode" : "Dark mode") : undefined}
          >
            {theme === "dark" ? <Sun className="w-4 h-4 flex-shrink-0" /> : <Moon className="w-4 h-4 flex-shrink-0" />}
            {!sidebarCollapsed && <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>}
          </button>

          {/* Lock */}
          <button
            onClick={lock}
            className={`w-full flex items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-sm font-medium ${sidebarCollapsed ? "justify-center py-3 w-11 mx-auto" : "gap-3 px-3 py-2.5"}`}
            data-testid="button-lock"
            title={sidebarCollapsed ? "Lock screen" : undefined}
          >
            <Lock className="w-4 h-4 flex-shrink-0" />
            {!sidebarCollapsed && <span>Lock Screen</span>}
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className={`w-full flex items-center rounded-xl text-destructive hover:bg-destructive/10 transition-all text-sm font-medium ${sidebarCollapsed ? "justify-center py-3 w-11 mx-auto" : "gap-3 px-3 py-2.5"}`}
            data-testid="button-logout"
            title={sidebarCollapsed ? "Log out" : undefined}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!sidebarCollapsed && <span>Log Out</span>}
          </button>

          {/* Collapse toggle — desktop only */}
          <button
            onClick={toggleCollapsed}
            className={`hidden md:flex w-full items-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-sm font-medium mt-1 border-t pt-2 ${sidebarCollapsed ? "justify-center py-3 w-11 mx-auto" : "gap-3 px-3 py-2.5"}`}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!sidebarCollapsed && <span className="text-xs">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* ── Right side: header + content + mobile bottom bar ──────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* Top header */}
        <header className="flex-shrink-0 h-14 border-b bg-card flex items-center px-4 gap-3 shadow-sm">
          {/* Mobile hamburger */}
          <button
            className="md:hidden flex-shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setSidebarOpen(v => !v)}
            data-testid="button-mobile-menu"
            aria-label="Open menu"
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>

          {/* Page title */}
          <h1 className="font-semibold text-base flex-1 truncate">{pageTitle}</h1>

          {/* Inventory alert icon (mobile) */}
          {inventoryAlertCount > 0 && (
            <Link href="/inventory">
              <button className="md:hidden relative p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-0 right-0 bg-destructive text-destructive-foreground text-[9px] font-black min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5 leading-none">
                  {inventoryAlertCount > 99 ? "99+" : inventoryAlertCount}
                </span>
              </button>
            </Link>
          )}

          {/* User info (desktop) */}
          {user && (
            <div className="hidden md:flex items-center gap-2.5 pl-3 border-l ml-1">
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{userInitial}</span>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold leading-tight">{user.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize leading-tight">{user.role}</p>
              </div>
            </div>
          )}

          {/* User info (mobile — compact) */}
          {user && (
            <div className="md:hidden flex items-center gap-1.5">
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{userInitial}</span>
              </div>
              <div className="hidden xs:block min-w-0">
                <p className="text-xs font-semibold truncate max-w-[80px]">{user.name}</p>
                <p className="text-[10px] text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
          )}
        </header>

        {/* Main content — bottom padding on mobile to clear the tab bar */}
        <main className="flex-1 overflow-hidden relative flex flex-col pb-[env(safe-area-inset-bottom)] md:pb-0">
          <div className="flex-1 overflow-hidden flex flex-col pb-16 md:pb-0">
            {children}
          </div>
        </main>

        {/* ── Mobile bottom tab bar ────────────────────────────────── */}
        <nav
          className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t flex items-stretch z-20 shadow-[0_-2px_12px_rgba(0,0,0,0.08)]"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {navItems.map(item => {
            const isActive = location === item.href;
            const isInventory = item.permission === "inventory";
            const showBadge = isInventory && inventoryAlertCount > 0;
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div
                  className={[
                    "flex flex-col items-center justify-center py-2 gap-0.5 cursor-pointer transition-colors select-none min-h-[52px]",
                    isActive ? "text-primary" : "text-muted-foreground",
                  ].join(" ")}
                  data-testid={`bottom-nav-${item.label.toLowerCase().replace(/ /g, "-")}`}
                >
                  <div className="relative">
                    <item.icon className={`w-5 h-5 ${isActive ? "stroke-[2.5px]" : ""}`} />
                    {showBadge && (
                      <span className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground text-[8px] font-black min-w-[13px] h-[13px] rounded-full flex items-center justify-center px-0.5 leading-none">
                        {inventoryAlertCount > 99 ? "99+" : inventoryAlertCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-medium leading-none ${isActive ? "font-semibold" : ""}`}>
                    {item.label === "Time Clock" ? "Clock" : item.label}
                  </span>
                  {isActive && <div className="absolute -top-px left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />}
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
