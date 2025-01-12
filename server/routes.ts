import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { businesses, branches, customers, loyaltyCards, notifications } from "@db/schema";
import { eq, count, sql, desc } from "drizzle-orm";

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

  // Advanced Analytics
  app.get("/api/analytics/customer-growth", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const customerGrowth = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', ${customers.createdAt})::text`,
        count: count(),
      })
      .from(customers)
      .where(eq(customers.businessId, businessId))
      .groupBy(sql`DATE_TRUNC('day', ${customers.createdAt})`)
      .orderBy(sql`DATE_TRUNC('day', ${customers.createdAt})`);

    res.json(customerGrowth);
  });

  app.get("/api/analytics/points-distribution", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const ranges = [
      { min: 0, max: 100 },
      { min: 101, max: 500 },
      { min: 501, max: 1000 },
      { min: 1001, max: 5000 },
      { min: 5001, max: null },
    ];

    const distribution = await Promise.all(
      ranges.map(async ({ min, max }) => {
        const [result] = await db
          .select({ count: count() })
          .from(customers)
          .where(
            sql`${customers.businessId} = ${businessId} 
                AND ${customers.points} >= ${min} 
                ${max ? sql`AND ${customers.points} <= ${max}` : sql``}`
          );

        return {
          range: max ? `${min}-${max}` : `${min}+`,
          count: Number(result.count),
        };
      })
    );

    res.json(distribution);
  });

  app.get("/api/analytics/notification-engagement", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const engagement = await db
      .select({
        status: notifications.status,
        count: count(),
      })
      .from(notifications)
      .where(eq(notifications.businessId, businessId))
      .groupBy(notifications.status);

    res.json(engagement);
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