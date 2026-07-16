import { Link } from "react-router-dom";
import { CalendarRange } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Heading } from "@/components/ui/app";

interface Props {
  data: { month: string; earnings: number }[];
}

const MonthlyEarningsChart = ({ data }: Props) => (
  <section className="bg-card rounded-sm border border-border p-6 animate-reveal-delay-2">
    <div className="flex items-center justify-between mb-4">
      <Heading level={3}  className="flex items-center gap-2">
        <CalendarRange className="w-4 h-4 text-indigo-500" />
        Monthly Earnings Trend
      </Heading>
      <Link to="/provider-earnings" className="text-fs-xs text-primary font-medium hover:underline">Details</Link>
    </div>
    {data.every((d) => d.earnings === 0) ? (
      <div className="py-10 text-center">
        <CalendarRange className="w-7 h-7 mx-auto mb-2 text-muted-foreground/30" />
        <p className="text-description-sm">No earnings data yet</p>
      </div>
    ) : (
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="earningsGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `$${v}`} width={50} />
          <Tooltip
            formatter={(v: number) => [`$${v.toFixed(0)}`, "Earnings"]}
            contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
          />
          <Area type="monotone" dataKey="earnings" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#earningsGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    )}
  </section>
);

export default MonthlyEarningsChart;
