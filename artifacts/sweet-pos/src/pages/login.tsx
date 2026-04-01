import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useListStaff } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Store } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function Login() {
  const [pin, setPin] = useState("");
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  
  const { data: staffList } = useListStaff();

  const handleNumpadClick = (num: string) => {
    if (pin.length < 6) {
      setPin((prev) => prev + num);
    }
  };

  const handleBackspace = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handleLogin = async () => {
    if (pin.length < 4) return;
    setIsLoading(true);
    try {
      await login(pin);
    } catch (e) {
      setPin("");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row items-center justify-center p-4">
      {/* Decorative side */}
      <div className="hidden md:flex flex-1 items-center justify-center p-12 h-full max-w-2xl relative">
        <div className="absolute inset-0 opacity-20 dark:opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-background to-background"></div>
        <div className="relative z-10 text-center space-y-6">
          <div className="w-24 h-24 bg-primary text-primary-foreground rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-primary/20">
            <Store className="w-12 h-12" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground">
            SweetPOS
          </h1>
          <p className="text-xl text-muted-foreground font-medium max-w-md mx-auto">
            The heart of your daily operations. Fast, reliable, and delightful.
          </p>
        </div>
      </div>

      {/* Login side */}
      <div className="flex-1 flex items-center justify-center w-full max-w-md">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card w-full p-8 md:p-12 rounded-[2rem] shadow-xl border border-border"
        >
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-2">Staff Login</h2>
            <p className="text-muted-foreground">Enter your PIN to start shift</p>
          </div>

          <div className="mb-10">
            <div className="flex justify-center gap-4 mb-4">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div 
                  key={idx} 
                  className={`w-4 h-4 rounded-full transition-all duration-300 ${
                    idx < pin.length 
                      ? "bg-primary scale-125" 
                      : "bg-muted"
                  } ${idx >= 4 && pin.length < 4 ? "opacity-30" : ""}`}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-8">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <Button
                key={num}
                variant="outline"
                className="h-16 text-2xl font-semibold rounded-2xl bg-muted/50 hover:bg-muted border-none shadow-sm transition-transform active:scale-95"
                onClick={() => handleNumpadClick(num.toString())}
                data-testid={`numpad-${num}`}
              >
                {num}
              </Button>
            ))}
            <div />
            <Button
              variant="outline"
              className="h-16 text-2xl font-semibold rounded-2xl bg-muted/50 hover:bg-muted border-none shadow-sm transition-transform active:scale-95"
              onClick={() => handleNumpadClick("0")}
              data-testid="numpad-0"
            >
              0
            </Button>
            <Button
              variant="outline"
              className="h-16 text-xl font-semibold rounded-2xl bg-muted/50 hover:bg-muted border-none shadow-sm transition-transform active:scale-95 text-destructive"
              onClick={handleBackspace}
              disabled={pin.length === 0}
              data-testid="numpad-backspace"
            >
              ⌫
            </Button>
          </div>

          <Button 
            className="w-full h-14 text-xl font-bold rounded-2xl" 
            size="lg"
            onClick={handleLogin}
            disabled={pin.length < 4 || isLoading}
            data-testid="button-login"
          >
            {isLoading ? "Signing in..." : "Enter"}
          </Button>

          {staffList && staffList.length > 0 && (
            <div className="mt-8">
              <p className="text-sm text-center text-muted-foreground mb-4">Quick Select</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {staffList.filter(s => s.active).map(staff => (
                  <Badge key={staff.id} staff={staff} />
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function Badge({ staff }: { staff: any }) {
  return (
    <div className="px-3 py-1.5 bg-muted rounded-full text-xs font-medium text-muted-foreground flex items-center gap-2">
      <div className="w-2 h-2 rounded-full bg-primary" />
      {staff.name}
    </div>
  );
}
