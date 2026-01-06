import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout, CreditCard, Users, Building2, BarChart, QrCode, Menu, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  href: string;
  active: boolean;
  onClick?: () => void;
}

const SidebarItem = ({ icon, label, href, active, onClick }: SidebarItemProps) => (
  <Link href={href} onClick={onClick} className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
    active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
  }`}>
    {icon}
    <span>{label}</span>
  </Link>
);

function SidebarContent({ location, onItemClick, user, onLogout }: { 
  location: string; 
  onItemClick?: () => void;
  user?: { name: string } | null;
  onLogout?: () => void;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-8">
        <Layout className="h-6 w-6" />
        <span className="font-bold text-lg">Loyalty Pro</span>
      </div>
      
      <nav className="space-y-2 flex-1">
        <SidebarItem
          icon={<BarChart className="h-5 w-5" />}
          label="Dashboard"
          href="/dashboard"
          active={location === '/dashboard'}
          onClick={onItemClick}
        />
        <SidebarItem
          icon={<CreditCard className="h-5 w-5" />}
          label="Card Designer"
          href="/cards"
          active={location === '/cards'}
          onClick={onItemClick}
        />
        <SidebarItem
          icon={<Users className="h-5 w-5" />}
          label="Customers"
          href="/customers"
          active={location === '/customers'}
          onClick={onItemClick}
        />
        <SidebarItem
          icon={<Building2 className="h-5 w-5" />}
          label="Branches"
          href="/branches"
          active={location === '/branches'}
          onClick={onItemClick}
        />
        
        <div className="pt-4 mt-4 border-t">
          <p className="px-4 pb-2 text-xs font-medium text-muted-foreground uppercase">Staff Tools</p>
          <SidebarItem
            icon={<QrCode className="h-5 w-5" />}
            label="Scanner"
            href="/staff"
            active={location === '/staff'}
            onClick={onItemClick}
          />
        </div>
      </nav>

      {user && (
        <div className="pt-4 mt-4 border-t">
          <div className="px-4 py-2">
            <p className="text-sm font-medium truncate">{user.name}</p>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 px-4"
            onClick={onLogout}
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logoutMutation } = useAuth();

  const handleLogout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        setLocation("/auth");
      }
    });
  };

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden lg:flex w-64 border-r bg-card p-4 shrink-0 flex-col">
        <SidebarContent 
          location={location} 
          user={user}
          onLogout={handleLogout}
        />
      </aside>
      
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden flex items-center gap-4 p-4 border-b bg-card">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-4">
              <SidebarContent 
                location={location} 
                onItemClick={() => setMobileOpen(false)}
                user={user}
                onLogout={() => {
                  setMobileOpen(false);
                  handleLogout();
                }}
              />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <Layout className="h-5 w-5" />
            <span className="font-bold">Loyalty Pro</span>
          </div>
        </header>
        
        <main className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
