import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useListMembers, 
  useListIssues,
  useCreateMember,
  useUpdateMember,
  useDeleteMember,
  getListMembersQueryKey,
  getListIssuesQueryKey,
  getGetDashboardSummaryQueryKey
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Plus, Users, Pencil, Trash2, Mail } from "lucide-react";

const memberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  role: z.string().min(1, "Role is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  avatarColor: z.string().min(1, "Avatar color is required"),
});

const AVATAR_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", 
  "#ec4899", "#06b6d4", "#14b8a6", "#f97316", "#6366f1"
];

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

export default function Team() {
  const { data: members, isLoading } = useListMembers();
  const { data: issues } = useListIssues();
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createMember = useCreateMember();
  const updateMember = useUpdateMember();
  const deleteMember = useDeleteMember();
  
  const form = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: "",
      role: "",
      email: "",
      avatarColor: AVATAR_COLORS[0],
    },
  });

  const onSubmitCreate = (values: z.infer<typeof memberSchema>) => {
    createMember.mutate(
      { data: { ...values, email: values.email || null } },
      {
        onSuccess: () => {
          toast({ title: "Member added successfully" });
          setOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to add member", variant: "destructive" });
        }
      }
    );
  };

  const getEditForm = (memberId: number) => {
    const member = members?.find(m => m.id === memberId);
    if (!member) return null;
    
    return <EditMemberForm member={member} onClose={() => setEditOpen(null)} />;
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Team</h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage team members and their roles.</p>
          </div>
          
          <Dialog open={open} onOpenChange={(val) => {
            if (!val) form.reset();
            setOpen(val);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Team Member</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmitCreate)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="John Doe" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Role</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Frontend Developer" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email (Optional)</FormLabel>
                        <FormControl>
                          <Input {...field} type="email" placeholder="john@example.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="avatarColor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Avatar Color</FormLabel>
                        <FormControl>
                          <div className="flex flex-wrap gap-2">
                            {AVATAR_COLORS.map(c => (
                              <button
                                key={c}
                                type="button"
                                className={`w-8 h-8 rounded-full border-2 ${field.value === c ? 'border-primary' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                                onClick={() => field.onChange(c)}
                              />
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="submit" disabled={createMember.isPending}>
                      {createMember.isPending ? "Adding..." : "Add Member"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : members?.length === 0 ? (
          <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center bg-card/50">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No team members</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">Add team members to assign them to issues.</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Add Member
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {members?.map(member => {
              const openIssuesAssigned = issues?.filter(i => i.assigneeId === member.id && i.status !== 'resolved').length || 0;
              
              return (
                <Card key={member.id} className="p-6 border-border/50 bg-card/50 hover:bg-card transition-all flex flex-col relative group">
                  <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Dialog open={editOpen === member.id} onOpenChange={(val) => setEditOpen(val ? member.id : null)}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Edit Member</DialogTitle>
                        </DialogHeader>
                        {getEditForm(member.id)}
                      </DialogContent>
                    </Dialog>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove member?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone. This will permanently remove {member.name} from the team.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive hover:bg-destructive/90"
                            onClick={() => {
                              deleteMember.mutate({ id: member.id }, {
                                onSuccess: () => {
                                  toast({ title: "Member removed" });
                                  queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
                                  queryClient.invalidateQueries({ queryKey: getListIssuesQueryKey() });
                                  queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
                                }
                              });
                            }}
                          >
                            {deleteMember.isPending ? "Removing..." : "Remove"}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  
                  <div className="flex flex-col items-center text-center mt-2 mb-6">
                    <Avatar className="w-20 h-20 mb-4 border-4 border-background shadow-sm">
                      <AvatarFallback style={{ backgroundColor: member.avatarColor, color: '#fff' }} className="text-2xl font-medium">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <h3 className="font-semibold text-lg">{member.name}</h3>
                    <p className="text-sm text-muted-foreground">{member.role}</p>
                    
                    {member.email && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-2">
                        <Mail className="w-3 h-3" />
                        <a href={`mailto:${member.email}`} className="hover:underline">{member.email}</a>
                      </div>
                    )}
                  </div>
                  
                  <div className="mt-auto pt-4 border-t border-border/50 text-center">
                    <div className="text-sm">
                      <span className="font-medium text-foreground">{openIssuesAssigned}</span>
                      <span className="text-muted-foreground ml-1">open issues assigned</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}

function EditMemberForm({ member, onClose }: { member: any, onClose: () => void }) {
  const updateMember = useUpdateMember();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const form = useForm<z.infer<typeof memberSchema>>({
    resolver: zodResolver(memberSchema),
    defaultValues: {
      name: member.name,
      role: member.role,
      email: member.email || "",
      avatarColor: member.avatarColor,
    },
  });

  const onSubmit = (values: z.infer<typeof memberSchema>) => {
    updateMember.mutate(
      { id: member.id, data: { ...values, email: values.email || null } },
      {
        onSuccess: () => {
          toast({ title: "Member updated" });
          onClose();
          queryClient.invalidateQueries({ queryKey: getListMembersQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to update member", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
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
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input {...field} type="email" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="avatarColor"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Avatar Color</FormLabel>
              <FormControl>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      className={`w-8 h-8 rounded-full border-2 ${field.value === c ? 'border-primary' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                      onClick={() => field.onChange(c)}
                    />
                  ))}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="submit" disabled={updateMember.isPending}>
            {updateMember.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}
