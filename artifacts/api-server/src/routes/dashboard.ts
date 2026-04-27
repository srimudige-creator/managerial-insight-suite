import { Router, type IRouter } from "express";
import { sql, eq, and, gte, ne } from "drizzle-orm";
import {
  db,
  projectsTable,
  membersTable,
  issuesTable,
  activitiesTable,
} from "@workspace/db";
import {
  GetDashboardSummaryResponse,
  GetIssuePriorityBreakdownResponse,
  GetProjectHealthResponse,
  GetRecentActivitiesQueryParams,
  GetRecentActivitiesResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekAgoStr = weekAgo.toISOString().slice(0, 10);

  const [{ activeProjects, totalProjects }] = await db
    .select({
      activeProjects: sql<number>`cast(count(*) filter (where ${projectsTable.status} = 'active') as int)`,
      totalProjects: sql<number>`cast(count(*) as int)`,
    })
    .from(projectsTable);

  const [{ teamSize }] = await db
    .select({ teamSize: sql<number>`cast(count(*) as int)` })
    .from(membersTable);

  const [{ openIssues, criticalIssues, resolvedThisWeek }] = await db
    .select({
      openIssues: sql<number>`cast(count(*) filter (where ${issuesTable.status} <> 'resolved') as int)`,
      criticalIssues: sql<number>`cast(count(*) filter (where ${issuesTable.priority} = 'critical' and ${issuesTable.status} <> 'resolved') as int)`,
      resolvedThisWeek: sql<number>`cast(count(*) filter (where ${issuesTable.status} = 'resolved' and ${issuesTable.updatedAt} >= ${weekAgo.toISOString()}) as int)`,
    })
    .from(issuesTable);

  const [{ activitiesToday, minutesLoggedThisWeek }] = await db
    .select({
      activitiesToday: sql<number>`cast(count(*) filter (where ${activitiesTable.activityDate} = ${todayStr}) as int)`,
      minutesLoggedThisWeek: sql<number>`cast(coalesce(sum(${activitiesTable.durationMinutes}) filter (where ${activitiesTable.activityDate} >= ${weekAgoStr}), 0) as int)`,
    })
    .from(activitiesTable);

  res.json(
    GetDashboardSummaryResponse.parse({
      activeProjects,
      totalProjects,
      teamSize,
      openIssues,
      criticalIssues,
      resolvedThisWeek,
      activitiesToday,
      minutesLoggedThisWeek,
    }),
  );
});

router.get("/dashboard/issue-priority-breakdown", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      priority: issuesTable.priority,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(issuesTable)
    .where(ne(issuesTable.status, "resolved"))
    .groupBy(issuesTable.priority);

  const order = ["critical", "high", "medium", "low"] as const;
  const map = new Map(rows.map((r) => [r.priority, r.count]));
  const result = order.map((priority) => ({
    priority,
    count: map.get(priority) ?? 0,
  }));
  res.json(GetIssuePriorityBreakdownResponse.parse(result));
});

router.get("/dashboard/project-health", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      projectId: projectsTable.id,
      name: projectsTable.name,
      client: projectsTable.client,
      color: projectsTable.color,
      openIssues: sql<number>`cast(count(${issuesTable.id}) filter (where ${issuesTable.status} <> 'resolved') as int)`,
      criticalIssues: sql<number>`cast(count(${issuesTable.id}) filter (where ${issuesTable.priority} = 'critical' and ${issuesTable.status} <> 'resolved') as int)`,
      resolvedIssues: sql<number>`cast(count(${issuesTable.id}) filter (where ${issuesTable.status} = 'resolved') as int)`,
    })
    .from(projectsTable)
    .leftJoin(issuesTable, eq(issuesTable.projectId, projectsTable.id))
    .groupBy(projectsTable.id, projectsTable.name, projectsTable.client, projectsTable.color)
    .orderBy(projectsTable.name);
  res.json(GetProjectHealthResponse.parse(rows));
});

router.get("/dashboard/recent-activities", async (req, res): Promise<void> => {
  const parsed = GetRecentActivitiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const limit = parsed.data.limit ?? 10;
  const rows = await db
    .select()
    .from(activitiesTable)
    .orderBy(
      sql`${activitiesTable.activityDate} desc`,
      sql`${activitiesTable.createdAt} desc`,
    )
    .limit(limit);
  res.json(GetRecentActivitiesResponse.parse(rows));
});

export default router;
