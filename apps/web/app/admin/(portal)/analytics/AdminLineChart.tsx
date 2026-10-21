"use client";

// Split out of analytics/page.tsx so recharts (~100KB gz) lands in its own
// lazy chunk and the analytics KPIs paint without waiting on the chart library.

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const GRID_STROKE = "rgba(255,255,255,0.05)";
const AXIS_STROKE = "#64748b";
const AXIS_FONT_SIZE = 11;

interface AdminLineChartProps {
  data: object[];
  dataKey: string;
  stroke: string;
  tooltip: React.ReactElement;
}

export default function AdminLineChart({ data, dataKey, stroke, tooltip }: AdminLineChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
        <XAxis dataKey="day" stroke={AXIS_STROKE} fontSize={AXIS_FONT_SIZE} />
        <YAxis stroke={AXIS_STROKE} fontSize={AXIS_FONT_SIZE} />
        <Tooltip content={tooltip} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke={stroke}
          strokeWidth={2}
          dot={{ fill: stroke, r: 3 }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
