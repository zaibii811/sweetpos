import { useState } from "react";
import { 
  useGetReportSummary, 
  useGetTopProducts, 
  useGetSalesByDay, 
  useGetSalesByCategory, 
  useGetRecentActivity 
} from "@workspace/api-client-react";
import { format, parseISO } from "date-fns";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { 
  BarChart3, TrendingUp, ShoppingCart, DollarSign, Package, Activity, ArrowRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export default function Reports() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const [days, setDays] = useState<number>(7);

  const { data: summary, isLoading: loadingSummary } = useGetReportSummary({ period });
  const { data: topProducts = [], isLoading: loadingTopProducts } = useGetTopProducts({ period, limit: 5 });
  const { data: salesByDay = [], isLoading: loadingSalesByDay } = useGetSalesByDay({ days });
  const { data: salesByCategory = [], isLoading: loadingSalesByCategory } = useGetSalesByCategory({ period });
  const { data: recentActivity = [], isLoading: loadingActivity } = useGetRecentActivity({ limit: 10 });

  const handlePeriodChange = (val: "today" | "week" | "month") => {
    setPeriod(val);
    if (val === "today") setDays(1);
    else if (val === "week") setDays(7);
    else setDays(30);
  };

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="p-6 border-b bg-card">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <BarChart3 className="text-blue-500 w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold">Sales Reports</h1>
          </div>
          <Select value={period} onValueChange={(val: any) => handlePeriodChange(val)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="shadow-sm border-none bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
              <DollarSign className="w-4 h-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-black text-primary">
                RM {summary?.totalSales.toFixed(2) || "0.00"}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
              <ShoppingCart className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {summary?.totalOrders || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Avg Value</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                RM {summary?.averageOrderValue.toFixed(2) || "0.00"}
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tax Collected</CardTitle>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                RM {summary?.totalTax.toFixed(2) || "0.00"}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card className="lg:col-span-2 shadow-sm border">
            <CardHeader>
              <CardTitle>Revenue ({days} Days)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              {loadingSalesByDay ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">Loading chart...</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => format(parseISO(val), 'MMM d')} 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                      tickFormatter={(val) => `RM${val}`}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'hsl(var(--muted))' }}
                      contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                      formatter={(value: number) => [`RM ${value.toFixed(2)}`, 'Sales']}
                      labelFormatter={(label) => format(parseISO(label as string), 'MMMM d, yyyy')}
                    />
                    <Bar dataKey="totalSales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border">
            <CardHeader>
              <CardTitle>Sales by Category</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px] flex flex-col">
              {loadingSalesByCategory ? (
                <div className="flex h-full items-center justify-center text-muted-foreground">Loading chart...</div>
              ) : (
                <>
                  <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={salesByCategory}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="totalSales"
                        >
                          {salesByCategory.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip 
                          formatter={(value: number) => [`RM ${value.toFixed(2)}`, 'Sales']}
                          contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', backgroundColor: 'hsl(var(--card))' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    {salesByCategory.slice(0, 4).map((cat, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                        <span className="truncate" title={cat.categoryName}>{cat.categoryName}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Top Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTopProducts ? (
                <div className="py-10 text-center text-muted-foreground">Loading...</div>
              ) : topProducts.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">No data available</div>
              ) : (
                <div className="space-y-4">
                  {topProducts.map((product, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-bold text-sm leading-tight">{product.productName}</p>
                          <p className="text-xs text-muted-foreground">{product.categoryName || "Uncategorized"}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">RM {product.revenue.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">{product.quantitySold} sold</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-secondary" />
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingActivity ? (
                <div className="py-10 text-center text-muted-foreground">Loading...</div>
              ) : recentActivity.length === 0 ? (
                <div className="py-10 text-center text-muted-foreground">No recent activity</div>
              ) : (
                <div className="space-y-4">
                  {recentActivity.map((activity: any, idx: number) => (
                    <div key={idx} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-2 h-2 rounded-full bg-primary mt-1.5" />
                        {idx !== recentActivity.length - 1 && <div className="w-px h-full bg-border my-1" />}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm">
                          <span className="font-bold">{activity.staffName || "System"}</span> processed order{" "}
                          <span className="font-medium text-primary">#{activity.orderNumber}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-5">{activity.status}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(activity.createdAt), "h:mm a")} • RM {activity.total.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </ScrollArea>
    </div>
  );
}