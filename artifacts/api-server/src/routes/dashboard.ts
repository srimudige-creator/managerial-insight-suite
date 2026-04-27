import { Router, type IRouter } from "express";
import { sql, eq, and, gte, lte, desc, inArray, notInArray } from "drizzle-orm";
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
  GetWeeklySummaryResponse,
} from "@workspace/api-zod";

const DONE_STATUSES = ["resolved", "raised_cr_closed"] as const;

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
      openIssues: sql<number>`cast(count(*) filter (where ${issuesTable.status} not in ('resolved','raised_cr_closed')) as int)`,
      criticalIssues: sql<number>`cast(count(*) filter (where ${issuesTable.priority} = 'critical' and ${issuesTable.status} not in ('resolved','raised_cr_closed')) as int)`,
      resolvedThisWeek: sql<number>`cast(count(*) filter (where ${issuesTable.status} in ('resolved','raised_cr_closed') and ${issuesTable.updatedAt} >= ${weekAgo.toISOString()}) as int)`,
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
    .where(notInArray(issuesTable.status, DONE_STATUSES as unknown as string[]))
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
      openIssues: sql<number>`cast(count(${issuesTable.id}) filter (where ${issuesTable.status} not in ('resolved','raised_cr_closed')) as int)`,
      criticalIssues: sql<number>`cast(count(${issuesTable.id}) filter (where ${issuesTable.priority} = 'critical' and ${issuesTable.status} not in ('resolved','raised_cr_closed')) as int)`,
      resolvedIssues: sql<number>`cast(count(${issuesTable.id}) filter (where ${issuesTable.status} in ('resolved','raised_cr_closed')) as int)`,
    })
    .from(projectsTable)
    .leftJoin(issuesTable, eq(issuesTable.projectId, projectsTable.id))
    .groupBy(projectsTable.id, projectsTable.name, projectsTable.client, projectsTable.color)
    .orderBy(projectsTable.name);
  res.json(GetProjectHealthResponse.parse(rows));
});

router.get("/dashboard/weekly-summary", async (req, res): Promise<void> => {
  const endParam = typeof req.query.endDate === "string" ? req.query.endDate : undefined;
  if (endParam !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(endParam)) {
    res.status(400).json({ error: "endDate must be a YYYY-MM-DD date string" });
    return;
  }
  const endDate = endParam ? new Date(`${endParam}T00:00:00Z`) : new Date();
  const endIso = endDate.toISOString().slice(0, 10);
  const startDate = new Date(endDate.getTime() - 6 * 24 * 60 * 60 * 1000);
  const startIso = startDate.toISOString().slice(0, 10);

  const activities = await db
    .select()
    .from(activitiesTable)
    .where(
      and(
        gte(activitiesTable.activityDate, startIso),
        lte(activitiesTable.activityDate, endIso),
      ),
    )
    .orderBy(desc(activitiesTable.activityDate), desc(activitiesTable.createdAt));

  const resolvedIssues = await db
    .select()
    .from(issuesTable)
    .where(
      and(
        inArray(issuesTable.status, DONE_STATUSES as unknown as string[]),
        gte(issuesTable.updatedAt, new Date(startDate.getTime())),
      ),
    )
    .orderBy(desc(issuesTable.updatedAt));

  const [{ outstandingCriticalCount }] = await db
    .select({
      outstandingCriticalCount: sql<number>`cast(count(*) as int)`,
    })
    .from(issuesTable)
    .where(
      and(
        eq(issuesTable.priority, "critical"),
        notInArray(issuesTable.status, DONE_STATUSES as unknown as string[]),
      ),
    );

  const projects = await db.select().from(projectsTable);
  const projectMap = new Map(projects.map((p) => [p.id, p]));

  const categoryMap = new Map<
    string,
    { category: string; count: number; minutes: number }
  >();
  for (const a of activities) {
    const entry = categoryMap.get(a.category) ?? {
      category: a.category,
      count: 0,
      minutes: 0,
    };
    entry.count += 1;
    entry.minutes += a.durationMinutes ?? 0;
    categoryMap.set(a.category, entry);
  }
  const categoryBreakdown = Array.from(categoryMap.values()).sort(
    (a, b) => b.minutes - a.minutes,
  );

  type ProjectBucket = {
    projectId: number | null;
    projectName: string;
    projectColor: string | null;
    client: string | null;
    totalMinutes: number;
    activities: typeof activities;
    resolvedIssues: typeof resolvedIssues;
  };
  const projectBucket = new Map<string, ProjectBucket>();
  const bucketKey = (id: number | null) => (id == null ? "none" : String(id));

  const ensureBucket = (id: number | null): ProjectBucket => {
    const key = bucketKey(id);
    let bucket = projectBucket.get(key);
    if (!bucket) {
      const project = id != null ? projectMap.get(id) : undefined;
      bucket = {
        projectId: id,
        projectName: project?.name ?? "General",
        projectColor: project?.color ?? null,
        client: project?.client ?? null,
        totalMinutes: 0,
        activities: [],
        resolvedIssues: [],
      };
      projectBucket.set(key, bucket);
    }
    return bucket;
  };

  for (const a of activities) {
    const bucket = ensureBucket(a.projectId ?? null);
    bucket.activities.push(a);
    bucket.totalMinutes += a.durationMinutes ?? 0;
  }
  for (const i of resolvedIssues) {
    const bucket = ensureBucket(i.projectId);
    bucket.resolvedIssues.push(i);
  }

  const projectBreakdown = Array.from(projectBucket.values()).sort((a, b) => {
    if (a.projectId == null) return 1;
    if (b.projectId == null) return -1;
    if (b.totalMinutes !== a.totalMinutes) return b.totalMinutes - a.totalMinutes;
    return a.projectName.localeCompare(b.projectName);
  });

  const totalMinutes = activities.reduce(
    (sum, a) => sum + (a.durationMinutes ?? 0),
    0,
  );

  res.json(
    GetWeeklySummaryResponse.parse({
      weekStart: startIso,
      weekEnd: endIso,
      totalActivities: activities.length,
      totalMinutes,
      resolvedIssuesCount: resolvedIssues.length,
      outstandingCriticalCount,
      categoryBreakdown,
      projectBreakdown,
    }),
  );
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
