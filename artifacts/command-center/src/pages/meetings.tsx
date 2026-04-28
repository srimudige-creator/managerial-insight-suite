import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
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
  Pencil,
  Trash2,
  X,
  Copy,
  Search,
} from "lucide-react";

const actionItemSchema = z.object({
  description: z.string().min(1, "Required"),
  actionOn: z.string().default(""),
  eta: z.string().default(""),
  remarks: z.string().default(""),
});

const meetingSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  title: z.string().min(1, "Title is required"),
  meetingDate: z.string().min(1, "Date is required"),
  meetingTime: z.string().optional(),
  location: z.string().optional(),
  clientParticipants: z.string().optional(),
  internalParticipants: z.string().optional(),
  agenda: z.string().optional(),
  discussion: z.string().optional(),
  actionItems: z.array(actionItemSchema).default([]),
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
    meetingTime: "",
    location: "",
    clientParticipants: "",
    internalParticipants: "",
    agenda: "",
    discussion: "",
    actionItems: [{ description: "", actionOn: "", eta: "", remarks: "" }],
  };
}

function buildPayload(values: MeetingFormValues) {
  return {
    projectId: parseInt(values.projectId, 10),
    title: values.title,
    meetingDate: values.meetingDate,
    meetingTime: values.meetingTime?.trim() || null,
    location: values.location?.trim() || null,
    clientParticipants: values.clientParticipants?.trim() || null,
    internalParticipants: values.internalParticipants?.trim() || null,
    agenda: values.agenda?.trim() || null,
    discussion: values.discussion?.trim() || null,
    actionItems: values.actionItems.filter((a) => a.description.trim().length > 0),
  };
}

export default function Meetings() {
  const { data: meetings, isLoading } = useListMeetings();
  const { data: projects } = useListProjects();
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createMeeting = useCreateMeeting();
  const deleteMeeting = useDeleteMeeting();

  const projectMap = useMemo(() => {
    const m = new Map<number, { name: string; client: string; color: string }>();
    for (const p of projects ?? [])
      m.set(p.id, { name: p.name, client: p.client, color: p.color });
    return m;
  }, [projects]);

  const filtered = useMemo(() => {
    if (!meetings) return [];
    let list = meetings;
    if (projectFilter !== "all") {
      const pid = parseInt(projectFilter, 10);
      list = list.filter((m) => m.projectId === pid);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((m) => {
        const projectName = projectMap.get(m.projectId)?.name ?? "";
        const projectClient = projectMap.get(m.projectId)?.client ?? "";
        const haystacks: string[] = [
          m.title,
          projectName,
          projectClient,
          m.location ?? "",
          m.clientParticipants ?? "",
          m.internalParticipants ?? "",
          m.agenda ?? "",
          m.discussion ?? "",
          ...m.actionItems.flatMap((a) => [
            a.description,
            a.actionOn,
            a.eta,
            a.remarks,
          ]),
        ];
        return haystacks.some((h) => h.toLowerCase().includes(q));
      });
    }
    return list;
  }, [meetings, projectFilter, searchQuery, projectMap]);

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
              Capture meeting summaries with participants, action owners, and ETAs.
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
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search title, participants, action items..."
              className="pl-9 h-9"
            />
          </div>
          <span className="text-xs text-muted-foreground">Project</span>
          <Select value={projectFilter} onValueChange={setProjectFilter}>
            <SelectTrigger className="h-9 w-[200px]">
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
          {(searchQuery || projectFilter !== "all") && meetings && (
            <span className="text-xs text-muted-foreground ml-auto">
              {filtered.length} of {meetings.length}
            </span>
          )}
        </Card>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center bg-card/50">
            <NotebookPen className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No meetings yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">
              Record the next sync so it's searchable and shareable later.
            </p>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> New MoM
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {filtered.map((m) => (
              <MeetingSummaryCard
                key={m.id}
                meeting={m}
                projectName={projectMap.get(m.projectId)?.name}
                projectClient={projectMap.get(m.projectId)?.client}
                onEdit={() => setEditing(m)}
                onDelete={() => onDelete(m.id)}
              />
            ))}
          </div>
        )}

        <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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

function buildPlainText(
  meeting: Meeting,
  dateTimeLabel: string,
  projectName?: string,
  projectClient?: string,
): string {
  const lines: string[] = [];
  lines.push("Meeting Action Summary");
  lines.push("======================");
  lines.push("");
  lines.push(`Title       : ${meeting.title}`);
  if (projectName) {
    lines.push(
      `Project     : ${projectName}${projectClient ? ` (${projectClient})` : ""}`,
    );
  }
  lines.push(`Date & Time : ${dateTimeLabel}`);
  lines.push(`Location    : ${meeting.location || "-"}`);
  if (meeting.clientParticipants || meeting.internalParticipants) {
    const parts: string[] = [];
    if (meeting.clientParticipants) parts.push(meeting.clientParticipants);
    if (meeting.internalParticipants) parts.push(meeting.internalParticipants);
    parts.forEach((p, i) => {
      lines.push(i === 0 ? `Participants: ${p}` : `              ${p}`);
    });
  }
  lines.push("");
  lines.push("Action Items");
  lines.push("------------");
  if (meeting.actionItems.length === 0) {
    lines.push("(none)");
  } else {
    meeting.actionItems.forEach((item, idx) => {
      lines.push(`${idx + 1}. Description : ${item.description}`);
      lines.push(`   Action On   : ${item.actionOn || "-"}`);
      lines.push(`   ETA         : ${item.eta || "-"}`);
      lines.push(`   Remarks     : ${item.remarks || "-"}`);
      lines.push("");
    });
  }
  if (meeting.agenda) {
    lines.push("Agenda");
    lines.push("------");
    lines.push(meeting.agenda);
    lines.push("");
  }
  if (meeting.discussion) {
    lines.push("Discussion notes");
    lines.push("----------------");
    lines.push(meeting.discussion);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function MeetingSummaryCard({
  meeting,
  projectName,
  projectClient,
  onEdit,
  onDelete,
}: {
  meeting: Meeting;
  projectName?: string;
  projectClient?: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { toast } = useToast();
  const dateLabel = format(parseISO(meeting.meetingDate.slice(0, 10)), "d-MMM-yyyy");
  const dateTimeLabel = meeting.meetingTime
    ? `${dateLabel} ${meeting.meetingTime}`
    : dateLabel;

  const handleCopy = async () => {
    const text = buildPlainText(meeting, dateTimeLabel, projectName, projectClient);
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied to clipboard" });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  return (
    <Card className="overflow-hidden border-border/60 bg-card/70 group">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-muted/30">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold">{meeting.title}</h3>
          {projectName && (
            <Badge variant="outline" className="text-[10px]">
              {projectName}
              {projectClient ? ` · ${projectClient}` : ""}
            </Badge>
          )}
        </div>
        <div className="flex gap-1 items-center">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleCopy}
          >
            <Copy className="w-3 h-3 mr-1.5" /> Copy as text
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={onEdit}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this MoM?</AlertDialogTitle>
                <AlertDialogDescription>
                  "{meeting.title}" will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive hover:bg-destructive/90"
                  onClick={onDelete}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th
                colSpan={5}
                className="bg-[#a01818] text-white font-semibold text-center py-2 px-3 text-xs uppercase tracking-wider"
              >
                Meeting Action Summary
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="bg-[#a01818] text-white font-medium px-3 py-2 w-[140px] border border-border/40">
                Date &amp; Time
              </td>
              <td className="px-3 py-2 border border-border/40 text-center" colSpan={4}>
                {dateTimeLabel}
              </td>
            </tr>
            <tr>
              <td className="bg-[#a01818] text-white font-medium px-3 py-2 border border-border/40">
                Location
              </td>
              <td className="px-3 py-2 border border-border/40 text-center" colSpan={4}>
                {meeting.location || "-"}
              </td>
            </tr>
            <tr>
              <td
                rowSpan={meeting.internalParticipants ? 2 : 1}
                className="bg-[#a01818] text-white font-medium px-3 py-2 border border-border/40 align-middle"
              >
                Participants
              </td>
              <td className="px-3 py-2 border border-border/40 text-center" colSpan={4}>
                {meeting.clientParticipants || "-"}
              </td>
            </tr>
            {meeting.internalParticipants && (
              <tr>
                <td className="px-3 py-2 border border-border/40 text-center" colSpan={4}>
                  {meeting.internalParticipants}
                </td>
              </tr>
            )}

            <tr className="bg-[#a01818] text-white">
              <th className="px-3 py-2 border border-[#7a1212] text-xs uppercase tracking-wider w-[60px] text-center">
                SL No
              </th>
              <th className="px-3 py-2 border border-[#7a1212] text-xs uppercase tracking-wider w-[200px] text-center">
                Description
              </th>
              <th className="px-3 py-2 border border-[#7a1212] text-xs uppercase tracking-wider w-[140px] text-center">
                Action On
              </th>
              <th className="px-3 py-2 border border-[#7a1212] text-xs uppercase tracking-wider w-[100px] text-center">
                ETA
              </th>
              <th className="px-3 py-2 border border-[#7a1212] text-xs uppercase tracking-wider text-center">
                Remarks
              </th>
            </tr>
            {meeting.actionItems.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-6 border border-border/40 text-center text-muted-foreground italic"
                >
                  No action items recorded.
                </td>
              </tr>
            ) : (
              meeting.actionItems.map((item, idx) => (
                <tr key={idx}>
                  <td className="px-3 py-2 border border-border/40 text-center align-top">
                    {idx + 1}
                  </td>
                  <td className="px-3 py-2 border border-border/40 align-top whitespace-pre-wrap">
                    {item.description}
                  </td>
                  <td className="px-3 py-2 border border-border/40 align-top whitespace-pre-wrap">
                    {item.actionOn || "-"}
                  </td>
                  <td className="px-3 py-2 border border-border/40 align-top whitespace-pre-wrap">
                    {item.eta || "-"}
                  </td>
                  <td className="px-3 py-2 border border-border/40 align-top whitespace-pre-wrap">
                    {item.remarks || "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {(meeting.agenda || meeting.discussion) && (
        <div className="px-4 py-3 border-t border-border/40 bg-muted/20 grid gap-3 md:grid-cols-2">
          {meeting.agenda && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                Agenda
              </div>
              <p className="text-xs whitespace-pre-wrap text-foreground/90">
                {meeting.agenda}
              </p>
            </div>
          )}
          {meeting.discussion && (
            <div>
              <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-1">
                Discussion notes
              </div>
              <p className="text-xs whitespace-pre-wrap text-foreground/90">
                {meeting.discussion}
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function MeetingFormFields({
  form,
  projects,
}: {
  form: ReturnType<typeof useForm<MeetingFormValues>>;
  projects: { id: number; name: string }[];
}) {
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "actionItems",
  });

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
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Weekly call with Ooredoo Qatar" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
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
        <FormField
          control={form.control}
          name="meetingTime"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Time (optional)</FormLabel>
              <FormControl>
                <Input
                  placeholder="09:30 AM Qatar time"
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
          name="location"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Location</FormLabel>
              <FormControl>
                <Input
                  placeholder="Microsoft Teams"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="clientParticipants"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Client participants</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Ooredoo Qatar: Ahmed Ghamal, Satha"
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
          name="internalParticipants"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Internal participants</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Subex: Pradeep Iyer, Shashi & Srinivas"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <FormLabel className="text-sm">Action items</FormLabel>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              append({ description: "", actionOn: "", eta: "", remarks: "" })
            }
          >
            <Plus className="w-3.5 h-3.5 mr-1" /> Add row
          </Button>
        </div>
        <div className="border border-border/60 rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-2 py-1.5 w-8 text-center">#</th>
                <th className="px-2 py-1.5 text-left">Description</th>
                <th className="px-2 py-1.5 text-left w-[140px]">Action On</th>
                <th className="px-2 py-1.5 text-left w-[110px]">ETA</th>
                <th className="px-2 py-1.5 text-left">Remarks</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {fields.map((f, idx) => (
                <tr key={f.id} className="border-t border-border/40 align-top">
                  <td className="px-2 py-1.5 text-center text-muted-foreground">
                    {idx + 1}
                  </td>
                  <td className="px-1 py-1">
                    <FormField
                      control={form.control}
                      name={`actionItems.${idx}.description` as const}
                      render={({ field }) => (
                        <Textarea rows={2} className="text-xs" {...field} />
                      )}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <FormField
                      control={form.control}
                      name={`actionItems.${idx}.actionOn` as const}
                      render={({ field }) => (
                        <Input className="h-8 text-xs" {...field} />
                      )}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <FormField
                      control={form.control}
                      name={`actionItems.${idx}.eta` as const}
                      render={({ field }) => (
                        <Input
                          className="h-8 text-xs"
                          placeholder="29-Apr-26"
                          {...field}
                        />
                      )}
                    />
                  </td>
                  <td className="px-1 py-1">
                    <FormField
                      control={form.control}
                      name={`actionItems.${idx}.remarks` as const}
                      render={({ field }) => (
                        <Textarea rows={2} className="text-xs" {...field} />
                      )}
                    />
                  </td>
                  <td className="px-1 py-1 align-middle">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => remove(idx)}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Empty rows are skipped on save.
        </p>
      </div>

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
            <FormLabel>Discussion notes (optional)</FormLabel>
            <FormControl>
              <Textarea
                rows={4}
                placeholder="Free-form notes that didn't fit the action table"
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
      meetingTime: meeting.meetingTime ?? "",
      location: meeting.location ?? "",
      clientParticipants: meeting.clientParticipants ?? "",
      internalParticipants: meeting.internalParticipants ?? "",
      agenda: meeting.agenda ?? "",
      discussion: meeting.discussion ?? "",
      actionItems:
        meeting.actionItems.length > 0
          ? meeting.actionItems
          : [{ description: "", actionOn: "", eta: "", remarks: "" }],
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
