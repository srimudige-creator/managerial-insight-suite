import { pgTable, serial, text, timestamp, integer, date } from "drizzle-orm/pg-core";

export const meetingsTable = pgTable("meetings", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  meetingDate: date("meeting_date").notNull(),
  attendees: text("attendees"),
  agenda: text("agenda"),
  discussion: text("discussion").notNull(),
  actionItems: text("action_items"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Meeting = typeof meetingsTable.$inferSelect;
