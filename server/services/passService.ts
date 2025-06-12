
import type { LoyaltyCard } from '@db/schema';
import PKPass from 'passkit-generator';
import { formatPEM } from './certificateService';

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  try {
    // Validate required environment variables
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID || 
        !process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || 
        !process.env.APPLE_WWDR_CERT) {
      throw new Error('Missing required Apple Wallet certificates or configuration');
    }

    // Format certificates
    const signingCert = formatPEM(process.env.APPLE_SIGNING_CERT, 'CERTIFICATE');
    const signingKey = formatPEM(process.env.APPLE_SIGNING_KEY, 'PRIVATE KEY');
    const wwdrCert = formatPEM(process.env.APPLE_WWDR_CERT, 'CERTIFICATE');

    // Create pass template
    const pass = new PKPass(
      {
        'pass.json': {
          formatVersion: 1,
          passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
          teamIdentifier: process.env.APPLE_TEAM_ID,
          organizationName: "Loyalty Pro",
          description: card.name,
          serialNumber: serialNumber || `card-${card.id}`,
          storeCard: {
            primaryFields: [
              {
                key: 'points',
                label: 'Points',
                value: '0',
              }
            ],
            secondaryFields: [
              {
                key: 'cardName',
                label: 'Card',
                value: card.name,
              }
            ]
          },
          backgroundColor: card.design.backgroundColor,
          foregroundColor: card.design.primaryColor,
          barcodes: [
            {
              message: serialNumber || `card-${card.id}`,
              format: 'PKBarcodeFormatQR',
              messageEncoding: 'iso-8859-1',
            }
          ]
        }
      },
      {
        signerCert: signingCert,
        signerKey: signingKey,
        wwdr: wwdrCert,
      }
    );

    // Add logo if exists
    if (card.design.logo) {
      const logoData = card.design.logo.split(',')[1];
      const logoBuffer = Buffer.from(logoData, 'base64');
      pass.images.add('icon', logoBuffer);
      pass.images.add('logo', logoBuffer);
    }

    // Generate and return the signed pass buffer
    const passBuffer = await pass.asBuffer();
    return passBuffer;

  } catch (error: any) {
    console.error('Apple Wallet pass generation error:', error);
    throw new Error(`Failed to generate Apple Wallet pass: ${error.message}`);
  }
}
