import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function CustomerMetrics() {
  const { data: segments } = useQuery({
    queryKey: ["/api/analytics/customer-segments"],
  });

  const { data: pointsTrends } = useQuery({
    queryKey: ["/api/analytics/points-trends"],
  });

  const { data: retention } = useQuery({
    queryKey: ["/api/analytics/customer-retention"],
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Customer Engagement Metrics</h1>
        <p className="text-muted-foreground mt-2">
          Analyze customer behavior and loyalty program performance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer Segments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={segments}
                    dataKey="count"
                    nameKey="segment"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ segment, percent }) => 
                      `${segment} (${(percent * 100).toFixed(0)}%)`
                    }
                  >
                    {segments?.map((_, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={COLORS[index % COLORS.length]} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Points Accumulation Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={pointsTrends}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="averagePoints" 
                    stroke="#8884d8" 
                    name="Avg Points"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="totalCustomers" 
                    stroke="#82ca9d" 
                    name="Total Customers"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Customer Retention</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={retention}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="cohort"
                    tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  />
                  <Bar dataKey="count" fill="#8884d8" name="Customers" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
