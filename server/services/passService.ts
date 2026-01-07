import type { LoyaltyCard, Business, Customer } from '@db/schema';
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import forge from 'node-forge';
import sharp from 'sharp';
import { AuthTokenService } from './authTokenService';

export interface PassGenerationOptions {
  card: LoyaltyCard;
  business: Business;
  customer?: Customer;
  currentBalance?: number;
  serialNumber?: string;
}

async function generateIconPng(backgroundColor: string, size: number): Promise<Buffer> {
  const hexColor = backgroundColor.startsWith('#') ? backgroundColor : `#${backgroundColor}`;
  
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="${hexColor}" rx="${Math.round(size * 0.2)}"/>
    <text x="50%" y="55%" font-family="Arial, sans-serif" font-size="${Math.round(size * 0.4)}" 
          fill="white" text-anchor="middle" dominant-baseline="middle" font-weight="bold">L</text>
  </svg>`;
  
  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function generateStripPng(backgroundColor: string, textColor: string, cardName: string, width: number, height: number): Promise<Buffer> {
  const bgHex = backgroundColor.startsWith('#') ? backgroundColor : `#${backgroundColor}`;
  const textHex = textColor.startsWith('#') ? textColor : `#${textColor}`;
  
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${bgHex};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${adjustColor(bgHex, -30)};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="${width}" height="${height}" fill="url(#grad)"/>
    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${Math.round(height * 0.25)}" 
          fill="${textHex}" text-anchor="middle" dominant-baseline="middle" font-weight="bold">${escapeXml(cardName)}</text>
  </svg>`;
  
  return sharp(Buffer.from(svg)).png().toBuffer();
}

function adjustColor(hex: string, amount: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

function escapeXml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  // Legacy function - redirects to enhanced version with minimal info
  const mockBusiness: Business = {
    id: 1,
    name: card.name || 'Loyalty Business',
    email: '',
    password: '',
    logo: null,
    phone: null,
    address: null,
    website: null,
    stripeCustomerId: null,
    stripeSubscriptionId: null,
    subscriptionStatus: null,
    createdAt: new Date(),
  };
  
  return generateEnhancedPass({
    card,
    business: mockBusiness,
    serialNumber,
  });
}

export async function generateEnhancedPass(options: PassGenerationOptions): Promise<Buffer> {
  const { card, business, customer, currentBalance = 0, serialNumber } = options;
  
  try {
    // Validate required environment variables
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID || 
        !process.env.APPLE_SIGNING_KEY) {
      throw new Error('Missing required Apple Wallet configuration');
    }

    console.log('Creating enhanced Apple Wallet pass...');
    
    const design = card.design as any;
    const loyaltyType = design.loyaltyType || 'stamps';
    const maxStamps = design.maxStamps || design.stamps || 10;
    const serial = serialNumber || `pass-${card.id}-${customer?.id || 'generic'}-${Date.now()}`;
    
    // Create temporary build directory
    const buildDir = `/tmp/pass_${Date.now()}`;
    fs.mkdirSync(buildDir, { recursive: true });
    
    try {
      // Build primary fields based on loyalty type
      const primaryFields = [];
      if (loyaltyType === 'stamps') {
        primaryFields.push({
          key: 'stamps',
          label: 'STAMPS',
          value: `${currentBalance}/${maxStamps}`
        });
      } else {
        primaryFields.push({
          key: 'points',
          label: 'POINTS',
          value: currentBalance.toString()
        });
      }
      
      // Build secondary fields with customer and business info
      const secondaryFields = [];
      if (customer?.name) {
        secondaryFields.push({
          key: 'member',
          label: 'MEMBER',
          value: customer.name
        });
      }
      secondaryFields.push({
        key: 'business',
        label: 'BUSINESS',
        value: business.name
      });
      
      // Build auxiliary fields
      const auxiliaryFields = [];
      if (loyaltyType === 'points' && design.rewardThreshold) {
        const pointsToReward = Math.max(0, design.rewardThreshold - currentBalance);
        auxiliaryFields.push({
          key: 'nextReward',
          label: 'NEXT REWARD',
          value: pointsToReward > 0 ? `${pointsToReward} points away` : 'Reward available!'
        });
      }
      if (customer?.totalVisits) {
        auxiliaryFields.push({
          key: 'visits',
          label: 'VISITS',
          value: customer.totalVisits.toString()
        });
      }
      
      // Build back fields with contact info and terms
      const backFields = [];
      if (business.phone) {
        backFields.push({
          key: 'phone',
          label: 'Contact Phone',
          value: business.phone
        });
      }
      if (business.address) {
        backFields.push({
          key: 'address',
          label: 'Address',
          value: business.address
        });
      }
      if (business.website) {
        backFields.push({
          key: 'website',
          label: 'Website',
          value: business.website
        });
      }
      if (design.rewardDescription) {
        backFields.push({
          key: 'reward',
          label: 'Reward',
          value: design.rewardDescription
        });
      }
      backFields.push({
        key: 'terms',
        label: 'Terms and Conditions',
        value: `Present this pass at ${business.name} to earn and redeem ${loyaltyType === 'stamps' ? 'stamps' : 'loyalty points'}. Valid at participating locations.`
      });
      backFields.push({
        key: 'cardId',
        label: 'Card ID',
        value: `#${card.id}`
      });
      if (customer?.id) {
        backFields.push({
          key: 'memberId',
          label: 'Member ID',
          value: `#${customer.id}`
        });
      }
      
      // Generate or retrieve authentication token for this pass
      const authToken = await AuthTokenService.getOrCreateToken(serial);

      // Create pass data that exactly matches Apple's specifications
      const passData: any = {
        formatVersion: 1,
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
        serialNumber: serial,
        teamIdentifier: process.env.APPLE_TEAM_ID,
        organizationName: business.name,
        description: `${card.name} - ${business.name}`,
        foregroundColor: design.textColor || '#ffffff',
        backgroundColor: design.backgroundColor || '#000000',
        labelColor: design.textColor || '#ffffff',
        logoText: business.name,
        // Apple Wallet web service configuration for push notifications
        webServiceURL: process.env.WALLET_SERVICE_URL,
        authenticationToken: authToken,
        generic: {
          primaryFields,
          secondaryFields,
          auxiliaryFields: auxiliaryFields.length > 0 ? auxiliaryFields : undefined,
          backFields
        },
        barcodes: [
          {
            message: JSON.stringify({
              type: 'loyalty',
              cardId: card.id,
              customerId: customer?.id || null,
              serial
            }),
            format: 'PKBarcodeFormatQR',
            messageEncoding: 'iso-8859-1'
          }
        ]
      };
      
      // Remove undefined fields
      if (!passData.generic.auxiliaryFields) {
        delete passData.generic.auxiliaryFields;
      }

      // Write pass.json to build directory
      const passJsonContent = JSON.stringify(passData, null, 2);
      fs.writeFileSync(path.join(buildDir, 'pass.json'), passJsonContent);
      
      // Generate required icon assets for Apple Wallet
      console.log('Generating icon assets...');
      const bgColor = design.backgroundColor || design.primaryColor || '#4F46E5';
      const icon = await generateIconPng(bgColor, 29);
      const icon2x = await generateIconPng(bgColor, 58);
      const icon3x = await generateIconPng(bgColor, 87);
      const logo = await generateIconPng(bgColor, 160);
      const logo2x = await generateIconPng(bgColor, 320);
      
      // Generate strip images (required for generic/loyalty passes)
      const strip = await generateStripPng(bgColor, design.textColor || '#ffffff', design.name || 'Loyalty Card', 375, 123);
      const strip2x = await generateStripPng(bgColor, design.textColor || '#ffffff', design.name || 'Loyalty Card', 750, 246);
      const strip3x = await generateStripPng(bgColor, design.textColor || '#ffffff', design.name || 'Loyalty Card', 1125, 369);
      
      fs.writeFileSync(path.join(buildDir, 'icon.png'), icon);
      fs.writeFileSync(path.join(buildDir, 'icon@2x.png'), icon2x);
      fs.writeFileSync(path.join(buildDir, 'icon@3x.png'), icon3x);
      fs.writeFileSync(path.join(buildDir, 'logo.png'), logo);
      fs.writeFileSync(path.join(buildDir, 'logo@2x.png'), logo2x);
      fs.writeFileSync(path.join(buildDir, 'strip.png'), strip);
      fs.writeFileSync(path.join(buildDir, 'strip@2x.png'), strip2x);
      fs.writeFileSync(path.join(buildDir, 'strip@3x.png'), strip3x);
      console.log('Icon and strip assets generated successfully');
      
      // Compute SHA1 hashes for every file -> manifest.json
      const manifest: Record<string, string> = {};
      for (const f of fs.readdirSync(buildDir)) {
        manifest[f] = crypto.createHash("sha1").update(fs.readFileSync(path.join(buildDir, f))).digest("hex");
      }
      fs.writeFileSync(path.join(buildDir, "manifest.json"), JSON.stringify(manifest, null, 2));

      // Create PKCS#7 signature with certificate chain for iOS
      console.log('Creating PKCS#7 signature for iOS compatibility...');
      const manifestData = fs.readFileSync(path.join(buildDir, 'manifest.json'));
      
      try {
        // Format certificates for node-forge compatibility
        const formatPemForForge = (data: string, type: 'CERTIFICATE' | 'PRIVATE KEY'): string => {
          const clean = data.replace(/\s+/g, '').replace(/-----[^-]*-----/g, '');
          const lines = clean.match(/.{1,64}/g) || [];
          return `-----BEGIN ${type}-----\n${lines.join('\n')}\n-----END ${type}-----`;
        };
        
        const formattedCert = formatPemForForge(process.env.APPLE_SIGNING_CERT!, 'CERTIFICATE');
        const formattedKey = formatPemForForge(process.env.APPLE_SIGNING_KEY!, 'PRIVATE KEY');
        
        // Parse certificates and key using node-forge with error handling
        console.log('Parsing signing certificate...');
        const signingCert = forge.pki.certificateFromPem(formattedCert);
        console.log('Certificate parsed successfully');
        
        console.log('Parsing private key...');
        const privateKey = forge.pki.privateKeyFromPem(formattedKey);
        console.log('Private key parsed successfully');
        
        // Create PKCS#7 signed data structure
        const p7 = forge.pkcs7.createSignedData();
        p7.content = forge.util.createBuffer(manifestData.toString(), 'utf8');
        
        // Add signer with proper attributes for Apple Wallet
        p7.addSigner({
          key: privateKey,
          certificate: signingCert,
          digestAlgorithm: forge.pki.oids.sha1,
          authenticatedAttributes: [
            {
              type: forge.pki.oids.contentType,
              value: forge.pki.oids.data
            },
            {
              type: forge.pki.oids.messageDigest
              // value is automatically computed by node-forge during signing
            },
            {
              type: forge.pki.oids.signingTime,
              value: new Date() as any
            }
          ]
        });
        
        // Add signing certificate to the chain
        p7.addCertificate(signingCert);
        
        // Add WWDR certificate if available
        if (process.env.APPLE_WWDR_CERT) {
          try {
            const formattedWwdr = formatPemForForge(process.env.APPLE_WWDR_CERT, 'CERTIFICATE');
            const wwdrCert = forge.pki.certificateFromPem(formattedWwdr);
            p7.addCertificate(wwdrCert);
            console.log('Added WWDR certificate to chain');
          } catch (wwdrError) {
            console.log('WWDR certificate format issue, proceeding without it');
          }
        }
        
        // Sign and convert to DER format (detached signature as Apple requires)
        p7.sign({ detached: true });
        const asn1 = p7.toAsn1();
        const der = forge.asn1.toDer(asn1).getBytes();
        const signature = Buffer.from(der, 'binary');
        
        fs.writeFileSync(path.join(buildDir, 'signature'), signature);
        console.log(`PKCS#7 signature created (${signature.length} bytes) - iOS compatible`);
        
      } catch (forgeError) {
        console.log('PKCS#7 creation failed, error:', (forgeError as Error).message);
        console.log('Creating fallback signature with multiple key format attempts...');
        
        const keyData = process.env.APPLE_SIGNING_KEY!;
        
        // Diagnostic information about the key
        console.log('Key diagnostic info:');
        console.log('- Key length:', keyData.length);
        console.log('- Key starts with:', keyData.substring(0, 50));
        console.log('- Key ends with:', keyData.substring(keyData.length - 50));
        console.log('- Contains BEGIN:', keyData.includes('-----BEGIN'));
        console.log('- Contains END:', keyData.includes('-----END'));
        
        const sign = crypto.createSign('SHA1');
        sign.update(manifestData);
        
        let signature: Buffer | null = null;
        
        // Validate key data first
        if (!keyData || keyData.length < 100) {
          throw new Error('Private key data is missing or too short');
        }
        
        // Try multiple key formats to handle different certificate types
        const keyFormats = [];
        
        // Original format
        keyFormats.push(keyData);
        
        // Try to fix common formatting issues
        if (keyData.includes('-----BEGIN') && keyData.includes('-----END')) {
          // Standard PEM formats
          keyFormats.push(
            keyData.replace(/-----BEGIN.*PRIVATE KEY-----/, '-----BEGIN PRIVATE KEY-----')
                  .replace(/-----END.*PRIVATE KEY-----/, '-----END PRIVATE KEY-----')
          );
          keyFormats.push(
            keyData.replace(/-----BEGIN.*PRIVATE KEY-----/, '-----BEGIN RSA PRIVATE KEY-----')
                  .replace(/-----END.*PRIVATE KEY-----/, '-----END RSA PRIVATE KEY-----')
          );
          keyFormats.push(
            keyData.replace(/-----BEGIN.*PRIVATE KEY-----/, '-----BEGIN EC PRIVATE KEY-----')
                  .replace(/-----END.*PRIVATE KEY-----/, '-----END EC PRIVATE KEY-----')
          );
        }
        
        // Extract base64 content and reformat
        const base64Match = keyData.match(/-----BEGIN[^-]*-----\s*([A-Za-z0-9+/=\s]+)\s*-----END[^-]*-----/);
        if (base64Match && base64Match[1]) {
          const clean = base64Match[1].replace(/\s+/g, '');
          if (clean.length > 100) {
            const lines = clean.match(/.{1,64}/g) || [];
            keyFormats.push(`-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`);
            keyFormats.push(`-----BEGIN RSA PRIVATE KEY-----\n${lines.join('\n')}\n-----END RSA PRIVATE KEY-----`);
            keyFormats.push(`-----BEGIN EC PRIVATE KEY-----\n${lines.join('\n')}\n-----END EC PRIVATE KEY-----`);
          }
        }
        
        // Try base64 decode and re-encode if needed
        try {
          const decoded = Buffer.from(keyData, 'base64');
          if (decoded.length > 100) {
            const encoded = decoded.toString('base64');
            const lines = encoded.match(/.{1,64}/g) || [];
            keyFormats.push(`-----BEGIN PRIVATE KEY-----\n${lines.join('\n')}\n-----END PRIVATE KEY-----`);
          }
        } catch (e) {
          // Not base64, continue
        }
        
        for (let i = 0; i < keyFormats.length; i++) {
          try {
            const testSign = crypto.createSign('SHA1');
            testSign.update(manifestData);
            signature = testSign.sign(keyFormats[i]);
            console.log(`Signature created with key format ${i + 1} (${signature.length} bytes)`);
            break;
          } catch (keyError) {
            console.log(`Key format ${i + 1} failed:`, (keyError as Error).message);
            continue;
          }
        }
        
        if (!signature) {
          // Try with OpenSSL as final fallback
          try {
            console.log('Attempting OpenSSL fallback...');
            const { execSync } = require('child_process');
            const fsSync = require('fs');
            const pathSync = require('path');
            
            // Write key to temp file for OpenSSL
            const tempKeyPath = `/tmp/temp-key-${Date.now()}.pem`;
            fsSync.writeFileSync(tempKeyPath, keyData);
            
            // Create signature with OpenSSL
            const manifestPath = `/tmp/manifest-${Date.now()}.json`;
            fsSync.writeFileSync(manifestPath, manifestData);
            
            const signaturePath = `/tmp/signature-${Date.now()}.bin`;
            execSync(`openssl dgst -sha1 -sign ${tempKeyPath} -out ${signaturePath} ${manifestPath}`);
            
            signature = fsSync.readFileSync(signaturePath) as Buffer;
            console.log(`OpenSSL signature created (${signature.length} bytes)`);
            
            // Cleanup
            fsSync.unlinkSync(tempKeyPath);
            fsSync.unlinkSync(manifestPath);
            fsSync.unlinkSync(signaturePath);
            
          } catch (opensslError) {
            console.log('OpenSSL fallback failed:', (opensslError as Error).message);
            throw new Error('All signing methods failed - certificate/key format incompatible');
          }
        }
        
        if (!signature) {
          throw new Error('Failed to create signature');
        }
        
        fs.writeFileSync(path.join(buildDir, 'signature'), signature);
        console.log(`Fallback signature written successfully`);
      }

      // Create ZIP file with JSZip
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      // Add all files from build directory to ZIP
      for (const filename of fs.readdirSync(buildDir)) {
        const filePath = path.join(buildDir, filename);
        const fileContent = fs.readFileSync(filePath);
        zip.file(filename, fileContent);
        console.log(`Added ${filename} to ZIP (${fileContent.length} bytes)`);
      }
      
      const passBuffer = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 }
      });
      
      console.log('Files in pkpass: pass.json, manifest.json, signature');
      
      // Clean up
      fs.rmSync(buildDir, { recursive: true, force: true });
      
      console.log(`Apple Wallet pass created with Node.js crypto (${passBuffer.length} bytes)`);
      return passBuffer;
      
    } catch (buildError) {
      // Clean up on error
      if (fs.existsSync(buildDir)) {
        fs.rmSync(buildDir, { recursive: true, force: true });
      }
      throw buildError;
    }
    
  } catch (error: any) {
    console.error('Apple Wallet pass generation failed:', error.message);
    throw new Error(`Failed to create Apple Wallet pass: ${error.message}`);
  }
}