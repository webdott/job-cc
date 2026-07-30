"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { PullToRefresh } from "@/components/pull-to-refresh";
import {
  Search,
  Layers,
  FileText,
  TrendingUp,
  Send,
  MessageSquare,
  Trophy,
  Zap,
} from "lucide-react";

interface AnalyticsStats {
  total: number;
  applied: number;
  responded: number;
  interviews: number;
  offers: number;
  responseRate: number;
  interviewRate: number;
  avgScore: number | null;
}

interface AnalyticsResponse {
  stats: AnalyticsStats | null;
}

interface Job {
  id: string;
  title: string;
  company: string;
  remote: boolean;
  evaluation: { overallScore: number | null; recommendation: string | null } | null;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
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
      <p className="text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-card border border-border rounded-xl p-4 animate-pulse">
      <div className="h-3 bg-muted rounded w-24 mb-3" />
      <div className="h-7 bg-muted rounded w-16" />
    </div>
  );
}

export default function HomePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: analyticsData, isLoading: analyticsLoading } = useQuery<AnalyticsResponse>({
    queryKey: ["analytics"],
    queryFn: async () => {
      const res = await fetch("/api/analytics");
      return res.json() as Promise<AnalyticsResponse>;
    },
  });

  const { data: jobsData, isLoading: jobsLoading } = useQuery<{ jobs: Job[] }>({
    queryKey: ["jobs", 0, false, "score", 1],
    queryFn: async () => {
      const res = await fetch("/api/jobs?sortBy=score&page=1");
      return res.json() as Promise<{ jobs: Job[] }>;
    },
  });

  const stats = analyticsData?.stats;
  const topJobs = (jobsData?.jobs ?? []).filter((j) => j.evaluation?.overallScore).slice(0, 3);
  const hasAnyData = stats && stats.total > 0;

  return (
    <PullToRefresh className="h-full" onRefresh={() => queryClient.invalidateQueries()}>
      <div className="mx-auto max-w-4xl p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-foreground">{greeting()} 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {hasAnyData ? "Here's your job search snapshot." : "Let's get your job search started."}
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {analyticsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          ) : (
            <>
              <StatCard
                label="Applications"
                value={stats?.total ?? 0}
                icon={Send}
                color="bg-blue-500/10 text-blue-400"
              />
              <StatCard
                label="Response Rate"
                value={`${stats?.responseRate ?? 0}%`}
                icon={MessageSquare}
                color="bg-yellow-500/10 text-yellow-400"
              />
              <StatCard
                label="Interviews"
                value={stats?.interviews ?? 0}
                icon={TrendingUp}
                color="bg-purple-500/10 text-purple-400"
              />
              <StatCard
                label="Offers"
                value={stats?.offers ?? 0}
                icon={Trophy}
                color="bg-green-500/10 text-green-400"
              />
            </>
          )}
        </div>

        {analyticsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : hasAnyData ? (
          /* Top job matches */
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-foreground/80">Top Job Matches</h2>
              <Link
                href="/discover"
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                View all →
              </Link>
            </div>
            {jobsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : topJobs.length === 0 ? (
              <div className="text-center py-8">
                <Search className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Scan for jobs to see matches here</p>
                <button
                  onClick={() => router.push("/discover")}
                  className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Go to Discover →
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {topJobs.map((job) => {
                  const score = job.evaluation?.overallScore ?? 0;
                  return (
                    <div
                      key={job.id}
                      onClick={() => router.push(`/discover?jobId=${job.id}`)}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{job.title}</p>
                        <p className="text-xs text-muted-foreground">{job.company}</p>
                      </div>
                      <span
                        className={cn(
                          "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ml-3",
                          score >= 70
                            ? "bg-green-600/15 text-green-700 dark:bg-green-500/15 dark:text-green-400"
                            : score >= 40
                              ? "bg-yellow-600/15 text-yellow-700 dark:bg-yellow-500/15 dark:text-yellow-400"
                              : "bg-red-600/15 text-red-700 dark:bg-red-500/15 dark:text-red-400"
                        )}
                      >
                        {score}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* Getting-started empty state */
          <div className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <Zap className="h-4 w-4 text-blue-400" />
              <h2 className="text-sm font-medium text-foreground/80">Get started in 3 steps</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                {
                  step: "1",
                  icon: FileText,
                  title: "Upload your resume",
                  desc: "AI parses it into skills and experience",
                  href: "/profile",
                  cta: "Go to Profile",
                  color: "text-blue-400 bg-blue-500/10",
                },
                {
                  step: "2",
                  icon: Search,
                  title: "Scan for jobs",
                  desc: "Finds remote roles and scores them against your resume",
                  href: "/discover",
                  cta: "Go to Discover",
                  color: "text-purple-400 bg-purple-500/10",
                },
                {
                  step: "3",
                  icon: Layers,
                  title: "Track applications",
                  desc: "Drag cards through the Kanban pipeline",
                  href: "/pipeline",
                  cta: "Go to Pipeline",
                  color: "text-green-400 bg-green-500/10",
                },
              ].map(({ step, icon: Icon, title, desc, href, cta, color }) => (
                <Link
                  key={step}
                  href={href}
                  className="group flex flex-col gap-3 p-4 bg-muted/40 hover:bg-muted border border-border hover:border-blue-500/30 rounded-xl transition-colors"
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                  </div>
                  <span className="text-xs text-blue-400 group-hover:text-blue-300 transition-colors mt-auto">
                    {cta} →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </PullToRefresh>
  );
}
