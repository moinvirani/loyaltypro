import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { businesses, branches, customers, loyaltyCards, notifications } from "@db/schema";
import { eq, count, sql, desc, and } from "drizzle-orm";
import { processImage, validateImage } from "./services/imageService";
import { Template } from "@destinationstransfers/passkit";

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

  // Customer Engagement Metrics
  app.get("/api/analytics/customer-segments", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const segments = [
      { name: "New", days: 30 },
      { name: "Active", days: 90 },
      { name: "At Risk", days: 180 },
      { name: "Inactive", days: null },
    ];

    const segmentData = await Promise.all(
      segments.map(async ({ name, days }) => {
        const [result] = await db
          .select({ count: count() })
          .from(customers)
          .where(
            sql`${customers.businessId} = ${businessId} 
                ${days
              ? sql`AND ${customers.createdAt} >= NOW() - INTERVAL '${days} days'`
              : sql`AND ${customers.createdAt} < NOW() - INTERVAL '180 days'`
            }`
          );

        return {
          segment: name,
          count: Number(result.count),
        };
      })
    );

    res.json(segmentData);
  });

  app.get("/api/analytics/points-trends", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const trends = await db
      .select({
        date: sql<string>`DATE_TRUNC('month', ${customers.createdAt})::text`,
        averagePoints: sql`AVG(${customers.points})::float`,
        totalCustomers: count(),
      })
      .from(customers)
      .where(eq(customers.businessId, businessId))
      .groupBy(sql`DATE_TRUNC('month', ${customers.createdAt})`)
      .orderBy(sql`DATE_TRUNC('month', ${customers.createdAt})`);

    res.json(trends);
  });

  app.get("/api/analytics/customer-retention", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const months = 6;

    const cohorts = await db
      .select({
        cohort: sql<string>`DATE_TRUNC('month', ${customers.createdAt})::text`,
        count: count(),
      })
      .from(customers)
      .where(
        sql`${customers.businessId} = ${businessId} 
            AND ${customers.createdAt} >= NOW() - INTERVAL '${months} months'`
      )
      .groupBy(sql`DATE_TRUNC('month', ${customers.createdAt})`)
      .orderBy(sql`DATE_TRUNC('month', ${customers.createdAt})`);

    res.json(cohorts);
  });


  // Branches endpoints
  app.get("/api/branches", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const branchList = await db.query.branches.findMany({
      where: eq(branches.businessId, businessId),
      orderBy: [branches.createdAt],
    });
    res.json(branchList);
  });

  app.post("/api/branches", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const { name, address } = req.body;

    // Check branch limit
    const [{ count: branchCount }] = await db
      .select({ count: count() })
      .from(branches)
      .where(eq(branches.businessId, businessId));

    if (Number(branchCount) >= 3) {
      return res.status(400).json({ message: "Maximum branch limit reached (3)" });
    }

    const newBranch = await db
      .insert(branches)
      .values({ businessId, name, address })
      .returning();

    res.json(newBranch[0]);
  });

  app.put("/api/branches/:id", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const branchId = parseInt(req.params.id);
    const { name, address } = req.body;

    const updatedBranch = await db
      .update(branches)
      .set({ name, address })
      .where(and(
        eq(branches.id, branchId),
        eq(branches.businessId, businessId)
      ))
      .returning();

    if (!updatedBranch.length) {
      return res.status(404).json({ message: "Branch not found" });
    }

    res.json(updatedBranch[0]);
  });

  app.delete("/api/branches/:id", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const branchId = parseInt(req.params.id);

    const deletedBranch = await db
      .delete(branches)
      .where(and(
        eq(branches.id, branchId),
        eq(branches.businessId, businessId)
      ))
      .returning();

    if (!deletedBranch.length) {
      return res.status(404).json({ message: "Branch not found" });
    }

    res.json({ message: "Branch deleted successfully" });
  });

  // Cards endpoints
  app.get("/api/cards", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const cards = await db.query.loyaltyCards.findMany({
      where: eq(loyaltyCards.businessId, businessId),
      orderBy: [desc(loyaltyCards.createdAt)],
    });
    res.json(cards);
  });

  app.post("/api/cards", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from auth
      const { name, design } = req.body;

      if (!name || !design) {
        return res.status(400).json({ message: "Name and design are required" });
      }

      // Process logo if present
      let processedDesign = { ...design };
      if (design.logo) {
        if (!validateImage(design.logo)) {
          return res.status(400).json({ message: "Invalid image format or size" });
        }
        const processed = await processImage(design.logo);
        processedDesign.logo = processed.data;
      }

      const newCard = await db
        .insert(loyaltyCards)
        .values({
          businessId,
          name,
          design: processedDesign,
          isActive: true,
        })
        .returning();

      res.json(newCard[0]);
    } catch (error: any) {
      console.error("Error creating card:", error);
      res.status(500).json({ message: "Failed to create card" });
    }
  });

  app.put("/api/cards/:id", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from auth
      const cardId = parseInt(req.params.id);
      const { name, design } = req.body;

      if (!name || !design) {
        return res.status(400).json({ message: "Name and design are required" });
      }

      // Process logo if changed
      let processedDesign = { ...design };
      if (design.logo) {
        if (!validateImage(design.logo)) {
          return res.status(400).json({ message: "Invalid image format or size" });
        }
        const processed = await processImage(design.logo);
        processedDesign.logo = processed.data;
      }

      const updatedCard = await db
        .update(loyaltyCards)
        .set({
          name,
          design: processedDesign,
        })
        .where(and(
          eq(loyaltyCards.id, cardId),
          eq(loyaltyCards.businessId, businessId)
        ))
        .returning();

      if (!updatedCard.length) {
        return res.status(404).json({ message: "Card not found" });
      }

      res.json(updatedCard[0]);
    } catch (error: any) {
      console.error("Error updating card:", error);
      res.status(500).json({ message: "Failed to update card" });
    }
  });

  app.delete("/api/cards/:id", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from auth
      const cardId = parseInt(req.params.id);

      const deletedCard = await db
        .delete(loyaltyCards)
        .where(and(
          eq(loyaltyCards.id, cardId),
          eq(loyaltyCards.businessId, businessId)
        ))
        .returning();

      if (!deletedCard.length) {
        return res.status(404).json({ message: "Card not found" });
      }

      res.json({ message: "Card deleted successfully" });
    } catch (error: any) {
      console.error("Error deleting card:", error);
      res.status(500).json({ message: "Failed to delete card" });
    }
  });

  // Generate wallet pass for existing card
  app.post("/api/cards/:id/wallet-pass", async (req, res) => {
    try {
      const businessId = 1; // TODO: Get from auth
      const cardId = parseInt(req.params.id);

      const card = await db.query.loyaltyCards.findFirst({
        where: and(
          eq(loyaltyCards.id, cardId),
          eq(loyaltyCards.businessId, businessId)
        ),
      });

      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Debug certificate availability
      console.log('Certificate check:');
      console.log('Pass Type ID:', process.env.APPLE_PASS_TYPE_ID?.substring(0, 10) + '...');
      console.log('Team ID:', process.env.APPLE_TEAM_ID?.substring(0, 5) + '...');
      console.log('Has Signing Cert:', !!process.env.APPLE_SIGNING_CERT);
      console.log('Has Signing Key:', !!process.env.APPLE_SIGNING_KEY);
      console.log('Has WWDR Cert:', !!process.env.APPLE_WWDR_CERT);

      // Create pass template with minimal required fields
      const template = new Template('storeCard', {
        formatVersion: 1,
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
        teamIdentifier: process.env.APPLE_TEAM_ID,
        organizationName: "Loyalty Pro",
        description: card.name,
        serialNumber: `card-${card.id}`,
      });

      // Set certificates
      if (!process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || !process.env.APPLE_WWDR_CERT) {
        throw new Error('Missing required certificates');
      }

      // Add basic styling
      template.backgroundColor = card.design.backgroundColor;
      template.foregroundColor = card.design.primaryColor;

      // Add logo if exists
      if (card.design.logo) {
        const logoData = card.design.logo.split(',')[1];
        const logoBuffer = Buffer.from(logoData, 'base64');
        template.images.add('icon', logoBuffer);
        template.images.add('logo', logoBuffer);
      }

      // Add primary fields
      template.primaryFields.add({
        key: 'points',
        label: 'Points',
        value: '0',
      });

      // Add barcode
      template.barcodes = [{
        message: `card-${card.id}`,
        format: 'PKBarcodeFormatQR',
        messageEncoding: 'iso-8859-1',
      }];

      // Format and add certificates to template
      const formatPEM = (pemContent: string, type: string) => {
        const base64 = Buffer.from(pemContent, 'base64').toString('utf-8');
        return `-----BEGIN ${type}-----\n${base64}\n-----END ${type}-----`;
      };

      template.setCertificate(formatPEM(process.env.APPLE_SIGNING_CERT!, 'CERTIFICATE'));
      template.setPrivateKey(formatPEM(process.env.APPLE_SIGNING_KEY!, 'PRIVATE KEY'));
      template.setWWDRcertificate(formatPEM(process.env.APPLE_WWDR_CERT!, 'CERTIFICATE'));

      // Generate the pass
      const buffer = await template.generate();

      // Send the pass file
      res.set({
        'Content-Type': 'application/vnd.apple.pkpass',
        'Content-Disposition': `attachment; filename=${card.name.replace(/\s+/g, '_')}.pkpass`,
      });

      res.send(buffer);

    } catch (error: any) {
      console.error('Error generating pass:', error);
      res.status(500).json({ 
        message: "Failed to generate pass",
        details: error.message
      });
    }
  });

  // Customers endpoints
  app.get("/api/customers", async (req, res) => {
    const businessId = 1; // TODO: Get from auth
    const customerList = await db.query.customers.findMany({
      where: eq(customers.businessId, businessId),
    });
    res.json(customerList);
  });

  // Apple Wallet pass generation (duplicate route - removed)
  // Customer wallet pass generation endpoint
  app.get("/api/wallet-pass/:cardId/:customerId", async (req, res) => {
    const cardId = parseInt(req.params.cardId);
    const customerId = req.params.customerId;

    try {
      // Debug environment variables
      console.log('Pass Type ID:', process.env.APPLE_PASS_TYPE_ID?.substring(0, 10) + '...');
      console.log('Team ID:', process.env.APPLE_TEAM_ID?.substring(0, 5) + '...');
      console.log('Has Signing Cert:', !!process.env.APPLE_SIGNING_CERT);
      console.log('Has Signing Key:', !!process.env.APPLE_SIGNING_KEY);

      // Get card details
      const card = await db.query.loyaltyCards.findFirst({
        where: eq(loyaltyCards.id, cardId),
      });

      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Create pass template
      const template = new Template("storeCard", {
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
        teamIdentifier: process.env.APPLE_TEAM_ID,
        organizationName: "Loyalty Pro",
        description: card.name,
        serialNumber: customerId,
      });

      // Set pass styling based on card design
      template.style({
        labelColor: "rgb(45, 45, 45)",
        foregroundColor: "rgb(45, 45, 45)",
        backgroundColor: card.design.backgroundColor,
      });

      // Add logo if exists
      if (card.design.logo) {
        template.images.add("icon", Buffer.from(card.design.logo, "base64"));
        template.images.add("logo", Buffer.from(card.design.logo, "base64"));
      }

      // Set card information
      template.primaryFields.add({
        key: "points",
        label: "Points",
        value: 0,
      });

      // Add barcode
      template.barcodes = [{
        message: customerId,
        format: "PKBarcodeFormatQR",
        messageEncoding: "iso-8859-1",
      }];

      // Convert base64 cert and key strings to buffers
      const signingCert = Buffer.from(process.env.APPLE_SIGNING_CERT!, 'base64');
      const signingKey = Buffer.from(process.env.APPLE_SIGNING_KEY!, 'base64');

      const pass = await template.sign(
        signingCert,
        signingKey,
      );

      // Send pass file
      res.set({
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-disposition": `attachment; filename=${card.name}.pkpass`,
      });
      res.send(Buffer.from(await pass.getAsBuffer()));
    } catch (error: any) {
      console.error("Error generating pass:", error);
      res.status(500).json({ message: "Failed to generate pass" });
    }
  });

  return httpServer;
}