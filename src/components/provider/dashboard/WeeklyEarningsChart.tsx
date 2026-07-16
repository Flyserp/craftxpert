import { Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Heading } from "@/components/ui/app";

interface Props {
  data: { week: string; earnings: number }[];
}

const WeeklyEarningsChart = ({ data }: Props) => (
  <section className="bg-card rounded-sm border border-border p-6 animate-reveal-delay-2">
    <div className="flex items-center justify-between mb-4">
      <Heading level={3}  className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-primary" />
        Weekly Earnings
      </Heading>
      <Link to="/provider-earnings" className="text-fs-xs text-primary font-medium hover:underline">Details</Link>
    </div>
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
        <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} />
        <Tooltip formatter={(v: number) => [`$${v}`, "Earnings"]} />
        <Bar dataKey="earnings" fill="hsl(var(--chart-1))" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  </section>
);

export default WeeklyEarningsChart;
