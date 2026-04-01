import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Store, KeyRound, Hash } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type LoginMode = "pin" | "password";

export default function Login() {
  const [mode, setMode] = useState<LoginMode>("pin");
  const [pin, setPin] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const { login, passwordLogin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleNumpadClick = (num: string) => {
    if (pin.length < 4) setPin((prev) => prev + num);
  };

  const handleBackspace = () => setPin((prev) => prev.slice(0, -1));

  const handlePinLogin = async () => {
    if (pin.length < 4) return;
    setIsLoading(true);
    try {
      await login(pin);
    } catch {
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!username || !password) return;
    setIsLoading(true);
    try {
      await passwordLogin(username, password);
    } catch {
      setPassword("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row items-center justify-center p-4">
      {/* Decorative side */}
      <div className="hidden md:flex flex-1 items-center justify-center p-12 h-full max-w-2xl relative">
        <div className="absolute inset-0 opacity-20 dark:opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary via-background to-background" />
        <div className="relative z-10 text-center space-y-6">
          <div className="w-24 h-24 bg-primary text-primary-foreground rounded-3xl mx-auto flex items-center justify-center shadow-2xl shadow-primary/20">
            <Store className="w-12 h-12" />
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-foreground">SweetPOS</h1>
          <p className="text-xl text-muted-foreground font-medium max-w-md mx-auto">
            The heart of your daily operations. Fast, reliable, and delightful.
          </p>
          <div className="mt-8 space-y-2 text-sm text-muted-foreground">
            <p className="font-semibold">Staff roles:</p>
            <p>Owner — full access (username login)</p>
            <p>Manager — POS, Inventory, Reports (username login)</p>
            <p>Cashier — POS only (4-digit PIN)</p>
          </div>
        </div>
      </div>

      {/* Login side */}
      <div className="flex-1 flex items-center justify-center w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card w-full p-8 md:p-10 rounded-[2rem] shadow-xl border border-border"
        >
          <div className="text-center mb-8">
            <div className="md:hidden w-12 h-12 bg-primary text-primary-foreground rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <Store className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold">
              {mode === "pin" ? "Cashier Login" : "Staff Login"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {mode === "pin" ? "Enter your 4-digit PIN" : "Enter your username and password"}
            </p>
          </div>

          {/* Mode tabs */}
          <div className="flex gap-2 mb-8 bg-muted p-1 rounded-xl">
            <button
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === "pin"
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setMode("pin"); setPin(""); }}
              data-testid="tab-pin-login"
            >
              <Hash className="w-4 h-4" />
              PIN
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                mode === "password"
                  ? "bg-background shadow text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setMode("password"); setPassword(""); }}
              data-testid="tab-password-login"
            >
              <KeyRound className="w-4 h-4" />
              Username
            </button>
          </div>

          <AnimatePresence mode="wait">
            {mode === "pin" ? (
              <motion.div
                key="pin"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
              >
                {/* PIN dots */}
                <div className="flex justify-center gap-5 mb-8">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={`w-4 h-4 rounded-full transition-all duration-300 ${
                        idx < pin.length ? "bg-primary scale-125" : "bg-muted"
                      }`}
                    />
                  ))}
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-3 mb-6">
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
                  className="w-full h-13 text-lg font-bold rounded-2xl"
                  onClick={handlePinLogin}
                  disabled={pin.length < 4 || isLoading}
                  data-testid="button-login"
                >
                  {isLoading ? "Signing in..." : "Enter"}
                </Button>
              </motion.div>
            ) : (
              <motion.div
                key="password"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                    className="h-12 rounded-xl text-base"
                    data-testid="input-username"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handlePasswordLogin()}
                    className="h-12 rounded-xl text-base"
                    data-testid="input-password"
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  className="w-full h-12 text-lg font-bold rounded-2xl mt-2"
                  onClick={handlePasswordLogin}
                  disabled={!username || !password || isLoading}
                  data-testid="button-login-password"
                >
                  {isLoading ? "Signing in..." : "Sign In"}
                </Button>
                <p className="text-xs text-center text-muted-foreground pt-2">
                  For Owner and Manager accounts only
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}
