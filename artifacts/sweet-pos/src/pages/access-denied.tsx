import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function AccessDenied() {
  const [, setLocation] = useLocation();
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <ShieldAlert className="w-16 h-16 text-muted-foreground" />
      <h2 className="text-2xl font-bold">Access Denied</h2>
      <p className="text-muted-foreground max-w-sm">
        You don't have permission to view this page. Contact your manager or owner.
      </p>
      <Button variant="outline" onClick={() => setLocation("/")}>
        Back to POS
      </Button>
    </div>
  );
}
