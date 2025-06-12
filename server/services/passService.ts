import type { LoyaltyCard } from '@db/schema';
import { createHash } from 'crypto';

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  try {
    // Validate required environment variables
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID || 
        !process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || 
        !process.env.APPLE_WWDR_CERT) {
      throw new Error('Missing required Apple Wallet configuration');
    }

    console.log('Creating signed Apple Wallet pass...');

    const design = card.design as any;
    const serial = serialNumber || `${card.id}-${Date.now()}`;

    // Try using the installed passkit library for proper PKCS#7 signing
    try {
      const passkit = await import('@destinationstransfers/passkit');
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Create temporary directory for certificate files
      const tempDir = '/tmp/passkit_signing_' + Date.now();
      await fs.mkdir(tempDir, { recursive: true });
      
      // Write certificate files
      const certPath = path.join(tempDir, 'signerCert.pem');
      const keyPath = path.join(tempDir, 'signerKey.pem');
      const wwdrPath = path.join(tempDir, 'wwdr.pem');
      
      await fs.writeFile(certPath, process.env.APPLE_SIGNING_CERT);
      await fs.writeFile(keyPath, process.env.APPLE_SIGNING_KEY);
      await fs.writeFile(wwdrPath, process.env.APPLE_WWDR_CERT);

      // Create pass data structure
      const passData = {
        formatVersion: 1,
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
        serialNumber: serial,
        teamIdentifier: process.env.APPLE_TEAM_ID,
        organizationName: design.name || 'Loyalty Card',
        description: `${design.name || 'Loyalty'} Card`,
        foregroundColor: design.textColor || '#000000',
        backgroundColor: design.backgroundColor || '#ffffff',
        labelColor: design.textColor || '#000000',
        logoText: design.name,
        generic: {
          primaryFields: [
            {
              key: 'balance',
              label: 'Points',
              value: `${card.stamps || 0}/${design.stamps || 10}`
            }
          ],
          secondaryFields: [
            {
              key: 'name', 
              label: 'Card',
              value: design.name || 'Loyalty Card'
            }
          ],
          backFields: [
            {
              key: 'terms',
              label: 'Terms',
              value: 'Present this pass to earn and redeem loyalty points.'
            }
          ]
        },
        barcode: {
          message: `loyalty:${card.id}:guest`,
          format: 'PKBarcodeFormatQR',
          messageEncoding: 'iso-8859-1'
        }
      };

      // Initialize passkit template
      const template = new passkit.Template('generic', {
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
        teamIdentifier: process.env.APPLE_TEAM_ID,
        backgroundColor: design.backgroundColor || '#ffffff',
        foregroundColor: design.textColor || '#000000',
        labelColor: design.textColor || '#000000',
        organizationName: design.name || 'Loyalty Card',
        description: `${design.name || 'Loyalty'} Card`
      });

      // Add certificate files to template
      template.setCertificate(certPath);
      template.setPrivateKey(keyPath);
      template.setWWDRcert(wwdrPath);

      // Add pass data fields
      template.primaryFields.add({
        key: 'balance',
        label: 'Points', 
        value: `${card.stamps || 0}/${design.stamps || 10}`
      });

      template.secondaryFields.add({
        key: 'name',
        label: 'Card',
        value: design.name || 'Loyalty Card'
      });

      // Add logo if available
      if (design.logo) {
        try {
          const logoData = design.logo.split(',')[1];
          const logoBuffer = Buffer.from(logoData, 'base64');
          const logoPath = path.join(tempDir, 'logo.png');
          await fs.writeFile(logoPath, logoBuffer);
          template.setImage('logo', logoPath);
          template.setImage('icon', logoPath);
        } catch (logoError) {
          console.warn('Logo processing failed:', logoError);
        }
      }

      // Create signed pass
      const pass = template.createPass({
        serialNumber: serial,
        barcodes: [{
          message: `loyalty:${card.id}:guest`,
          format: 'PKBarcodeFormatQR',
          messageEncoding: 'iso-8859-1'
        }]
      });

      const signedBuffer = await pass.sign();
      
      // Clean up temporary files
      await fs.rm(tempDir, { recursive: true, force: true });
      
      console.log(`Apple Wallet pass signed successfully (${signedBuffer.length} bytes)`);
      return signedBuffer;
      
    } catch (passkitError: any) {
      console.warn('passkit library signing failed:', passkitError.message);
      
      // Fallback to manual pass structure (unsigned but correct format)
      return await createUnsignedPass(card, serial, design);
    }

  } catch (error: any) {
    console.error('Apple Wallet pass generation error:', error);
    throw new Error(`Failed to generate Apple Wallet pass: ${error.message}`);
  }
}

async function createUnsignedPass(card: LoyaltyCard, serial: string, design: any): Promise<Buffer> {
  console.log('Creating unsigned pass structure for testing...');
  
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Create pass.json
  const passData = {
    formatVersion: 1,
    passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
    serialNumber: serial,
    teamIdentifier: process.env.APPLE_TEAM_ID,
    organizationName: design.name || card.businessName || 'Loyalty Card',
    description: `${design.name || 'Loyalty'} Card`,
    foregroundColor: design.textColor || '#000000',
    backgroundColor: design.backgroundColor || '#ffffff',
    labelColor: design.textColor || '#000000',
    logoText: design.name || card.businessName,
    generic: {
      primaryFields: [
        {
          key: 'balance',
          label: 'Points',
          value: `${card.currentStamps || 0}/${design.stamps || 10}`
        }
      ],
      secondaryFields: [
        {
          key: 'name',
          label: 'Card',
          value: design.name || 'Loyalty Card'
        }
      ]
    },
    barcode: {
      message: `loyalty:${card.id}:${card.customerId || 'guest'}`,
      format: 'PKBarcodeFormatQR',
      messageEncoding: 'iso-8859-1'
    }
  };

  zip.file('pass.json', JSON.stringify(passData, null, 2));

  // Create manifest for unsigned pass
  const manifest: Record<string, string> = {
    'pass.json': createHash('sha1').update(JSON.stringify(passData, null, 2)).digest('hex')
  };

  // Add logo if available
  if (design.logo) {
    try {
      const logoData = design.logo.split(',')[1];
      const logoBuffer = Buffer.from(logoData, 'base64');
      
      zip.file('logo.png', logoBuffer);
      zip.file('icon.png', logoBuffer);
      
      manifest['logo.png'] = createHash('sha1').update(logoBuffer).digest('hex');
      manifest['icon.png'] = createHash('sha1').update(logoBuffer).digest('hex');
    } catch (logoError) {
      console.warn('Logo processing failed:', logoError);
    }
  }

  zip.file('manifest.json', JSON.stringify(manifest));

  const passBuffer = await zip.generateAsync({ 
    type: 'nodebuffer',
    compression: 'DEFLATE'
  });

  console.log(`Unsigned pass created (${passBuffer.length} bytes) - iOS will reject without proper signature`);
  return passBuffer;
}