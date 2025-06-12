import type { Express } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { businesses, branches, customers, loyaltyCards, notifications } from "@db/schema";
import { eq, count, sql, desc, and } from "drizzle-orm";
import { processImage, validateImage } from "./services/imageService";
import { generateAppleWalletPass } from "./services/passService";
import { diagnosePassCertificates, formatPEM } from "./services/certificateService";
import { execSync } from "child_process";
import writeCerts from "./helpers/writeCerts";

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

  // GET endpoint for QR code wallet pass download
  app.get("/api/cards/:id/wallet-pass", async (req, res) => {
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

      // Generate the pass buffer using OpenSSL signing
      const passBuffer = await generateAppleWalletPass(card, `card-${cardId}-${Date.now()}`);

      // Send pass file with proper content type
      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader("Content-disposition", `attachment; filename=${card.name.replace(/\s+/g, '_')}.pkpass`);
      res.send(passBuffer);

    } catch (error: any) {
      console.error("Error generating pass:", error);
      res.status(500).json({ 
        message: "Failed to generate pass",
        error: error.message
      });
    }
  });

  // Generate wallet pass for existing card (POST for manual downloads)
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

      // Use the Node.js crypto service
      const passBuffer = await generateAppleWalletPass(card, `card-${cardId}-${Date.now()}`);

      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader("Content-disposition", `attachment; filename=${card.name.replace(/\s+/g, '_')}.pkpass`);
      res.send(passBuffer);

    } catch (error: any) {
      console.error('Error generating pass:', error);
      res.status(500).json({ 
        message: "Failed to generate pass",
        error: error.message
      });
    }
  });

  // Web endpoint for Apple Wallet pass download (for QR codes)
  app.get("/wallet/:cardId", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      
      // Check if card exists
      const card = await db.query.loyaltyCards.findFirst({
        where: eq(loyaltyCards.id, cardId),
      });

      if (!card) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Card Not Found</title></head>
            <body>
              <h1>Card not found</h1>
              <p>The loyalty card you're looking for doesn't exist.</p>
            </body>
          </html>
        `);
      }

      // Redirect to the wallet pass download
      res.redirect(`/api/cards/${cardId}/wallet-pass`);
    } catch (error) {
      console.error('Error in wallet redirect:', error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Error</h1>
            <p>Unable to load wallet pass. Please try again later.</p>
          </body>
        </html>
      `);
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

  // Customer wallet pass generation endpoint (using Node.js crypto)
  app.get("/api/wallet-pass/:cardId/:customerId", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      
      const card = await db.query.loyaltyCards.findFirst({
        where: eq(loyaltyCards.id, cardId),
      });

      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Use the Node.js crypto service
      const passBuffer = await generateAppleWalletPass(card, `customer-${req.params.customerId}-${Date.now()}`);

      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader("Content-disposition", `attachment; filename=${card.name.replace(/\s+/g, '_')}.pkpass`);
      res.send(passBuffer);

    } catch (error: any) {
      console.error("Error generating pass:", error);
      res.status(500).json({ message: "Failed to generate pass", error: error.message });
    }
  });

  // Add a new endpoint for certificate validation
  app.post("/api/certificates/validate", async (req, res) => {
    try {
      // Validate environment variables are set
      if (!process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || !process.env.APPLE_WWDR_CERT) {
        return res.status(400).json({
          message: "Missing required certificates in environment variables",
          required: [
            "APPLE_SIGNING_CERT",
            "APPLE_SIGNING_KEY",
            "APPLE_WWDR_CERT"
          ]
        });
      }

      // Format and validate certificates
      try {
        var signingCert = formatPEM(process.env.APPLE_SIGNING_CERT, 'CERTIFICATE');
        var signingKey = formatPEM(process.env.APPLE_SIGNING_KEY, 'PRIVATE KEY');
        var wwdrCert = formatPEM(process.env.APPLE_WWDR_CERT, 'CERTIFICATE');
      } catch (certError: any) {
        return res.status(400).json({
          message: "Certificate formatting error",
          error: certError.message
        });
      }

      // Validate the formatted certificates
      const { isValid, diagnostics } = diagnosePassCertificates(
        signingCert,
        signingKey,
        wwdrCert
      );

      // Return detailed validation results
      return res.json({
        isValid,
        diagnostics,
        certificates: {
          signingCert: signingCert.substring(0, 100) + '...',
          signingKey: signingKey.substring(0, 100) + '...',
          wwdrCert: wwdrCert.substring(0, 100) + '...'
        }
      });

    } catch (error: any) {
      console.error('Certificate validation error:', error);
      return res.status(500).json({
        message: "Failed to validate certificates",
        error: error.message
      });
    }
  });

  // Test certificate validation
  app.get("/api/test/certificates", async (req, res) => {
    try {
      const { cert, key, wwdr } = writeCerts();
      
      const results = {
        signingCert: { path: cert, valid: false, error: null as string | null },
        privateKey: { path: key, valid: false, error: null as string | null },
        wwdrCert: { path: wwdr, valid: false, error: null as string | null }
      };
      
      try {
        execSync(`openssl x509 -in ${cert} -noout -text`, { stdio: 'pipe' });
        results.signingCert.valid = true;
      } catch (error: any) {
        results.signingCert.error = error.message;
      }
      
      try {
        execSync(`openssl rsa -in ${key} -noout -check`, { stdio: 'pipe' });
        results.privateKey.valid = true;
      } catch (error: any) {
        results.privateKey.error = error.message;
      }
      
      try {
        execSync(`openssl x509 -in ${wwdr} -noout -text`, { stdio: 'pipe' });
        results.wwdrCert.valid = true;
      } catch (error: any) {
        results.wwdrCert.error = error.message;
      }
      
      res.json(results);
      
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}