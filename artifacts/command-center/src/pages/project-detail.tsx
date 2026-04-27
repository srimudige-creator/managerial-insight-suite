import { useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import {
  useGetProject,
  useUpdateProject,
  useDeleteProject,
  useListIssues,
  useListActivities,
  useListMembers,
  useCreateIssue,
  useUpdateIssue,
  useDeleteIssue,
  getGetProjectQueryKey,
  getListProjectsQueryKey,
  getGetProjectHealthQueryKey,
  getListIssuesQueryKey,
  getListActivitiesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetIssuePriorityBreakdownQueryKey,
  getGetRecentActivitiesQueryKey,
  type Project,
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
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Plus,
  AlertCircle,
  Calendar,
  CircleDot,
  CheckCircle2,
  Activity as ActivityIcon,
  Clock,
} from "lucide-react";

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

const STATUS_STYLES: Record<string, string> = {
  l2: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  l3: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
  wfc: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  resolved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  yet_to_pick: "bg-primary/10 text-primary border-primary/30",
  raised_cr_closed: "bg-purple-500/15 text-purple-400 border-purple-500/30",
};

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

const PROJECT_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#14b8a6", "#f97316", "#6366f1",
];

const projectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  client: z.string().min(1, "Client is required"),
  description: z.string().optional(),
  status: z.enum(["active", "on_hold", "completed"]),
  color: z.string().min(1),
});

const issueSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  priority: z.enum(["critical", "high", "medium", "low"]),
  status: z.enum(["l2", "l3", "wfc", "resolved", "yet_to_pick", "raised_cr_closed"]),
  assigneeId: z.string().optional(),
  reportedBy: z.string().optional(),
  dueDate: z.string().optional(),
});

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: getListIssuesQueryKey() });
  qc.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
  qc.invalidateQueries({ queryKey: getGetProjectHealthQueryKey() });
  qc.invalidateQueries({ queryKey: getGetIssuePriorityBreakdownQueryKey() });
}

export default function ProjectDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: project, isLoading: loadingProject } = useGetProject(id, {
    query: { enabled: !!id, queryKey: getGetProjectQueryKey(id) },
  });
  const { data: issues, isLoading: loadingIssues } = useListIssues({ projectId: id });
  const { data: activities } = useListActivities({ projectId: id });
  const { data: members } = useListMembers();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [editOpen, setEditOpen] = useState(false);
  const [newIssueOpen, setNewIssueOpen] = useState(false);

  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createIssue = useCreateIssue();
  const updateIssue = useUpdateIssue();
  const deleteIssue = useDeleteIssue();

  const editForm = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      client: "",
      description: "",
      status: "active",
      color: PROJECT_COLORS[0],
    },
  });

  const issueForm = useForm<z.infer<typeof issueSchema>>({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
      status: "open",
      assigneeId: "unassigned",
      reportedBy: "",
      dueDate: "",
    },
  });

  const openEditDialog = () => {
    if (!project) return;
    editForm.reset({
      name: project.name,
      client: project.client,
      description: project.description ?? "",
      status: project.status,
      color: project.color,
    });
    setEditOpen(true);
  };

  const filteredIssues = (issues ?? []).filter((iss) => {
    if (statusFilter !== "all" && iss.status !== statusFilter) return false;
    if (priorityFilter !== "all" && iss.priority !== priorityFilter) return false;
    return true;
  });

  const sortedIssues = [...filteredIssues].sort((a, b) => {
    const pri = PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
    if (pri !== 0) return pri;
    if (a.status === "resolved" && b.status !== "resolved") return 1;
    if (b.status === "resolved" && a.status !== "resolved") return -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const groupedActivities = (activities ?? []).reduce<Record<string, typeof activities>>(
    (acc, a) => {
      const k = a.activityDate;
      acc[k] = acc[k] ?? [];
      acc[k]!.push(a);
      return acc;
    },
    {} as Record<string, typeof activities>,
  );
  const activityDays = Object.keys(groupedActivities).sort((a, b) => (a < b ? 1 : -1));

  if (loadingProject) {
    return (
      <Layout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </Layout>
    );
  }

  if (!project) {
    return (
      <Layout>
        <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center bg-card/50">
          <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Project not found</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            This project may have been removed.
          </p>
          <Link href="/projects">
            <Button variant="outline">Back to projects</Button>
          </Link>
        </Card>
      </Layout>
    );
  }

  const onSaveEdit = (values: z.infer<typeof projectSchema>) => {
    updateProject.mutate(
      {
        id,
        data: {
          ...values,
          description: values.description || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Project updated" });
          setEditOpen(false);
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(id) });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProjectHealthQueryKey() });
        },
        onError: () =>
          toast({ title: "Failed to update project", variant: "destructive" }),
      },
    );
  };

  const onDeleteProject = () => {
    deleteProject.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Project deleted" });
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProjectHealthQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setLocation("/projects");
        },
        onError: () =>
          toast({ title: "Failed to delete project", variant: "destructive" }),
      },
    );
  };

  const onCreateIssue = (values: z.infer<typeof issueSchema>) => {
    createIssue.mutate(
      {
        data: {
          projectId: id,
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
          setNewIssueOpen(false);
          issueForm.reset();
          invalidateAll(queryClient);
        },
        onError: () =>
          toast({ title: "Failed to create issue", variant: "destructive" }),
      },
    );
  };

  const handleInlineUpdate = (issue: Issue, patch: Partial<Issue>) => {
    updateIssue.mutate(
      { id: issue.id, data: patch as Record<string, unknown> },
      {
        onSuccess: () => invalidateAll(queryClient),
        onError: () =>
          toast({ title: "Failed to update issue", variant: "destructive" }),
      },
    );
  };

  const handleDeleteIssue = (issue: Issue) => {
    deleteIssue.mutate(
      { id: issue.id },
      {
        onSuccess: () => {
          toast({ title: "Issue deleted" });
          invalidateAll(queryClient);
          queryClient.invalidateQueries({ queryKey: getGetRecentActivitiesQueryKey() });
        },
      },
    );
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="-ml-2 mb-4 text-muted-foreground">
              <ArrowLeft className="w-4 h-4 mr-2" /> All projects
            </Button>
          </Link>
          <Card className="p-6 border-border/50 bg-card/50 relative overflow-hidden">
            <div
              className="absolute top-0 left-0 w-full h-1"
              style={{ backgroundColor: project.color }}
            />
            <div className="flex justify-between items-start gap-6 mt-2">
              <div className="flex-1">
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
                  <Badge
                    variant={
                      project.status === "active"
                        ? "default"
                        : project.status === "completed"
                          ? "secondary"
                          : "outline"
                    }
                    className="capitalize"
                  >
                    {project.status.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{project.client}</p>
                {project.description && (
                  <p className="text-sm mt-3 text-foreground/90 max-w-3xl leading-relaxed">
                    {project.description}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={openEditDialog}>
                  <Pencil className="w-4 h-4 mr-2" /> Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete project?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete {project.name}. Issues and activities
                        linked to this project will remain but lose their project reference.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive hover:bg-destructive/90"
                        onClick={onDeleteProject}
                      >
                        {deleteProject.isPending ? "Deleting..." : "Delete project"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </Card>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Issues</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredIssues.length} of {issues?.length ?? 0} shown
              </p>
            </div>
            <div className="flex gap-2 items-center flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Priority" />
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
              <Dialog
                open={newIssueOpen}
                onOpenChange={(v) => {
                  if (!v) issueForm.reset();
                  setNewIssueOpen(v);
                }}
              >
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" /> New issue
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New issue</DialogTitle>
                  </DialogHeader>
                  <Form {...issueForm}>
                    <form
                      onSubmit={issueForm.handleSubmit(onCreateIssue)}
                      className="space-y-4"
                    >
                      <FormField
                        control={issueForm.control}
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
                        control={issueForm.control}
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
                          control={issueForm.control}
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
                          control={issueForm.control}
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
                          control={issueForm.control}
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
                          control={issueForm.control}
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
                        control={issueForm.control}
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
          </div>

          {loadingIssues ? (
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          ) : sortedIssues.length === 0 ? (
            <Card className="p-10 border-dashed flex flex-col items-center justify-center text-center bg-card/50">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="font-semibold">No issues match these filters</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Adjust the filters or log a new issue.
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {sortedIssues.map((iss) => (
                <Card
                  key={iss.id}
                  className="p-4 border-border/50 bg-card/50 hover:bg-card transition-colors"
                >
                  <div className="flex items-start gap-4 flex-wrap">
                    <div className="flex-1 min-w-[240px]">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`capitalize text-xs ${PRIORITY_STYLES[iss.priority]}`}
                        >
                          {iss.priority}
                        </Badge>
                        <h3 className="font-medium">{iss.title}</h3>
                      </div>
                      {iss.description && (
                        <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2">
                          {iss.description}
                        </p>
                      )}
                      <div className="flex gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                        {iss.reportedBy && <span>Reported: {iss.reportedBy}</span>}
                        {iss.dueDate && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Due {format(parseISO(iss.dueDate.slice(0, 10)), "MMM d")}
                          </span>
                        )}
                        {iss.assigneeId && (
                          <span>
                            Assigned:{" "}
                            {members?.find((m) => m.id === iss.assigneeId)?.name ?? "—"}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select
                        value={iss.priority}
                        onValueChange={(v) => handleInlineUpdate(iss, { priority: v as Issue["priority"] })}
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
                        onValueChange={(v) => handleInlineUpdate(iss, { status: v as Issue["status"] })}
                      >
                        <SelectTrigger className={`h-8 w-[130px] text-xs capitalize`}>
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
                              onClick={() => handleDeleteIssue(iss)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold tracking-tight">Activity log</h2>
          {activityDays.length === 0 ? (
            <Card className="p-10 border-dashed flex flex-col items-center justify-center text-center bg-card/50">
              <ActivityIcon className="w-10 h-10 text-muted-foreground mb-3" />
              <h3 className="font-semibold">Nothing logged here yet</h3>
              <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
                Daily activities you log against this project will appear here.
              </p>
              <Link href="/activities">
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" /> Log activity
                </Button>
              </Link>
            </Card>
          ) : (
            <div className="space-y-6">
              {activityDays.map((day) => (
                <div key={day}>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">
                    {format(parseISO(day), "EEEE, MMM d")}
                  </div>
                  <div className="space-y-2">
                    {groupedActivities[day]!.map((a) => (
                      <Card
                        key={a.id}
                        className="p-4 border-border/50 bg-card/50 flex items-start gap-4"
                      >
                        <CircleDot className="w-4 h-4 mt-1 text-primary" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="secondary" className="text-xs">
                              {CATEGORY_LABELS[a.category]}
                            </Badge>
                            <span className="font-medium text-sm">{a.title}</span>
                          </div>
                          {a.notes && (
                            <p className="text-sm text-muted-foreground mt-1.5">
                              {a.notes}
                            </p>
                          )}
                        </div>
                        {a.durationMinutes != null && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="w-3 h-3" /> {a.durationMinutes}m
                          </span>
                        )}
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onSaveEdit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="client"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
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
              <FormField
                control={editForm.control}
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
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="on_hold">On hold</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="color"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <div className="flex flex-wrap gap-2">
                        {PROJECT_COLORS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            className={`w-8 h-8 rounded-full border-2 ${field.value === c ? "border-primary" : "border-transparent"}`}
                            style={{ backgroundColor: c }}
                            onClick={() => field.onChange(c)}
                          />
                        ))}
                      </div>
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateProject.isPending}>
                  {updateProject.isPending ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
