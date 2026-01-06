import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { Layout, CreditCard, Users, Building2, BarChart, QrCode, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

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

const SidebarContent = ({ location, onItemClick }: { location: string; onItemClick?: () => void }) => (
  <>
    <div className="flex items-center gap-2 mb-8">
      <Layout className="h-6 w-6" />
      <span className="font-bold text-lg">Loyalty Pro</span>
    </div>
    
    <nav className="space-y-2">
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
  </>
);

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden lg:block w-64 border-r bg-card p-4 shrink-0">
        <SidebarContent location={location} />
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
              <SidebarContent location={location} onItemClick={() => setMobileOpen(false)} />
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
