import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, activitiesTable } from "@workspace/db";
import {
  CreateActivityBody,
  ListActivitiesQueryParams,
  ListActivitiesResponse,
  UpdateActivityBody,
  UpdateActivityParams,
  UpdateActivityResponse,
  DeleteActivityParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/activities", async (req, res): Promise<void> => {
  const parsed = ListActivitiesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters = [];
  if (parsed.data.projectId !== undefined) {
    filters.push(eq(activitiesTable.projectId, parsed.data.projectId));
  }
  if (parsed.data.date !== undefined) {
    filters.push(eq(activitiesTable.activityDate, parsed.data.date));
  }
  const rows = await db
    .select()
    .from(activitiesTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(activitiesTable.activityDate), desc(activitiesTable.createdAt));
  res.json(ListActivitiesResponse.parse(rows));
});

router.post("/activities", async (req, res): Promise<void> => {
  const parsed = CreateActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(activitiesTable)
    .values({
      projectId: parsed.data.projectId ?? null,
      category: parsed.data.category,
      title: parsed.data.title,
      notes: parsed.data.notes ?? null,
      durationMinutes: parsed.data.durationMinutes ?? null,
      activityDate: parsed.data.activityDate,
    })
    .returning();
  res.status(201).json(UpdateActivityResponse.parse(row));
});

router.patch("/activities/:id", async (req, res): Promise<void> => {
  const params = UpdateActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateActivityBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(activitiesTable)
    .set(parsed.data)
    .where(eq(activitiesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }
  res.json(UpdateActivityResponse.parse(row));
});

router.delete("/activities/:id", async (req, res): Promise<void> => {
  const params = DeleteActivityParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(activitiesTable)
    .where(eq(activitiesTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Activity not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
