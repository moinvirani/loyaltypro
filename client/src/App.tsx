import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import CardDesigner from "@/pages/card-designer";
import Customers from "@/pages/customers";
import CustomerMetrics from "@/pages/customers/metrics";
import Branches from "@/pages/branches";
import StaffPage from "@/pages/staff";
import AuthPage from "@/pages/auth";
import OnboardingPage from "@/pages/onboarding";
import NotFound from "@/pages/not-found";
import { Loader2 } from "lucide-react";

function DashboardRouter() {
  return (
    <Switch>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/cards" component={CardDesigner} />
      <Route path="/customers" component={Customers} />
      <Route path="/customers/metrics" component={CustomerMetrics} />
      <Route path="/branches" component={Branches} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ProtectedDashboard() {
  return (
    <DashboardLayout>
      <DashboardRouter />
    </DashboardLayout>
  );
}

function AppRoutes() {
  const [location] = useLocation();
  const { user, isLoading } = useAuth();
  
  const isLandingPage = location === "/" || location === "/pricing";
  const isAuthPage = location === "/auth";
  const isStaffPage = location === "/staff" || location.startsWith("/staff/");
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/pricing" component={Landing} />
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/onboarding" component={OnboardingPage} />
      <Route path="/staff" component={StaffPage} />
      <ProtectedRoute path="/dashboard" component={ProtectedDashboard} />
      <ProtectedRoute path="/cards" component={ProtectedDashboard} />
      <ProtectedRoute path="/customers" component={ProtectedDashboard} />
      <ProtectedRoute path="/customers/metrics" component={ProtectedDashboard} />
      <ProtectedRoute path="/branches" component={ProtectedDashboard} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
