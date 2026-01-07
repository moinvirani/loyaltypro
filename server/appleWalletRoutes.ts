import type { Express, Request, Response, NextFunction } from "express";
import { db } from "@db";
import { deviceRegistrations, passAuthTokens, customerPasses } from "@db/schema";
import { eq, and } from "drizzle-orm";
import { generateEnhancedPass } from "./services/passService";
import { createRateLimiter } from "./middleware/rateLimiter";
import { z } from "zod";

/**
 * Middleware to validate authentication token from Apple Wallet
 * Checks the Authorization header for a valid token
 */
async function validatePassAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const serialNumber = req.params.serialNumber;

  if (!authHeader || !authHeader.startsWith('ApplePass ')) {
    console.warn(`❌ Unauthorized access attempt: Missing or invalid Authorization header`);
    return res.status(401).send();
  }

  const token = authHeader.replace('ApplePass ', '');

  try {
    const authRecord = await db.query.passAuthTokens.findFirst({
      where: eq(passAuthTokens.serialNumber, serialNumber),
    });

    if (!authRecord || authRecord.authToken !== token) {
      console.warn(`❌ Unauthorized access attempt: Invalid token for pass ${serialNumber}`);
      return res.status(401).send();
    }

    // Token is valid, proceed
    next();
  } catch (error: any) {
    console.error('Error validating pass auth:', error);
    return res.status(500).send();
  }
}

/**
 * Register all Apple Wallet web service endpoints
 * These endpoints are called by Apple Wallet to manage pass registrations and updates
 */
export function registerAppleWalletRoutes(app: Express) {
  // Rate limiter: 100 requests per 15 minutes per IP
  const walletRateLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  });

  // Apply rate limiter to all wallet endpoints
  app.use('/v1/*', walletRateLimiter);

  // Validation schema for device registration
  const registerDeviceSchema = z.object({
    pushToken: z.string().min(1).max(256),
  });

  /**
   * 1. Register a device to receive push notifications for a pass
   * POST /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
   *
   * Called when a user adds a pass to their Apple Wallet
   */
  app.post(
    '/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
    validatePassAuth,
    async (req: Request, res: Response) => {
      try {
        const { deviceLibraryIdentifier, passTypeIdentifier, serialNumber } = req.params;

        // Validate request body
        const validationResult = registerDeviceSchema.safeParse(req.body);
        if (!validationResult.success) {
          console.warn(`❌ Invalid request body for device registration:`, validationResult.error);
          return res.status(400).send();
        }

        const { pushToken } = validationResult.data;

        // Check if device is already registered
        const existing = await db.query.deviceRegistrations.findFirst({
          where: and(
            eq(deviceRegistrations.deviceLibraryIdentifier, deviceLibraryIdentifier),
            eq(deviceRegistrations.serialNumber, serialNumber)
          ),
        });

        if (existing) {
          // Update push token if changed
          await db.update(deviceRegistrations)
            .set({
              pushToken,
              lastUpdated: new Date()
            })
            .where(eq(deviceRegistrations.id, existing.id));

          console.log(`✅ Updated device registration for pass ${serialNumber}`);
          return res.status(200).send();
        }

        // Create new registration
        await db.insert(deviceRegistrations).values({
          deviceLibraryIdentifier,
          passTypeIdentifier,
          serialNumber,
          pushToken,
        });

        console.log(`✅ Registered device ${deviceLibraryIdentifier} for pass: ${serialNumber}`);
        res.status(201).send();
      } catch (error: any) {
        console.error('❌ Device registration error:', error);
        res.status(500).send();
      }
    }
  );

  /**
   * 2. Unregister a device
   * DELETE /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}/{serialNumber}
   *
   * Called when a user removes a pass from their Apple Wallet
   */
  app.delete(
    '/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber',
    validatePassAuth,
    async (req: Request, res: Response) => {
      try {
        const { deviceLibraryIdentifier, serialNumber } = req.params;

        await db.delete(deviceRegistrations)
          .where(and(
            eq(deviceRegistrations.deviceLibraryIdentifier, deviceLibraryIdentifier),
            eq(deviceRegistrations.serialNumber, serialNumber)
          ));

        console.log(`✅ Unregistered device ${deviceLibraryIdentifier} for pass: ${serialNumber}`);
        res.status(200).send();
      } catch (error: any) {
        console.error('❌ Device unregistration error:', error);
        res.status(500).send();
      }
    }
  );

  /**
   * 3. Get serial numbers for passes registered to a device
   * GET /v1/devices/{deviceLibraryIdentifier}/registrations/{passTypeIdentifier}?passesUpdatedSince={tag}
   *
   * Called periodically by Apple Wallet to check for updated passes
   */
  app.get(
    '/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier',
    async (req: Request, res: Response) => {
      try {
        const { deviceLibraryIdentifier } = req.params;
        const passesUpdatedSince = req.query.passesUpdatedSince as string;

        // Find all passes for this device
        const registrations = await db.query.deviceRegistrations.findMany({
          where: eq(deviceRegistrations.deviceLibraryIdentifier, deviceLibraryIdentifier),
          columns: {
            serialNumber: true,
            lastUpdated: true,
          },
        });

        if (registrations.length === 0) {
          return res.status(204).send();
        }

        // Filter by update time if provided
        let serialNumbers = registrations.map(r => r.serialNumber);

        if (passesUpdatedSince) {
          const sinceDate = new Date(passesUpdatedSince);
          serialNumbers = registrations
            .filter(r => r.lastUpdated && r.lastUpdated > sinceDate)
            .map(r => r.serialNumber);
        }

        if (serialNumbers.length === 0) {
          return res.status(204).send();
        }

        // Return current timestamp as lastUpdated tag
        const lastUpdated = new Date().toISOString();

        console.log(`✅ Returned ${serialNumbers.length} passes for device ${deviceLibraryIdentifier}`);

        res.json({
          serialNumbers,
          lastUpdated,
        });
      } catch (error: any) {
        console.error('❌ Get registrations error:', error);
        res.status(500).send();
      }
    }
  );

  /**
   * 4. Get the latest version of a pass
   * GET /v1/passes/{passTypeIdentifier}/{serialNumber}
   *
   * Called by Apple Wallet to fetch an updated pass
   */
  app.get(
    '/v1/passes/:passTypeIdentifier/:serialNumber',
    validatePassAuth,
    async (req: Request, res: Response) => {
      try {
        const { serialNumber } = req.params;

        // Find the customer pass
        const customerPass = await db.query.customerPasses.findFirst({
          where: eq(customerPasses.serialNumber, serialNumber),
          with: {
            customer: true,
            card: {
              with: {
                business: true,
              },
            },
          },
        });

        if (!customerPass || !customerPass.card) {
          console.warn(`❌ Pass not found: ${serialNumber}`);
          return res.status(404).send();
        }

        // Check if pass was modified since If-Modified-Since header
        const ifModifiedSince = req.headers['if-modified-since'];
        if (ifModifiedSince && customerPass.lastUpdated) {
          const modifiedDate = new Date(ifModifiedSince);
          if (customerPass.lastUpdated <= modifiedDate) {
            console.log(`✅ Pass not modified: ${serialNumber}`);
            return res.status(304).send(); // Not modified
          }
        }

        // Generate fresh pass with current balance
        const passBuffer = await generateEnhancedPass({
          card: customerPass.card,
          business: customerPass.card.business!,
          customer: customerPass.customer || undefined,
          currentBalance: customerPass.currentBalance || 0,
          serialNumber: customerPass.serialNumber,
        });

        // Set headers
        res.set({
          'Content-Type': 'application/vnd.apple.pkpass',
          'Last-Modified': customerPass.lastUpdated?.toUTCString() || new Date().toUTCString(),
        });

        console.log(`✅ Sent updated pass: ${serialNumber}`);
        res.send(passBuffer);
      } catch (error: any) {
        console.error('❌ Get pass error:', error);
        res.status(500).send();
      }
    }
  );

  /**
   * 5. Log errors from devices (optional but helpful for debugging)
   * POST /v1/log
   *
   * Called by Apple Wallet when there are errors on the device
   */
  app.post('/v1/log', async (req: Request, res: Response) => {
    try {
      const { logs } = req.body;
      console.log('📱 Apple Wallet device logs:', JSON.stringify(logs, null, 2));
      res.status(200).send();
    } catch (error: any) {
      console.error('❌ Log endpoint error:', error);
      res.status(500).send();
    }
  });

  console.log('✅ Apple Wallet web service endpoints registered');
}
