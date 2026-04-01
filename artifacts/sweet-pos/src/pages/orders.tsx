import { useState } from "react";
import { useListOrders, useUpdateOrderStatus, OrderStatus, Order } from "@workspace/api-client-react";
import { format } from "date-fns";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Receipt, Search, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListOrdersQueryKey } from "@workspace/api-client-react";

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data: orders = [], isLoading } = useListOrders({
    status: statusFilter !== "all" ? statusFilter : undefined,
    date: dateFilter || undefined,
  });

  const updateStatus = useUpdateOrderStatus();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleStatusChange = async (id: number, status: OrderStatus) => {
    try {
      await updateStatus.mutateAsync({ id, data: { status } });
      queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      toast({ title: "Status updated" });
      if (selectedOrder?.id === id) {
        setSelectedOrder({ ...selectedOrder, status });
      }
    } catch (e: any) {
      toast({ title: "Failed to update status", variant: "destructive" });
    }
  };

  const filteredOrders = orders.filter(o => 
    o.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
    (o.staffName && o.staffName.toLowerCase().includes(search.toLowerCase()))
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200";
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200";
      case "refunded": return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300 border-gray-200";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <div className="flex flex-col h-full bg-muted/20">
      <div className="p-6 border-b bg-card">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Receipt className="text-primary w-5 h-5" />
          </div>
          <h1 className="text-2xl font-bold">Order History</h1>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input 
              placeholder="Search order # or staff..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 bg-background"
            />
          </div>
          <div className="flex items-center gap-2 w-full md:w-auto">
            <Filter className="text-muted-foreground w-4 h-4 ml-2" />
            <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
              <SelectTrigger className="w-[140px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
              </SelectContent>
            </Select>
            <Input 
              type="date" 
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[160px] bg-background"
            />
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 p-6">
        <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Date & Time</TableHead>
                <TableHead>Staff</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10">Loading orders...</TableCell>
                </TableRow>
              ) : filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No orders found.</TableCell>
                </TableRow>
              ) : (
                filteredOrders.map((order) => (
                  <TableRow 
                    key={order.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedOrder(order)}
                  >
                    <TableCell className="font-medium text-primary">{order.orderNumber}</TableCell>
                    <TableCell>{format(new Date(order.createdAt), "MMM d, yyyy h:mm a")}</TableCell>
                    <TableCell>{order.staffName || "System"}</TableCell>
                    <TableCell className="capitalize">{order.paymentMethod || "Unknown"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(order.status)}>
                        {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">RM {order.total.toFixed(2)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </ScrollArea>

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-2xl bg-background rounded-2xl p-0 overflow-hidden">
          {selectedOrder && (
            <div className="flex flex-col h-[80vh] md:h-[600px]">
              <DialogHeader className="p-6 border-b bg-card">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-2xl font-bold text-primary">Order {selectedOrder.orderNumber}</DialogTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {format(new Date(selectedOrder.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                    </p>
                  </div>
                  <Badge variant="outline" className={`${getStatusColor(selectedOrder.status)} text-base px-3 py-1`}>
                    {selectedOrder.status.toUpperCase()}
                  </Badge>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 p-6 bg-muted/10">
                <div className="space-y-6">
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Order Items</h3>
                    <div className="bg-card border rounded-xl overflow-hidden shadow-sm">
                      <Table>
                        <TableHeader className="bg-muted/30">
                          <TableRow>
                            <TableHead>Item</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {selectedOrder.items.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">
                                {item.productName}
                                {item.taxRate > 0 && <Badge variant="secondary" className="ml-2 text-[10px]">SST</Badge>}
                              </TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">RM {item.unitPrice.toFixed(2)}</TableCell>
                              <TableCell className="text-right font-bold">RM {item.total.toFixed(2)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-card border rounded-xl p-4 shadow-sm">
                      <h4 className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">Payment Info</h4>
                      <p className="font-medium capitalize">{selectedOrder.paymentMethod || "Unknown"}</p>
                      {selectedOrder.paymentMethod === "cash" && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <div className="flex justify-between">
                            <span>Paid:</span>
                            <span>RM {selectedOrder.amountPaid?.toFixed(2) || "0.00"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Change:</span>
                            <span>RM {selectedOrder.change?.toFixed(2) || "0.00"}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="bg-card border rounded-xl p-4 shadow-sm">
                      <h4 className="text-xs text-muted-foreground font-bold uppercase tracking-wider mb-2">Staff</h4>
                      <p className="font-medium">{selectedOrder.staffName || "System"}</p>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <div className="p-6 border-t bg-card flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">Update Status:</span>
                  <Select 
                    value={selectedOrder.status} 
                    onValueChange={(v: OrderStatus) => handleStatusChange(selectedOrder.id, v)}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-right">
                  <div className="text-sm text-muted-foreground mb-1">
                    Subtotal: RM {selectedOrder.subtotal.toFixed(2)} | SST: RM {selectedOrder.taxTotal.toFixed(2)}
                  </div>
                  <div className="text-2xl font-black text-primary">
                    Total: RM {selectedOrder.total.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}