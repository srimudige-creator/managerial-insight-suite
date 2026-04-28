import { Router, type IRouter } from "express";
import { and, eq, desc } from "drizzle-orm";
import { db, meetingsTable } from "@workspace/db";
import {
  CreateMeetingBody,
  ListMeetingsQueryParams,
  ListMeetingsResponse,
  UpdateMeetingBody,
  UpdateMeetingParams,
  UpdateMeetingResponse,
  DeleteMeetingParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/meetings", async (req, res): Promise<void> => {
  const parsed = ListMeetingsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const filters = [];
  if (parsed.data.projectId !== undefined) {
    filters.push(eq(meetingsTable.projectId, parsed.data.projectId));
  }
  const rows = await db
    .select()
    .from(meetingsTable)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(meetingsTable.meetingDate), desc(meetingsTable.createdAt));
  res.json(ListMeetingsResponse.parse(rows));
});

router.post("/meetings", async (req, res): Promise<void> => {
  const parsed = CreateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(meetingsTable)
    .values({
      projectId: parsed.data.projectId,
      title: parsed.data.title,
      meetingDate: parsed.data.meetingDate,
      attendees: parsed.data.attendees ?? null,
      agenda: parsed.data.agenda ?? null,
      discussion: parsed.data.discussion,
      actionItems: parsed.data.actionItems ?? null,
    })
    .returning();
  res.status(201).json(UpdateMeetingResponse.parse(row));
});

router.patch("/meetings/:id", async (req, res): Promise<void> => {
  const params = UpdateMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMeetingBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(meetingsTable)
    .set(parsed.data)
    .where(eq(meetingsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.json(UpdateMeetingResponse.parse(row));
});

router.delete("/meetings/:id", async (req, res): Promise<void> => {
  const params = DeleteMeetingParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(meetingsTable)
    .where(eq(meetingsTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Meeting not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
