import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Save, RefreshCw, Download, Upload } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PAYMENT_OPTIONS = [
  { key: "cash", label: "Cash" },
  { key: "card", label: "Card" },
  { key: "tng", label: "TNG eWallet" },
  { key: "duitnow", label: "DuitNow QR" },
];

async function fetchSettings(): Promise<Record<string, string>> {
  const r = await fetch(`${BASE}/api/settings`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to fetch settings");
  return r.json();
}

async function saveSettings(data: Record<string, string>): Promise<Record<string, string>> {
  const r = await fetch(`${BASE}/api/settings`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  if (!r.ok) throw new Error("Failed to save settings");
  return r.json();
}

async function fetchActivityLog(limit = 100) {
  const r = await fetch(`${BASE}/api/activity-log?limit=${limit}`, { credentials: "include" });
  if (!r.ok) throw new Error("Failed to fetch activity log");
  return r.json();
}

export default function Settings() {
  const { user } = useAuth();
  const { isOwner, isManagerOrAbove } = usePermissions();
  const { toast } = useToast();

  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"shop" | "payments" | "activity">("shop");

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch(() => toast({ title: "Could not load settings", variant: "destructive" }))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "activity" && isManagerOrAbove()) {
      fetchActivityLog()
        .then(setActivityLog)
        .catch(() => {});
    }
  }, [activeTab]);

  if (!isManagerOrAbove()) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <ShieldAlert className="w-16 h-16 text-muted-foreground" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">You don't have permission to view this page.</p>
      </div>
    );
  }

  if (isLoading || !settings) {
    return <div className="flex-1 flex items-center justify-center">Loading settings...</div>;
  }

  const setVal = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev!, [key]: value }));
  };

  const paymentMethods: string[] = JSON.parse(settings.payment_methods || '["cash","card","tng","duitnow"]');

  const togglePayment = (key: string) => {
    const updated = paymentMethods.includes(key)
      ? paymentMethods.filter((k) => k !== key)
      : [...paymentMethods, key];
    setVal("payment_methods", JSON.stringify(updated));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updated = await saveSettings(settings);
      setSettings(updated);
      toast({ title: "Settings saved" });
    } catch {
      toast({ title: "Failed to save settings", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleBackup = async () => {
    try {
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sweetpos-settings-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Settings exported" });
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      const updated = await saveSettings(data);
      setSettings(updated);
      toast({ title: "Settings restored" });
    } catch {
      toast({ title: "Restore failed", variant: "destructive" });
    }
    e.target.value = "";
  };

  const tabs = [
    { key: "shop", label: "Shop" },
    { key: "payments", label: "Payments" },
    ...(isManagerOrAbove() ? [{ key: "activity", label: "Activity Log" }] : []),
  ] as const;

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {isOwner() ? "Owner access" : "Manager access"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted p-1 rounded-xl w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.key
                ? "bg-background shadow text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.key)}
            data-testid={`tab-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "shop" && (
        <div className="space-y-6">
          <div className="bg-card border rounded-2xl p-6 space-y-5">
            <h2 className="font-semibold text-lg">Shop Information</h2>
            <div className="space-y-2">
              <Label htmlFor="shop_name">Shop Name</Label>
              <Input
                id="shop_name"
                value={settings.shop_name ?? ""}
                onChange={(e) => setVal("shop_name", e.target.value)}
                data-testid="input-shop-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop_address">Address</Label>
              <Input
                id="shop_address"
                value={settings.shop_address ?? ""}
                onChange={(e) => setVal("shop_address", e.target.value)}
                data-testid="input-shop-address"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sst_number">SST Registration Number</Label>
              <Input
                id="sst_number"
                value={settings.sst_number ?? ""}
                onChange={(e) => setVal("sst_number", e.target.value)}
                placeholder="e.g. W10-1234-56789012"
                data-testid="input-sst-number"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt_footer">Receipt Footer Message</Label>
              <Input
                id="receipt_footer"
                value={settings.receipt_footer ?? ""}
                onChange={(e) => setVal("receipt_footer", e.target.value)}
                data-testid="input-receipt-footer"
              />
            </div>
          </div>

          {isOwner() && (
            <div className="bg-card border rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold text-lg">Tax</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Enable SST (8%) Globally</p>
                  <p className="text-sm text-muted-foreground">Applies 8% SST to all taxable products</p>
                </div>
                <Switch
                  checked={settings.sst_enabled_global === "true"}
                  onCheckedChange={(v) => setVal("sst_enabled_global", v ? "true" : "false")}
                  data-testid="switch-sst-global"
                />
              </div>
            </div>
          )}

          {isOwner() && (
            <div className="bg-card border rounded-2xl p-6 space-y-4">
              <h2 className="font-semibold text-lg">Backup &amp; Restore</h2>
              <p className="text-sm text-muted-foreground">Export or import your settings configuration.</p>
              <div className="flex gap-3 flex-wrap">
                <Button variant="outline" onClick={handleBackup} data-testid="button-export-settings">
                  <Download className="w-4 h-4 mr-2" />
                  Export Settings
                </Button>
                <label>
                  <Button variant="outline" asChild>
                    <span className="cursor-pointer" data-testid="button-import-settings">
                      <Upload className="w-4 h-4 mr-2" />
                      Import Settings
                    </span>
                  </Button>
                  <input type="file" accept=".json" className="hidden" onChange={handleRestore} />
                </label>
              </div>
            </div>
          )}

          {isOwner() && (
            <Button className="w-full h-12 text-base font-semibold rounded-xl" onClick={handleSave} disabled={isSaving} data-testid="button-save-settings">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Settings"}
            </Button>
          )}
        </div>
      )}

      {activeTab === "payments" && (
        <div className="space-y-4">
          <div className="bg-card border rounded-2xl p-6 space-y-5">
            <h2 className="font-semibold text-lg">Payment Methods</h2>
            <p className="text-sm text-muted-foreground">Choose which payment options appear on the checkout screen.</p>
            <div className="space-y-3">
              {PAYMENT_OPTIONS.map((opt) => (
                <div key={opt.key} className="flex items-center justify-between p-3 bg-muted/50 rounded-xl">
                  <span className="font-medium">{opt.label}</span>
                  <Switch
                    checked={paymentMethods.includes(opt.key)}
                    onCheckedChange={() => togglePayment(opt.key)}
                    disabled={!isOwner()}
                    data-testid={`switch-payment-${opt.key}`}
                  />
                </div>
              ))}
            </div>
          </div>
          {isOwner() && (
            <Button className="w-full h-12 text-base font-semibold rounded-xl" onClick={handleSave} disabled={isSaving} data-testid="button-save-payments">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Payment Settings"}
            </Button>
          )}
        </div>
      )}

      {activeTab === "activity" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Activity Log</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchActivityLog().then(setActivityLog)}
              data-testid="button-refresh-log"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
          <div className="bg-card border rounded-2xl overflow-hidden">
            {activityLog.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">No activity recorded yet</div>
            ) : (
              <div className="divide-y">
                {activityLog.map((entry: any) => (
                  <div key={entry.id} className="flex items-start gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{entry.description}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {entry.staffName || "System"}
                        </span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          {entry.actionType}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                      {new Date(entry.createdAt).toLocaleString("en-MY", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
