import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subWeeks } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, CartesianGrid
} from "recharts";
import { BarChart3, TrendingUp, ShoppingCart, DollarSign, Package, Download, Printer, Calendar, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
type Tab = "sales" | "inventory" | "staff";
const CHART_COLORS = ["#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ef4444", "#f97316", "#06b6d4"];
const PAYMENT_COLORS: Record<string, string> = { cash: "#10b981", ewallet: "#3b82f6", tng: "#8b5cf6", card: "#f59e0b", duitnow: "#06b6d4", unknown: "#94a3b8" };

async function apiFetch(path: string) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include" });
  if (!r.ok) throw new Error("Request failed");
  return r.json();
}

type QuickRange = "today" | "yesterday" | "this-week" | "last-week" | "this-month" | "last-month";
function getQuickRange(q: QuickRange): { from: string; to: string } {
  const now = new Date();
  switch (q) {
    case "today": return { from: format(now, "yyyy-MM-dd"), to: format(now, "yyyy-MM-dd") };
    case "yesterday": { const y = subDays(now, 1); return { from: format(y, "yyyy-MM-dd"), to: format(y, "yyyy-MM-dd") }; }
    case "this-week": return { from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd") };
    case "last-week": { const lw = subWeeks(now, 1); return { from: format(startOfWeek(lw, { weekStartsOn: 1 }), "yyyy-MM-dd"), to: format(endOfWeek(lw, { weekStartsOn: 1 }), "yyyy-MM-dd") }; }
    case "this-month": return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd") };
    case "last-month": { const lm = subMonths(now, 1); return { from: format(startOfMonth(lm), "yyyy-MM-dd"), to: format(endOfMonth(lm), "yyyy-MM-dd") }; }
  }
}

export default function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>("sales");
  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="p-6 border-b bg-card flex-shrink-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="text-blue-500 w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
        </div>
        <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
          {(["sales", "inventory", "staff"] as Tab[]).map(tab => (
            <button key={tab} className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setActiveTab(tab)} data-testid={`tab-${tab}`}>{tab === "staff" ? "Staff & Payroll" : tab === "inventory" ? "Inventory" : "Sales"}</button>
          ))}
        </div>
      </div>
      {activeTab === "sales" && <SalesTab />}
      {activeTab === "inventory" && <InventoryTab />}
      {activeTab === "staff" && <StaffTab />}
    </div>
  );
}

function SalesTab() {
  const [from, setFrom] = useState(format(new Date(), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [quick, setQuick] = useState<QuickRange>("today");

  const applyQuick = (q: QuickRange) => {
    setQuick(q);
    const r = getQuickRange(q);
    setFrom(r.from);
    setTo(r.to);
  };

  const { data, isLoading } = useQuery<any>({
    queryKey: ["detailed-sales", from, to],
    queryFn: () => apiFetch(`/api/reports/detailed-sales?from=${from}&to=${to}`),
    enabled: !!from && !!to,
  });

  const QUICK: { label: string; value: QuickRange }[] = [
    { label: "Today", value: "today" }, { label: "Yesterday", value: "yesterday" },
    { label: "This Week", value: "this-week" }, { label: "Last Week", value: "last-week" },
    { label: "This Month", value: "this-month" }, { label: "Last Month", value: "last-month" },
  ];

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex gap-1 flex-wrap">
            {QUICK.map(q => (
              <button key={q.value} onClick={() => applyQuick(q.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${quick === q.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{q.label}</button>
            ))}
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <Label className="text-sm whitespace-nowrap">From</Label>
              <Input type="date" value={from} onChange={e => { setFrom(e.target.value); setQuick("today"); }} className="w-36 h-8 text-sm" data-testid="input-date-from" />
            </div>
            <span className="text-muted-foreground">—</span>
            <div className="flex items-center gap-2">
              <Label className="text-sm">To</Label>
              <Input type="date" value={to} onChange={e => { setTo(e.target.value); setQuick("today"); }} className="w-36 h-8 text-sm" data-testid="input-date-to" />
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="ml-auto"><Printer className="w-4 h-4 mr-2" />Print / PDF</Button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Revenue", value: data ? `RM ${data.totalRevenue.toFixed(2)}` : "—", icon: DollarSign, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Transactions", value: data ? String(data.totalTransactions) : "—", icon: ShoppingCart, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Avg Order Value", value: data ? `RM ${data.avgOrderValue.toFixed(2)}` : "—", icon: TrendingUp, color: "text-violet-500", bg: "bg-violet-500/10" },
            { label: "SST Collected", value: data ? `RM ${data.sstCollected.toFixed(2)}` : "—", icon: Package, color: "text-amber-500", bg: "bg-amber-500/10" },
          ].map(c => (
            <Card key={c.label} className="shadow-sm">
              <CardContent className="p-4">
                <div className={`w-9 h-9 ${c.bg} rounded-xl flex items-center justify-center mb-3`}><c.icon className={`w-4 h-4 ${c.color}`} /></div>
                {isLoading ? <Skeleton className="h-8 w-24 mb-1" /> : <p className="text-2xl font-bold" data-testid={`kpi-${c.label.toLowerCase().replace(/ /g, "-")}`}>{c.value}</p>}
                <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Revenue by Category</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[220px] w-full" /> : !data?.categoryBreakdown?.length ? (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data for this period</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie data={data.categoryBreakdown} dataKey="revenue" nameKey="category" cx="50%" cy="50%" outerRadius={85} label={({ category, percent }: any) => `${category} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {data.categoryBreakdown.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `RM ${v.toFixed(2)}`} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Payment Methods</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[220px] w-full" /> : !data?.paymentBreakdown?.length ? (
                <div className="h-[180px] flex items-center justify-center text-muted-foreground text-sm">No data for this period</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.paymentBreakdown} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="method" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={(v: number) => `RM${v}`} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => [`RM ${v.toFixed(2)}`, "Revenue"]} contentStyle={{ fontSize: 12 }} />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {data.paymentBreakdown.map((p: any, i: number) => <Cell key={i} fill={PAYMENT_COLORS[p.method?.toLowerCase()] ?? CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex flex-wrap gap-3">
                    {data.paymentBreakdown.map((p: any) => (
                      <div key={p.method} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="w-2.5 h-2.5 rounded-sm" style={{ background: PAYMENT_COLORS[p.method?.toLowerCase()] ?? "#94a3b8" }} />
                        <span className="capitalize font-medium text-foreground">{p.method}</span>
                        <span>{p.count} orders</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Best-Selling Products</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-[200px] w-full" /> : !data?.topProducts?.length ? (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">No product sales this period</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.topProducts.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 10 }}>
                    <XAxis type="number" tickFormatter={(v: number) => `RM${v}`} tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="productName" width={130} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: number) => `RM ${v.toFixed(2)}`} contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {data.topProducts.slice(0, 8).map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>#</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead className="text-right">Qty / Weight Sold</TableHead>
                        <TableHead className="text-right">Revenue (RM)</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topProducts.map((p: any, i: number) => (
                        <TableRow key={p.productId}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{p.productName}{p.isWeightBased && <Badge variant="outline" className="ml-2 text-xs">Weight</Badge>}</TableCell>
                          <TableCell className="text-right text-sm">{p.isWeightBased ? `${p.weightKg} kg` : `${p.quantity} units`}</TableCell>
                          <TableCell className="text-right font-bold">RM {p.revenue.toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Plastic Bags Consumed</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? <Skeleton className="h-[80px] w-full" /> : !data?.bagUsage?.length ? (
                <div className="py-6 text-center text-muted-foreground text-sm">No bag usage recorded for this period</div>
              ) : (
                <Table>
                  <TableHeader><TableRow><TableHead>Bag Type</TableHead><TableHead className="text-right">Total Used</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {data.bagUsage.map((b: any) => (
                      <TableRow key={b.consumableId}><TableCell className="font-medium">{b.name}</TableCell><TableCell className="text-right">{Math.round(b.totalUsed)} pcs</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">SST Summary (8%)</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {isLoading ? <Skeleton className="h-[80px] w-full" /> : (
                <>
                  <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">Total SST Collected</p>
                    <p className="text-3xl font-bold text-amber-600">RM {data?.sstCollected?.toFixed(2) ?? "0.00"}</p>
                  </div>
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Subtotal (excl. SST)</span><span className="font-medium">RM {data ? (data.totalRevenue - data.sstCollected).toFixed(2) : "—"}</span></div>
                    <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">SST @ 8%</span><span className="font-medium">RM {data?.sstCollected?.toFixed(2) ?? "—"}</span></div>
                    <div className="flex justify-between py-2"><span className="font-semibold">Gross Total</span><span className="font-bold">RM {data?.totalRevenue?.toFixed(2) ?? "—"}</span></div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </ScrollArea>
  );
}

type InvFilter = "all" | "low" | "expiring" | "expired";

function InventoryTab() {
  const [filter, setFilter] = useState<InvFilter>("all");
  const { data, isLoading } = useQuery<any>({
    queryKey: ["inventory-status"],
    queryFn: () => apiFetch("/api/reports/inventory-status"),
    refetchInterval: 60000,
  });

  const products: any[] = data?.products ?? [];
  const consumables: any[] = data?.consumables ?? [];
  const filteredProducts = products.filter(p => {
    if (filter === "low") return p.isLow;
    if (filter === "expiring") return p.isExpiring;
    if (filter === "expired") return p.isExpired;
    return true;
  });

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Total Products", value: products.length, icon: Package, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Low Stock", value: (data?.lowStockProducts ?? 0) + (data?.lowStockConsumables ?? 0), icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
            { label: "Expiring (14 days)", value: data?.expiringCount ?? 0, icon: Calendar, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "Expired", value: data?.expiredCount ?? 0, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-500/10" },
          ].map(c => (
            <Card key={c.label} className="shadow-sm">
              <CardContent className="p-4">
                <div className={`w-9 h-9 ${c.bg} rounded-xl flex items-center justify-center mb-3`}><c.icon className={`w-4 h-4 ${c.color}`} /></div>
                {isLoading ? <Skeleton className="h-8 w-16 mb-1" /> : <p className="text-2xl font-bold">{c.value}</p>}
                <p className="text-xs text-muted-foreground mt-1">{c.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-3 flex-row items-center justify-between gap-4">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Products Stock Report</CardTitle>
            <div className="flex gap-1 flex-wrap">
              {(["all", "low", "expiring", "expired"] as InvFilter[]).map(f => (
                <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`} data-testid={`filter-${f}`}>
                  {f === "all" ? "All" : f === "low" ? "Low Stock" : f === "expiring" ? "Expiring" : "Expired"}
                  {f === "low" && data?.lowStockProducts > 0 && filter !== "low" && <span className="bg-destructive/10 text-destructive rounded-full px-1 text-xs">{data.lowStockProducts}</span>}
                  {f === "expiring" && data?.expiringCount > 0 && filter !== "expiring" && <span className="bg-amber-100 text-amber-800 rounded-full px-1 text-xs dark:bg-amber-900/30 dark:text-amber-400">{data.expiringCount}</span>}
                  {f === "expired" && data?.expiredCount > 0 && filter !== "expired" && <span className="bg-destructive/10 text-destructive rounded-full px-1 text-xs">{data.expiredCount}</span>}
                </button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Reorder At</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8"><Skeleton className="h-4 w-40 mx-auto" /></TableCell></TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No products matching this filter</TableCell></TableRow>
                ) : filteredProducts.map((p: any) => (
                  <TableRow key={p.id} className={p.isExpired ? "bg-red-50/50 dark:bg-red-900/5" : p.isExpiring ? "bg-amber-50/50 dark:bg-amber-900/5" : ""}>
                    <TableCell className="font-medium">{p.name}{p.sku && <span className="text-xs text-muted-foreground ml-1">({p.sku})</span>}</TableCell>
                    <TableCell className="text-muted-foreground">{p.categoryName}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{p.productType === "weight" ? "Weight (g)" : "Units"}</Badge></TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${p.isLow ? "text-destructive" : ""}`}>{p.stock}{p.productType === "weight" ? "g" : ""}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{p.lowStockThreshold}{p.productType === "weight" ? "g" : ""}</TableCell>
                    <TableCell className="text-sm">{p.expiryDate || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {p.isExpired && <Badge className="bg-destructive/10 text-destructive border-transparent text-xs">Expired</Badge>}
                        {p.isExpiring && !p.isExpired && <Badge className="bg-amber-100 text-amber-800 border-transparent text-xs dark:bg-amber-900/30 dark:text-amber-400">Expiring</Badge>}
                        {p.isLow && <Badge className="bg-orange-100 text-orange-800 border-transparent text-xs dark:bg-orange-900/30 dark:text-orange-400">Low Stock</Badge>}
                        {!p.isExpired && !p.isExpiring && !p.isLow && <span className="text-xs text-muted-foreground">OK</span>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Consumables & Bags Stock</CardTitle></CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Reorder At</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
                ) : consumables.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">No consumables</TableCell></TableRow>
                ) : consumables.map((c: any) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground capitalize">{c.unit}</TableCell>
                    <TableCell className={`text-right font-mono font-semibold ${c.isLow ? "text-destructive" : ""}`}>{c.stock}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{c.lowStockThreshold}</TableCell>
                    <TableCell>{c.isLow ? <Badge className="bg-destructive/10 text-destructive border-transparent text-xs">Low Stock</Badge> : <span className="text-xs text-muted-foreground">OK</span>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}

type StaffPeriod = "this-week" | "last-week" | "this-month" | "last-month";
function getStaffRange(p: StaffPeriod): { from: string; to: string; label: string } {
  const now = new Date();
  switch (p) {
    case "this-week": return { from: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), to: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"), label: "This Week" };
    case "last-week": { const lw = subWeeks(now, 1); return { from: format(startOfWeek(lw, { weekStartsOn: 1 }), "yyyy-MM-dd"), to: format(endOfWeek(lw, { weekStartsOn: 1 }), "yyyy-MM-dd"), label: "Last Week" }; }
    case "this-month": return { from: format(startOfMonth(now), "yyyy-MM-dd"), to: format(endOfMonth(now), "yyyy-MM-dd"), label: "This Month" };
    case "last-month": { const lm = subMonths(now, 1); return { from: format(startOfMonth(lm), "yyyy-MM-dd"), to: format(endOfMonth(lm), "yyyy-MM-dd"), label: "Last Month" }; }
  }
}

function StaffTab() {
  const [period, setPeriod] = useState<StaffPeriod>("this-week");
  const range = getStaffRange(period);
  const { toast } = useToast();

  const { data: payroll, isLoading: loadingPayroll } = useQuery<any>({
    queryKey: ["payroll", range.from, range.to],
    queryFn: () => apiFetch(`/api/payroll/summary?from=${range.from}&to=${range.to}`),
  });

  const { data: rawEntries = [], isLoading: loadingEntries } = useQuery<any[]>({
    queryKey: ["time-entries-report", range.from, range.to],
    queryFn: () => apiFetch(`/api/time-entries?from=${range.from}&to=${range.to}`),
  });

  const lateEntries = rawEntries.filter((e: any) => e.isLate);

  const exportPayrollCSV = () => {
    if (!payroll?.summary) return;
    const rows = [
      ["Staff", "Role", "Rate (RM/hr)", "Hours Worked", "Late Arrivals", "Overtime Days", "Est. Pay (RM)"],
      ...payroll.summary.map((r: any) => [r.staffName, r.role, r.hourlyRate, r.totalHours.toFixed(2), r.lateCount, r.overtimeDays, r.estimatedPay.toFixed(2)])
    ];
    const csv = rows.map(r => r.map((v: any) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payroll-${range.from}-to-${range.to}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Payroll CSV exported" });
  };

  const exportLateCSV = () => {
    const rows = [
      ["Staff", "Date", "Clock In", "Late (min)"],
      ...lateEntries.map((e: any) => [e.staffName, format(new Date(e.clockInAt), "yyyy-MM-dd"), format(new Date(e.clockInAt), "HH:mm"), e.lateMinutes])
    ];
    const csv = rows.map(r => r.map((v: any) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `late-log-${range.from}-to-${range.to}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Late log CSV exported" });
  };

  const PERIODS: { label: string; value: StaffPeriod }[] = [
    { label: "This Week", value: "this-week" }, { label: "Last Week", value: "last-week" },
    { label: "This Month", value: "this-month" }, { label: "Last Month", value: "last-month" },
  ];

  return (
    <ScrollArea className="flex-1">
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex gap-1 bg-muted p-1 rounded-xl">
            {PERIODS.map(p => (
              <button key={p.value} onClick={() => setPeriod(p.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${period === p.value ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{p.label}</button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="sm" onClick={exportPayrollCSV} data-testid="button-export-payroll-csv"><Download className="w-4 h-4 mr-2" />Payroll CSV</Button>
            <Button variant="outline" size="sm" onClick={exportLateCSV} data-testid="button-export-late-csv"><Download className="w-4 h-4 mr-2" />Late Log</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />Print</Button>
          </div>
        </div>

        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Payroll Summary — {range.label}</CardTitle>
            <span className="text-xs text-muted-foreground">{range.from} to {range.to}</span>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Hours Worked</TableHead>
                  <TableHead className="text-center">Late</TableHead>
                  <TableHead className="text-center">Overtime</TableHead>
                  <TableHead className="text-right">Rate (RM/hr)</TableHead>
                  <TableHead className="text-right">Est. Pay (RM)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingPayroll ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8"><Skeleton className="h-4 w-40 mx-auto" /></TableCell></TableRow>
                ) : !payroll?.summary?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No data for this period</TableCell></TableRow>
                ) : payroll.summary.map((row: any) => (
                  <TableRow key={row.staffId}>
                    <TableCell><p className="font-medium">{row.staffName}</p><p className="text-xs text-muted-foreground capitalize">{row.role}</p></TableCell>
                    <TableCell className="text-right font-mono">{row.totalHours.toFixed(2)}</TableCell>
                    <TableCell className="text-center">{row.lateCount > 0 ? <Badge className="bg-destructive/10 text-destructive border-transparent">{row.lateCount}</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center">{row.overtimeDays > 0 ? <Badge className="bg-amber-100 text-amber-800 border-transparent dark:bg-amber-900/30 dark:text-amber-400">{row.overtimeDays}d</Badge> : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-right">{parseFloat(row.hourlyRate || "0").toFixed(2)}</TableCell>
                    <TableCell className="text-right font-bold text-primary">{row.estimatedPay > 0 ? `RM ${row.estimatedPay.toFixed(2)}` : "—"}</TableCell>
                  </TableRow>
                ))}
                {payroll?.summary?.length > 0 && (
                  <TableRow className="bg-muted/30 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right">{payroll.summary.reduce((s: number, r: any) => s + r.totalHours, 0).toFixed(2)}</TableCell>
                    <TableCell className="text-center">{payroll.summary.reduce((s: number, r: any) => s + r.lateCount, 0)}</TableCell>
                    <TableCell className="text-center">{payroll.summary.reduce((s: number, r: any) => s + r.overtimeDays, 0)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right text-primary">RM {payroll.summary.reduce((s: number, r: any) => s + r.estimatedPay, 0).toFixed(2)}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {payroll?.summary?.length > 0 && (
          <Card className="shadow-sm">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Hours Worked — {range.label}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={payroll.summary.filter((r: any) => r.totalHours > 0)} margin={{ top: 5, right: 5, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="staffName" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} unit="h" />
                  <Tooltip formatter={(v: number) => [`${v.toFixed(2)} hrs`, "Hours"]} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="totalHours" radius={[4, 4, 0, 0]}>
                    {payroll.summary.map((_: any, i: number) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-sm">
          <CardHeader className="pb-2 flex-row items-center gap-3">
            <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Late Arrivals Log</CardTitle>
            {lateEntries.length > 0 && <Badge className="bg-destructive/10 text-destructive border-transparent">{lateEntries.length} incidents</Badge>}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Clock In</TableHead>
                  <TableHead className="text-right">Late By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingEntries ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6"><Skeleton className="h-4 w-32 mx-auto" /></TableCell></TableRow>
                ) : lateEntries.length === 0 ? (
                  <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">No late arrivals for this period</TableCell></TableRow>
                ) : lateEntries.map((e: any) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.staffName}</TableCell>
                    <TableCell>{format(new Date(e.clockInAt), "EEE, d MMM yyyy")}</TableCell>
                    <TableCell className="font-mono">{format(new Date(e.clockInAt), "HH:mm")}</TableCell>
                    <TableCell className="text-right"><Badge className="bg-destructive/10 text-destructive border-transparent">{e.lateMinutes} min</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ScrollArea>
  );
}
