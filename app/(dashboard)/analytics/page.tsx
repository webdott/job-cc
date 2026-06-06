"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { TrendingUp, Send, MessageSquare, CalendarCheck, Trophy } from "lucide-react";

interface AnalyticsStats {
  total: number;
  applied: number;
  responded: number;
  interviews: number;
  offers: number;
  rejected: number;
  responseRate: number;
  interviewRate: number;
  avgScore: number | null;
  funnel: { stage: string; count: number }[];
  byDay: { day: string; count: number }[];
  weeklyTrend: { week: string; applied: number; responses: number }[];
}

interface AnalyticsResponse {
  stats: AnalyticsStats | null;
}

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className={cn("p-1.5 rounded-lg", color)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-2xl font-semibold text-white">{value}</p>
      {sub && <p className="text-xs text-muted-foreground/70 mt-1">{sub}</p>}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="h-3 bg-muted rounded w-24 mb-3" />
      <div className="h-7 bg-slate-700 rounded w-16 mb-1" />
      <div className="h-2.5 bg-muted rounded w-20" />
    </div>
  );
}

const STAGE_COLORS: Record<string, string> = {
  Saved: "#64748b",
  Applied: "#3b82f6",
  Screening: "#eab308",
  Interview: "#a855f7",
  Offer: "#22c55e",
  Rejected: "#ef4444",
};

export default function AnalyticsPage() {
  const { data, isLoading } = useQuery<AnalyticsResponse>({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch("/api/analytics");
      return res.json() as Promise<AnalyticsResponse>;
    },
  });

  const stats = data?.stats;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <p className="text-muted-foreground text-sm">Your job search performance at a glance</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Applications"
              value={stats?.total ?? 0}
              icon={Send}
              color="bg-blue-500/10 text-blue-400"
            />
            <StatCard
              label="Response Rate"
              value={`${stats?.responseRate ?? 0}%`}
              sub={`${stats?.responded ?? 0} responses`}
              icon={MessageSquare}
              color="bg-yellow-500/10 text-yellow-400"
            />
            <StatCard
              label="Interviews"
              value={stats?.interviews ?? 0}
              sub={`${stats?.interviewRate ?? 0}% of responses`}
              icon={CalendarCheck}
              color="bg-purple-500/10 text-purple-400"
            />
            <StatCard
              label="Offers"
              value={stats?.offers ?? 0}
              sub={stats?.avgScore != null ? `Avg score ${stats.avgScore}%` : undefined}
              icon={Trophy}
              color="bg-green-500/10 text-green-400"
            />
          </>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        {/* Weekly trend */}
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-foreground/80">Weekly Activity</h2>
          </div>
          {isLoading ? (
            <div className="h-40 bg-muted rounded animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={stats?.weeklyTrend ?? []}>
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  axisLine={false}
                  tickLine={false}
                  width={20}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid #334155",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#94a3b8" }}
                />
                <Line
                  type="monotone"
                  dataKey="applied"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  name="Applied"
                />
                <Line
                  type="monotone"
                  dataKey="responses"
                  stroke="#22c55e"
                  strokeWidth={2}
                  dot={false}
                  name="Responses"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <span className="w-3 h-0.5 bg-blue-500 rounded" />
              Applied
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
              <span className="w-3 h-0.5 bg-green-500 rounded" />
              Responses
            </span>
          </div>
        </div>

        {/* Stage funnel */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h2 className="text-sm font-medium text-foreground/80 mb-4">Stage Funnel</h2>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-7 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(stats?.funnel ?? []).map(({ stage, count }) => {
                const max = Math.max(...(stats?.funnel ?? []).map((f) => f.count), 1);
                const pct = Math.round((count / max) * 100);
                return (
                  <div key={stage} className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-20 shrink-0">{stage}</span>
                    <div className="flex-1 bg-muted rounded-full h-5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500 flex items-center px-2"
                        style={{
                          width: `${Math.max(pct, count > 0 ? 8 : 0)}%`,
                          backgroundColor: STAGE_COLORS[stage] ?? "#64748b",
                          opacity: 0.8,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground/70 w-4 text-right shrink-0">
                      {count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Applications by day */}
      <div className="bg-card border border-border rounded-xl p-4">
        <h2 className="text-sm font-medium text-foreground/80 mb-4">Applications by Day of Week</h2>
        {isLoading ? (
          <div className="h-32 bg-muted rounded animate-pulse" />
        ) : (
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={stats?.byDay ?? []}>
              <XAxis
                dataKey="day"
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                width={20}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid #334155",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar dataKey="count" name="Applications" radius={[4, 4, 0, 0]}>
                {(stats?.byDay ?? []).map((entry, i) => (
                  <Cell
                    key={i}
                    fill={
                      entry.count === Math.max(...(stats?.byDay ?? []).map((d) => d.count))
                        ? "#3b82f6"
                        : "#334155"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Empty state */}
      {!isLoading && (stats?.total ?? 0) === 0 && (
        <div className="mt-6 text-center py-8">
          <p className="text-muted-foreground/70 text-sm">
            No data yet — start applying to see your stats here.
          </p>
        </div>
      )}
    </div>
  );
}
