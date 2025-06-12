import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from 'zod';

// Define the design schema
export const designSchema = z.object({
  primaryColor: z.string(),
  backgroundColor: z.string(),
  logo: z.string().optional(),
  stamps: z.number().optional(),
  gradientEnabled: z.boolean().optional(),
  gradientColor: z.string().optional(),
  textColor: z.string().optional(),
  cardStyle: z.string().optional(),
});

export type Design = z.infer<typeof designSchema>;

export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  logo: text("logo"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  name: text("name").notNull(),
  address: text("address").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const loyaltyCards = pgTable("loyalty_cards", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  name: text("name").notNull(),
  design: jsonb("design").$type<Design>().notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  cardId: integer("card_id").references(() => loyaltyCards.id),
  points: integer("points").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  title: text("title").notNull(),
  message: text("message").notNull(),
  sentAt: timestamp("sent_at").defaultNow(),
  status: text("status").notNull(),
});

export const businessRelations = relations(businesses, ({ many }) => ({
  branches: many(branches),
  loyaltyCards: many(loyaltyCards),
  customers: many(customers),
  notifications: many(notifications),
}));

export const loyaltyCardRelations = relations(loyaltyCards, ({ many, one }) => ({
  customers: many(customers),
  business: one(businesses, {
    fields: [loyaltyCards.businessId],
    references: [businesses.id],
  }),
}));

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Branch = typeof branches.$inferSelect;
export type LoyaltyCard = typeof loyaltyCards.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export const insertBusinessSchema = createInsertSchema(businesses);
export const selectBusinessSchema = createSelectSchema(businesses);