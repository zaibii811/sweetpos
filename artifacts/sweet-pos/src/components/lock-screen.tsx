import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { motion } from "framer-motion";

export function LockScreen() {
  const { user, unlock, logout } = useAuth();
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  const handleNumpad = (digit: string) => {
    if (pin.length < 6) setPin((p) => p + digit);
  };

  const handleBackspace = () => setPin((p) => p.slice(0, -1));

  const handleUnlock = async () => {
    if (pin.length < 4) return;
    setIsLoading(true);
    try {
      await unlock(pin);
    } catch {
      setPin("");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-6"
      data-testid="lock-screen"
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-2xl font-bold">Session Locked</h2>
          <p className="text-muted-foreground mt-1">
            {user ? `Enter your PIN to continue as ${user.name}` : "Enter PIN to unlock"}
          </p>
        </div>

        <motion.div
          animate={shake ? { x: [-8, 8, -8, 8, 0] } : {}}
          transition={{ duration: 0.4 }}
        >
          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-4 h-4 rounded-full transition-all duration-200 ${
                  idx < pin.length ? "bg-primary scale-125" : "bg-muted"
                }`}
              />
            ))}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                variant="outline"
                className="h-14 text-xl font-semibold rounded-xl bg-muted/50 hover:bg-muted border-none"
                onClick={() => handleNumpad(num.toString())}
                data-testid={`lock-numpad-${num}`}
              >
                {num}
              </Button>
            ))}
            <div />
            <Button
              variant="outline"
              className="h-14 text-xl font-semibold rounded-xl bg-muted/50 hover:bg-muted border-none"
              onClick={() => handleNumpad("0")}
              data-testid="lock-numpad-0"
            >
              0
            </Button>
            <Button
              variant="outline"
              className="h-14 text-xl font-semibold rounded-xl bg-muted/50 hover:bg-muted border-none text-destructive"
              onClick={handleBackspace}
              disabled={pin.length === 0}
            >
              ⌫
            </Button>
          </div>

          <Button
            className="w-full h-12 text-lg font-bold rounded-xl"
            onClick={handleUnlock}
            disabled={pin.length < 4 || isLoading}
            data-testid="button-unlock"
          >
            {isLoading ? "Unlocking..." : "Unlock"}
          </Button>
        </motion.div>

        <div className="mt-6 text-center">
          <button
            className="text-sm text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
            onClick={logout}
            data-testid="button-logout-from-lock"
          >
            Sign out instead
          </button>
        </div>
      </div>
    </motion.div>
  );
}
