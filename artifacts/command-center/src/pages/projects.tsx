import { useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  useListProjects, 
  useGetProjectHealth, 
  useCreateProject,
  getListProjectsQueryKey,
  getGetProjectHealthQueryKey,
  getGetDashboardSummaryQueryKey,
  ProjectStatus
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, FolderKanban, ArrowRight } from "lucide-react";

const projectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  client: z.string().min(1, "Client is required"),
  description: z.string().optional(),
  status: z.enum(["active", "on_hold", "completed"]),
  color: z.string().min(1, "Color is required"),
});

const COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", 
  "#ec4899", "#06b6d4", "#14b8a6", "#f97316", "#6366f1"
];

export default function Projects() {
  const { data: projects, isLoading } = useListProjects();
  const { data: health } = useGetProjectHealth();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  
  const createProject = useCreateProject();
  
  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      client: "",
      description: "",
      status: "active",
      color: COLORS[0],
    },
  });

  const onSubmit = (values: z.infer<typeof projectSchema>) => {
    createProject.mutate(
      { data: { ...values, description: values.description || null } },
      {
        onSuccess: () => {
          toast({ title: "Project created successfully" });
          setOpen(false);
          form.reset();
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetProjectHealthQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
        },
        onError: () => {
          toast({ title: "Failed to create project", variant: "destructive" });
        }
      }
    );
  };

  return (
    <Layout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1 text-sm">Manage all client projects and their current status.</p>
          </div>
          
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" /> New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Project name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="client"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Client</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Client name" />
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
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl>
                          <Textarea {...field} placeholder="Project description" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on_hold">On Hold</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="color"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Color</FormLabel>
                        <FormControl>
                          <div className="flex flex-wrap gap-2">
                            {COLORS.map(c => (
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
                    <Button type="submit" disabled={createProject.isPending}>
                      {createProject.isPending ? "Creating..." : "Create"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        ) : projects?.length === 0 ? (
          <Card className="p-12 border-dashed flex flex-col items-center justify-center text-center bg-card/50">
            <FolderKanban className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">No projects yet</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4 max-w-sm">Create your first project to start tracking issues and activities.</p>
            <Button onClick={() => setOpen(true)}>
              <Plus className="w-4 h-4 mr-2" /> Create Project
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects?.map(project => {
              const projectHealth = health?.find(h => h.projectId === project.id);
              
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="p-6 border-border/50 bg-card/50 hover:bg-card hover:border-primary/50 transition-all cursor-pointer group flex flex-col h-full relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: project.color }} />
                    <div className="flex justify-between items-start mb-4 mt-2">
                      <div>
                        <h3 className="text-lg font-semibold line-clamp-1">{project.name}</h3>
                        <p className="text-sm text-muted-foreground">{project.client}</p>
                      </div>
                      <Badge variant={
                        project.status === 'active' ? 'default' : 
                        project.status === 'completed' ? 'secondary' : 'outline'
                      } className="capitalize">
                        {project.status.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    <div className="mt-auto pt-6 flex items-center justify-between text-sm">
                      <div className="flex gap-4">
                        <div className="flex flex-col">
                          <span className="text-muted-foreground text-xs uppercase tracking-wider">Open</span>
                          <span className="font-medium">{projectHealth?.openIssues || 0}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-muted-foreground text-xs uppercase tracking-wider">Critical</span>
                          <span className={projectHealth?.criticalIssues ? "text-destructive font-medium" : "font-medium"}>
                            {projectHealth?.criticalIssues || 0}
                          </span>
                        </div>
                      </div>
                      
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <ArrowRight className="w-5 h-5 text-primary" />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
