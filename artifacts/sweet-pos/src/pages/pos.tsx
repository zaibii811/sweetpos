import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useListProducts,
  useListCategories,
  useCreateOrder,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { motion, AnimatePresence } from "framer-motion";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Search, Minus, Plus, Trash2, ShoppingBag, CreditCard, Wallet,
  Banknote, Tag, Printer, MessageCircle, CheckCircle2, X,
  Cake, SplitSquareHorizontal, QrCode, Store,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// ─── Types ────────────────────────────────────────────────────────────────────

type CakeSize = '6"' | '8"' | '10"';

interface CartModifiers {
  size?: CakeSize;
  message?: string;
  giftWrap?: boolean;
}

interface WeightModifiers {
  weightGrams: number;
  calculatedUnitPrice: number;
  bagIncluded: boolean;
  bagConsumableId?: number;
  bagConsumableName?: string;
  bagChargePrice?: number;
}

interface CartItem {
  product: Product;
  quantity: number;
  modifiers?: CartModifiers;
  weightModifiers?: WeightModifiers;
  /** Price already adjusted for modifiers/weight */
  unitPrice: number;
}

type PaymentMethod = "cash" | "card" | "tng" | "duitnow" | "split";

interface SplitPayment {
  method1: "cash" | "card" | "tng" | "duitnow";
  amount1: string;
  method2: "cash" | "card" | "tng" | "duitnow";
  amount2: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────

const GIFT_WRAP_PRICE = 5;
const CAKE_SIZE_PRICES: Record<CakeSize, number> = { '6"': 0, '8"': 15, '10"': 30 };
const SST_RATE = 0.08;

const PAYMENT_METHODS: { id: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "card", label: "Card", icon: CreditCard },
  { id: "tng", label: "TNG eWallet", icon: Wallet },
  { id: "duitnow", label: "DuitNow QR", icon: QrCode },
  { id: "split", label: "Split", icon: SplitSquareHorizontal },
];

const NUMPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "⌫"];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function isCakeProduct(product: Product, categoryName?: string | null): boolean {
  return (categoryName ?? product.categoryName ?? "").toLowerCase().includes("cake");
}

function modifierSummary(modifiers?: CartModifiers): string {
  if (!modifiers) return "";
  const parts: string[] = [];
  if (modifiers.size) parts.push(modifiers.size);
  if (modifiers.message) parts.push(`"${modifiers.message}"`);
  if (modifiers.giftWrap) parts.push("Gift Wrap +RM5");
  return parts.join(" · ");
}

function fmtMYR(n: number) {
  return `RM ${n.toFixed(2)}`;
}

// ─── QR Placeholder ────────────────────────────────────────────────────────────

function QRPlaceholder({ amount, label }: { amount: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-2xl shadow-inner border">
      <p className="font-semibold text-muted-foreground text-sm">{label}</p>
      <div className="text-3xl font-black text-foreground">{fmtMYR(amount)}</div>
      {/* SVG mock QR */}
      <svg width="180" height="180" viewBox="0 0 180 180" className="rounded-xl border">
        <rect width="180" height="180" fill="white" />
        {/* Corner squares */}
        <rect x="10" y="10" width="50" height="50" fill="none" stroke="black" strokeWidth="6" />
        <rect x="20" y="20" width="30" height="30" fill="black" />
        <rect x="120" y="10" width="50" height="50" fill="none" stroke="black" strokeWidth="6" />
        <rect x="130" y="20" width="30" height="30" fill="black" />
        <rect x="10" y="120" width="50" height="50" fill="none" stroke="black" strokeWidth="6" />
        <rect x="20" y="130" width="30" height="30" fill="black" />
        {/* Middle data modules */}
        {Array.from({ length: 6 }, (_, r) =>
          Array.from({ length: 6 }, (_, c) => {
            const x = 75 + c * 9;
            const y = 75 + r * 9;
            const on = (r + c + r * c) % 3 !== 0;
            return on ? <rect key={`${r}-${c}`} x={x} y={y} width="7" height="7" fill="black" /> : null;
          })
        )}
        {/* Random scatter */}
        {[
          [70,30],[80,30],[90,30],[100,30],[110,30],[120,30],
          [70,40],[80,40],[110,40],[120,40],
          [70,50],[90,50],[100,50],[120,50],
          [30,70],[40,70],[60,70],[70,70],[100,70],[130,70],[140,70],[150,70],
          [30,80],[50,80],[70,80],[100,80],[130,80],[150,80],
          [30,90],[40,90],[70,90],[100,90],[130,90],[140,90],[150,90],
          [30,100],[60,100],[70,100],[100,100],[130,100],[150,100],
          [30,110],[50,110],[70,110],[90,110],[130,110],[140,110],[150,110],
          [70,130],[80,130],[100,130],[110,130],[120,130],[140,130],
          [70,140],[100,140],[130,140],[150,140],
          [70,150],[80,150],[90,150],[110,150],[130,150],[140,150],
        ].map(([x, y], i) => <rect key={i} x={x} y={y} width="8" height="8" fill="black" />)}
      </svg>
      <p className="text-xs text-muted-foreground text-center">Scan with your banking or e-wallet app</p>
    </div>
  );
}

// ─── Cake Modifiers Dialog ─────────────────────────────────────────────────────

interface ModifiersDialogProps {
  product: Product | null;
  onConfirm: (product: Product, modifiers: CartModifiers, unitPrice: number) => void;
  onCancel: () => void;
}

function ModifiersDialog({ product, onConfirm, onCancel }: ModifiersDialogProps) {
  const [size, setSize] = useState<CakeSize>('6"');
  const [message, setMessage] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);

  if (!product) return null;

  const basePrice = product.price;
  const sizeAddon = CAKE_SIZE_PRICES[size];
  const giftAddon = giftWrap ? GIFT_WRAP_PRICE : 0;
  const finalPrice = basePrice + sizeAddon + giftAddon;

  const handleConfirm = () => {
    onConfirm(product, { size, message: message.trim() || undefined, giftWrap: giftWrap || undefined }, finalPrice);
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cake className="w-5 h-5 text-primary" />
            Customise {product.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Size */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Cake Size</Label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(CAKE_SIZE_PRICES) as CakeSize[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSize(s)}
                  data-testid={`modifier-size-${s}`}
                  className={`py-3 rounded-xl border-2 text-sm font-bold transition-all ${
                    size === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-foreground hover:border-primary/40"
                  }`}
                >
                  {s}
                  {CAKE_SIZE_PRICES[s] > 0 && (
                    <span className="block text-xs font-medium mt-0.5 text-muted-foreground">
                      +RM{CAKE_SIZE_PRICES[s]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="cake-message" className="text-sm font-semibold">
              Message on Cake <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="cake-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder='e.g. "Happy Birthday Aini!"'
              maxLength={40}
              data-testid="input-cake-message"
              className="rounded-xl"
            />
          </div>

          {/* Gift Wrap */}
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-xl border">
            <div>
              <p className="font-semibold text-sm">Gift Wrap</p>
              <p className="text-xs text-muted-foreground">Includes ribbon &amp; gift tag</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-primary">+RM5</span>
              <Switch
                checked={giftWrap}
                onCheckedChange={setGiftWrap}
                data-testid="modifier-gift-wrap"
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between px-1">
          <span className="text-muted-foreground text-sm">Unit price</span>
          <span className="font-black text-xl text-primary">{fmtMYR(finalPrice)}</span>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} className="rounded-xl flex-1" data-testid="modifier-cancel">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="rounded-xl flex-1" data-testid="modifier-confirm">
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Weight Input Modal ────────────────────────────────────────────────────────

interface BagSettings {
  chargeEnabled: boolean;
  price: number;
}

interface WeightInputModalProps {
  product: (Product & { productType?: string }) | null;
  consumables: Array<{ id: number; name: string; stock: number; unit: string }>;
  bagSizeRules: Array<{ id: number; name: string; maxWeightGrams: number; consumableId: number | null }>;
  bagSettings: BagSettings | null;
  onConfirm: (product: Product, weightModifiers: WeightModifiers, unitPrice: number) => void;
  onCancel: () => void;
}

const WEIGHT_NUMPAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];

function WeightInputModal({ product, consumables, bagSizeRules, bagSettings, onConfirm, onCancel }: WeightInputModalProps) {
  const [grams, setGrams] = useState("");
  const [bagIncluded, setBagIncluded] = useState(consumables.length > 0);
  const [selectedConsumableId, setSelectedConsumableId] = useState<number | null>(consumables[0]?.id ?? null);
  const chargeEnabled = !!(bagSettings?.chargeEnabled && bagSettings.price > 0);
  const bagPrice = bagSettings?.price ?? 0;

  if (!product) return null;

  const gramsNum = parseInt(grams || "0", 10);
  // price per 100g → total for given grams
  const totalPrice = gramsNum > 0 ? (gramsNum / 100) * product.price : 0;
  // unit price sent to API = price per gram
  const unitPricePerGram = product.price / 100;

  // Auto-select bag based on weight rules
  const autoRule = bagSizeRules
    .filter((r) => r.consumableId != null)
    .sort((a, b) => a.maxWeightGrams - b.maxWeightGrams)
    .find((r) => gramsNum <= r.maxWeightGrams);

  const effectiveConsumableId = autoRule?.consumableId ?? selectedConsumableId;
  const selectedConsumable = consumables.find((c) => c.id === effectiveConsumableId);

  const handleNumpad = (key: string) => {
    if (key === "C") { setGrams(""); return; }
    if (key === "⌫") { setGrams((p) => p.slice(0, -1)); return; }
    if (grams.length >= 5) return;
    setGrams((p) => (p === "0" ? key : p + key));
  };

  const handleConfirm = () => {
    if (gramsNum <= 0) return;
    const wm: WeightModifiers = {
      weightGrams: gramsNum,
      calculatedUnitPrice: unitPricePerGram,
      bagIncluded,
      bagConsumableId: bagIncluded && effectiveConsumableId ? effectiveConsumableId : undefined,
      bagConsumableName: bagIncluded && selectedConsumable ? selectedConsumable.name : undefined,
      bagChargePrice: bagIncluded && chargeEnabled ? bagPrice : undefined,
    };
    // unitPrice in cart = total for this portion (price shown as line total)
    onConfirm(product, wm, totalPrice);
  };

  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden" data-testid="dialog-weight-input">
        <div className="bg-primary/10 p-5">
          <p className="text-sm font-semibold text-muted-foreground">{product.name}</p>
          <p className="text-xs text-muted-foreground">RM {product.price.toFixed(2)} per 100g</p>
        </div>
        <div className="p-5 space-y-4">
          {/* Weight display */}
          <div className="bg-muted rounded-xl p-3 flex items-center justify-between border">
            <span className="text-sm font-medium text-muted-foreground">Weight</span>
            <span className="text-3xl font-black tabular-nums">{grams || "0"}<span className="text-lg text-muted-foreground ml-1">g</span></span>
          </div>

          {/* Numpad */}
          <div className="grid grid-cols-3 gap-2">
            {WEIGHT_NUMPAD_KEYS.map((key) => (
              <button
                key={key}
                onClick={() => handleNumpad(key)}
                data-testid={`weight-numpad-${key}`}
                className={`h-12 rounded-xl text-lg font-bold transition-all active:scale-95 border ${
                  key === "⌫" ? "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20"
                  : key === "C" ? "bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-950/30"
                  : "bg-background border-border hover:bg-muted"
                }`}
              >
                {key}
              </button>
            ))}
          </div>

          {/* Quick weights */}
          <div className="grid grid-cols-4 gap-1.5">
            {[100, 200, 300, 500].map((w) => (
              <button
                key={w}
                onClick={() => setGrams(String(w))}
                className="py-1.5 rounded-lg text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
                data-testid={`weight-quick-${w}`}
              >
                {w}g
              </button>
            ))}
          </div>

          {/* Price preview */}
          {gramsNum > 0 && (
            <div className="flex items-center justify-between bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 rounded-xl">
              <span className="text-sm font-medium text-green-700 dark:text-green-400">Total for {gramsNum}g</span>
              <span className="text-xl font-black text-green-700 dark:text-green-400">RM {totalPrice.toFixed(2)}</span>
            </div>
          )}

          {/* Bag toggle */}
          {consumables.length > 0 && (
            <div
              className={`rounded-xl border-2 p-3 transition-all ${bagIncluded ? (chargeEnabled ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30" : "border-primary/40 bg-primary/5") : "border-border bg-muted/30"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bagIncluded ? (chargeEnabled ? "bg-amber-100 dark:bg-amber-900/50" : "bg-primary/10") : "bg-muted"}`}>
                    <ShoppingBag className={`w-4 h-4 ${bagIncluded ? (chargeEnabled ? "text-amber-600 dark:text-amber-400" : "text-primary") : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-bold leading-tight">
                      Plastic Bag
                      {chargeEnabled && bagIncluded && (
                        <span className="ml-1.5 text-amber-600 dark:text-amber-400 font-black">+{fmtMYR(bagPrice)}</span>
                      )}
                      {chargeEnabled && !bagIncluded && (
                        <span className="ml-1.5 text-muted-foreground text-xs font-normal">No bag</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground leading-tight">
                      {!chargeEnabled ? "Free • deducts stock" :
                        bagIncluded ? "Charged as separate item" : "Customer declined bag"}
                    </p>
                  </div>
                </div>
                <Switch checked={bagIncluded} onCheckedChange={setBagIncluded} data-testid="weight-bag-toggle" />
              </div>
              {bagIncluded && autoRule && (
                <p className="text-xs text-muted-foreground mt-2 pl-11">Auto: {autoRule.name} ({autoRule.maxWeightGrams}g max)</p>
              )}
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 px-5 pb-5">
          <Button variant="outline" onClick={onCancel} className="rounded-xl flex-1" data-testid="weight-cancel">Cancel</Button>
          <Button onClick={handleConfirm} className="rounded-xl flex-1" disabled={gramsNum <= 0} data-testid="weight-confirm">
            Add {gramsNum > 0 ? `${gramsNum}g` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Payment Modal ─────────────────────────────────────────────────────────────

interface PaymentModalProps {
  open: boolean;
  total: number;
  paymentMethod: PaymentMethod;
  onClose: () => void;
  onConfirm: (amountPaid?: number, splitPayment?: SplitPayment) => void;
  isPending: boolean;
}

function PaymentModal({ open, total, paymentMethod, onClose, onConfirm, isPending }: PaymentModalProps) {
  const [cashInput, setCashInput] = useState("");
  const [split, setSplit] = useState<SplitPayment>({
    method1: "cash", amount1: "",
    method2: "card", amount2: "",
  });

  const change = cashInput ? Math.max(0, parseFloat(cashInput || "0") - total) : null;
  const cashSufficient = parseFloat(cashInput || "0") >= total;

  // Auto-fill split amount2
  const splitAmount1 = parseFloat(split.amount1 || "0");
  const splitRemainder = Math.max(0, total - splitAmount1);

  const handleNumpad = (key: string) => {
    setCashInput((prev) => {
      if (key === "⌫") return prev.slice(0, -1);
      if (key === "." && prev.includes(".")) return prev;
      if (key === "." && prev === "") return "0.";
      return prev + key;
    });
  };

  const handleConfirm = () => {
    if (paymentMethod === "cash") {
      onConfirm(parseFloat(cashInput || "0"));
    } else if (paymentMethod === "split") {
      onConfirm(undefined, { ...split, amount2: splitRemainder.toFixed(2) });
    } else {
      onConfirm();
    }
  };

  const isConfirmable =
    paymentMethod === "cash" ? cashSufficient :
    paymentMethod === "split" ? splitAmount1 > 0 && splitAmount1 <= total :
    true;

  const SPLIT_METHODS: { id: "cash" | "card" | "tng" | "duitnow"; label: string }[] = [
    { id: "cash", label: "Cash" },
    { id: "card", label: "Card" },
    { id: "tng", label: "TNG" },
    { id: "duitnow", label: "DuitNow" },
  ];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden" data-testid="dialog-payment">
        <div className="bg-primary p-5 text-primary-foreground">
          <p className="text-sm font-medium opacity-80">Amount to collect</p>
          <p className="text-4xl font-black mt-1">{fmtMYR(total)}</p>
        </div>

        <div className="p-5 space-y-4">

          {/* Cash: numpad */}
          {paymentMethod === "cash" && (
            <div className="space-y-3">
              <div className="bg-muted rounded-xl p-3 flex items-center justify-between border">
                <span className="text-sm font-medium text-muted-foreground">Amount Paid</span>
                <span className="text-2xl font-black tabular-nums">
                  RM {cashInput || "0.00"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {NUMPAD_KEYS.map((key) => (
                  <button
                    key={key}
                    onClick={() => handleNumpad(key)}
                    data-testid={`numpad-${key}`}
                    className={`h-14 rounded-xl text-lg font-bold transition-all active:scale-95 border ${
                      key === "⌫"
                        ? "bg-destructive/10 border-destructive/20 text-destructive hover:bg-destructive/20"
                        : "bg-background border-border hover:bg-muted"
                    }`}
                  >
                    {key}
                  </button>
                ))}
              </div>
              {/* Quick amounts */}
              <div className="grid grid-cols-4 gap-1.5">
                {[Math.ceil(total / 5) * 5, Math.ceil(total / 10) * 10, Math.ceil(total / 50) * 50, Math.ceil(total / 100) * 100]
                  .filter((v, i, a) => a.indexOf(v) === i)
                  .slice(0, 4)
                  .map((amt) => (
                    <button
                      key={amt}
                      onClick={() => setCashInput(amt.toFixed(2))}
                      className="py-2 rounded-lg text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all"
                    >
                      RM {amt}
                    </button>
                  ))}
              </div>
              {cashInput && cashSufficient && (
                <div className="flex justify-between items-center bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 p-3 rounded-xl font-bold">
                  <span>Change</span>
                  <span className="text-xl">{fmtMYR(change!)}</span>
                </div>
              )}
            </div>
          )}

          {/* TNG / DuitNow: QR */}
          {(paymentMethod === "tng" || paymentMethod === "duitnow") && (
            <QRPlaceholder
              amount={total}
              label={paymentMethod === "tng" ? "Touch 'n Go eWallet" : "DuitNow QR"}
            />
          )}

          {/* Card: tap to proceed */}
          {paymentMethod === "card" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center">
                <CreditCard className="w-10 h-10 text-primary" />
              </div>
              <p className="text-center text-muted-foreground font-medium">
                Insert, tap, or swipe card on terminal.<br />Confirm when payment is received.
              </p>
            </div>
          )}

          {/* Split payment */}
          {paymentMethod === "split" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">First Payment</Label>
                <div className="flex gap-2">
                  <select
                    className="flex-shrink-0 rounded-xl border bg-background px-2 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    value={split.method1}
                    onChange={(e) => setSplit((s) => ({ ...s, method1: e.target.value as "cash" | "card" | "tng" | "duitnow" }))}
                    data-testid="split-method1"
                  >
                    {SPLIT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <Input
                    type="number"
                    value={split.amount1}
                    onChange={(e) => setSplit((s) => ({ ...s, amount1: e.target.value }))}
                    placeholder="0.00"
                    min={0}
                    max={total}
                    className="flex-1 rounded-xl text-right font-bold"
                    data-testid="split-amount1"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Second Payment</Label>
                <div className="flex gap-2">
                  <select
                    className="flex-shrink-0 rounded-xl border bg-background px-2 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                    value={split.method2}
                    onChange={(e) => setSplit((s) => ({ ...s, method2: e.target.value as "cash" | "card" | "tng" | "duitnow" }))}
                    data-testid="split-method2"
                  >
                    {SPLIT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                  </select>
                  <div className="flex-1 bg-muted rounded-xl px-3 py-2 text-right font-bold text-sm flex items-center justify-end border">
                    {fmtMYR(splitRemainder)}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl h-12" data-testid="payment-cancel">
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            className="flex-1 rounded-xl h-12 font-bold"
            disabled={!isConfirmable || isPending}
            data-testid="payment-confirm"
          >
            {isPending ? "Processing..." : "Confirm Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Receipt Modal ─────────────────────────────────────────────────────────────

interface ReceiptModalProps {
  open: boolean;
  orderNumber: string;
  items: CartItem[];
  subtotal: number;
  bagTotal: number;
  discountAmount: number;
  taxTotal: number;
  total: number;
  sstEnabled: boolean;
  paymentMethod: PaymentMethod;
  amountPaid?: number;
  change?: number;
  onClose: () => void;
}

function ReceiptModal({
  open, orderNumber, items, subtotal, bagTotal, discountAmount, taxTotal, total,
  sstEnabled, paymentMethod, amountPaid, change, onClose
}: ReceiptModalProps) {
  const now = new Date();

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    const lines = [
      `*SweetPOS Receipt*`,
      `Order: ${orderNumber}`,
      `Date: ${now.toLocaleDateString("en-MY")} ${now.toLocaleTimeString("en-MY")}`,
      ``,
      ...items.map((i) => {
        const lineTotal = i.unitPrice * i.quantity;
        const bagLine = i.weightModifiers?.bagIncluded && i.weightModifiers.bagChargePrice
          ? ` + Plastic Bag RM ${i.weightModifiers.bagChargePrice.toFixed(2)}`
          : "";
        return `${i.product.name}${i.modifiers?.size ? ` (${i.modifiers.size})` : ""} x${i.quantity} — RM ${lineTotal.toFixed(2)}${bagLine}`;
      }),
      ``,
      `Subtotal: RM ${subtotal.toFixed(2)}`,
      bagTotal > 0 ? `Plastic Bag: RM ${bagTotal.toFixed(2)}` : null,
      discountAmount > 0 ? `Discount: -RM ${discountAmount.toFixed(2)}` : null,
      sstEnabled ? `SST (8%): RM ${taxTotal.toFixed(2)}` : null,
      `*Total: RM ${total.toFixed(2)}*`,
      amountPaid ? `Paid: RM ${amountPaid.toFixed(2)}` : null,
      change != null && change > 0 ? `Change: RM ${change.toFixed(2)}` : null,
      ``,
      `Thank you for shopping at SweetPOS!`,
    ].filter(Boolean).join("\n");

    const url = `https://wa.me/?text=${encodeURIComponent(lines)}`;
    window.open(url, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden" data-testid="dialog-receipt">
        {/* Success header */}
        <div className="bg-green-500 p-5 text-white text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3"
          >
            <CheckCircle2 className="w-9 h-9 text-white" />
          </motion.div>
          <h2 className="text-xl font-black">Payment Successful</h2>
          <p className="text-sm opacity-80 mt-1">{orderNumber}</p>
        </div>

        {/* Receipt body */}
        <div className="p-5 space-y-3 font-mono text-sm">
          <div className="text-center text-muted-foreground text-xs mb-2">
            {now.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}
            {" · "}
            {now.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}
          </div>
          <Separator />
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i}>
                <div className="flex justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground truncate block">{item.product.name}</span>
                    {item.modifiers && modifierSummary(item.modifiers) && (
                      <span className="text-xs text-muted-foreground">{modifierSummary(item.modifiers)}</span>
                    )}
                    {item.weightModifiers ? (
                      <span className="text-muted-foreground text-xs">{item.weightModifiers.weightGrams}g @ {fmtMYR(item.weightModifiers.calculatedUnitPrice * 100)}/100g</span>
                    ) : (
                      <span className="text-muted-foreground text-xs">x{item.quantity} @ {fmtMYR(item.unitPrice)}</span>
                    )}
                  </div>
                  <span className="font-semibold tabular-nums">{fmtMYR(item.unitPrice * item.quantity)}</span>
                </div>
                {item.weightModifiers?.bagIncluded && (
                  <div className="flex justify-between gap-2 pl-3 mt-0.5">
                    <div className="flex-1 min-w-0 flex items-center gap-1">
                      <ShoppingBag className="w-3 h-3 text-amber-500 flex-shrink-0" />
                      <span className="text-xs text-muted-foreground">Plastic Bag</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {item.weightModifiers.bagChargePrice ? fmtMYR(item.weightModifiers.bagChargePrice) : "Free"}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
          <Separator />
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{fmtMYR(subtotal)}</span></div>
            {bagTotal > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400">
                <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" />Plastic Bag</span>
                <span>{fmtMYR(bagTotal)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600"><span>Discount</span><span>-{fmtMYR(discountAmount)}</span></div>
            )}
            {sstEnabled && (
              <div className="flex justify-between text-muted-foreground"><span>SST (8%)</span><span>{fmtMYR(taxTotal)}</span></div>
            )}
          </div>
          <div className="flex justify-between font-black text-base pt-1">
            <span>TOTAL</span>
            <span className="text-primary">{fmtMYR(total)}</span>
          </div>
          {amountPaid != null && (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-muted-foreground"><span>Paid ({paymentMethod.toUpperCase()})</span><span>{fmtMYR(amountPaid)}</span></div>
              {change != null && change > 0 && (
                <div className="flex justify-between font-bold text-green-600"><span>Change</span><span>{fmtMYR(change)}</span></div>
              )}
            </div>
          )}
          <Separator />
          <p className="text-center text-muted-foreground text-xs py-1">Thank you for shopping at SweetPOS!</p>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={handlePrint}
            className="rounded-xl h-12 gap-2"
            data-testid="receipt-print"
          >
            <Printer className="w-4 h-4" /> Print
          </Button>
          <Button
            onClick={handleWhatsApp}
            className="rounded-xl h-12 gap-2 bg-green-500 hover:bg-green-600 text-white"
            data-testid="receipt-whatsapp"
          >
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            className="col-span-2 rounded-xl h-10 text-muted-foreground"
            data-testid="receipt-close"
          >
            New Order
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main POS Component ────────────────────────────────────────────────────────

export default function POS() {
  const BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.BASE_URL).replace(/\/$/, "");
  async function posFetch(path: string) {
    const r = await fetch(`${BASE}${path}`, { credentials: "include" });
    if (!r.ok) throw new Error(r.statusText);
    return r.json();
  }

  // Data
  const { data: products = [], isLoading: isLoadingProducts } = useListProducts(
    { active: true },
    { query: { select: (data) => Array.isArray(data) ? data : [] } },
  );
  const { data: categories = [] } = useListCategories({
    query: { select: (data) => Array.isArray(data) ? data : [] },
  });
  const { data: posConsumables = [] } = useQuery<Array<{ id: number; name: string; stock: number; unit: string; active: boolean }>>({
    queryKey: ["pos-consumables"],
    queryFn: () => posFetch("/api/consumables"),
    staleTime: 60000,
    select: (data) => Array.isArray(data) ? data : [],
  });
  const { data: posBagRules = [] } = useQuery<Array<{ id: number; name: string; maxWeightGrams: number; consumableId: number | null }>>({
    queryKey: ["pos-bag-rules"],
    queryFn: () => posFetch("/api/bag-size-rules"),
    staleTime: 60000,
    select: (data) => Array.isArray(data) ? data : [],
  });
  const { data: posSettings = {} } = useQuery<Record<string, string>>({
    queryKey: ["pos-settings"],
    queryFn: () => posFetch("/api/settings"),
    staleTime: 300000,
  });
  const activeBagConsumables = posConsumables.filter((c) => c.active && c.stock > 0);
  const bagSettings: BagSettings = {
    chargeEnabled: posSettings.plastic_bag_charge_enabled === "true",
    price: parseFloat(posSettings.plastic_bag_price ?? "0.25"),
  };

  const createOrder = useCreateOrder();
  const { toast } = useToast();
  const { user } = useAuth();

  // Product grid state
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // Modifiers
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [pendingWeightProduct, setPendingWeightProduct] = useState<Product | null>(null);

  // Discount
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [discountValue, setDiscountValue] = useState("");

  // SST
  const [sstEnabled, setSstEnabled] = useState(true);

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  // Receipt
  const [receipt, setReceipt] = useState<{
    orderNumber: string;
    amountPaid?: number;
    change?: number;
  } | null>(null);

  // Long press to remove
  const longPressTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchCat = activeCategory === null || p.categoryId === activeCategory;
      const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [products, activeCategory, searchQuery]);

  // Totals
  const bagTotal = useMemo(
    () => cart.reduce((sum, item) => sum + (item.weightModifiers?.bagChargePrice ?? 0), 0),
    [cart]
  );
  // subtotal = product items only (bags shown separately, discount not applied to bags)
  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );

  const rawDiscount = parseFloat(discountValue || "0");
  const discountAmount = useMemo(() => {
    if (rawDiscount <= 0) return 0;
    if (discountType === "percent") return Math.min(subtotal, (subtotal * rawDiscount) / 100);
    return Math.min(subtotal, rawDiscount);
  }, [subtotal, rawDiscount, discountType]);

  const afterDiscount = subtotal - discountAmount;

  const taxTotal = useMemo(() => {
    if (!sstEnabled) return 0;
    return cart.reduce((sum, item) => {
      if (!item.product.taxable) return sum;
      const lineTotal = item.unitPrice * item.quantity;
      return sum + lineTotal * SST_RATE;
    }, 0);
  }, [cart, sstEnabled]);

  const total = afterDiscount + taxTotal + bagTotal;

  // Add to cart (with modifier check)
  const handleProductClick = useCallback((product: Product) => {
    if (product.stock < 1) {
      toast({ title: "Out of stock", variant: "destructive" });
      return;
    }
    const extProduct = product as Product & { productType?: string };
    if (extProduct.productType === "weight") {
      setPendingWeightProduct(product);
    } else if (isCakeProduct(product)) {
      setPendingProduct(product);
    } else {
      addToCart(product, undefined, product.price);
    }
  }, [products]);

  const addToCart = (product: Product, modifiers?: CartModifiers, unitPrice?: number, weightModifiers?: WeightModifiers) => {
    const price = unitPrice ?? product.price;
    setCart((prev) => {
      // Weight items are always unique entries (each has different weight)
      if (weightModifiers) {
        return [...prev, { product, quantity: 1, weightModifiers, unitPrice: price }];
      }
      // If same product with same modifiers exists, bump quantity
      const key = `${product.id}-${JSON.stringify(modifiers ?? {})}`;
      const existingIdx = prev.findIndex(
        (i) => !i.weightModifiers && `${i.product.id}-${JSON.stringify(i.modifiers ?? {})}` === key
      );
      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        if (existing.quantity >= product.stock) {
          toast({ title: "Exceeds available stock", variant: "destructive" });
          return prev;
        }
        return prev.map((item, idx) =>
          idx === existingIdx ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1, modifiers, unitPrice: price }];
    });
  };

  const updateQuantity = (idx: number, delta: number) => {
    setCart((prev) => {
      const item = prev[idx];
      if (!item) return prev;
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== idx);
      if (newQty > item.product.stock) {
        toast({ title: "Exceeds available stock", variant: "destructive" });
        return prev;
      }
      return prev.map((it, i) => (i === idx ? { ...it, quantity: newQty } : it));
    });
  };

  const removeItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  // Long press handlers
  const startLongPress = (idx: number) => {
    longPressTimers.current[idx] = setTimeout(() => {
      removeItem(idx);
      toast({ title: "Item removed" });
    }, 600);
  };
  const cancelLongPress = (idx: number) => {
    clearTimeout(longPressTimers.current[idx]);
  };

  // Checkout
  const handleCharge = () => {
    if (cart.length === 0) return;
    setPaymentModalOpen(true);
  };

  const handlePaymentConfirm = async (amountPaid?: number, splitPayment?: SplitPayment) => {
    try {
      // Map internal method to API method
      const apiMethod =
        paymentMethod === "tng" || paymentMethod === "duitnow" ? "ewallet" :
        paymentMethod === "split" ? (splitPayment?.method1 === "cash" ? "cash" : "card") :
        paymentMethod as "cash" | "card" | "ewallet";

      // For weight-based items: quantity = grams, unitPrice override = price per gram
      const apiItems = cart.map((item) => ({
        productId: item.product.id,
        quantity: item.weightModifiers ? item.weightModifiers.weightGrams : item.quantity,
      }));

      const itemPriceOverrides = cart
        .filter((i) => i.weightModifiers)
        .map((i) => ({
          productId: i.product.id,
          unitPrice: i.weightModifiers!.calculatedUnitPrice,
        }));

      // Aggregate bag deductions across all weight items
      const bagMap = new Map<number, number>();
      for (const item of cart) {
        if (item.weightModifiers?.bagIncluded && item.weightModifiers.bagConsumableId) {
          const cid = item.weightModifiers.bagConsumableId;
          bagMap.set(cid, (bagMap.get(cid) ?? 0) + 1);
        }
      }
      const bagDeductions = Array.from(bagMap.entries()).map(([consumableId, quantity]) => ({
        consumableId,
        quantity,
      }));

      const notes = cart.filter((i) => i.modifiers?.message)
        .map((i) => `${i.product.name}: "${i.modifiers!.message}"`).join("; ") || null;

      const result = await createOrder.mutateAsync({
        data: {
          items: apiItems,
          paymentMethod: apiMethod,
          amountPaid: amountPaid ?? null,
          notes,
          staffId: user?.id,
          // @ts-ignore — extra fields handled by API route
          itemPriceOverrides,
          bagDeductions,
          bagChargesTotal: bagTotal,
        },
      });

      setPaymentModalOpen(false);
      setReceipt({
        orderNumber: result.orderNumber,
        amountPaid,
        change: amountPaid != null ? Math.max(0, amountPaid - total) : undefined,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast({ title: "Checkout failed", description: msg, variant: "destructive" });
    }
  };

  const handleReceiptClose = () => {
    setReceipt(null);
    setCart([]);
    setDiscountValue("");
  };

  const clearCart = () => setCart([]);

  return (
    <div className="flex h-full w-full bg-muted/30 flex-col md:flex-row overflow-hidden">

      {/* ── Left: Product Grid ───────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Search + Category tabs */}
        <div className="bg-card border-b px-4 pt-4 pb-3 space-y-3 shadow-sm z-10">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              className="pl-9 h-11 rounded-xl bg-muted/50 border-0 focus-visible:ring-primary text-sm"
              placeholder="Search sweet treats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-search-products"
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setSearchQuery("")}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setActiveCategory(null)}
              data-testid="category-all"
              className={`flex-shrink-0 h-9 px-4 rounded-xl text-sm font-semibold border transition-all ${
                activeCategory === null
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                data-testid={`category-${cat.id}`}
                className={`flex-shrink-0 h-9 px-4 rounded-xl text-sm font-semibold border transition-all ${
                  activeCategory === cat.id
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
                style={cat.color ? { "--cat-color": cat.color } as React.CSSProperties : undefined}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <ScrollArea className="flex-1 p-3 md:p-4">
          {isLoadingProducts ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-card rounded-2xl border overflow-hidden animate-pulse">
                  <div className="aspect-square bg-muted" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <Store className="w-14 h-14 mb-4 opacity-20" />
              <p className="text-base font-medium">No products found</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
              <AnimatePresence mode="popLayout">
                {filteredProducts.map((product) => {
                  const inCart = cart.find((i) => i.product.id === product.id);
                  const outOfStock = product.stock < 1;
                  return (
                    <motion.button
                      key={product.id}
                      layout
                      initial={{ opacity: 0, scale: 0.92 }}
                      animate={{ opacity: outOfStock ? 0.45 : 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.88 }}
                      whileHover={outOfStock ? {} : { y: -3 }}
                      whileTap={outOfStock ? {} : { scale: 0.96 }}
                      onClick={() => !outOfStock && handleProductClick(product)}
                      disabled={outOfStock}
                      data-testid={`product-card-${product.id}`}
                      className={`bg-card rounded-2xl border text-left overflow-hidden shadow-sm hover:shadow-md transition-shadow relative ${
                        outOfStock ? "cursor-not-allowed grayscale" : "cursor-pointer"
                      } ${inCart ? "ring-2 ring-primary ring-offset-1" : ""}`}
                    >
                      {/* Image */}
                      <div className="aspect-square bg-muted relative overflow-hidden">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/5">
                            <span className="text-4xl select-none">
                              {isCakeProduct(product) ? "🎂" : 
                               (product.categoryName ?? "").toLowerCase().includes("drink") ? "🧋" :
                               (product.categoryName ?? "").toLowerCase().includes("kuih") ? "🍡" :
                               (product.categoryName ?? "").toLowerCase().includes("cookie") ? "🍪" :
                               (product.categoryName ?? "").toLowerCase().includes("candy") ? "🍬" : "🍫"}
                            </span>
                          </div>
                        )}
                        {/* SST badge */}
                        {product.taxable && (
                          <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md backdrop-blur-sm">
                            SST
                          </div>
                        )}
                        {/* Cart count badge */}
                        {inCart && (
                          <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground text-xs font-black w-6 h-6 rounded-full flex items-center justify-center shadow">
                            {inCart.quantity}
                          </div>
                        )}
                        {outOfStock && (
                          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                            <span className="text-xs font-bold text-muted-foreground bg-background px-2 py-0.5 rounded-md border">
                              Sold Out
                            </span>
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="p-3">
                        <p className="font-bold text-foreground text-sm leading-snug line-clamp-2">{product.name}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-primary font-extrabold text-base">{fmtMYR(product.price)}</span>
                          {product.stock <= 5 && product.stock > 0 && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 px-1.5 py-0.5 rounded-md">
                              {product.stock} left
                            </span>
                          )}
                        </div>
                        {isCakeProduct(product) && (
                          <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                            <Cake className="w-3 h-3" /> Customisable
                          </p>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right: Cart ─────────────────────────────────────────────────────── */}
      <div className="w-full md:w-[380px] lg:w-[420px] bg-card border-l flex flex-col h-full shadow-2xl z-20 flex-shrink-0">

        {/* Cart Header */}
        <div className="p-4 border-b flex items-center justify-between bg-muted/30">
          <h2 className="text-base font-bold flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-primary" />
            Current Order
            {cart.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs font-bold">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </Badge>
            )}
          </h2>
          {cart.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1"
              data-testid="button-clear-cart"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          )}
        </div>

        {/* Cart Items */}
        <ScrollArea className="flex-1 px-3 py-2">
          <AnimatePresence>
            {cart.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-40 text-muted-foreground"
              >
                <div className="w-14 h-14 bg-muted rounded-full flex items-center justify-center mb-3">
                  <ShoppingBag className="w-7 h-7 opacity-40" />
                </div>
                <p className="text-sm font-medium">Tap a product to add</p>
              </motion.div>
            ) : (
              <div className="space-y-2 py-1">
                {cart.map((item, idx) => (
                  <motion.div
                    key={`${item.product.id}-${idx}`}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30, scale: 0.9 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-start gap-2 bg-background border rounded-xl p-2.5 relative overflow-hidden select-none"
                    onPointerDown={() => startLongPress(idx)}
                    onPointerUp={() => cancelLongPress(idx)}
                    onPointerLeave={() => cancelLongPress(idx)}
                    data-testid={`cart-item-${item.product.id}`}
                  >
                    {/* Left: info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm leading-tight truncate">{item.product.name}</p>
                      {item.modifiers && modifierSummary(item.modifiers) && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">{modifierSummary(item.modifiers)}</p>
                      )}
                      {item.weightModifiers && (
                        <div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.weightModifiers.weightGrams}g
                            {!item.weightModifiers.bagIncluded && (
                              <span className="ml-1.5 text-muted-foreground/60 italic">No Bag</span>
                            )}
                          </p>
                          {item.weightModifiers.bagIncluded && (
                            <div className="flex items-center gap-1 mt-0.5">
                              <ShoppingBag className="w-3 h-3 text-amber-500 flex-shrink-0" />
                              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                Plastic Bag
                                {item.weightModifiers.bagChargePrice != null && item.weightModifiers.bagChargePrice > 0
                                  ? ` +${fmtMYR(item.weightModifiers.bagChargePrice)}`
                                  : " (free)"}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-xs text-muted-foreground">{fmtMYR(item.unitPrice)}</span>
                        {item.product.taxable && sstEnabled && (
                          <Badge variant="secondary" className="text-[9px] px-1 py-0 font-bold">SST</Badge>
                        )}
                      </div>
                    </div>
                    {/* Right: qty + subtotal */}
                    <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                      <span className="font-bold text-sm">{fmtMYR(item.unitPrice * item.quantity)}</span>
                      {item.weightModifiers ? (
                        <button
                          className="px-2 h-7 rounded-md flex items-center justify-center hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-colors text-xs font-semibold"
                          onClick={(e) => { e.stopPropagation(); cancelLongPress(idx); removeItem(idx); }}
                          data-testid={`cart-remove-${item.product.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                      <div className="flex items-center gap-1 bg-muted rounded-lg">
                        <button
                          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => { e.stopPropagation(); cancelLongPress(idx); updateQuantity(idx, -1); }}
                          data-testid={`cart-decrease-${item.product.id}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-6 text-center font-black text-sm">{item.quantity}</span>
                        <button
                          className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => { e.stopPropagation(); cancelLongPress(idx); updateQuantity(idx, 1); }}
                          data-testid={`cart-increase-${item.product.id}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      )}
                    </div>
                    {/* Remove button */}
                    <button
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 w-5 h-5 text-muted-foreground hover:text-destructive transition-all"
                      onClick={(e) => { e.stopPropagation(); cancelLongPress(idx); removeItem(idx); }}
                      data-testid={`cart-remove-${item.product.id}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </AnimatePresence>
        </ScrollArea>

        {/* Cart Footer */}
        <div className="border-t bg-card p-4 space-y-3">
          {/* Discount row */}
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 flex items-center gap-1.5 bg-muted/50 rounded-xl border px-2.5 h-9 overflow-hidden">
              <button
                onClick={() => setDiscountType((t) => (t === "percent" ? "fixed" : "percent"))}
                className="text-xs font-bold text-primary border border-primary/30 bg-primary/10 px-1.5 py-0.5 rounded-md hover:bg-primary/20 transition-colors flex-shrink-0"
                data-testid="button-discount-toggle-type"
              >
                {discountType === "percent" ? "%" : "RM"}
              </button>
              <Input
                type="number"
                min={0}
                max={discountType === "percent" ? 100 : subtotal}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                placeholder={discountType === "percent" ? "Discount %" : "Discount RM"}
                className="flex-1 border-0 h-7 bg-transparent text-sm p-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/60"
                data-testid="input-discount"
              />
              {discountValue && (
                <button onClick={() => setDiscountValue("")} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            {/* SST toggle */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-xs font-semibold text-muted-foreground">SST</span>
              <Switch
                checked={sstEnabled}
                onCheckedChange={setSstEnabled}
                data-testid="switch-sst"
                className="scale-90"
              />
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{fmtMYR(subtotal)}</span>
            </div>
            {bagTotal > 0 && (
              <div className="flex justify-between text-amber-600 dark:text-amber-400 font-medium">
                <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> Plastic Bag</span>
                <span>{fmtMYR(bagTotal)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-green-600 dark:text-green-400 font-medium">
                <span>Discount {discountType === "percent" ? `(${rawDiscount}%)` : ""}</span>
                <span>-{fmtMYR(discountAmount)}</span>
              </div>
            )}
            {sstEnabled && (
              <div className="flex justify-between text-muted-foreground">
                <span>SST (8%)</span>
                <span>{fmtMYR(taxTotal)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-black text-xl pt-0.5">
              <span>Total</span>
              <span className="text-primary">{fmtMYR(total)}</span>
            </div>
          </div>

          {/* Payment methods */}
          <div className="grid grid-cols-5 gap-1.5">
            {PAYMENT_METHODS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setPaymentMethod(id)}
                data-testid={`payment-method-${id}`}
                className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-semibold transition-all ${
                  paymentMethod === id
                    ? "bg-primary text-primary-foreground border-primary shadow-md"
                    : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="leading-tight text-center" style={{ fontSize: "9px" }}>{label}</span>
              </button>
            ))}
          </div>

          {/* Charge button */}
          <motion.button
            whileTap={{ scale: cart.length === 0 ? 1 : 0.97 }}
            onClick={handleCharge}
            disabled={cart.length === 0 || createOrder.isPending}
            data-testid="button-checkout"
            className="w-full h-14 rounded-xl font-black text-lg bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {createOrder.isPending ? "Processing..." : cart.length === 0 ? "Add items to cart" : `Charge ${fmtMYR(total)}`}
          </motion.button>
        </div>
      </div>

      {/* ── Modifiers Dialog ─────────────────────────────────────────────────── */}
      <ModifiersDialog
        product={pendingProduct}
        onConfirm={(product, modifiers, unitPrice) => {
          setPendingProduct(null);
          addToCart(product, modifiers, unitPrice);
        }}
        onCancel={() => setPendingProduct(null)}
      />

      {/* ── Weight Input Dialog ──────────────────────────────────────────────── */}
      {pendingWeightProduct && (
        <WeightInputModal
          product={pendingWeightProduct}
          consumables={activeBagConsumables}
          bagSizeRules={posBagRules}
          bagSettings={activeBagConsumables.length > 0 ? bagSettings : null}
          onConfirm={(product, weightModifiers, unitPrice) => {
            setPendingWeightProduct(null);
            addToCart(product, undefined, unitPrice, weightModifiers);
          }}
          onCancel={() => setPendingWeightProduct(null)}
        />
      )}

      {/* ── Payment Modal ────────────────────────────────────────────────────── */}
      <PaymentModal
        open={paymentModalOpen}
        total={total}
        paymentMethod={paymentMethod}
        onClose={() => setPaymentModalOpen(false)}
        onConfirm={handlePaymentConfirm}
        isPending={createOrder.isPending}
      />

      {/* ── Receipt Modal ────────────────────────────────────────────────────── */}
      {receipt && (
        <ReceiptModal
          open
          orderNumber={receipt.orderNumber}
          items={cart}
          subtotal={subtotal}
          bagTotal={bagTotal}
          discountAmount={discountAmount}
          taxTotal={taxTotal}
          total={total}
          sstEnabled={sstEnabled}
          paymentMethod={paymentMethod}
          amountPaid={receipt.amountPaid}
          change={receipt.change}
          onClose={handleReceiptClose}
        />
      )}
    </div>
  );
}
