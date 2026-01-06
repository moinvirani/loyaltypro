import { pgTable, text, serial, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from 'zod';

// Define the design schema with loyalty type support
export const designSchema = z.object({
  primaryColor: z.string(),
  backgroundColor: z.string(),
  logo: z.string().optional(),
  stamps: z.number().optional(),
  gradientEnabled: z.boolean().optional(),
  gradientColor: z.string().optional(),
  textColor: z.string().optional(),
  cardStyle: z.string().optional(),
  loyaltyType: z.enum(['stamps', 'points']).default('stamps'),
  maxStamps: z.number().optional(),
  pointsPerCurrency: z.number().optional(),
  rewardThreshold: z.number().optional(),
  rewardDescription: z.string().optional(),
});

export type Design = z.infer<typeof designSchema>;

export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").unique().notNull(),
  password: text("password").notNull(),
  logo: text("logo"),
  phone: text("phone"),
  address: text("address"),
  website: text("website"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  subscriptionStatus: text("subscription_status"),
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
  stamps: integer("stamps").default(0),
  totalVisits: integer("total_visits").default(0),
  totalSpent: integer("total_spent").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const customerPasses = pgTable("customer_passes", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").references(() => customers.id).notNull(),
  cardId: integer("card_id").references(() => loyaltyCards.id).notNull(),
  serialNumber: text("serial_number").unique().notNull(),
  currentBalance: integer("current_balance").default(0),
  lifetimeBalance: integer("lifetime_balance").default(0),
  lastUpdated: timestamp("last_updated").defaultNow(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  customerPassId: integer("customer_pass_id").references(() => customerPasses.id).notNull(),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  description: text("description"),
  staffId: integer("staff_id"),
  branchId: integer("branch_id").references(() => branches.id),
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
  customerPasses: many(customerPasses),
  business: one(businesses, {
    fields: [loyaltyCards.businessId],
    references: [businesses.id],
  }),
}));

export const customerRelations = relations(customers, ({ many, one }) => ({
  passes: many(customerPasses),
  card: one(loyaltyCards, {
    fields: [customers.cardId],
    references: [loyaltyCards.id],
  }),
  business: one(businesses, {
    fields: [customers.businessId],
    references: [businesses.id],
  }),
}));

export const customerPassRelations = relations(customerPasses, ({ many, one }) => ({
  transactions: many(transactions),
  customer: one(customers, {
    fields: [customerPasses.customerId],
    references: [customers.id],
  }),
  card: one(loyaltyCards, {
    fields: [customerPasses.cardId],
    references: [loyaltyCards.id],
  }),
}));

export const transactionRelations = relations(transactions, ({ one }) => ({
  customerPass: one(customerPasses, {
    fields: [transactions.customerPassId],
    references: [customerPasses.id],
  }),
  branch: one(branches, {
    fields: [transactions.branchId],
    references: [branches.id],
  }),
}));

export type Business = typeof businesses.$inferSelect;
export type NewBusiness = typeof businesses.$inferInsert;
export type Branch = typeof branches.$inferSelect;
export type LoyaltyCard = typeof loyaltyCards.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type CustomerPass = typeof customerPasses.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Notification = typeof notifications.$inferSelect;

export const insertBusinessSchema = createInsertSchema(businesses);
export const selectBusinessSchema = createSelectSchema(businesses);