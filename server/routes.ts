import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { businesses, branches, customers, loyaltyCards, notifications } from "@db/schema";
import { eq, count } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);

  // Dashboard stats
  app.get("/api/dashboard/stats", async (req, res) => {
    const businessId = 1; // TODO: Get from auth

    const [customerCount] = await db
      .select({ count: count() })
      .from(customers)
      .where(eq(customers.businessId, businessId));

    const [cardCount] = await db
      .select({ count: count() })
      .from(loyaltyCards)
      .where(eq(loyaltyCards.businessId, businessId));

    const [branchCount] = await db
      .select({ count: count() })
      .from(branches)
      .where(eq(branches.businessId, businessId));

    const [notificationCount] = await db
      .select({ count: count() })
      .from(notifications)
      .where(eq(notifications.businessId, businessId));

    res.json({
      customers: Number(customerCount.count) || 0,
      activeCards: Number(cardCount.count) || 0,
      branches: Number(branchCount.count) || 0,
      notifications: Number(notificationCount.count) || 0,
    });
  });

  // Cards endpoints
  app.get("/api/cards", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const cards = await db.query.loyaltyCards.findMany({
      where: eq(loyaltyCards.businessId, businessId),
    });
    res.json(cards);
  });

  // Customers endpoints
  app.get("/api/customers", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const customers = await db.query.customers.findMany({
      where: eq(customers.businessId, businessId),
    });
    res.json(customers);
  });

  // Branches endpoints
  app.get("/api/branches", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const branches = await db.query.branches.findMany({
      where: eq(branches.businessId, businessId),
    });
    res.json(branches);
  });

  return httpServer;
}