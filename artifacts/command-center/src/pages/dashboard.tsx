import { Layout } from "@/components/layout";
import { 
  useGetDashboardSummary, 
  useGetIssuePriorityBreakdown, 
  useGetProjectHealth, 
  useGetRecentActivities 
} from "@workspace/api-client-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  FolderKanban, 
  Users,
  Activity as ActivityIcon,
  ArrowRight
} from "lucide-react";
import { Link } from "wouter";

export default function Dashboard() {
  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary();
  const { data: priorityBreakdown, isLoading: isLoadingBreakdown } = useGetIssuePriorityBreakdown();
  const { data: projectHealth, isLoading: isLoadingHealth } = useGetProjectHealth();
  const { data: recentActivities, isLoading: isLoadingActivities } = useGetRecentActivities({ limit: 5 });

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Morning Briefing</h1>
          <p className="text-muted-foreground mt-1 text-sm">Here's what's happening across your projects today.</p>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard 
            title="Active Projects" 
            value={summary?.activeProjects} 
            icon={<FolderKanban className="w-4 h-4 text-primary" />} 
            loading={isLoadingSummary} 
          />
          <StatCard 
            title="Critical Issues" 
            value={summary?.criticalIssues} 
            icon={<AlertCircle className="w-4 h-4 text-destructive" />} 
            loading={isLoadingSummary} 
            valueClassName={summary?.criticalIssues ? "text-destructive" : ""}
          />
          <StatCard 
            title="Resolved This Week" 
            value={summary?.resolvedThisWeek} 
            icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />} 
            loading={isLoadingSummary} 
          />
          <StatCard 
            title="Team Members" 
            value={summary?.teamSize} 
            icon={<Users className="w-4 h-4 text-blue-500" />} 
            loading={isLoadingSummary} 
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Project Health */}
            <Card className="p-6 border-border/50 shadow-sm bg-card/50">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold">Project Health</h2>
                <Link href="/projects" className="text-sm text-primary hover:underline flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-4">
                {isLoadingHealth ? (
                  <div className="space-y-3">
                    <Skeleton className="h-16 w-full rounded-md" />
                    <Skeleton className="h-16 w-full rounded-md" />
                  </div>
                ) : (Array.isArray(projectHealth) ? projectHealth : []).map(ph => (
                  <div key={ph.projectId} className="flex items-center justify-between p-4 rounded-lg bg-background border border-border/50 hover:border-border transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ph.color }} />
                      <div>
                        <div className="font-medium text-sm">{ph.name}</div>
                        <div className="text-xs text-muted-foreground">{ph.client}</div>
                      </div>
                    </div>
                    <div className="flex gap-4 text-sm">
                      <div className="flex flex-col items-end">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">Critical</span>
                        <span className={ph.criticalIssues > 0 ? "text-destructive font-medium" : "text-muted-foreground"}>{ph.criticalIssues}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider">Open</span>
                        <span>{ph.openIssues}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Side Column */}
          <div className="space-y-6">
            {/* Priority Queue */}
            <Card className="p-6 border-border/50 shadow-sm bg-card/50">
               <h2 className="text-lg font-semibold mb-4">Issue Queue</h2>
               <div className="space-y-3">
                  {isLoadingBreakdown ? (
                    <Skeleton className="h-32 w-full" />
                  ) : (Array.isArray(priorityBreakdown) ? priorityBreakdown : []).map(pb => (
                    <div key={pb.priority} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={pb.priority === 'critical' ? 'destructive' : 'secondary'} className="capitalize text-xs">
                          {pb.priority}
                        </Badge>
                      </div>
                      <span className="text-sm font-medium">{pb.count}</span>
                    </div>
                  ))}
               </div>
               <Link href="/issues" className="mt-4 block w-full text-center text-sm text-primary hover:underline">
                  Go to Issue Queue
               </Link>
            </Card>

            {/* Recent Activity */}
            <Card className="p-6 border-border/50 shadow-sm bg-card/50">
              <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
              <div className="space-y-4">
                {isLoadingActivities ? (
                  <Skeleton className="h-40 w-full" />
                ) : (Array.isArray(recentActivities) ? recentActivities : []).map(act => (
                  <div key={act.id} className="flex gap-3">
                    <div className="mt-0.5">
                      <ActivityIcon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-medium leading-tight">{act.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(act.activityDate).toLocaleDateString()}
                        {act.durationMinutes && <span className="text-muted-foreground/50">· {act.durationMinutes}m</span>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function StatCard({ title, value, icon, loading, valueClassName }: { title: string, value?: number, icon: React.ReactNode, loading: boolean, valueClassName?: string }) {
  return (
    <Card className="p-4 border-border/50 bg-card/50 hover:bg-card transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
        {icon}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-16" />
      ) : (
        <div className={`text-2xl font-semibold ${valueClassName || ''}`}>{value || 0}</div>
      )}
    </Card>
  );
}
