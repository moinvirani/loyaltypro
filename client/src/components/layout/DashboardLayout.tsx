import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Layout, CreditCard, Users, Building2, BarChart } from "lucide-react";

interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  href: string;
  active: boolean;
}

const SidebarItem = ({ icon, label, href, active }: SidebarItemProps) => (
  <Link href={href}>
    <a className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors ${
      active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
    }`}>
      {icon}
      <span>{label}</span>
    </a>
  </Link>
);

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen bg-background">
      <aside className="w-64 border-r bg-card p-4">
        <div className="flex items-center gap-2 mb-8">
          <Layout className="h-6 w-6" />
          <span className="font-bold text-lg">Loyalty Pro</span>
        </div>
        
        <nav className="space-y-2">
          <SidebarItem
            icon={<BarChart className="h-5 w-5" />}
            label="Dashboard"
            href="/"
            active={location === '/'}
          />
          <SidebarItem
            icon={<CreditCard className="h-5 w-5" />}
            label="Card Designer"
            href="/cards"
            active={location === '/cards'}
          />
          <SidebarItem
            icon={<Users className="h-5 w-5" />}
            label="Customers"
            href="/customers"
            active={location === '/customers'}
          />
          <SidebarItem
            icon={<Building2 className="h-5 w-5" />}
            label="Branches"
            href="/branches"
            active={location === '/branches'}
          />
        </nav>
      </aside>
      
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
