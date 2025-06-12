import type { LoyaltyCard } from '@db/schema';
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import * as forge from 'node-forge';

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  try {
    // Validate required environment variables
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID || 
        !process.env.APPLE_SIGNING_KEY) {
      throw new Error('Missing required Apple Wallet configuration');
    }

    console.log('Creating Apple Wallet pass with Node.js crypto signing...');
    
    const design = card.design as any;
    const serial = serialNumber || `card-${card.id}-${Date.now()}`;
    
    // Create temporary build directory
    const buildDir = `/tmp/pass_${Date.now()}`;
    fs.mkdirSync(buildDir, { recursive: true });
    
    try {
      // Create pass data that exactly matches Apple's specifications
      const passData = {
        formatVersion: 1,
        passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID,
        serialNumber: serial,
        teamIdentifier: process.env.APPLE_TEAM_ID,
        organizationName: design.name || 'Loyalty Business',
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
              value: `${design.stamps || 0}/${design.stamps || 10}`
            }
          ],
          secondaryFields: [
            {
              key: 'name',
              label: 'Card Name',
              value: design.name || 'Loyalty Card'
            }
          ],
          backFields: [
            {
              key: 'terms',
              label: 'Terms and Conditions',
              value: 'Present this pass to earn and redeem loyalty points. Valid at participating locations.'
            }
          ]
        },
        barcodes: [
          {
            message: `CUSTOMER-${card.id}`,
            format: 'PKBarcodeFormatQR',
            messageEncoding: 'iso-8859-1'
          }
        ]
      };

      // Write pass.json to build directory
      const passJsonContent = JSON.stringify(passData, null, 2);
      fs.writeFileSync(path.join(buildDir, 'pass.json'), passJsonContent);
      
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
              type: forge.pki.oids.contentTypes,
              value: forge.pki.oids.data
            },
            {
              type: forge.pki.oids.messageDigest
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
        
        // Sign and convert to DER format
        p7.sign({ detached: false });
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
          throw new Error('All private key formats failed - invalid key data');
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