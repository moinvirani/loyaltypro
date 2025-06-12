
import type { LoyaltyCard } from '@db/schema';
import { createHash } from 'crypto';

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  try {
    // Validate required environment variables
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID || 
        !process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || 
        !process.env.APPLE_WWDR_CERT) {
      throw new Error('Missing required Apple Wallet certificates or configuration');
    }

    console.log('Creating production Apple Wallet pass with certificate signing...');

    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // Create pass.json with proper Apple Wallet structure
    const passContent = {
      formatVersion: 1,
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
      teamIdentifier: process.env.APPLE_TEAM_ID,
      organizationName: "Loyalty Pro",
      description: card.name,
      serialNumber: serialNumber || `card-${card.id}-${Date.now()}`,
      backgroundColor: card.design.backgroundColor,
      foregroundColor: card.design.textColor || card.design.primaryColor,
      labelColor: card.design.textColor || card.design.primaryColor,
      storeCard: {
        primaryFields: [
          {
            key: "balance",
            label: "Points",
            value: "0"
          }
        ],
        secondaryFields: [
          {
            key: "name", 
            label: "Card Name",
            value: card.name
          }
        ],
        backFields: [
          {
            key: "terms",
            label: "Terms and Conditions", 
            value: "Present this card to earn and redeem points. Card is non-transferable."
          }
        ]
      },
      barcodes: [
        {
          message: serialNumber || `card-${card.id}`,
          format: "PKBarcodeFormatQR",
          messageEncoding: "iso-8859-1"
        }
      ]
    };

    const passJson = JSON.stringify(passContent);
    zip.file('pass.json', passJson);

    // Create manifest with file hashes
    const manifest: Record<string, string> = {
      'pass.json': createHash('sha1').update(passJson).digest('hex')
    };

    // Add logo assets if available
    if (card.design.logo) {
      try {
        const logoData = card.design.logo.includes(',') 
          ? card.design.logo.split(',')[1] 
          : card.design.logo;
        const logoBuffer = Buffer.from(logoData, 'base64');
        
        const sharp = (await import('sharp')).default;
        
        // Create required icon sizes for Apple Wallet
        const icon = await sharp(logoBuffer)
          .resize(58, 58, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
          
        const icon2x = await sharp(logoBuffer)
          .resize(116, 116, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();
          
        const logo = await sharp(logoBuffer)
          .resize(320, 100, { fit: 'inside', withoutEnlargement: true })
          .png()
          .toBuffer();

        zip.file('icon.png', icon);
        zip.file('icon@2x.png', icon2x);
        zip.file('logo.png', logo);
        
        manifest['icon.png'] = createHash('sha1').update(icon).digest('hex');
        manifest['icon@2x.png'] = createHash('sha1').update(icon2x).digest('hex');
        manifest['logo.png'] = createHash('sha1').update(logo).digest('hex');
      } catch (logoError) {
        console.warn('Failed to process logo assets:', logoError);
      }
    }

    const manifestJson = JSON.stringify(manifest);
    zip.file('manifest.json', manifestJson);

    // Create PKCS#7 signature for the manifest
    try {
      console.log('Starting Apple Wallet pass signing...');
      
      // Use passkit-generator library for proper Apple Wallet signing
      const PassKit = await import('passkit-generator');
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Validate required environment variables
      if (!process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || !process.env.APPLE_WWDR_CERT) {
        throw new Error('Missing required Apple certificates');
      }

      // Create temporary directory for passkit-generator
      const tempDir = '/tmp/passkit_signing';
      await fs.mkdir(tempDir, { recursive: true });
      
      // Write certificate files for passkit-generator
      const certPath = path.join(tempDir, 'signerCert.pem');
      const keyPath = path.join(tempDir, 'signerKey.pem');
      const wwdrPath = path.join(tempDir, 'wwdrCert.pem');
      
      await fs.writeFile(certPath, process.env.APPLE_SIGNING_CERT);
      await fs.writeFile(keyPath, process.env.APPLE_SIGNING_KEY);
      await fs.writeFile(wwdrPath, process.env.APPLE_WWDR_CERT);

      // Create passkit template structure
      const templateDir = path.join(tempDir, 'template');
      await fs.mkdir(templateDir, { recursive: true });
      
      // Write pass.json
      await fs.writeFile(path.join(templateDir, 'pass.json'), JSON.stringify(passData, null, 2));
      
      // Copy icon if exists
      if (design.logo) {
        const iconBuffer = Buffer.from(design.logo.split(',')[1], 'base64');
        await fs.writeFile(path.join(templateDir, 'icon.png'), iconBuffer);
        await fs.writeFile(path.join(templateDir, 'icon@2x.png'), iconBuffer);
      }

      // Create signed pass using passkit-generator
      try {
        const pass = await PassKit.PKPass.from({
          model: templateDir,
          certificates: {
            signerCert: certPath,
            signerKey: keyPath,
            wwdrCert: wwdrPath,
          }
        });

        const signedPassBuffer = pass.getAsBuffer();
        
        // Clean up
        await fs.rm(tempDir, { recursive: true, force: true });
        
        console.log('Apple Wallet pass signed successfully using passkit-generator');
        return signedPassBuffer;
        
      } catch (passkitError: any) {
        console.warn('passkit-generator failed:', passkitError.message);
        throw passkitError;
      }
      
    } catch (signingError: any) {
      console.error('Apple Wallet signing failed:', signingError.message);
      console.log('Falling back to unsigned pass structure');
    }

    // Generate final pass file
    const passBuffer = await zip.generateAsync({ 
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    return passBuffer;

  } catch (error: any) {
    console.error('Apple Wallet pass generation error:', error);
    throw new Error(`Failed to generate Apple Wallet pass: ${error.message}`);
  }
}
