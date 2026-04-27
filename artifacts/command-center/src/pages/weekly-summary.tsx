import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { useGetWeeklySummary, type WeeklySummary } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Activity as ActivityIcon,
  FolderKanban,
  FileText,
} from "lucide-react";

const CATEGORY_LABELS: Record<string, string> = {
  client_call: "Client call",
  code_review: "Code review",
  planning: "Planning",
  one_on_one: "1:1",
  support: "Support",
  deployment: "Deployment",
  documentation: "Documentation",
  other: "Other",
};

function formatMinutes(min: number) {
  if (min === 0) return "0m";
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function buildPlainText(summary: WeeklySummary): string {
  const start = format(parseISO(summary.weekStart), "MMM d");
  const end = format(parseISO(summary.weekEnd), "MMM d, yyyy");
  const lines: string[] = [];
  lines.push(`Weekly Update — ${start} to ${end}`);
  lines.push("");
  lines.push(
    `Logged ${summary.totalActivities} activities (${formatMinutes(summary.totalMinutes)}) and resolved ${summary.resolvedIssuesCount} issue${summary.resolvedIssuesCount === 1 ? "" : "s"}.`,
  );
  if (summary.outstandingCriticalCount > 0) {
    lines.push(
      `${summary.outstandingCriticalCount} critical issue${summary.outstandingCriticalCount === 1 ? "" : "s"} still open.`,
    );
  }
  lines.push("");

  for (const project of summary.projectBreakdown) {
    if (project.activities.length === 0 && project.resolvedIssues.length === 0) continue;
    lines.push(`## ${project.projectName}${project.client ? ` (${project.client})` : ""}`);
    lines.push(
      `Time logged: ${formatMinutes(project.totalMinutes)} · ${project.activities.length} activit${project.activities.length === 1 ? "y" : "ies"}`,
    );
    if (project.resolvedIssues.length > 0) {
      lines.push("Resolved:");
      for (const iss of project.resolvedIssues) {
        lines.push(`  - ${iss.title}`);
      }
    }
    if (project.activities.length > 0) {
      lines.push("Highlights:");
      for (const a of project.activities) {
        const dur = a.durationMinutes != null ? ` (${formatMinutes(a.durationMinutes)})` : "";
        lines.push(`  - [${CATEGORY_LABELS[a.category]}] ${a.title}${dur}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}

export default function WeeklySummaryPage() {
  const { toast } = useToast();
  const [endDate, setEndDate] = useState<string>(todayIso());

  const { data, isLoading } = useGetWeeklySummary({ endDate });

  const plainText = useMemo(() => (data ? buildPlainText(data) : ""), [data]);

  const onCopy = async () => {
    if (!plainText) return;
    try {
      await navigator.clipboard.writeText(plainText);
      toast({ title: "Copied to clipboard", description: "Paste it into your client update." });
    } catch {
      toast({
        title: "Couldn't copy automatically",
        description: "Select the text below and copy it manually.",
        variant: "destructive",
      });
    }
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Weekly summary</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              A shareable wrap-up of the past 7 days, grouped by client.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Week ending</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 w-[170px]"
              />
            </div>
            <Button onClick={onCopy} disabled={!data || isLoading}>
              <Copy className="w-4 h-4 mr-2" /> Copy as text
            </Button>
          </div>
        </div>

        {isLoading || !data ? (
          <div className="space-y-4">
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="p-5 border-border/50 bg-card/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Time logged
                  </span>
                  <Clock className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight">
                  {formatMinutes(data.totalMinutes)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {data.totalActivities} entr{data.totalActivities === 1 ? "y" : "ies"}
                </p>
              </Card>
              <Card className="p-5 border-border/50 bg-card/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Issues resolved
                  </span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-3 text-3xl font-semibold tracking-tight">
                  {data.resolvedIssuesCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">In the past 7 days</p>
              </Card>
              <Card className="p-5 border-border/50 bg-card/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Critical open
                  </span>
                  <AlertTriangle
                    className={`w-4 h-4 ${data.outstandingCriticalCount > 0 ? "text-destructive" : "text-muted-foreground"}`}
                  />
                </div>
                <div
                  className={`mt-3 text-3xl font-semibold tracking-tight ${data.outstandingCriticalCount > 0 ? "text-destructive" : ""}`}
                >
                  {data.outstandingCriticalCount}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Carrying into next week
                </p>
              </Card>
              <Card className="p-5 border-border/50 bg-card/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                    Period
                  </span>
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="mt-3 text-base font-semibold tracking-tight">
                  {format(parseISO(data.weekStart), "MMM d")} —{" "}
                  {format(parseISO(data.weekEnd), "MMM d, yyyy")}
                </div>
                <p className="text-xs text-muted-foreground mt-1">7-day window</p>
              </Card>
            </div>

            <Card className="p-6 border-border/50 bg-card/50">
              <h2 className="text-sm uppercase tracking-wider font-semibold text-muted-foreground mb-4">
                Time by category
              </h2>
              {data.categoryBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No activities logged in this window.
                </p>
              ) : (
                <div className="space-y-3">
                  {data.categoryBreakdown.map((cat) => {
                    const pct =
                      data.totalMinutes > 0
                        ? Math.round((cat.minutes / data.totalMinutes) * 100)
                        : 0;
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between text-sm mb-1.5">
                          <span className="font-medium">
                            {CATEGORY_LABELS[cat.category]}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatMinutes(cat.minutes)} · {cat.count} entr
                            {cat.count === 1 ? "y" : "ies"}
                          </span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>

            <div className="space-y-6">
              <h2 className="text-xl font-semibold tracking-tight">By project</h2>
              {data.projectBreakdown.length === 0 ? (
                <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center bg-card/50">
                  <FolderKanban className="w-12 h-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">Nothing to summarize yet</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                    Log some activities or resolve issues to see them here.
                  </p>
                </Card>
              ) : (
                data.projectBreakdown.map((project) => {
                  const key =
                    project.projectId == null ? "general" : String(project.projectId);
                  return (
                    <Card
                      key={key}
                      className="p-6 border-border/50 bg-card/50 relative overflow-hidden"
                    >
                      {project.projectColor && (
                        <div
                          className="absolute top-0 left-0 w-full h-1"
                          style={{ backgroundColor: project.projectColor }}
                        />
                      )}
                      <div className="flex items-start justify-between gap-4 flex-wrap mt-2">
                        <div>
                          <h3 className="text-lg font-semibold">{project.projectName}</h3>
                          {project.client && (
                            <p className="text-xs text-muted-foreground">
                              {project.client}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatMinutes(project.totalMinutes)}
                          </span>
                          <span>{project.activities.length} activit{project.activities.length === 1 ? "y" : "ies"}</span>
                        </div>
                      </div>

                      {project.resolvedIssues.length > 0 && (
                        <div className="mt-5">
                          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Resolved
                          </div>
                          <ul className="space-y-1.5">
                            {project.resolvedIssues.map((iss) => (
                              <li
                                key={iss.id}
                                className="text-sm flex items-start gap-2"
                              >
                                <Badge
                                  variant="outline"
                                  className="text-[10px] capitalize bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                                >
                                  {iss.priority}
                                </Badge>
                                <span>{iss.title}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {project.activities.length > 0 && (
                        <div className="mt-5">
                          <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                            <ActivityIcon className="w-3 h-3" /> Highlights
                          </div>
                          <ul className="space-y-2">
                            {project.activities.map((a) => (
                              <li
                                key={a.id}
                                className="text-sm flex items-start gap-3"
                              >
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] shrink-0"
                                >
                                  {CATEGORY_LABELS[a.category]}
                                </Badge>
                                <div className="flex-1">
                                  <div className="flex items-baseline justify-between gap-2 flex-wrap">
                                    <span className="font-medium">{a.title}</span>
                                    <span className="text-xs text-muted-foreground shrink-0">
                                      {format(parseISO(a.activityDate), "EEE, MMM d")}
                                      {a.durationMinutes != null
                                        ? ` · ${formatMinutes(a.durationMinutes)}`
                                        : ""}
                                    </span>
                                  </div>
                                  {a.notes && (
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                      {a.notes}
                                    </p>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </Card>
                  );
                })
              )}
            </div>

            <Card className="p-6 border-border/50 bg-card/50">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm uppercase tracking-wider font-semibold text-muted-foreground flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5" /> Plain-text version
                </h2>
                <Button onClick={onCopy} variant="outline" size="sm">
                  <Copy className="w-3.5 h-3.5 mr-2" /> Copy
                </Button>
              </div>
              <pre className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90 font-mono bg-background/40 rounded-lg p-4 border border-border/50">
                {plainText || "—"}
              </pre>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
