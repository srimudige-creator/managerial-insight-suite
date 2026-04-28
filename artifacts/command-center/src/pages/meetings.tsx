import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parseISO } from "date-fns";
import {
  useListMeetings,
  useListProjects,
  useCreateMeeting,
  useUpdateMeeting,
  useDeleteMeeting,
  getListMeetingsQueryKey,
  type Meeting,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  Plus,
  NotebookPen,
  Calendar,
  Users as UsersIcon,
  ListChecks,
  Pencil,
  Trash2,
  FileText,
} from "lucide-react";

const meetingSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  title: z.string().min(1, "Title is required"),
  meetingDate: z.string().min(1, "Date is required"),
  attendees: z.string().optional(),
  agenda: z.string().optional(),
  discussion: z.string().min(1, "Notes are required"),
  actionItems: z.string().optional(),
});

type MeetingFormValues = z.infer<typeof meetingSchema>;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function defaultValues(): MeetingFormValues {
  return {
    projectId: "",
    title: "",
    meetingDate: todayIso(),
    attendees: "",
    agenda: "",
    discussion: "",
    actionItems: "",
  };
}

function buildPayload(values: MeetingFormValues) {
  return {
    projectId: parseInt(values.projectId, 10),
    title: values.title,
    meetingDate: values.meetingDate,
    attendees: values.attendees?.trim() || null,
    agenda: values.agenda?.trim() || null,
    discussion: values.discussion,
    actionItems: values.actionItems?.trim() || null,
  };
}

export default function Meetings() {
  const { data: meetings, isLoading } = useListMeetings();
  const { data: projects } = useListProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMeeting = useCreateMeeting();
  const updateMeeting = useUpdateMeeting();
  const deleteMeeting = useDeleteMeeting();

  const projectMap = useMemo(() => {
    const m = new Map<number, { name: string; client: string; color: string }>();
    for (const p of projects ?? [])
      m.set(p.id, { name: p.name, client: p.client, color: p.color });
    return m;
  }, [projects]);

  const filtered = useMemo(() => {
    if (!meetings) return [];
    if (projectFilter === "all") return meetings;
    const pid = parseInt(projectFilter, 10);
    return meetings.filter((m) => m.projectId === pid);
  }, [meetings, projectFilter]);

  const createForm = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: defaultValues(),
  });

  const onCreateSubmit = (values: MeetingFormValues) => {
    createMeeting.mutate(
      { data: buildPayload(values) },
      {
        onSuccess: () => {
          toast({ title: "Meeting saved" });
          setCreateOpen(false);
          createForm.reset(defaultValues());
          queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
        },
        onError: () => toast({ title: "Failed to save meeting", variant: "destructive" }),
      },
    );
  };

  const onDelete = (id: number) => {
    deleteMeeting.mutate(
      { id },
      {
        onSuccess: () => {
          toast({ title: "Meeting removed" });
          queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
        },
      },
    );
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Minutes of meeting</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Capture ad-hoc meeting notes, decisions, and action items per project.
            </p>
          </div>

          <Dialog
            open={createOpen}
            onOpenChange={(v) => {
              if (!v) createForm.reset(defaultValues());
              setCreateOpen(v);
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> New MoM
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New meeting minutes</DialogTitle>
              </DialogHeader>
              <Form {...createForm}>
                <form
                  onSubmit={createForm.handleSubmit(onCreateSubmit)}
                  className="space-y-4"
                >
                  <MeetingFormFields form={createForm} projects={projects ?? []} />
                  <DialogFooter>
                    <Button type="submit" disabled={createMeeting.isPending}>
                      {createMeeting.isPending ? "Saving..." : "Save meeting"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-4 border-border/50 bg-card/50 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">Filter by project</span>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-9 w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All projects</SelectItem>
              {(projects ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center bg-card/50">
            <NotebookPen className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No meetings yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
              Record the next ad-hoc sync so it's searchable and shareable later.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> New MoM
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((m) => {
              const proj = projectMap.get(m.projectId);
              return (
                <Card
                  key={m.id}
                  className="p-6 border-border/50 bg-card/50 relative overflow-hidden group"
                >
                  {proj?.color && (
                    <div
                      className="absolute top-0 left-0 w-full h-1"
                      style={{ backgroundColor: proj.color }}
                    />
                  )}
                  <div className="flex items-start justify-between gap-4 flex-wrap mt-1">
                    <div className="flex-1 min-w-[260px]">
                      <h3 className="text-lg font-semibold">{m.title}</h3>
                      <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(parseISO(m.meetingDate.slice(0, 10)), "EEE, MMM d, yyyy")}
                        </span>
                        {proj && (
                          <Badge variant="outline" className="text-[10px]">
                            {proj.name}
                            {proj.client ? ` · ${proj.client}` : ""}
                          </Badge>
                        )}
                        {m.attendees && (
                          <span className="flex items-center gap-1">
                            <UsersIcon className="w-3 h-3" />
                            {m.attendees}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditing(m)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
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
                            <AlertDialogTitle>Delete this MoM?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{m.title}" will be permanently removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive hover:bg-destructive/90"
                              onClick={() => onDelete(m.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    {m.agenda && (
                      <Section icon={<FileText className="w-3 h-3" />} label="Agenda">
                        {m.agenda}
                      </Section>
                    )}
                    <Section
                      icon={<NotebookPen className="w-3 h-3" />}
                      label="Discussion"
                      full={!m.agenda && !m.actionItems}
                    >
                      {m.discussion}
                    </Section>
                    {m.actionItems && (
                      <Section
                        icon={<ListChecks className="w-3 h-3" />}
                        label="Action items"
                      >
                        {m.actionItems}
                      </Section>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit meeting minutes</DialogTitle>
            </DialogHeader>
            {editing && (
              <EditMeetingForm
                meeting={editing}
                projects={projects ?? []}
                onClose={() => setEditing(null)}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}

function Section({
  icon,
  label,
  children,
  full,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : undefined}>
      <div className="text-xs uppercase tracking-wider font-semibold text-muted-foreground mb-1.5 flex items-center gap-1.5">
        {icon} {label}
      </div>
      <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
        {children}
      </p>
    </div>
  );
}

function MeetingFormFields({
  form,
  projects,
}: {
  form: ReturnType<typeof useForm<MeetingFormValues>>;
  projects: { id: number; name: string }[];
}) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="projectId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {projects.map((p) => (
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
          name="meetingDate"
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
      </div>
      <FormField
        control={form.control}
        name="title"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Title</FormLabel>
            <FormControl>
              <Input placeholder="e.g. SSO incident triage" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="attendees"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Attendees (optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="Comma separated names"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="agenda"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Agenda (optional)</FormLabel>
            <FormControl>
              <Textarea
                rows={2}
                placeholder="What was the meeting set up to cover?"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="discussion"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Discussion / notes</FormLabel>
            <FormControl>
              <Textarea
                rows={6}
                placeholder="Key points discussed, decisions made, open questions..."
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="actionItems"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Action items (optional)</FormLabel>
            <FormControl>
              <Textarea
                rows={3}
                placeholder="Owner — task — due date"
                {...field}
                value={field.value ?? ""}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
}

function EditMeetingForm({
  meeting,
  projects,
  onClose,
}: {
  meeting: Meeting;
  projects: { id: number; name: string }[];
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMeeting = useUpdateMeeting();

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      projectId: String(meeting.projectId),
      title: meeting.title,
      meetingDate: meeting.meetingDate.slice(0, 10),
      attendees: meeting.attendees ?? "",
      agenda: meeting.agenda ?? "",
      discussion: meeting.discussion,
      actionItems: meeting.actionItems ?? "",
    },
  });

  const onSubmit = (values: MeetingFormValues) => {
    updateMeeting.mutate(
      { id: meeting.id, data: buildPayload(values) },
      {
        onSuccess: () => {
          toast({ title: "Meeting updated" });
          onClose();
          queryClient.invalidateQueries({ queryKey: getListMeetingsQueryKey() });
        },
        onError: () =>
          toast({ title: "Failed to update meeting", variant: "destructive" }),
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <MeetingFormFields form={form} projects={projects} />
        <DialogFooter>
          <Button type="submit" disabled={updateMeeting.isPending}>
            {updateMeeting.isPending ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
