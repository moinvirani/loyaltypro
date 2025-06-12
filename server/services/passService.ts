
import type { LoyaltyCard } from '@db/schema';
import { Template } from 'passkit-generator';
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
    const template = new Template('storeCard', {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
      teamIdentifier: process.env.APPLE_TEAM_ID,
      organizationName: "Loyalty Pro",
      description: card.name,
      serialNumber: serialNumber || `card-${card.id}`,
    });

    // Set certificates
    template.setCertificate(signingCert);
    template.setPrivateKey(signingKey);
    template.setWWDRcert(wwdrCert);

    // Apply card design
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

    // Add secondary fields if needed
    template.secondaryFields.add({
      key: 'cardName',
      label: 'Card',
      value: card.name,
    });

    // Add barcode for scanning
    template.barcodes = [{
      message: serialNumber || `card-${card.id}`,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1',
    }];

    // Generate and return the signed pass buffer
    const passBuffer = await template.sign();
    return passBuffer;

  } catch (error: any) {
    console.error('Apple Wallet pass generation error:', error);
    throw new Error(`Failed to generate Apple Wallet pass: ${error.message}`);
  }
}
