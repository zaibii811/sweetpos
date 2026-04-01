import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Store, Receipt, Package, Users, BarChart3, LogOut, Sun, Moon, Settings, Lock, Timer, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useAutoLock } from "@/hooks/use-auto-lock";
import { LockScreen } from "@/components/lock-screen";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export function Layout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { user, logout, isLoading, isLocked, lock } = useAuth();
  const { can, isOwner } = usePermissions();
  const { theme, setTheme } = useTheme();

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

  if (isLoading || (!user && location !== "/login")) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (location === "/login") {
    return <>{children}</>;
  }

  const allNavItems = [
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", permission: "dashboard" as const },
    { href: "/", icon: Store, label: "POS", permission: "pos" as const },
    { href: "/orders", icon: Receipt, label: "Orders", permission: "orders" as const },
    { href: "/inventory", icon: Package, label: "Inventory", permission: "inventory" as const },
    { href: "/staff", icon: Users, label: "Staff", permission: "staff" as const },
    { href: "/reports", icon: BarChart3, label: "Reports", permission: "reports" as const },
    { href: "/timeclock", icon: Timer, label: "Time Clock", permission: "timeclock" as const },
    { href: "/settings", icon: Settings, label: "Settings", permission: "settings" as const },
  ];

  const navItems = allNavItems.filter((item) => can(item.permission));

  return (
    <div className="flex h-screen overflow-hidden bg-background relative">
      {isLocked && <LockScreen />}

      {/* Sidebar */}
      <motion.aside
        initial={{ x: -100 }}
        animate={{ x: 0 }}
        className="w-24 md:w-64 flex-shrink-0 border-r bg-card flex flex-col items-center md:items-stretch py-6"
      >
        <div className="px-4 mb-8 flex items-center justify-center md:justify-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg">
            <Store className="text-primary-foreground w-6 h-6" />
          </div>
          <span className="font-bold text-xl hidden md:block tracking-tight">SweetPOS</span>
        </div>

        <nav className="flex-1 w-full px-2 md:px-4 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href;
            const isInventory = item.label === "Inventory";
            const alertBadge = isInventory && inventoryAlertCount > 0;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-3.5 rounded-xl cursor-pointer transition-all duration-200 ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <div className="relative flex-shrink-0 mx-auto md:mx-0">
                    <item.icon className="w-5 h-5" />
                    {alertBadge && (
                      <span
                        className="absolute -top-2 -right-2 bg-destructive text-white text-[9px] font-black min-w-[16px] h-[16px] rounded-full flex items-center justify-center px-0.5"
                        data-testid="nav-inventory-badge"
                      >
                        {inventoryAlertCount > 99 ? "99+" : inventoryAlertCount}
                      </span>
                    )}
                  </div>
                  <span className="font-medium text-sm hidden md:block">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-2 md:px-4 mt-auto space-y-1 w-full">
          {user && (
            <div className="hidden md:flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">
                  {user.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
          )}

          <Button
            variant="ghost"
            className="w-full justify-center md:justify-start"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="w-5 h-5 md:mr-2" /> : <Moon className="w-5 h-5 md:mr-2" />}
            <span className="hidden md:block text-sm">Theme</span>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-center md:justify-start"
            onClick={lock}
            data-testid="button-lock"
          >
            <Lock className="w-5 h-5 md:mr-2" />
            <span className="hidden md:block text-sm">Lock</span>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-center md:justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5 md:mr-2" />
            <span className="hidden md:block text-sm">Logout</span>
          </Button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        {children}
      </main>
    </div>
  );
}
