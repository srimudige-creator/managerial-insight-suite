import { pgTable, serial, text, timestamp, integer, date, jsonb } from "drizzle-orm/pg-core";

export type MeetingActionItem = {
  description: string;
  actionOn: string;
  eta: string;
  remarks: string;
};

export const meetingsTable = pgTable("meetings", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull(),
  title: text("title").notNull(),
  meetingDate: date("meeting_date").notNull(),
  meetingTime: text("meeting_time"),
  location: text("location"),
  clientParticipants: text("client_participants"),
  internalParticipants: text("internal_participants"),
  agenda: text("agenda"),
  discussion: text("discussion"),
  actionItems: jsonb("action_items").$type<MeetingActionItem[]>().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Meeting = typeof meetingsTable.$inferSelect;
