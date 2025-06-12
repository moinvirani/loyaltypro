import type { LoyaltyCard } from '@db/schema';
import { execSync } from "child_process";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import writeCerts from "../helpers/writeCerts";

export async function generateAppleWalletPass(card: LoyaltyCard, serialNumber?: string): Promise<Buffer> {
  try {
    // Validate required environment variables
    if (!process.env.APPLE_PASS_TYPE_ID || !process.env.APPLE_TEAM_ID || 
        !process.env.APPLE_SIGNING_CERT || !process.env.APPLE_SIGNING_KEY || 
        !process.env.APPLE_WWDR_CERT) {
      throw new Error('Missing required Apple Wallet configuration');
    }

    console.log('Creating Apple Wallet pass with OpenSSL signing...');
    
    const design = card.design as any;
    const serial = serialNumber || `card-${card.id}-${Date.now()}`;
    
    // Write certificates to temporary files
    const { cert, key, wwdr } = writeCerts();
    
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

      // OpenSSL sign
      execSync(`openssl smime -binary -sign -signer ${cert} -inkey ${key} -certfile ${wwdr} -in manifest.json -out signature -outform DER -nodetach -noattr`, 
               { cwd: buildDir });

      // Zip everything -> Buffer
      const zipName = `/tmp/${serial}.pkpass`;
      execSync(`zip -r -q ${zipName} .`, { cwd: buildDir });
      
      // Log files in pkpass for verification
      try {
        const zipContents = execSync(`unzip -l ${zipName}`, { encoding: 'utf8' });
        console.log('Files in pkpass:', zipContents);
      } catch (zipError) {
        console.warn('Could not list zip contents:', zipError);
      }
      
      const passBuffer = fs.readFileSync(zipName);
      
      // Clean up
      fs.rmSync(buildDir, { recursive: true, force: true });
      fs.unlinkSync(zipName);
      
      console.log(`Apple Wallet pass created with OpenSSL (${passBuffer.length} bytes)`);
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