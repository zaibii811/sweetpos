import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Layout } from "@/components/layout";

import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import POS from "@/pages/pos";
import Orders from "@/pages/orders";
import Inventory from "@/pages/inventory";
import Staff from "@/pages/staff";
import Reports from "@/pages/reports";
import Settings from "@/pages/settings";
import TimeClock from "@/pages/time-clock";
import Dashboard from "@/pages/dashboard";
import AccessDenied from "@/pages/access-denied";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function GuardedRoute({ permission, component: Component }: { permission: Parameters<ReturnType<typeof usePermissions>["can"]>[0]; component: React.ComponentType }) {
  const { can } = usePermissions();
  if (!can(permission)) return <AccessDenied />;
  return <Component />;
}

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/login" component={Login} />
        <Route path="/" component={POS} />
        <Route path="/orders">
          {() => <GuardedRoute permission="orders" component={Orders} />}
        </Route>
        <Route path="/inventory">
          {() => <GuardedRoute permission="inventory" component={Inventory} />}
        </Route>
        <Route path="/staff">
          {() => <GuardedRoute permission="staff" component={Staff} />}
        </Route>
        <Route path="/reports">
          {() => <GuardedRoute permission="reports" component={Reports} />}
        </Route>
        <Route path="/settings">
          {() => <GuardedRoute permission="settings" component={Settings} />}
        </Route>
        <Route path="/timeclock">
          {() => <GuardedRoute permission="timeclock" component={TimeClock} />}
        </Route>
        <Route path="/dashboard">
          {() => <GuardedRoute permission="dashboard" component={Dashboard} />}
        </Route>
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light">
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <Router />
            </AuthProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
