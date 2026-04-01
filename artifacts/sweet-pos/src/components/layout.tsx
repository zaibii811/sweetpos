import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Store, Receipt, Package, Users, BarChart3, LogOut, Sun, Moon } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { motion } from "framer-motion";

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { user, logout, isLoading } = useAuth();
  const { theme, setTheme } = useTheme();

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

  const navItems = [
    { href: "/", icon: Store, label: "POS" },
    { href: "/orders", icon: Receipt, label: "Orders" },
    { href: "/inventory", icon: Package, label: "Inventory" },
    { href: "/staff", icon: Users, label: "Staff" },
    { href: "/reports", icon: BarChart3, label: "Reports" },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
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

        <nav className="flex-1 w-full px-2 md:px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  className={`flex items-center gap-3 px-3 py-4 rounded-xl cursor-pointer transition-all duration-200 ${
                    isActive 
                      ? "bg-primary text-primary-foreground shadow-md" 
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                >
                  <item.icon className="w-6 h-6 flex-shrink-0 mx-auto md:mx-0" />
                  <span className="font-medium hidden md:block">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-2 md:px-4 mt-auto space-y-2 w-full">
          <Button 
            variant="ghost" 
            className="w-full justify-center md:justify-start" 
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            data-testid="button-theme-toggle"
          >
            {theme === "dark" ? <Sun className="w-5 h-5 md:mr-2" /> : <Moon className="w-5 h-5 md:mr-2" />}
            <span className="hidden md:block">Theme</span>
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-center md:justify-start text-destructive hover:text-destructive hover:bg-destructive/10" 
            onClick={logout}
            data-testid="button-logout"
          >
            <LogOut className="w-5 h-5 md:mr-2" />
            <span className="hidden md:block">Logout</span>
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
