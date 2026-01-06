import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Users, 
  CreditCard, 
  Bell, 
  Building2,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Smartphone,
  Plus,
  ExternalLink
} from "lucide-react";
import { SiApple, SiGoogle } from "react-icons/si";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import { apiRequest } from "@/lib/queryClient";

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

interface Stats {
  customers: number;
  activeCards: number;
  branches: number;
  notifications: number;
}

interface GrowthData {
  date: string;
  count: number;
}

interface DistributionData {
  range: string;
  count: number;
}

interface EngagementData {
  status: string;
  count: number;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendUp = true,
  loading = false 
}: { 
  title: string; 
  value: number | string; 
  icon: typeof Users; 
  trend?: string;
  trendUp?: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-16 mb-2" />
          <Skeleton className="h-3 w-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="p-2 bg-primary/10 rounded-lg">
          <Icon className="h-4 w-4 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {trend && (
          <div className={`text-xs mt-1 flex items-center gap-1 ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
            <TrendingUp className={`h-3 w-3 ${!trendUp && 'rotate-180'}`} />
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery<Stats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: customerGrowth, isLoading: growthLoading } = useQuery<GrowthData[]>({
    queryKey: ["/api/analytics/customer-growth"],
  });

  const { data: pointsDistribution } = useQuery<DistributionData[]>({
    queryKey: ["/api/analytics/points-distribution"],
  });

  const { data: notificationEngagement } = useQuery<EngagementData[]>({
    queryKey: ["/api/analytics/notification-engagement"],
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/stripe/portal', {});
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.open(data.url, '_blank');
      }
    }
  });

  const hasData = customerGrowth && customerGrowth.length > 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's how your loyalty program is performing.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending}>
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Billing
          </Button>
          <Link href="/cards">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Card
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Customers"
          value={stats?.customers || 0}
          icon={Users}
          trend="+12% from last month"
          trendUp={true}
          loading={statsLoading}
        />
        <StatCard
          title="Active Cards"
          value={stats?.activeCards || 0}
          icon={CreditCard}
          trend="+3 this week"
          trendUp={true}
          loading={statsLoading}
        />
        <StatCard
          title="Branches"
          value={stats?.branches || 0}
          icon={Building2}
          loading={statsLoading}
        />
        <StatCard
          title="Notifications Sent"
          value={stats?.notifications || 0}
          icon={Bell}
          trend="98% delivery rate"
          trendUp={true}
          loading={statsLoading}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Customer Growth</CardTitle>
                <CardDescription>New customers over time</CardDescription>
              </div>
              <Badge variant="secondary">Last 30 days</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {growthLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-full w-full" />
              </div>
            ) : hasData ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={customerGrowth}>
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      className="text-xs"
                    />
                    <YAxis className="text-xs" />
                    <Tooltip 
                      labelFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="count" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fill="url(#colorCount)"
                      name="New Customers"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-center">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <p className="text-muted-foreground mb-4">No customer data yet</p>
                <p className="text-sm text-muted-foreground max-w-xs">
                  Start adding customers to see your growth analytics
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks at a glance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Link href="/cards">
              <Button variant="outline" className="w-full justify-between group">
                <span className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Design New Card
                </span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/customers">
              <Button variant="outline" className="w-full justify-between group">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  View Customers
                </span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/branches">
              <Button variant="outline" className="w-full justify-between group">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Manage Branches
                </span>
                <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Points Distribution</CardTitle>
                <CardDescription>Customer points breakdown</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {pointsDistribution && pointsDistribution.some(d => d.count > 0) ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pointsDistribution}
                      dataKey="count"
                      nameKey="range"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      label={({ range, percent }) => 
                        percent > 0.05 ? `${range}` : ''
                      }
                    >
                      {pointsDistribution?.map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-center">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <p className="text-muted-foreground">No points data yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Notification Performance</CardTitle>
                <CardDescription>Engagement by status</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {notificationEngagement && notificationEngagement.some(d => d.count > 0) ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={notificationEngagement} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis dataKey="status" type="category" className="text-xs" width={80} />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="count" 
                      fill="hsl(var(--primary))" 
                      name="Count"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex flex-col items-center justify-center text-center">
                <div className="p-4 bg-primary/10 rounded-full mb-4">
                  <Bell className="h-8 w-8 text-primary" />
                </div>
                <p className="text-muted-foreground">No notifications sent yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardContent className="flex flex-col md:flex-row items-center justify-between gap-6 py-8">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-primary/20 rounded-2xl">
              <Smartphone className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h3 className="text-xl font-semibold">Wallet Integration Ready</h3>
              <p className="text-muted-foreground mt-1">
                Your cards support Apple Wallet and Google Wallet
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="gap-2 py-2 px-4">
              <SiApple className="h-4 w-4" />
              Apple Wallet
            </Badge>
            <Badge variant="secondary" className="gap-2 py-2 px-4">
              <SiGoogle className="h-4 w-4" />
              Google Wallet
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
