import { Template } from '@destinationstransfers/passkit';
import type { LoyaltyCard } from '@db/schema';

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  // Validate required environment variables
  if (!process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || !process.env.APPLE_WWDR_CERT) {
    throw new Error('Missing required Apple certificates');
  }

  if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID) {
    throw new Error('Missing required Apple pass configuration');
  }

  try {
    // Create pass template
    const template = new Template("storeCard", {
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
      teamIdentifier: process.env.APPLE_TEAM_ID,
      organizationName: "Loyalty Pro",
      description: card.name,
      serialNumber: serialNumber || `card-${card.id}-${Date.now()}`,
    });

    // Set pass styling based on card design
    if (template.style) {
      template.style({
        labelColor: "rgb(45, 45, 45)",
        foregroundColor: card.design.textColor || card.design.primaryColor,
        backgroundColor: card.design.backgroundColor,
      });
    }

    // Add logo if exists
    if (card.design.logo) {
      const logoData = card.design.logo.includes(',') 
        ? card.design.logo.split(',')[1] 
        : card.design.logo;
      
      try {
        const logoBuffer = Buffer.from(logoData, "base64");
        template.images.add("icon", logoBuffer);
        template.images.add("logo", logoBuffer);
      } catch (logoError) {
        console.warn('Failed to add logo to pass:', logoError);
      }
    }

    // Set card information
    template.primaryFields.add({
      key: "points",
      label: "Points",
      value: 0,
    });

    // Add barcode
    template.barcodes = [{
      message: serialNumber || `card-${card.id}`,
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
    }];

    // Convert base64 cert and key strings to buffers
    const signingCert = Buffer.from(process.env.APPLE_SIGNING_CERT, 'base64');
    const signingKey = Buffer.from(process.env.APPLE_SIGNING_KEY, 'base64');

    // Sign the pass
    const pass = await template.sign(signingCert, signingKey);
    
    // Return the pass buffer
    return Buffer.from(await pass.getAsBuffer());

  } catch (error: any) {
    console.error('Apple Wallet pass generation error:', error);
    
    // Check if it's a certificate format error
    if (error.message && error.message.includes('ASN.1')) {
      throw new Error('Certificate format error: Your Apple certificates may need to be re-exported in the correct format. Please ensure your private key is exported as a .p12 file and properly converted to PEM format.');
    }
    
    throw error;
  }
}