import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, membersTable } from "@workspace/db";
import {
  CreateMemberBody,
  ListMembersResponse,
  UpdateMemberBody,
  UpdateMemberParams,
  UpdateMemberResponse,
  DeleteMemberParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/members", async (_req, res): Promise<void> => {
  const rows = await db
    .select()
    .from(membersTable)
    .orderBy(membersTable.createdAt);
  res.json(ListMembersResponse.parse(rows));
});

router.post("/members", async (req, res): Promise<void> => {
  const parsed = CreateMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .insert(membersTable)
    .values({
      name: parsed.data.name,
      role: parsed.data.role,
      email: parsed.data.email ?? null,
      ...(parsed.data.avatarColor ? { avatarColor: parsed.data.avatarColor } : {}),
    })
    .returning();
  res.status(201).json(UpdateMemberResponse.parse(row));
});

router.patch("/members/:id", async (req, res): Promise<void> => {
  const params = UpdateMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = UpdateMemberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [row] = await db
    .update(membersTable)
    .set(parsed.data)
    .where(eq(membersTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.json(UpdateMemberResponse.parse(row));
});

router.delete("/members/:id", async (req, res): Promise<void> => {
  const params = DeleteMemberParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [row] = await db
    .delete(membersTable)
    .where(eq(membersTable.id, params.data.id))
    .returning();
  if (!row) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  res.sendStatus(204);
});

export default router;
