import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, issuesTable } from "@workspace/db";
import {
  CreateIssueBody,
  GetIssueParams,
  GetIssueResponse,
  ListIssuesQueryParams,
  ListIssuesResponse,
  UpdateIssueBody,
  UpdateIssueParams,
  UpdateIssueResponse,
  DeleteIssueParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/issues", async (req, res): Promise<void> => {
  const parsed = ListIssuesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters = [];
  if (parsed.data.projectId !== undefined) {
    filters.push(eq(issuesTable.projectId, parsed.data.projectId));
  }
  if (parsed.data.status !== undefined) {
    filters.push(eq(issuesTable.status, parsed.data.status));
  }
  if (parsed.data.priority !== undefined) {
    filters.push(eq(issuesTable.priority, parsed.data.priority));
  }
  const rows = await db
    .select()
    .from(issuesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(issuesTable.createdAt));
  res.json(ListIssuesResponse.parse(rows));
});

router.post("/issues", async (req, res): Promise<void> => {
  const parsed = CreateIssueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(issuesTable)
    .values({
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      priority: parsed.data.priority,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      assigneeId: parsed.data.assigneeId ?? null,
      reportedBy: parsed.data.reportedBy ?? null,
      dueDate: parsed.data.dueDate ?? null,
    })
    .returning();
  res.status(201).json(GetIssueResponse.parse(row));
});

router.get("/issues/:id", async (req, res): Promise<void> => {
  const params = GetIssueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .select()
    .from(issuesTable)
    .where(eq(issuesTable.id, params.data.id));
  if (!row) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }
  res.json(GetIssueResponse.parse(row));
});

router.patch("/issues/:id", async (req, res): Promise<void> => {
  const params = UpdateIssueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateIssueBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(issuesTable)
    .set(parsed.data)
    .where(eq(issuesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }
  res.json(UpdateIssueResponse.parse(row));
});

router.delete("/issues/:id", async (req, res): Promise<void> => {
  const params = DeleteIssueParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(issuesTable)
    .where(eq(issuesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Issue not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
