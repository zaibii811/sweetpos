import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { TrendingUp, ShoppingCart, Package, Users, AlertTriangle, Clock, ArrowRight, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";

const BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.BASE_URL).replace(/\/$/, "");

async function apiFetch(path: string) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error("Request failed");
  return r.json();
}

const CHART_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444"];

export default function Dashboard() {
  const [, navigate] = useLocation();

  const { data, isLoading } = useQuery<any>({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch("/api/reports/dashboard"),
    refetchInterval: 30000,
  });

  const today = data?.today;
  const activeStaff: any[] = data?.activeStaff ?? [];
  const lowStockCount: number = data?.lowStockCount ?? 0;
  const expiringCount: number = data?.expiringCount ?? 0;

  const timeNow = format(new Date(), "EEEE, d MMMM yyyy");

  const statCards = [
    {
      title: "Today's Sales",
      value: today ? `RM ${today.totalSales.toFixed(2)}` : "—",
      sub: today ? `SST collected: RM ${today.sstCollected.toFixed(2)}` : "",
      icon: DollarSign,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      title: "Transactions Today",
      value: today ? String(today.totalTransactions) : "—",
      sub: today && today.totalTransactions > 0 ? `Avg RM ${(today.totalSales / today.totalTransactions).toFixed(2)} per order` : "",
      icon: ShoppingCart,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      title: "Low Stock Alerts",
      value: String(lowStockCount),
      sub: `${expiringCount} item${expiringCount !== 1 ? "s" : ""} expiring within 14 days`,
      icon: AlertTriangle,
      color: lowStockCount > 0 ? "text-destructive" : "text-muted-foreground",
      bg: lowStockCount > 0 ? "bg-destructive/10" : "bg-muted",
      action: () => navigate("/inventory"),
      actionLabel: "View Inventory",
    },
    {
      title: "Staff Clocked In",
      value: String(activeStaff.length),
      sub: activeStaff.length > 0 ? activeStaff.map(s => s.staffName).join(", ") : "Nobody currently working",
      icon: Users,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
  ];

  return (
    <ScrollArea className="flex-1 h-full bg-muted/20">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Good {getGreeting()}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{timeNow}</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {statCards.map((card) => (
            <Card key={card.title} className={`shadow-sm transition-shadow hover:shadow-md ${card.action ? "cursor-pointer" : ""}`} onClick={card.action}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  {card.action && (
                    <Button variant="ghost" size="icon" className="w-7 h-7 rounded-lg" onClick={card.action}>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                {isLoading ? (
                  <Skeleton className="h-8 w-24 mb-1" />
                ) : (
                  <p className="text-3xl font-bold tracking-tight" data-testid={`stat-${card.title.toLowerCase().replace(/ /g,"-")}`}>{card.value}</p>
                )}
                <p className="text-xs text-muted-foreground mt-1 leading-snug">{card.sub}</p>
                <p className="text-sm font-medium text-muted-foreground mt-2">{card.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top 5 Products Chart */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                Top 5 Products Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              ) : !today?.topProducts?.length ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No sales today yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={today.topProducts} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" tickFormatter={v => `RM${v}`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="productName" width={100} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `RM ${v.toFixed(2)}`} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {today.topProducts.map((_: any, idx: number) => (
                        <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Active Staff */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-violet-500" />
                Currently Clocked In ({activeStaff.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
              ) : activeStaff.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No staff clocked in</div>
              ) : (
                <div className="space-y-3">
                  {activeStaff.map((s: any) => {
                    const clockIn = new Date(s.clockInAt);
                    const elapsed = getElapsed(clockIn);
                    return (
                      <div key={s.staffId} className="flex items-center gap-3 p-3 bg-muted/40 rounded-xl">
                        <div className="w-9 h-9 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-violet-600">{(s.staffName || "?").charAt(0)}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{s.staffName}</p>
                          <p className="text-xs text-muted-foreground">Since {format(clockIn, "h:mm a")} — {elapsed}</p>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse flex-shrink-0" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Open POS", href: "/", color: "bg-amber-500", icon: ShoppingCart },
            { label: "View Reports", href: "/reports", color: "bg-blue-500", icon: TrendingUp },
            { label: "Inventory", href: "/inventory", color: "bg-emerald-500", icon: Package },
            { label: "Time Clock", href: "/timeclock", color: "bg-violet-500", icon: Clock },
          ].map(link => (
            <button key={link.href} onClick={() => navigate(link.href)} className="flex items-center gap-3 p-4 rounded-xl bg-card border shadow-sm hover:shadow-md transition-all text-left group">
              <div className={`w-9 h-9 rounded-lg ${link.color}/10 flex items-center justify-center flex-shrink-0`}>
                <link.icon className={`w-4 h-4`} style={{ color: link.color.replace("bg-", "") }} />
              </div>
              <span className="font-semibold text-sm">{link.label}</span>
              <ArrowRight className="w-3.5 h-3.5 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

function getElapsed(from: Date): string {
  const ms = Date.now() - from.getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
