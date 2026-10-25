"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const walnut = "#6b4429";

/** New leads per week (last 12 weeks). A table with the same numbers sits beside it for screen readers. */
export function LeadsPerWeekChart({ data }: { data: { week: string; leads: number }[] }) {
  const fmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return (
    <div aria-hidden className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        {/* Not focusable: the chart is decorative here (the table carries the data). */}
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: -16 }}
          accessibilityLayer={false}
          tabIndex={-1}
        >
          <CartesianGrid vertical={false} stroke="#e6ded2" />
          <XAxis
            dataKey="week"
            tickFormatter={(w: string) => fmt.format(new Date(w))}
            tick={{ fontSize: 11 }}
            tickLine={false}
          />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip
            labelFormatter={(w) => `Week of ${fmt.format(new Date(String(w)))}`}
            formatter={(v) => [v, "Leads"]}
            cursor={{ fill: "#f1e9dd" }}
          />
          <Bar dataKey="leads" fill={walnut} radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
