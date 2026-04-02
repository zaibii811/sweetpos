import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Clock, LogIn, LogOut } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BASE = (import.meta.env.VITE_API_URL ?? import.meta.env.BASE_URL).replace(/\/$/, "");

type ClockState = "idle" | "clocked-in" | "clocked-out-confirm";

interface StaffInfo {
  id: number;
  name: string;
  role: string;
}
interface Entry {
  id: number;
  clockInAt: string;
  clockOutAt?: string | null;
  isLate?: boolean;
  lateMinutes?: number;
}

function useNow() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function formatElapsed(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime();
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function TimeClock() {
  const [pin, setPin] = useState("");
  const [confirmedPin, setConfirmedPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [staff, setStaff] = useState<StaffInfo | null>(null);
  const [entry, setEntry] = useState<Entry | null>(null);
  const [clockState, setClockState] = useState<ClockState>("idle");
  const [message, setMessage] = useState("");
  const [hoursWorked, setHoursWorked] = useState<number | null>(null);
  const { toast } = useToast();
  const now = useNow();

  const handleNumpad = (digit: string) => {
    if (pin.length < 4) setPin(p => p + digit);
  };
  const handleBackspace = () => setPin(p => p.slice(0, -1));

  const reset = () => {
    setPin("");
    setConfirmedPin("");
    setStaff(null);
    setEntry(null);
    setClockState("idle");
    setMessage("");
    setHoursWorked(null);
  };

  const handleSubmit = async () => {
    if (pin.length < 4) return;
    setIsLoading(true);
    try {
      const clockInRes = await fetch(`${BASE}/api/time-entries/clock-in`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin }),
      });

      if (clockInRes.status === 409) {
        const data = await clockInRes.json();
        if (data.entry) {
          setStaff(data.staff);
          setEntry(data.entry);
          setClockState("clocked-in");
          setMessage("");
          setConfirmedPin(pin);
          setPin("");
          return;
        }
      }

      if (clockInRes.ok) {
        const data = await clockInRes.json();
        setStaff(data.staff);
        setEntry(data.entry);
        setClockState("clocked-in");
        setMessage(data.isLate ? `Late by ${data.lateMinutes} min` : "");
        if (data.isLate) {
          toast({ title: `${data.staff.name} is late by ${data.lateMinutes} minutes`, variant: "destructive" });
        } else {
          toast({ title: `${data.staff.name} clocked in` });
        }
        setConfirmedPin(pin);
        setPin("");
        return;
      }

      const err = await clockInRes.json().catch(() => ({}));
      toast({ title: "Invalid PIN", description: err.error, variant: "destructive" });
      setPin("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!staff) return;
    setIsLoading(true);
    try {
      const res = await fetch(`${BASE}/api/time-entries/clock-out`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ pin: confirmedPin }),
      });

      if (res.ok) {
        const data = await res.json();
        setHoursWorked(data.hoursWorked);
        setClockState("clocked-out-confirm");
        toast({ title: `${data.staff.name} clocked out — ${data.hoursWorked.toFixed(2)} hrs` });
      } else {
        toast({ title: "Clock out failed", variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const DAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const timeString = now.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
  const dateString = now.toLocaleDateString("en-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="flex flex-col h-full items-center justify-center bg-muted/20 p-6" data-testid="time-clock-page">
      {/* Clock display */}
      <div className="text-center mb-8">
        <div className="flex items-center gap-2 justify-center mb-2">
          <Clock className="w-5 h-5 text-muted-foreground" />
          <span className="text-muted-foreground text-sm">{dateString}</span>
        </div>
        <div className="text-6xl font-mono font-bold tracking-tight tabular-nums">
          {timeString}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {clockState === "idle" && (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="w-full max-w-sm"
          >
            <div className="bg-card border rounded-2xl p-6 shadow-lg">
              <h2 className="text-xl font-bold text-center mb-2">Clock In / Out</h2>
              <p className="text-muted-foreground text-sm text-center mb-6">Enter your 4-digit PIN</p>

              <div className="flex justify-center gap-4 mb-6">
                {[0, 1, 2, 3].map(i => (
                  <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${i < pin.length ? "bg-primary scale-125" : "bg-muted"}`} />
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                {[1,2,3,4,5,6,7,8,9].map(n => (
                  <Button key={n} variant="outline" className="h-14 text-xl font-semibold rounded-xl bg-muted/50 hover:bg-muted border-none" onClick={() => handleNumpad(n.toString())} data-testid={`clock-numpad-${n}`}>{n}</Button>
                ))}
                <div />
                <Button variant="outline" className="h-14 text-xl font-semibold rounded-xl bg-muted/50 hover:bg-muted border-none" onClick={() => handleNumpad("0")} data-testid="clock-numpad-0">0</Button>
                <Button variant="outline" className="h-14 text-xl font-semibold rounded-xl bg-muted/50 hover:bg-muted border-none text-destructive" onClick={handleBackspace} disabled={pin.length === 0}>⌫</Button>
              </div>

              <Button
                className="w-full h-12 text-base font-bold rounded-xl"
                onClick={handleSubmit}
                disabled={pin.length < 4 || isLoading}
                data-testid="button-clock-submit"
              >
                {isLoading ? "Checking..." : "Submit PIN"}
              </Button>
            </div>
          </motion.div>
        )}

        {clockState === "clocked-in" && staff && entry && (
          <motion.div
            key="clocked-in"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-sm"
          >
            <div className="bg-card border rounded-2xl p-6 shadow-lg text-center">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full mx-auto flex items-center justify-center mb-4">
                <span className="text-3xl font-bold text-green-600">{staff.name.charAt(0)}</span>
              </div>
              <h2 className="text-2xl font-bold mb-1">{staff.name}</h2>
              <p className="text-muted-foreground text-sm capitalize mb-4">{staff.role}</p>

              {message && (
                <div className="bg-destructive/10 text-destructive text-sm rounded-lg px-3 py-2 mb-4">
                  {message}
                </div>
              )}

              <div className="bg-muted/50 rounded-xl p-4 mb-6">
                <p className="text-xs text-muted-foreground mb-1">Clocked in at</p>
                <p className="font-semibold">{new Date(entry.clockInAt).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: true })}</p>
                <p className="text-2xl font-mono font-bold mt-2 tabular-nums text-primary">
                  {formatElapsed(new Date(entry.clockInAt), now)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">elapsed</p>
              </div>

              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={reset} data-testid="button-clock-done">Done</Button>
                <Button
                  className="flex-1 bg-destructive hover:bg-destructive/90"
                  onClick={handleClockOut}
                  disabled={isLoading}
                  data-testid="button-clock-out"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  {isLoading ? "..." : "Clock Out"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {clockState === "clocked-out-confirm" && staff && (
          <motion.div
            key="confirmed"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-sm"
          >
            <div className="bg-card border rounded-2xl p-6 shadow-lg text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full mx-auto flex items-center justify-center mb-4">
                <LogOut className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-1">Clocked Out</h2>
              <p className="text-muted-foreground mb-4">{staff.name}</p>

              <div className="bg-muted/50 rounded-xl p-4 mb-6">
                <p className="text-sm text-muted-foreground">Hours worked today</p>
                <p className="text-4xl font-bold text-primary mt-1">
                  {hoursWorked !== null ? hoursWorked.toFixed(2) : "—"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">hours</p>
              </div>

              <Button className="w-full" onClick={reset} data-testid="button-clock-new">Done</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
