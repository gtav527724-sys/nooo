import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

/**
 * SONARA keeps likes, playlists, history and searches on the user's device,
 * so no database is required. This single table only exists so the optional
 * Drizzle tooling has a valid schema.
 */
export const appMeta = pgTable("app_meta", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
