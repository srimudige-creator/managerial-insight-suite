import { useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useListIssues,
  useListProjects,
  useListMembers,
  useCreateIssue,
  useUpdateIssue,
  useDeleteIssue,
  getListIssuesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetProjectHealthQueryKey,
  getGetIssuePriorityBreakdownQueryKey,
  type Issue,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, CheckCircle2, Trash2, Calendar, Flame, AlertCircle, Activity as ActivityIcon } from "lucide-react";

const PRIORITIES = ["critical", "high", "medium", "low"] as const;
const STATUSES = ["l2", "l3", "wfc", "resolved", "yet_to_pick", "raised_cr_closed"] as const;
const DONE_STATUSES = new Set(["resolved", "raised_cr_closed"]);
const STATUS_LABELS: Record<string, string> = {
  l2: "L2",
  l3: "L3",
  wfc: "WFC",
  resolved: "Resolved",
  yet_to_pick: "Yet to pick",
  raised_cr_closed: "Raised a CR and closed",
};

const PRIORITY_STYLES: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  low: "bg-muted text-muted-foreground border-border",
};

const PRIORITY_ICON: Record<string, typeof Flame> = {
  critical: Flame,
  high: AlertCircle,
  medium: ActivityIcon,
  low: CheckCircle2,
};

const issueSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["l2", "l3", "wfc", "resolved", "yet_to_pick", "raised_cr_closed"]),
  assigneeId: z.string().optional(),
  reportedBy: z.string().optional(),
  dueDate: z.string().optional(),
});

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase();
}

export default function Issues() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>("open_only");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [newOpen, setNewOpen] = useState(false);

  const queryParams: Record<string, unknown> = {};
  if (statusFilter !== "all" && statusFilter !== "open_only") queryParams.status = statusFilter;
  if (priorityFilter !== "all") queryParams.priority = priorityFilter;
  if (projectFilter !== "all") queryParams.projectId = Number(projectFilter);

  const { data: issues, isLoading } = useListIssues(queryParams);
  const { data: projects } = useListProjects();
  const { data: members } = useListMembers();

  const createIssue = useCreateIssue();
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();

  const form = useForm<z.infer<typeof issueSchema>>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      projectId: "",
      title: "",
      description: "",
      priority: "medium",
      status: "yet_to_pick",
      assigneeId: "unassigned",
      reportedBy: "",
      dueDate: "",
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListIssuesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetProjectHealthQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetIssuePriorityBreakdownQueryKey() });
  };

  const onSubmit = (values: z.infer<typeof issueSchema>) => {
    createIssue.mutate(
      {
        data: {
          projectId: Number(values.projectId),
          title: values.title,
          description: values.description || null,
          priority: values.priority,
          status: values.status,
          assigneeId:
            values.assigneeId && values.assigneeId !== "unassigned"
              ? Number(values.assigneeId)
              : null,
          reportedBy: values.reportedBy || null,
          dueDate: values.dueDate || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Issue created" });
          setNewOpen(false);
          form.reset();
          invalidateAll();
        },
        onError: () =>
          toast({ title: "Failed to create issue", variant: "destructive" }),
      },
    );
  };

  const handleStatusChange = (issue: Issue, status: Issue["status"]) => {
    updateIssue.mutate(
      { id: issue.id, data: { status } },
      {
        onSuccess: () => invalidateAll(),
        onError: () =>
          toast({ title: "Failed to update issue", variant: "destructive" }),
      },
    );
  };

  const handlePriorityChange = (issue: Issue, priority: Issue["priority"]) => {
    updateIssue.mutate(
      { id: issue.id, data: { priority } },
      {
        onSuccess: () => invalidateAll(),
        onError: () =>
          toast({ title: "Failed to update priority", variant: "destructive" }),
      },
    );
  };

  const handleDelete = (issue: Issue) => {
    deleteIssue.mutate(
      { id: issue.id },
      {
        onSuccess: () => {
          toast({ title: "Issue deleted" });
          invalidateAll();
        },
      },
    );
  };

  const visibleIssues = (issues ?? []).filter((iss) => {
    if (statusFilter === "open_only") return !DONE_STATUSES.has(iss.status);
    return true;
  });

  const grouped: Record<string, Issue[]> = {
    critical: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const iss of visibleIssues) {
    grouped[iss.priority]!.push(iss);
  }
  for (const k of Object.keys(grouped)) {
    grouped[k]!.sort((a, b) => {
      const aDone = DONE_STATUSES.has(a.status);
      const bDone = DONE_STATUSES.has(b.status);
      if (aDone && !bDone) return 1;
      if (bDone && !aDone) return -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Issue queue</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Triaged across every project — most urgent first.
            </p>
          </div>
          <Dialog
            open={newOpen}
            onOpenChange={(v) => {
              if (!v) form.reset();
              setNewOpen(v);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> New issue
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New issue</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {projects?.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="What's the problem?" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="priority"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Priority</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {PRIORITIES.map((p) => (
                                <SelectItem key={p} value={p} className="capitalize">
                                  {p}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STATUSES.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize">
                                  {STATUS_LABELS[s]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="assigneeId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assignee</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {members?.map((m) => (
                                <SelectItem key={m.id} value={String(m.id)}>
                                  {m.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="dueDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Due date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="reportedBy"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reported by</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Client or stakeholder" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createIssue.isPending}>
                      {createIssue.isPending ? "Creating..." : "Create issue"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-3 border-border/50 bg-card/50">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open_only">Open only</SelectItem>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All priorities</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[200px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Card>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : visibleIssues.length === 0 ? (
          <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center bg-card/50">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mb-4" />
            <h3 className="text-lg font-semibold">All clear</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
              No issues match these filters. Either you're caught up or you need to log something new.
            </p>
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> New issue
            </Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {PRIORITIES.map((priority) => {
              const list = grouped[priority]!;
              if (list.length === 0) return null;
              const Icon = PRIORITY_ICON[priority]!;
              return (
                <section key={priority}>
                  <div className="flex items-center gap-2 mb-3">
                    <Icon
                      className={`w-4 h-4 ${
                        priority === "critical"
                          ? "text-destructive"
                          : priority === "high"
                            ? "text-orange-400"
                            : priority === "medium"
                              ? "text-amber-400"
                              : "text-muted-foreground"
                      }`}
                    />
                    <h2 className="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                      {priority}
                    </h2>
                    <span className="text-xs text-muted-foreground">{list.length}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((iss) => {
                      const project = projects?.find((p) => p.id === iss.projectId);
                      const assignee = members?.find((m) => m.id === iss.assigneeId);
                      return (
                        <Card
                          key={iss.id}
                          className={`p-4 border-border/50 bg-card/50 hover:bg-card transition-colors ${DONE_STATUSES.has(iss.status) ? "opacity-60" : ""}`}
                        >
                          <div className="flex items-start gap-4 flex-wrap">
                            <div className="flex-1 min-w-[260px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge
                                  variant="outline"
                                  className={`capitalize text-xs ${PRIORITY_STYLES[iss.priority]}`}
                                >
                                  {iss.priority}
                                </Badge>
                                {project && (
                                  <Link href={`/projects/${project.id}`}>
                                    <span
                                      className="text-xs px-2 py-0.5 rounded-full hover:underline cursor-pointer"
                                      style={{
                                        backgroundColor: `${project.color}22`,
                                        color: project.color,
                                      }}
                                    >
                                      {project.name}
                                    </span>
                                  </Link>
                                )}
                                <h3 className="font-medium">{iss.title}</h3>
                              </div>
                              {iss.description && (
                                <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                                  {iss.description}
                                </p>
                              )}
                              <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap items-center">
                                {iss.reportedBy && <span>Reported: {iss.reportedBy}</span>}
                                {iss.dueDate && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3" /> Due {format(parseISO(iss.dueDate.slice(0, 10)), "MMM d")}
                                  </span>
                                )}
                                {assignee && (
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-medium text-white"
                                      style={{ backgroundColor: assignee.avatarColor }}
                                    >
                                      {getInitials(assignee.name)}
                                    </span>
                                    {assignee.name}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Select
                                value={iss.priority}
                                onValueChange={(v) =>
                                  handlePriorityChange(iss, v as Issue["priority"])
                                }
                              >
                                <SelectTrigger className="h-8 w-[110px] text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {PRIORITIES.map((p) => (
                                    <SelectItem key={p} value={p} className="capitalize">
                                      {p}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Select
                                value={iss.status}
                                onValueChange={(v) =>
                                  handleStatusChange(iss, v as Issue["status"])
                                }
                              >
                                <SelectTrigger className="h-8 w-[130px] text-xs capitalize">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {STATUSES.map((s) => (
                                    <SelectItem key={s} value={s} className="capitalize">
                                      {STATUS_LABELS[s]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete issue?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently remove "{iss.title}".
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive hover:bg-destructive/90"
                                      onClick={() => handleDelete(iss)}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
