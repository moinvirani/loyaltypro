import crypto from 'crypto';
import { db } from '@db';
import { passAuthTokens } from '@db/schema';
import { eq } from 'drizzle-orm';

/**
 * Service for managing authentication tokens for Apple Wallet passes
 * Generates and validates cryptographically secure tokens to prevent unauthorized access
 */
export class AuthTokenService {
  /**
   * Generate a secure authentication token using crypto.randomBytes
   * Returns a 256-bit random token in base64url format (URL-safe)
   */
  static generateToken(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Get or create an authentication token for a serial number
   * If a token already exists for this pass, return it
   * Otherwise, create a new one and store it in the database
   *
   * @param serialNumber - The unique serial number of the pass
   * @returns The authentication token for this pass
   */
  static async getOrCreateToken(serialNumber: string): Promise<string> {
    try {
      // Check if token already exists
      const existing = await db.query.passAuthTokens.findFirst({
        where: eq(passAuthTokens.serialNumber, serialNumber),
      });

      if (existing) {
        return existing.authToken;
      }

      // Create new token
      const newToken = this.generateToken();
      await db.insert(passAuthTokens).values({
        serialNumber,
        authToken: newToken,
      });

      console.log(`Created new auth token for pass: ${serialNumber}`);
      return newToken;
    } catch (error: any) {
      console.error('Error getting or creating auth token:', error);
      throw new Error(`Failed to get auth token: ${error.message}`);
    }
  }

  /**
   * Validate an authentication token for a serial number
   * Uses constant-time comparison to prevent timing attacks
   *
   * @param serialNumber - The serial number to validate against
   * @param token - The token to validate
   * @returns true if the token is valid for this serial number, false otherwise
   */
  static async validateToken(serialNumber: string, token: string): Promise<boolean> {
    try {
      const record = await db.query.passAuthTokens.findFirst({
        where: eq(passAuthTokens.serialNumber, serialNumber),
      });

      if (!record) {
        return false;
      }

      // Use timing-safe comparison to prevent timing attacks
      return crypto.timingSafeEqual(
        Buffer.from(record.authToken),
        Buffer.from(token)
      );
    } catch (error: any) {
      // If lengths don't match, timingSafeEqual throws an error
      // This is expected for invalid tokens
      return false;
    }
  }
}
