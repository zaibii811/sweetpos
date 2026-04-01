import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useListCategories } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Package, Plus, Search, Edit2, Trash2, TriangleAlert, CalendarClock,
  TrendingDown, Upload, ChevronUp, ChevronDown, Settings2, RefreshCw,
  ShoppingBag, X, FileSpreadsheet,
} from "lucide-react";
import Papa from "papaparse";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtendedProduct {
  id: number;
  name: string;
  productType: "fixed" | "weight";
  description?: string | null;
  price: number;
  costPrice?: number | null;
  categoryId?: number | null;
  categoryName?: string | null;
  sku?: string | null;
  stock: number;
  lowStockThreshold: number;
  taxable: boolean;
  active: boolean;
  imageUrl?: string | null;
  expiryDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Consumable {
  id: number;
  name: string;
  unit: string;
  stock: number;
  lowStockThreshold: number;
  costPerUnit: number | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface StockAdjustment {
  id: number;
  itemType: string;
  itemId: number;
  itemName: string;
  adjustmentType: string;
  quantity: number;
  reason: string | null;
  staffName: string | null;
  createdAt: string;
}

interface BagSizeRule {
  id: number;
  name: string;
  maxWeightGrams: number;
  consumableId: number | null;
  createdAt: string;
}

interface AlertData {
  lowStockProducts: Array<{ id: number; name: string; stock: number; threshold: number; productType: string }>;
  expiringProducts: Array<{ id: number; name: string; expiryDate: string; daysLeft: number }>;
  expiredProducts: Array<{ id: number; name: string; expiryDate: string }>;
  lowStockConsumables: Array<{ id: number; name: string; stock: number; threshold: number }>;
  totalAlertCount: number;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? "Request failed");
  }
  return res.json();
}

function useProducts() {
  return useQuery<ExtendedProduct[]>({
    queryKey: ["products-extended"],
    queryFn: () => apiFetch("/api/products"),
  });
}

function useConsumables() {
  return useQuery<Consumable[]>({
    queryKey: ["consumables"],
    queryFn: () => apiFetch("/api/consumables"),
  });
}

function useAlerts() {
  return useQuery<AlertData>({
    queryKey: ["inventory-alerts"],
    queryFn: () => apiFetch("/api/inventory/alerts"),
    refetchInterval: 60000,
  });
}

function useStockAdjustments(itemType?: string, itemId?: number) {
  return useQuery<StockAdjustment[]>({
    queryKey: ["stock-adjustments", itemType, itemId],
    queryFn: () => {
      const params = new URLSearchParams();
      if (itemType) params.set("itemType", itemType);
      if (itemId) params.set("itemId", String(itemId));
      return apiFetch(`/api/stock-adjustments?${params}`);
    },
    enabled: true,
  });
}

function useBagSizeRules() {
  return useQuery<BagSizeRule[]>({
    queryKey: ["bag-size-rules"],
    queryFn: () => apiFetch("/api/bag-size-rules"),
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMYR(n: number) { return `RM ${n.toFixed(2)}`; }

function daysUntilExpiry(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000);
}

function expiryBadge(dateStr: string | null | undefined) {
  if (!dateStr) return null;
  const days = daysUntilExpiry(dateStr);
  if (days < 0) return <Badge variant="destructive" className="text-[10px]">Expired</Badge>;
  if (days === 0) return <Badge variant="destructive" className="text-[10px]">Expires today</Badge>;
  if (days <= 7) return <Badge className="text-[10px] bg-amber-500 text-white">Exp. in {days}d</Badge>;
  return <span className="text-xs text-muted-foreground">{dateStr}</span>;
}

function stockBadge(stock: number, threshold: number, unit = "") {
  const low = stock <= threshold;
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs font-bold tabular-nums ${low ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground"}`}>
      {stock}{unit}
    </span>
  );
}

// ─── Product Modal ────────────────────────────────────────────────────────────

interface ProductModalProps {
  product: ExtendedProduct | null;
  categories: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSaved: () => void;
}

function ProductModal({ product, categories, onClose, onSaved }: ProductModalProps) {
  const { toast } = useToast();
  const isEdit = !!product;

  const [form, setForm] = useState({
    name: product?.name ?? "",
    productType: (product?.productType ?? "fixed") as "fixed" | "weight",
    description: product?.description ?? "",
    price: product?.price?.toString() ?? "",
    costPrice: product?.costPrice?.toString() ?? "",
    categoryId: product?.categoryId?.toString() ?? "",
    stock: product?.stock?.toString() ?? "0",
    lowStockThreshold: product?.lowStockThreshold?.toString() ?? "10",
    taxable: product?.taxable ?? true,
    active: product?.active ?? true,
    expiryDate: product?.expiryDate ?? "",
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    if (!form.price) { toast({ title: "Price required", variant: "destructive" }); return; }

    const body = {
      name: form.name.trim(),
      productType: form.productType,
      description: form.description || null,
      price: parseFloat(form.price),
      costPrice: form.costPrice ? parseFloat(form.costPrice) : null,
      categoryId: form.categoryId ? parseInt(form.categoryId, 10) : null,
      stock: parseInt(form.stock || "0", 10),
      lowStockThreshold: parseInt(form.lowStockThreshold || "10", 10),
      taxable: form.taxable,
      active: form.active,
      expiryDate: form.expiryDate || null,
    };

    try {
      if (isEdit && product) {
        await apiFetch(`/api/products/${product.id}`, { method: "PATCH", body: JSON.stringify(body) });
        toast({ title: "Product updated" });
      } else {
        await apiFetch("/api/products", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "Product created" });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[70vh] pr-1">
          <div className="space-y-4 py-2 pr-2">
            {/* Product type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Product Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["fixed", "weight"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => set("productType", t)}
                    className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${form.productType === t ? "border-primary bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground"}`}
                    data-testid={`type-${t}`}
                  >
                    {t === "fixed" ? "Fixed Price" : "Weight-Based"}
                    <span className="block text-[10px] font-normal mt-0.5 text-muted-foreground">
                      {t === "fixed" ? "Sold by unit" : "Sold by weight (per 100g)"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-sm">Product Name</Label>
                <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Gummy Bears" data-testid="input-product-name" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{form.productType === "weight" ? "Price per 100g (RM)" : "Selling Price (RM)"}</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="0.00" data-testid="input-price" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Cost Price (RM)</Label>
                <Input type="number" step="0.01" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{form.productType === "weight" ? "Current Stock (grams)" : "Current Stock (units)"}</Label>
                <Input type="number" value={form.stock} onChange={(e) => set("stock", e.target.value)} data-testid="input-stock" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">{form.productType === "weight" ? "Low Stock Alert (grams)" : "Low Stock Alert (units)"}</Label>
                <Input type="number" value={form.lowStockThreshold} onChange={(e) => set("lowStockThreshold", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">Category</Label>
                <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
                  <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-sm">Expiry Date</Label>
                <Input type="date" value={form.expiryDate} onChange={(e) => set("expiryDate", e.target.value)} />
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2 border-t">
              <div className="flex items-center gap-2">
                <Switch id="taxable" checked={form.taxable} onCheckedChange={(v) => set("taxable", v)} />
                <Label htmlFor="taxable" className="cursor-pointer text-sm">Apply 8% SST</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
                <Label htmlFor="active" className="cursor-pointer text-sm">Active in POS</Label>
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSubmit} className="rounded-xl" data-testid="button-save-product">
            {isEdit ? "Save Changes" : "Create Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Consumable Modal ─────────────────────────────────────────────────────────

interface ConsumableModalProps {
  consumable: Consumable | null;
  onClose: () => void;
  onSaved: () => void;
}

function ConsumableModal({ consumable, onClose, onSaved }: ConsumableModalProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isEdit = !!consumable;
  const isGummyBag = isEdit && (consumable!.name.toLowerCase().includes("gummy plastic bag") || consumable!.name.toLowerCase().includes("plastic bag"));
  const canEditBagSettings = user?.role === "owner" || user?.role === "admin" || user?.role === "manager";

  const [form, setForm] = useState({
    name: consumable?.name ?? "",
    unit: consumable?.unit ?? "pieces",
    stock: consumable?.stock?.toString() ?? "0",
    lowStockThreshold: consumable?.lowStockThreshold?.toString() ?? "50",
    costPerUnit: consumable?.costPerUnit?.toString() ?? "",
    active: consumable?.active ?? true,
  });

  const { data: bagSettings } = useQuery<Record<string, string>>({
    queryKey: ["settings-bag"],
    queryFn: () => apiFetch("/api/settings"),
    enabled: isGummyBag,
    staleTime: 30000,
  });

  const { data: bagStats } = useQuery<{ usedToday: number; usedThisWeek: number; usedThisMonth: number; currentStock: number }>({
    queryKey: ["bag-usage-stats"],
    queryFn: () => apiFetch("/api/reports/bag-usage-stats"),
    enabled: isGummyBag,
    staleTime: 30000,
  });

  const [bagChargeEnabled, setBagChargeEnabled] = useState<boolean | null>(null);
  const [bagPrice, setBagPrice] = useState<string>("");

  const effectiveBagChargeEnabled = bagChargeEnabled !== null ? bagChargeEnabled : bagSettings?.plastic_bag_charge_enabled === "true";
  const effectiveBagPrice = bagPrice !== "" ? bagPrice : (bagSettings?.plastic_bag_price ?? "0.25");

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast({ title: "Name required", variant: "destructive" }); return; }
    const body = {
      name: form.name.trim(),
      unit: form.unit || "pieces",
      stock: parseInt(form.stock || "0", 10),
      lowStockThreshold: parseInt(form.lowStockThreshold || "50", 10),
      costPerUnit: form.costPerUnit ? parseFloat(form.costPerUnit) : null,
      active: form.active,
    };
    try {
      if (isEdit && consumable) {
        await apiFetch(`/api/consumables/${consumable.id}`, { method: "PATCH", body: JSON.stringify(body) });
        if (isGummyBag && canEditBagSettings && (bagChargeEnabled !== null || bagPrice !== "")) {
          await apiFetch("/api/settings", {
            method: "PATCH",
            body: JSON.stringify({
              plastic_bag_charge_enabled: String(effectiveBagChargeEnabled),
              plastic_bag_price: parseFloat(effectiveBagPrice) > 0 ? effectiveBagPrice : "0.25",
            }),
          });
        }
        toast({ title: "Consumable updated" });
      } else {
        await apiFetch("/api/consumables", { method: "POST", body: JSON.stringify(body) });
        toast({ title: "Consumable created" });
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Consumable" : "Add Consumable"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm">Name</Label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder='e.g. Plastic Bag (M)' data-testid="input-consumable-name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Unit</Label>
              <Input value={form.unit} onChange={(e) => set("unit", e.target.value)} placeholder="pieces" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Cost per unit (RM)</Label>
              <Input type="number" step="0.01" value={form.costPerUnit} onChange={(e) => set("costPerUnit", e.target.value)} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Current Stock</Label>
              <Input type="number" value={form.stock} onChange={(e) => set("stock", e.target.value)} data-testid="input-consumable-stock" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Low Stock Alert</Label>
              <Input type="number" value={form.lowStockThreshold} onChange={(e) => set("lowStockThreshold", e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Switch id="c-active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
            <Label htmlFor="c-active" className="text-sm cursor-pointer">Active</Label>
          </div>

          {isGummyBag && canEditBagSettings && (
            <>
              <Separator />
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5" /> Customer Bag Charge
                </p>

                {/* Stock usage summary */}
                {bagStats && (
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: "Current Stock", value: bagStats.currentStock },
                      { label: "Used Today", value: bagStats.usedToday },
                      { label: "Used This Week", value: bagStats.usedThisWeek },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-muted/60 rounded-xl p-2.5 text-center">
                        <p className="text-lg font-black">{value}</p>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Charge toggle */}
                <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <div>
                    <p className="text-sm font-semibold">Charge customers for bag</p>
                    <p className="text-xs text-muted-foreground">Add bag price to every gummy order</p>
                  </div>
                  <Switch
                    checked={effectiveBagChargeEnabled}
                    onCheckedChange={(v) => setBagChargeEnabled(v)}
                    data-testid="switch-bag-charge-enabled"
                  />
                </div>

                {/* Price input */}
                {effectiveBagChargeEnabled && (
                  <div className="space-y-1.5">
                    <Label className="text-sm">Charge price (RM)</Label>
                    <Input
                      type="number"
                      step="0.05"
                      min="0.05"
                      value={effectiveBagPrice}
                      onChange={(e) => setBagPrice(e.target.value)}
                      placeholder="0.25"
                      data-testid="input-bag-charge-price"
                    />
                    <p className="text-xs text-muted-foreground">Default: RM 0.25</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSubmit} className="rounded-xl" data-testid="button-save-consumable">
            {isEdit ? "Save Changes" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Stock Adjust Modal ───────────────────────────────────────────────────────

interface StockAdjustModalProps {
  itemType: "product" | "consumable";
  item: ExtendedProduct | Consumable;
  onClose: () => void;
  onSaved: () => void;
}

function StockAdjustModal({ itemType, item, onClose, onSaved }: StockAdjustModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"top-up" | "deduction">("top-up");
  const { data: history = [] } = useStockAdjustments(itemType, item.id);

  const handleSubmit = async () => {
    const qty = parseFloat(quantity);
    if (!qty || qty <= 0) { toast({ title: "Enter a valid quantity", variant: "destructive" }); return; }
    try {
      await apiFetch("/api/stock-adjustments", {
        method: "POST",
        body: JSON.stringify({ itemType, itemId: item.id, adjustmentType: type, quantity: qty, reason: reason || null, staffId: user?.id ?? null }),
      });
      toast({ title: type === "top-up" ? "Stock added" : "Stock deducted" });
      onSaved();
      onClose();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const unit = itemType === "product" && (item as ExtendedProduct).productType === "weight" ? "g" : "";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>Stock Adjustment — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-xl p-3 text-sm">
            <span className="text-muted-foreground">Current stock:</span>
            <span className="font-black ml-2 text-lg">{item.stock}{unit}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["top-up", "deduction"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${type === t ? (t === "top-up" ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700" : "border-destructive bg-destructive/10 text-destructive") : "border-border text-muted-foreground"}`}
                data-testid={`adjust-type-${t}`}
              >
                {t === "top-up" ? "Top Up" : "Deduction"}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Quantity{unit ? ` (${unit})` : ""}</Label>
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              data-testid="input-adjust-quantity"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">Reason / Supplier Note</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder='e.g. "New shipment — 2kg bag from supplier"'
              rows={2}
              className="rounded-xl resize-none"
              data-testid="input-adjust-reason"
            />
          </div>
          {history.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recent Log</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {history.slice(0, 5).map((h) => (
                  <div key={h.id} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className={h.adjustmentType === "top-up" ? "text-green-600" : "text-destructive"}>
                      {h.adjustmentType === "top-up" ? "+" : "-"}{h.quantity}{unit}
                    </span>
                    <span className="truncate mx-2 flex-1">{h.reason ?? "—"}</span>
                    <span>{new Date(h.createdAt).toLocaleDateString("en-MY")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleSubmit} className="rounded-xl" data-testid="button-confirm-adjust">Confirm</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── CSV Import Modal ─────────────────────────────────────────────────────────

interface CsvImportModalProps {
  categories: Array<{ id: number; name: string }>;
  onClose: () => void;
  onImported: () => void;
}

function CsvImportModal({ categories, onClose, onImported }: CsvImportModalProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => setRows(result.data as any[]),
    });
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    let success = 0;
    let fail = 0;
    for (const row of rows) {
      try {
        const catId = categories.find((c) => c.name.toLowerCase() === (row.category ?? "").toLowerCase())?.id;
        await apiFetch("/api/products", {
          method: "POST",
          body: JSON.stringify({
            name: row.name?.trim() || "Unnamed",
            productType: row.type === "weight" ? "weight" : "fixed",
            price: parseFloat(row.price || "0"),
            costPrice: row.cost_price ? parseFloat(row.cost_price) : null,
            stock: parseInt(row.stock || "0", 10),
            lowStockThreshold: parseInt(row.low_stock_threshold || "10", 10),
            categoryId: catId ?? null,
            taxable: row.taxable?.toLowerCase() !== "false",
            active: row.active?.toLowerCase() !== "false",
            expiryDate: row.expiry_date?.trim() || null,
          }),
        });
        success++;
      } catch { fail++; }
    }
    setImporting(false);
    toast({ title: `Imported ${success} products${fail > 0 ? `, ${fail} failed` : ""}` });
    onImported();
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" /> CSV Import
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="bg-muted/50 rounded-xl p-4 text-xs space-y-1 border border-dashed">
            <p className="font-semibold mb-2">Expected CSV columns:</p>
            <code className="text-[11px] text-muted-foreground leading-relaxed block">
              name, type (fixed/weight), price, cost_price,<br />
              stock, low_stock_threshold, category, taxable, active, expiry_date
            </code>
          </div>
          <div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} data-testid="input-csv-file" />
            <Button variant="outline" onClick={() => fileRef.current?.click()} className="w-full rounded-xl gap-2">
              <Upload className="w-4 h-4" /> Choose CSV file
            </Button>
          </div>
          {rows.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-green-600">{rows.length} rows ready to import</p>
              <ScrollArea className="h-40 border rounded-xl">
                <div className="p-2 space-y-1">
                  {rows.slice(0, 10).map((r, i) => (
                    <div key={i} className="text-xs text-muted-foreground flex gap-2">
                      <span className="font-medium text-foreground truncate">{r.name}</span>
                      <span>{r.type}</span>
                      <span>RM{r.price}</span>
                      <span>{r.stock} units</span>
                    </div>
                  ))}
                  {rows.length > 10 && <p className="text-xs text-muted-foreground">...and {rows.length - 10} more</p>}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">Cancel</Button>
          <Button onClick={handleImport} disabled={rows.length === 0 || importing} className="rounded-xl" data-testid="button-import-csv">
            {importing ? "Importing..." : `Import ${rows.length} Products`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bag Size Rules Modal ─────────────────────────────────────────────────────

interface BagRulesModalProps {
  onClose: () => void;
}

function BagRulesModal({ onClose }: BagRulesModalProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: rules = [] } = useBagSizeRules();
  const { data: consumables = [] } = useConsumables();

  const [newRule, setNewRule] = useState({ name: "", maxWeightGrams: "", consumableId: "" });

  const handleAdd = async () => {
    if (!newRule.name || !newRule.maxWeightGrams) {
      toast({ title: "Fill all fields", variant: "destructive" }); return;
    }
    try {
      await apiFetch("/api/bag-size-rules", {
        method: "POST",
        body: JSON.stringify({
          name: newRule.name,
          maxWeightGrams: parseInt(newRule.maxWeightGrams, 10),
          consumableId: newRule.consumableId ? parseInt(newRule.consumableId, 10) : null,
        }),
      });
      qc.invalidateQueries({ queryKey: ["bag-size-rules"] });
      setNewRule({ name: "", maxWeightGrams: "", consumableId: "" });
      toast({ title: "Rule added" });
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: number) => {
    await apiFetch(`/api/bag-size-rules/${id}`, { method: "DELETE" });
    qc.invalidateQueries({ queryKey: ["bag-size-rules"] });
    toast({ title: "Rule deleted" });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" /> Bag Size Rules
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            Define weight thresholds that auto-select the correct plastic bag size when a weight-based item is sold.
          </p>
          {rules.length > 0 && (
            <div className="space-y-2">
              {[...rules].sort((a, b) => a.maxWeightGrams - b.maxWeightGrams).map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-muted/50 rounded-xl p-3 border">
                  <div>
                    <p className="font-semibold text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Up to {r.maxWeightGrams}g
                      {r.consumableId && (
                        <> — {consumables.find((c) => c.id === r.consumableId)?.name ?? "Unknown"}</>
                      )}
                    </p>
                  </div>
                  <button onClick={() => handleDelete(r.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <Separator />
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Rule</p>
            <div className="grid grid-cols-3 gap-2">
              <Input value={newRule.name} onChange={(e) => setNewRule((r) => ({ ...r, name: e.target.value }))} placeholder="Name (S/M/L)" className="rounded-xl text-sm" />
              <Input type="number" value={newRule.maxWeightGrams} onChange={(e) => setNewRule((r) => ({ ...r, maxWeightGrams: e.target.value }))} placeholder="Max grams" className="rounded-xl text-sm" />
              <Select value={newRule.consumableId} onValueChange={(v) => setNewRule((r) => ({ ...r, consumableId: v }))}>
                <SelectTrigger className="h-9 rounded-lg text-sm"><SelectValue placeholder="Bag SKU" /></SelectTrigger>
                <SelectContent>
                  {consumables.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} size="sm" className="rounded-xl w-full">Add Rule</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-xl">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteConfirm({ name, onConfirm, onCancel }: DeleteConfirmProps) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader><DialogTitle>Delete {name}?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl">Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} className="rounded-xl" data-testid="button-confirm-delete">Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Inventory Component ─────────────────────────────────────────────────

export default function Inventory() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: categories = [] } = useListCategories();
  const { data: products = [], isLoading: loadingProducts } = useProducts();
  const { data: consumables = [], isLoading: loadingConsumables } = useConsumables();
  const { data: alerts } = useAlerts();

  const [tab, setTab] = useState<"products" | "consumables">("products");
  const [search, setSearch] = useState("");

  // Modals
  const [productModal, setProductModal] = useState<{ product: ExtendedProduct | null } | null>(null);
  const [consumableModal, setConsumableModal] = useState<{ consumable: Consumable | null } | null>(null);
  const [adjustModal, setAdjustModal] = useState<{ itemType: "product" | "consumable"; item: ExtendedProduct | Consumable } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ type: "product" | "consumable"; id: number; name: string } | null>(null);
  const [csvModal, setCsvModal] = useState(false);
  const [bagRulesModal, setBagRulesModal] = useState(false);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["products-extended"] });
    qc.invalidateQueries({ queryKey: ["consumables"] });
    qc.invalidateQueries({ queryKey: ["inventory-alerts"] });
    qc.invalidateQueries({ queryKey: ["stock-adjustments"] });
    qc.invalidateQueries({ queryKey: ["settings"] });
    qc.invalidateQueries({ queryKey: ["settings-bag"] });
    qc.invalidateQueries({ queryKey: ["bag-usage-stats"] });
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    try {
      const path = deleteModal.type === "product" ? `/api/products/${deleteModal.id}` : `/api/consumables/${deleteModal.id}`;
      await apiFetch(path, { method: "DELETE" });
      toast({ title: `${deleteModal.name} deleted` });
      setDeleteModal(null);
      invalidateAll();
    } catch (e: unknown) {
      toast({ title: "Error", description: (e as Error).message, variant: "destructive" });
    }
  };

  const filteredProducts = products.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.categoryName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredConsumables = consumables.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalAlerts = alerts?.totalAlertCount ?? 0;

  return (
    <div className="flex flex-col h-full bg-muted/20">
      {/* Header */}
      <div className="px-6 pt-5 pb-4 bg-card border-b space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-5 h-5 text-primary" />
              </div>
              {totalAlerts > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-destructive text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center">
                  {totalAlerts > 99 ? "99+" : totalAlerts}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold">Inventory</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setBagRulesModal(true)} className="rounded-xl gap-1.5 hidden sm:flex">
              <Settings2 className="w-4 h-4" /> Bag Rules
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCsvModal(true)} className="rounded-xl gap-1.5 hidden sm:flex">
              <Upload className="w-4 h-4" /> Import CSV
            </Button>
            {tab === "products" && (
              <Button size="sm" onClick={() => setProductModal({ product: null })} className="rounded-xl gap-1.5" data-testid="button-add-product">
                <Plus className="w-4 h-4" /> Add Product
              </Button>
            )}
            {tab === "consumables" && (
              <Button size="sm" onClick={() => setConsumableModal({ consumable: null })} className="rounded-xl gap-1.5" data-testid="button-add-consumable">
                <Plus className="w-4 h-4" /> Add Consumable
              </Button>
            )}
          </div>
        </div>

        {/* Alert banners */}
        {alerts && (alerts.lowStockProducts.length > 0 || alerts.expiringProducts.length > 0 || alerts.expiredProducts.length > 0 || alerts.lowStockConsumables.length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
            {alerts.lowStockProducts.length > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded-xl px-3 py-2">
                <TrendingDown className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {alerts.lowStockProducts.length} low stock products
                </span>
              </div>
            )}
            {alerts.expiringProducts.length > 0 && (
              <div className="flex items-center gap-2 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 rounded-xl px-3 py-2">
                <CalendarClock className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <span className="text-xs font-medium text-orange-700 dark:text-orange-400">
                  {alerts.expiringProducts.length} expiring in 7 days
                </span>
              </div>
            )}
            {alerts.expiredProducts.length > 0 && (
              <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 rounded-xl px-3 py-2">
                <TriangleAlert className="w-4 h-4 text-destructive flex-shrink-0" />
                <span className="text-xs font-medium text-destructive">
                  {alerts.expiredProducts.length} expired items
                </span>
              </div>
            )}
            {alerts.lowStockConsumables.length > 0 && (
              <div className="flex items-center gap-2 bg-purple-50 dark:bg-purple-950/30 border border-purple-200 rounded-xl px-3 py-2">
                <ShoppingBag className="w-4 h-4 text-purple-600 flex-shrink-0" />
                <span className="text-xs font-medium text-purple-700 dark:text-purple-400">
                  {alerts.lowStockConsumables.length} low stock bags
                </span>
              </div>
            )}
          </div>
        )}

        {/* Tabs + Search */}
        <div className="flex items-center gap-3">
          <div className="flex bg-muted rounded-xl p-1 gap-1">
            {(["products", "consumables"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSearch(""); }}
                data-testid={`tab-${t}`}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t === "products" ? `Products (${products.length})` : `Consumables (${consumables.length})`}
              </button>
            ))}
          </div>
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 rounded-xl bg-background"
              data-testid="input-search-inventory"
            />
            {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
          </div>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1 p-4">
        {tab === "products" ? (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead>Expiry</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingProducts ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-12 text-muted-foreground">No products found.</TableCell></TableRow>
                ) : filteredProducts.map((p) => {
                  const isLow = p.stock <= p.lowStockThreshold;
                  const isExpired = p.expiryDate && daysUntilExpiry(p.expiryDate) < 0;
                  const isExpiring = p.expiryDate && daysUntilExpiry(p.expiryDate) >= 0 && daysUntilExpiry(p.expiryDate) <= 7;
                  return (
                    <TableRow
                      key={p.id}
                      className={`${!p.active ? "opacity-50" : ""} ${isExpired ? "bg-red-50/50 dark:bg-red-950/10" : isExpiring ? "bg-amber-50/50 dark:bg-amber-950/10" : ""}`}
                      data-testid={`product-row-${p.id}`}
                    >
                      <TableCell>
                        <button
                          onClick={() => setProductModal({ product: p })}
                          className="font-semibold text-sm text-left hover:text-primary hover:underline cursor-pointer transition-colors"
                          data-testid={`product-name-${p.id}`}
                        >
                          {p.name}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.productType === "weight" ? "outline" : "secondary"} className="text-[10px] font-semibold">
                          {p.productType === "weight" ? "Weight/100g" : "Fixed"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {p.categoryName
                          ? <Badge variant="secondary" className="font-normal text-xs">{p.categoryName}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>}
                      </TableCell>
                      <TableCell className="text-right font-medium text-sm">
                        {fmtMYR(p.price)}
                        {p.productType === "weight" && <span className="text-muted-foreground text-xs">/100g</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {p.costPrice != null ? fmtMYR(p.costPrice) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {stockBadge(p.stock, p.lowStockThreshold, p.productType === "weight" ? "g" : "")}
                      </TableCell>
                      <TableCell>{expiryBadge(p.expiryDate)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={p.active ? "default" : "secondary"} className="text-[10px]">
                          {p.active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setAdjustModal({ itemType: "product", item: p })}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Adjust stock"
                            data-testid={`adjust-product-${p.id}`}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setProductModal({ product: p })}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                            title="Edit"
                            data-testid={`edit-product-${p.id}`}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setDeleteModal({ type: "product", id: p.id, name: p.name })}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Delete"
                            data-testid={`delete-product-${p.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Stock</TableHead>
                  <TableHead className="text-right">Alert Threshold</TableHead>
                  <TableHead className="text-right">Cost/Unit</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingConsumables ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filteredConsumables.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No consumables yet. Add plastic bags to track them.
                    </TableCell>
                  </TableRow>
                ) : filteredConsumables.map((c) => (
                  <TableRow key={c.id} className={!c.active ? "opacity-50" : ""} data-testid={`consumable-row-${c.id}`}>
                    <TableCell className="font-semibold text-sm">{c.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.unit}</TableCell>
                    <TableCell className="text-right">{stockBadge(c.stock, c.lowStockThreshold)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{c.lowStockThreshold}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {c.costPerUnit != null ? fmtMYR(c.costPerUnit) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={c.active ? "default" : "secondary"} className="text-[10px]">
                        {c.active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setAdjustModal({ itemType: "consumable", item: c })}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="Adjust stock"
                          data-testid={`adjust-consumable-${c.id}`}
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setConsumableModal({ consumable: c })}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          data-testid={`edit-consumable-${c.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteModal({ type: "consumable", id: c.id, name: c.name })}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          data-testid={`delete-consumable-${c.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </ScrollArea>

      {/* Modals */}
      {productModal && (
        <ProductModal
          product={productModal.product}
          categories={categories}
          onClose={() => setProductModal(null)}
          onSaved={invalidateAll}
        />
      )}
      {consumableModal && (
        <ConsumableModal
          consumable={consumableModal.consumable}
          onClose={() => setConsumableModal(null)}
          onSaved={invalidateAll}
        />
      )}
      {adjustModal && (
        <StockAdjustModal
          itemType={adjustModal.itemType}
          item={adjustModal.item}
          onClose={() => setAdjustModal(null)}
          onSaved={invalidateAll}
        />
      )}
      {deleteModal && (
        <DeleteConfirm
          name={deleteModal.name}
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal(null)}
        />
      )}
      {csvModal && (
        <CsvImportModal
          categories={categories}
          onClose={() => setCsvModal(false)}
          onImported={invalidateAll}
        />
      )}
      {bagRulesModal && <BagRulesModal onClose={() => setBagRulesModal(false)} />}
    </div>
  );
}
