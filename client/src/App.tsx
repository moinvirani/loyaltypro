import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import DashboardLayout from "@/components/layout/DashboardLayout";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import CardDesigner from "@/pages/card-designer";
import Customers from "@/pages/customers";
import CustomerMetrics from "@/pages/customers/metrics";
import Branches from "@/pages/branches";
import StaffPage from "@/pages/staff";
import NotFound from "@/pages/not-found";

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

function App() {
  const [location] = useLocation();
  const isLandingPage = location === "/" || location === "/pricing";
  const isStaffPage = location === "/staff" || location.startsWith("/staff/");
  
  return (
    <QueryClientProvider client={queryClient}>
      {isLandingPage ? (
        <Landing />
      ) : isStaffPage ? (
        <StaffPage />
      ) : (
        <DashboardLayout>
          <DashboardRouter />
        </DashboardLayout>
      )}
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;