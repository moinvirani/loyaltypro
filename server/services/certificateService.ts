import { createHash } from 'crypto';
import forge from 'node-forge';

interface CertificateValidationResult {
  isValid: boolean;
  errors: string[];
  details?: {
    subject?: string;
    issuer?: string;
    validFrom?: Date;
    validTo?: Date;
    serialNumber?: string;
  };
}

export function formatPEM(base64Content: string, type: 'CERTIFICATE' | 'PRIVATE KEY'): string {
  try {
    // If content is already in PEM format, return as-is
    if (base64Content.includes('-----BEGIN')) {
      return base64Content;
    }

    // Remove any whitespace and validate base64
    const content = base64Content.replace(/[\r\n\s]/g, '');

    // Validate base64 content
    try {
      Buffer.from(content, 'base64');
    } catch (e) {
      throw new Error('Invalid base64 content. Please ensure you\'ve properly converted your certificate to base64.');
    }

    // For P12/PFX format private keys, try to convert to PEM
    if (type === 'PRIVATE KEY') {
      try {
        // Try to parse as P12/PFX
        const p12Der = forge.util.decode64(content);
        const p12Asn1 = forge.asn1.fromDer(p12Der);

        // Try without password first
        try {
          const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1);
          const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
          const keyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

          if (keyBag?.key) {
            return forge.pki.privateKeyToPem(keyBag.key);
          }
        } catch (e) {
          // If no password fails, try with empty password
          const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, '');
          const bags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
          const keyBag = bags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];

          if (keyBag?.key) {
            return forge.pki.privateKeyToPem(keyBag.key);
          }
        }
      } catch (e) {
        console.log('Note: P12/PFX conversion failed. If you provided a P12/PFX file, make sure to extract the private key first.');
      }
    }

    // Split into lines of 64 characters
    const lines = content.match(/.{1,64}/g) || [];
    return [
      `-----BEGIN ${type}-----`,
      ...lines,
      `-----END ${type}-----`
    ].join('\n');

  } catch (error: any) {
    console.error('PEM formatting error:', error);
    throw new Error(`Failed to format certificate: ${error.message}. Make sure you've provided a valid base64-encoded ${type.toLowerCase()}.`);
  }
}

export function validatePrivateKey(pemKey: string): CertificateValidationResult {
  const errors: string[] = [];
  let isValid = true;

  try {
    // Try parsing as RSA key first
    try {
      const privateKey = forge.pki.privateKeyFromPem(pemKey);

      // Verify key functionality with a test signature
      const md = forge.md.sha256.create();
      md.update('test', 'utf8');
      privateKey.sign(md);

      return { isValid: true, errors: [] };
    } catch (e: any) {
      // If RSA parsing fails, try PKCS#8
      try {
        const privateKey = forge.pki.decryptRsaPrivateKey(pemKey);
        if (!privateKey) {
          throw new Error('Failed to parse private key');
        }
        return { isValid: true, errors: [] };
      } catch (e2: any) {
        errors.push('Failed to parse private key in both RSA and PKCS#8 formats');
        errors.push(`RSA Error: ${e.message}`);
        errors.push(`PKCS#8 Error: ${e2.message}`);
        isValid = false;
      }
    }
  } catch (error: any) {
    errors.push(`Private key validation error: ${error.message}`);
    isValid = false;
  }

  return { isValid, errors };
}

export function validateSigningCertificate(pemCert: string): CertificateValidationResult {
  const errors: string[] = [];
  let isValid = true;
  let details;

  try {
    const cert = forge.pki.certificateFromPem(pemCert);

    details = {
      subject: cert.subject.getField('CN')?.value,
      issuer: cert.issuer.getField('CN')?.value,
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter,
      serialNumber: cert.serialNumber
    };

    // Check if certificate is expired
    const now = new Date();
    if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
      errors.push(`Certificate is ${now < cert.validity.notBefore ? 'not yet valid' : 'expired'}`);
      isValid = false;
    }

    // Check for Pass Type ID in subject
    if (!cert.subject.getField('CN')?.value?.includes('pass.')) {
      errors.push('Certificate subject does not contain valid Pass Type ID');
      isValid = false;
    }

  } catch (error: any) {
    errors.push(`Signing certificate validation error: ${error.message}`);
    isValid = false;
  }

  return { isValid, errors, details };
}

export function validateWWDRCertificate(pemCert: string): CertificateValidationResult {
  const errors: string[] = [];
  let isValid = true;
  let details;

  try {
    const cert = forge.pki.certificateFromPem(pemCert);

    details = {
      subject: cert.subject.getField('CN')?.value,
      issuer: cert.issuer.getField('CN')?.value,
      validFrom: cert.validity.notBefore,
      validTo: cert.validity.notAfter,
      serialNumber: cert.serialNumber
    };

    // Verify it's an Apple WWDR certificate
    if (!cert.issuer.getField('CN')?.value?.includes('Apple')) {
      errors.push('Not a valid Apple WWDR certificate');
      isValid = false;
    }

    // Check if certificate is expired
    const now = new Date();
    if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
      errors.push(`Certificate is ${now < cert.validity.notBefore ? 'not yet valid' : 'expired'}`);
      isValid = false;
    }

  } catch (error: any) {
    errors.push(`WWDR certificate validation error: ${error.message}`);
    isValid = false;
  }

  return { isValid, errors, details };
}

export function diagnosePassCertificates(
  signingCert: string,
  signingKey: string,
  wwdrCert: string
): { isValid: boolean; diagnostics: string[] } {
  const diagnostics: string[] = [];
  let isValid = true;

  try {
    // Validate signing certificate
    const signingCertResult = validateSigningCertificate(signingCert);
    if (!signingCertResult.isValid) {
      isValid = false;
      diagnostics.push('Signing Certificate Issues:');
      signingCertResult.errors.forEach(error => diagnostics.push(`- ${error}`));
    } else {
      diagnostics.push('✓ Signing Certificate is valid');
      if (signingCertResult.details?.validTo) {
        diagnostics.push(`  Subject: ${signingCertResult.details.subject}`);
        diagnostics.push(`  Valid until: ${signingCertResult.details.validTo.toLocaleDateString()}`);
      }
    }

    // Validate private key
    const privateKeyResult = validatePrivateKey(signingKey);
    if (!privateKeyResult.isValid) {
      isValid = false;
      diagnostics.push('Private Key Issues:');
      privateKeyResult.errors.forEach(error => diagnostics.push(`- ${error}`));
    } else {
      diagnostics.push('✓ Private Key is valid');
    }

    // Validate WWDR certificate
    const wwdrResult = validateWWDRCertificate(wwdrCert);
    if (!wwdrResult.isValid) {
      isValid = false;
      diagnostics.push('WWDR Certificate Issues:');
      wwdrResult.errors.forEach(error => diagnostics.push(`- ${error}`));
    } else {
      diagnostics.push('✓ WWDR Certificate is valid');
      if (wwdrResult.details?.validTo) {
        diagnostics.push(`  Issuer: ${wwdrResult.details.issuer}`);
        diagnostics.push(`  Valid until: ${wwdrResult.details.validTo.toLocaleDateString()}`);
      }
    }
  } catch (error: any) {
    isValid = false;
    diagnostics.push(`Unexpected error during certificate validation: ${error.message}`);
  }

  return { isValid, diagnostics };
}