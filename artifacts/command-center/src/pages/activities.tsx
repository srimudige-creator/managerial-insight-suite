import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import {
  useListActivities,
  useListProjects,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
  getListActivitiesQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetRecentActivitiesQueryKey,
  type Activity,
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
import { Plus, Activity as ActivityIcon, Clock, Pencil, Trash2 } from "lucide-react";

const CATEGORIES = [
  "client_call",
  "code_review",
  "planning",
  "one_on_one",
  "support",
  "deployment",
  "documentation",
  "other",
] as const;

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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatMinutes(min: number | null | undefined) {
  if (min == null) return null;
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

const activitySchema = z.object({
  category: z.enum(CATEGORIES),
  title: z.string().min(1, "Title is required"),
  projectId: z.string().optional(),
  activityDate: z.string().min(1),
  durationMinutes: z.string().optional(),
  notes: z.string().optional(),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

export default function Activities() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [dateFilter, setDateFilter] = useState<string>("");
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const queryParams: Record<string, unknown> = {};
  if (dateFilter) queryParams.date = dateFilter;
  if (projectFilter !== "all") queryParams.projectId = Number(projectFilter);

  const { data: activities, isLoading } = useListActivities(queryParams);
  const { data: projects } = useListProjects();

  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      category: "other",
      title: "",
      projectId: "none",
      activityDate: todayIso(),
      durationMinutes: "",
      notes: "",
    },
  });

  const editForm = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      category: "other",
      title: "",
      projectId: "none",
      activityDate: todayIso(),
      durationMinutes: "",
      notes: "",
    },
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: getListActivitiesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetRecentActivitiesQueryKey() });
  };

  const onCreate = (values: ActivityFormValues) => {
    createActivity.mutate(
      {
        data: {
          category: values.category,
          title: values.title,
          projectId:
            values.projectId && values.projectId !== "none"
              ? Number(values.projectId)
              : null,
          activityDate: values.activityDate,
          durationMinutes: values.durationMinutes
            ? Number(values.durationMinutes)
            : null,
          notes: values.notes || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Activity logged" });
          setCreateOpen(false);
          form.reset({
            category: "other",
            title: "",
            projectId: "none",
            activityDate: todayIso(),
            durationMinutes: "",
            notes: "",
          });
          invalidateAll();
        },
        onError: () =>
          toast({ title: "Failed to log activity", variant: "destructive" }),
      },
    );
  };

  const startEdit = (a: Activity) => {
    editForm.reset({
      category: a.category,
      title: a.title,
      projectId: a.projectId == null ? "none" : String(a.projectId),
      activityDate: a.activityDate,
      durationMinutes: a.durationMinutes != null ? String(a.durationMinutes) : "",
      notes: a.notes ?? "",
    });
    setEditingId(a.id);
  };

  const onEdit = (values: ActivityFormValues) => {
    if (editingId == null) return;
    updateActivity.mutate(
      {
        id: editingId,
        data: {
          category: values.category,
          title: values.title,
          projectId:
            values.projectId && values.projectId !== "none"
              ? Number(values.projectId)
              : null,
          activityDate: values.activityDate,
          durationMinutes: values.durationMinutes
            ? Number(values.durationMinutes)
            : null,
          notes: values.notes || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Activity updated" });
          setEditingId(null);
          invalidateAll();
        },
        onError: () =>
          toast({ title: "Failed to update activity", variant: "destructive" }),
      },
    );
  };

  const onDelete = (id: number) => {
    deleteActivity.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Activity deleted" });
          invalidateAll();
        },
      },
    );
  };

  const grouped = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const a of activities ?? []) {
      const list = map.get(a.activityDate) ?? [];
      list.push(a);
      map.set(a.activityDate, list);
    }
    return Array.from(map.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [activities]);

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Activity log</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Track your daily contributions across every project.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Log activity
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Log activity</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onCreate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {CATEGORIES.map((c) => (
                              <SelectItem key={c} value={c}>
                                {CATEGORY_LABELS[c]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
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
                          <Input {...field} placeholder="What did you work on?" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="projectId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Project</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">No specific project</SelectItem>
                            {projects?.map((p) => (
                              <SelectItem key={p.id} value={String(p.id)}>
                                {p.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="activityDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Date</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="durationMinutes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duration (minutes)</FormLabel>
                          <FormControl>
                            <Input type="number" min="0" {...field} />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Notes</FormLabel>
                        <FormControl>
                          <Textarea {...field} rows={3} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createActivity.isPending}>
                      {createActivity.isPending ? "Saving..." : "Save entry"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-3 border-border/50 bg-card/50">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Date</span>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="h-9 w-[170px]"
              />
              {dateFilter && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateFilter("")}
                  className="h-8 text-xs"
                >
                  Clear
                </Button>
              )}
            </div>
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
            <Skeleton className="h-32 rounded-xl" />
            <Skeleton className="h-32 rounded-xl" />
          </div>
        ) : grouped.length === 0 ? (
          <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center bg-card/50">
            <ActivityIcon className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Nothing logged yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
              Log your first activity to start tracking your daily contributions.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Log activity
            </Button>
          </Card>
        ) : (
          <div className="space-y-8">
            {grouped.map(([day, list]) => {
              const totalMinutes = list.reduce(
                (sum, a) => sum + (a.durationMinutes ?? 0),
                0,
              );
              return (
                <section key={day}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm uppercase tracking-wider font-semibold text-muted-foreground">
                        {format(parseISO(day), "EEEE, MMMM d")}
                      </h2>
                    </div>
                    {totalMinutes > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {formatMinutes(totalMinutes)} logged
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {list.map((a) => {
                      const project = projects?.find((p) => p.id === a.projectId);
                      return (
                        <Card
                          key={a.id}
                          className="p-4 border-border/50 bg-card/50 hover:bg-card transition-colors group"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  {CATEGORY_LABELS[a.category]}
                                </Badge>
                                {project && (
                                  <span
                                    className="text-xs px-2 py-0.5 rounded-full"
                                    style={{
                                      backgroundColor: `${project.color}22`,
                                      color: project.color,
                                    }}
                                  >
                                    {project.name}
                                  </span>
                                )}
                                <span className="font-medium text-sm">{a.title}</span>
                              </div>
                              {a.notes && (
                                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                                  {a.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {a.durationMinutes != null && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" />{" "}
                                  {formatMinutes(a.durationMinutes)}
                                </span>
                              )}
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-muted-foreground"
                                  onClick={() => startEdit(a)}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will permanently delete this activity entry.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive hover:bg-destructive/90"
                                        onClick={() => onDelete(a.id)}
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
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

      <Dialog open={editingId != null} onOpenChange={(v) => !v && setEditingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit activity</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEdit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {CATEGORY_LABELS[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No specific project</SelectItem>
                        {projects?.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={editForm.control}
                  name="activityDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={editForm.control}
                  name="durationMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Duration (minutes)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={editForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="submit" disabled={updateActivity.isPending}>
                  {updateActivity.isPending ? "Saving..." : "Save changes"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
