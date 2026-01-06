import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { db } from "@db";
import { businesses, branches, customers, loyaltyCards, notifications, customerPasses, transactions } from "@db/schema";
import { eq, count, sql, desc, and } from "drizzle-orm";
import { processImage, validateImage } from "./services/imageService";
import { generateAppleWalletPass, generateEnhancedPass } from "./services/passService";
import { diagnosePassCertificates, formatPEM } from "./services/certificateService";
import { execSync } from "child_process";
import writeCerts from "./helpers/writeCerts";
import { stripeService } from "./stripeService";
import { getStripePublishableKey, getUncachableStripeClient } from "./stripeClient";
import { setupAuth } from "./auth";

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  next();
}

function getBusinessId(req: Request): number {
  return (req.user as any)?.id;
}

export function registerRoutes(app: Express): Server {
  const httpServer = createServer(app);
  
  setupAuth(app);

  // Dashboard stats
  app.get("/api/dashboard/stats", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);

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
  app.get("/api/analytics/customer-growth", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
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

  app.get("/api/analytics/points-distribution", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
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

  app.get("/api/analytics/notification-engagement", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
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
  app.get("/api/analytics/customer-segments", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
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

  app.get("/api/analytics/points-trends", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
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

  app.get("/api/analytics/customer-retention", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
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
  app.get("/api/branches", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
    const branchList = await db.query.branches.findMany({
      where: eq(branches.businessId, businessId),
      orderBy: [branches.createdAt],
    });
    res.json(branchList);
  });

  app.post("/api/branches", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
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

  app.put("/api/branches/:id", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
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

  app.delete("/api/branches/:id", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
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
  app.get("/api/cards", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
    const cards = await db.query.loyaltyCards.findMany({
      where: eq(loyaltyCards.businessId, businessId),
      orderBy: [desc(loyaltyCards.createdAt)],
    });
    res.json(cards);
  });

  app.post("/api/cards", requireAuth, async (req, res) => {
    try {
      const businessId = getBusinessId(req);
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

  app.put("/api/cards/:id", requireAuth, async (req, res) => {
    try {
      const businessId = getBusinessId(req);
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

  app.delete("/api/cards/:id", requireAuth, async (req, res) => {
    try {
      const businessId = getBusinessId(req);
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

  // GET endpoint for QR code wallet pass download (generic pass for card preview)
  app.get("/api/cards/:id/wallet-pass", requireAuth, async (req, res) => {
    try {
      const businessId = getBusinessId(req);
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

      // Fetch business info for enhanced pass
      const business = await db.query.businesses.findFirst({
        where: eq(businesses.id, businessId),
      });

      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      // Generate enhanced pass with business info
      const passBuffer = await generateEnhancedPass({
        card,
        business,
        currentBalance: 0,
        serialNumber: `card-${cardId}-preview-${Date.now()}`
      });

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
  app.post("/api/cards/:id/wallet-pass", requireAuth, async (req, res) => {
    try {
      const businessId = getBusinessId(req);
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

      // Fetch business info for enhanced pass
      const business = await db.query.businesses.findFirst({
        where: eq(businesses.id, businessId),
      });

      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      // Generate enhanced pass with business info
      const passBuffer = await generateEnhancedPass({
        card,
        business,
        currentBalance: 0,
        serialNumber: `card-${cardId}-${Date.now()}`
      });

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
  app.get("/api/customers", requireAuth, async (req, res) => {
    const businessId = getBusinessId(req);
    const customerList = await db.query.customers.findMany({
      where: eq(customers.businessId, businessId),
    });
    res.json(customerList);
  });

  // Customer wallet pass generation endpoint - creates personalized pass for customer
  app.get("/api/wallet-pass/:cardId/:customerId", async (req, res) => {
    try {
      const cardId = parseInt(req.params.cardId);
      const customerId = parseInt(req.params.customerId);
      
      const card = await db.query.loyaltyCards.findFirst({
        where: eq(loyaltyCards.id, cardId),
      });

      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, customerId),
      });

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const business = await db.query.businesses.findFirst({
        where: eq(businesses.id, card.businessId || 1),
      });

      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      // Check for existing pass or create new one
      let customerPass = await db.query.customerPasses.findFirst({
        where: and(
          eq(customerPasses.customerId, customerId),
          eq(customerPasses.cardId, cardId)
        ),
      });

      const design = card.design as any;
      const loyaltyType = design.loyaltyType || 'stamps';
      let currentBalance = 0;

      if (!customerPass) {
        // Create new customer pass record
        const serialNumber = `pass-${cardId}-${customerId}-${Date.now()}`;
        const [newPass] = await db.insert(customerPasses).values({
          customerId,
          cardId,
          serialNumber,
          currentBalance: 0,
          lifetimeBalance: 0,
        }).returning();
        customerPass = newPass;
      } else {
        currentBalance = customerPass.currentBalance || 0;
      }

      // Generate enhanced pass with customer info
      const passBuffer = await generateEnhancedPass({
        card,
        business,
        customer,
        currentBalance,
        serialNumber: customerPass.serialNumber
      });

      res.setHeader("Content-Type", "application/vnd.apple.pkpass");
      res.setHeader("Content-disposition", `attachment; filename=${card.name.replace(/\s+/g, '_')}.pkpass`);
      res.send(passBuffer);

    } catch (error: any) {
      console.error("Error generating pass:", error);
      res.status(500).json({ message: "Failed to generate pass", error: error.message });
    }
  });

  // Issue a new pass to a customer (for staff use)
  app.post("/api/customers/:customerId/issue-pass/:cardId", async (req, res) => {
    try {
      const customerId = parseInt(req.params.customerId);
      const cardId = parseInt(req.params.cardId);

      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, customerId),
      });

      if (!customer) {
        return res.status(404).json({ message: "Customer not found" });
      }

      const card = await db.query.loyaltyCards.findFirst({
        where: eq(loyaltyCards.id, cardId),
      });

      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      // Check if customer already has this card
      const existingPass = await db.query.customerPasses.findFirst({
        where: and(
          eq(customerPasses.customerId, customerId),
          eq(customerPasses.cardId, cardId)
        ),
      });

      if (existingPass) {
        return res.status(400).json({ 
          message: "Customer already has this card",
          passId: existingPass.id
        });
      }

      // Create new customer pass
      const serialNumber = `pass-${cardId}-${customerId}-${Date.now()}`;
      const [newPass] = await db.insert(customerPasses).values({
        customerId,
        cardId,
        serialNumber,
        currentBalance: 0,
        lifetimeBalance: 0,
      }).returning();

      // Update customer's cardId if not set
      if (!customer.cardId) {
        await db.update(customers)
          .set({ cardId })
          .where(eq(customers.id, customerId));
      }

      res.json({ 
        message: "Pass issued successfully",
        pass: newPass,
        downloadUrl: `/api/wallet-pass/${cardId}/${customerId}`
      });

    } catch (error: any) {
      console.error("Error issuing pass:", error);
      res.status(500).json({ message: "Failed to issue pass", error: error.message });
    }
  });

  // Staff scan endpoint - add stamps/points when customer visits
  app.post("/api/staff/scan", requireAuth, async (req, res) => {
    try {
      const businessId = getBusinessId(req);
      const { qrData, amount = 1, description } = req.body;

      // Parse QR code data
      let scanData;
      try {
        scanData = JSON.parse(qrData);
      } catch {
        // Try legacy format: CUSTOMER-{cardId}
        if (qrData?.startsWith('CUSTOMER-')) {
          const cardId = parseInt(qrData.split('-')[1]);
          return res.status(400).json({ 
            message: "Legacy QR code format. Customer needs to download a new pass.",
            cardId 
          });
        }
        return res.status(400).json({ message: "Invalid QR code format" });
      }

      const { cardId, customerId, serial } = scanData;

      if (!cardId) {
        return res.status(400).json({ message: "Invalid QR code - missing card info" });
      }

      // If no customerId, this is a preview pass (not issued to a customer)
      if (!customerId) {
        return res.status(400).json({ 
          message: "This is a preview pass. Customer needs to sign up for a personalized card.",
          cardId
        });
      }

      // Find the customer pass
      const customerPass = await db.query.customerPasses.findFirst({
        where: and(
          eq(customerPasses.customerId, customerId),
          eq(customerPasses.cardId, cardId)
        ),
      });

      if (!customerPass) {
        return res.status(404).json({ message: "Customer pass not found" });
      }

      // Get card to determine loyalty type
      const card = await db.query.loyaltyCards.findFirst({
        where: eq(loyaltyCards.id, cardId),
      });

      if (!card) {
        return res.status(404).json({ message: "Card not found" });
      }

      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, customerId),
      });

      const design = card.design as any;
      const loyaltyType = design.loyaltyType || 'stamps';
      const maxStamps = design.maxStamps || design.stamps || 10;
      const rewardThreshold = design.rewardThreshold || 100;

      // Calculate new balance
      const currentBalance = customerPass.currentBalance || 0;
      let newBalance = currentBalance + amount;
      let rewardEarned = false;
      let rewardMessage = '';

      if (loyaltyType === 'stamps') {
        // Check if customer earned a reward (completed stamp card)
        if (newBalance >= maxStamps) {
          rewardEarned = true;
          rewardMessage = design.rewardDescription || 'Congratulations! You earned a free reward!';
          newBalance = 0; // Reset stamps after reward
        }
      } else {
        // Points system - check if crossed reward threshold
        if (currentBalance < rewardThreshold && newBalance >= rewardThreshold) {
          rewardEarned = true;
          rewardMessage = design.rewardDescription || `You reached ${rewardThreshold} points! Reward available!`;
        }
      }

      // Update the customer pass balance
      await db.update(customerPasses)
        .set({ 
          currentBalance: newBalance,
          lifetimeBalance: (customerPass.lifetimeBalance || 0) + amount,
          lastUpdated: new Date()
        })
        .where(eq(customerPasses.id, customerPass.id));

      // Update customer stats
      if (customer) {
        await db.update(customers)
          .set({ 
            points: loyaltyType === 'points' ? newBalance : customer.points,
            stamps: loyaltyType === 'stamps' ? newBalance : customer.stamps,
            totalVisits: (customer.totalVisits || 0) + 1
          })
          .where(eq(customers.id, customerId));
      }

      // Record the transaction
      await db.insert(transactions).values({
        customerPassId: customerPass.id,
        type: loyaltyType === 'stamps' ? 'stamp' : 'points',
        amount,
        description: description || `Added ${amount} ${loyaltyType === 'stamps' ? 'stamp(s)' : 'point(s)'}`,
      });

      // Generate pass update URL for customer
      const passUpdateUrl = `/api/pass/update/${customerId}/${cardId}`;

      res.json({
        success: true,
        customer: customer ? { id: customer.id, name: customer.name } : null,
        loyaltyType,
        previousBalance: currentBalance,
        newBalance,
        amountAdded: amount,
        rewardEarned,
        rewardMessage,
        maxStamps: loyaltyType === 'stamps' ? maxStamps : undefined,
        rewardThreshold: loyaltyType === 'points' ? rewardThreshold : undefined,
        passUpdateUrl,
      });

    } catch (error: any) {
      console.error("Error processing scan:", error);
      res.status(500).json({ message: "Failed to process scan", error: error.message });
    }
  });

  // Get customer pass info by scanning QR
  app.post("/api/staff/lookup", async (req, res) => {
    try {
      const { qrData } = req.body;

      let scanData;
      try {
        scanData = JSON.parse(qrData);
      } catch {
        return res.status(400).json({ message: "Invalid QR code format" });
      }

      const { cardId, customerId, serial } = scanData;

      if (!customerId) {
        return res.status(400).json({ message: "No customer associated with this pass" });
      }

      const customerPass = await db.query.customerPasses.findFirst({
        where: and(
          eq(customerPasses.customerId, customerId),
          eq(customerPasses.cardId, cardId)
        ),
      });

      if (!customerPass) {
        return res.status(404).json({ message: "Customer pass not found" });
      }

      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, customerId),
      });

      const card = await db.query.loyaltyCards.findFirst({
        where: eq(loyaltyCards.id, cardId),
      });

      const design = card?.design as any;

      // Get recent transactions
      const recentTransactions = await db.query.transactions.findMany({
        where: eq(transactions.customerPassId, customerPass.id),
        orderBy: desc(transactions.createdAt),
        limit: 5,
      });

      res.json({
        customer: customer ? {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          totalVisits: customer.totalVisits,
        } : null,
        pass: {
          id: customerPass.id,
          currentBalance: customerPass.currentBalance,
          lifetimeBalance: customerPass.lifetimeBalance,
          lastUpdated: customerPass.lastUpdated,
        },
        card: card ? {
          id: card.id,
          name: card.name,
          loyaltyType: design?.loyaltyType || 'stamps',
          maxStamps: design?.maxStamps || design?.stamps || 10,
          rewardThreshold: design?.rewardThreshold,
          rewardDescription: design?.rewardDescription,
        } : null,
        recentTransactions,
      });

    } catch (error: any) {
      console.error("Error looking up pass:", error);
      res.status(500).json({ message: "Failed to lookup pass", error: error.message });
    }
  });

  // Regenerate customer pass with updated balance
  app.get("/api/pass/update/:customerId/:cardId", async (req, res) => {
    try {
      const { customerId, cardId } = req.params;
      
      // Find customer pass
      const customerPass = await db.query.customerPasses.findFirst({
        where: and(
          eq(customerPasses.customerId, parseInt(customerId)),
          eq(customerPasses.cardId, parseInt(cardId))
        ),
      });

      if (!customerPass) {
        return res.status(404).json({ message: "Customer pass not found" });
      }

      // Get customer, card, and business data
      const customer = await db.query.customers.findFirst({
        where: eq(customers.id, parseInt(customerId)),
      });

      const card = await db.query.loyaltyCards.findFirst({
        where: eq(loyaltyCards.id, parseInt(cardId)),
      });

      if (!card) {
        return res.status(404).json({ message: "Loyalty card not found" });
      }

      const business = await db.query.businesses.findFirst({
        where: eq(businesses.id, card.businessId!),
      });

      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      // Generate updated pass with current balance
      // Use the existing serialNumber from the customer pass
      const passBuffer = await generateEnhancedPass({
        card,
        business,
        customer: customer || undefined,
        currentBalance: customerPass.currentBalance || 0,
        serialNumber: customerPass.serialNumber,
      });

      res.setHeader('Content-Type', 'application/vnd.apple.pkpass');
      res.setHeader('Content-Disposition', `attachment; filename="${card.name.replace(/\s+/g, '_')}_updated.pkpass"`);
      res.send(passBuffer);

    } catch (error: any) {
      console.error("Error regenerating pass:", error);
      res.status(500).json({ message: "Failed to regenerate pass", error: error.message });
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

  // Stripe routes
  app.get("/api/stripe/publishable-key", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stripe/products", async (req, res) => {
    try {
      const products = await stripeService.listProductsWithPrices();
      
      const productsMap = new Map();
      for (const row of products) {
        const r = row as any;
        if (!productsMap.has(r.product_id)) {
          productsMap.set(r.product_id, {
            id: r.product_id,
            name: r.product_name,
            description: r.product_description,
            active: r.product_active,
            metadata: r.product_metadata,
            prices: []
          });
        }
        if (r.price_id) {
          productsMap.get(r.product_id).prices.push({
            id: r.price_id,
            unit_amount: r.unit_amount,
            currency: r.currency,
            recurring: r.recurring,
            active: r.price_active,
            metadata: r.price_metadata,
          });
        }
      }

      res.json({ data: Array.from(productsMap.values()) });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe/checkout", requireAuth, async (req, res) => {
    try {
      const businessId = getBusinessId(req);
      const { priceId, withTrial } = req.body;

      const business = await db.query.businesses.findFirst({
        where: eq(businesses.id, businessId),
      });

      if (!business) {
        return res.status(404).json({ error: "Business not found" });
      }

      let customerId = business.stripeCustomerId;
      if (!customerId) {
        const customer = await stripeService.createCustomer(business.email, businessId, business.name);
        await db.update(businesses)
          .set({ stripeCustomerId: customer.id })
          .where(eq(businesses.id, businessId));
        customerId = customer.id;
      }

      const host = req.get('host') || 'localhost:5000';
      const protocol = req.protocol || 'https';
      const baseUrl = `${protocol}://${host}`;

      const TRIAL_DAYS = 14;
      const trialDays = withTrial ? TRIAL_DAYS : undefined;

      const session = await stripeService.createCheckoutSession(
        customerId,
        priceId,
        `${baseUrl}/dashboard?checkout=success`,
        `${baseUrl}/pricing?checkout=cancelled`,
        trialDays
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Checkout error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/stripe/portal", requireAuth, async (req, res) => {
    try {
      const businessId = getBusinessId(req);

      const business = await db.query.businesses.findFirst({
        where: eq(businesses.id, businessId),
      });

      if (!business?.stripeCustomerId) {
        return res.status(400).json({ error: "No subscription found" });
      }

      const host = req.get('host') || 'localhost:5000';
      const protocol = req.protocol || 'https';
      
      const session = await stripeService.createCustomerPortalSession(
        business.stripeCustomerId,
        `${protocol}://${host}/dashboard`
      );

      res.json({ url: session.url });
    } catch (error: any) {
      console.error('Portal error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/stripe/subscription", requireAuth, async (req, res) => {
    try {
      const businessId = getBusinessId(req);

      const business = await db.query.businesses.findFirst({
        where: eq(businesses.id, businessId),
      });

      if (!business?.stripeSubscriptionId) {
        return res.json({ subscription: null });
      }

      const subscription = await stripeService.getSubscription(business.stripeSubscriptionId);
      res.json({ subscription });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}