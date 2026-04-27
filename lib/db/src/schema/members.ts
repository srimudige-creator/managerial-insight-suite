import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const membersTable = pgTable("members", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").notNull(),
  email: text("email"),
  avatarColor: text("avatar_color").notNull().default("#94a3b8"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Member = typeof membersTable.$inferSelect;
