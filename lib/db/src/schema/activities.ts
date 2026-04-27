import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id"),
  category: text("category").notNull().default("other"),
  title: text("title").notNull(),
  notes: text("notes"),
  durationMinutes: integer("duration_minutes"),
  activityDate: date("activity_date").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Activity = typeof activitiesTable.$inferSelect;
