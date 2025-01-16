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

interface CertificateInfo {
  subject: string;
  issuer: string;
  validFrom: Date;
  validTo: Date;
  serialNumber: string;
}

export function formatPEM(base64Content: string, type: 'CERTIFICATE' | 'PRIVATE KEY'): string {
  try {
    // First decode from base64 to get the original content
    const decoded = Buffer.from(base64Content, 'base64').toString('base64');

    // Split the content into lines of 64 characters
    const chunks = decoded.match(/.{1,64}/g) || [];

    return [
      `-----BEGIN ${type}-----`,
      ...chunks,
      `-----END ${type}-----`
    ].join('\n');
  } catch (error) {
    throw new Error(`Failed to format PEM content: ${error}`);
  }
}

export function validatePrivateKey(pemKey: string): CertificateValidationResult {
  const errors: string[] = [];
  let isValid = true;

  try {
    // Remove headers and convert to forge key
    const keyContent = pemKey
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '');

    const privateKey = forge.pki.privateKeyFromPem(pemKey);

    // Basic key validation
    if (!privateKey) {
      errors.push('Invalid private key format');
      isValid = false;
    }

    // Additional key checks
    if (isValid) {
      try {
        const publicKey = forge.pki.rsa.setPublicKey(privateKey.n, privateKey.e);
        const testData = 'test';
        const signature = privateKey.sign(forge.md.sha256.create().update(testData));
        const verified = publicKey.verify(
          forge.md.sha256.create().update(testData).digest().bytes(),
          signature
        );

        if (!verified) {
          errors.push('Private key failed signature verification test');
          isValid = false;
        }
      } catch (e) {
        errors.push('Failed to perform key pair validation');
        isValid = false;
      }
    }
  } catch (error: any) {
    errors.push(`Private key validation error: ${error.message}`);
    isValid = false;
  }

  return { isValid, errors };
}

export function validateCertificate(pemCert: string): CertificateValidationResult {
  const errors: string[] = [];
  let isValid = true;
  let certInfo: CertificateInfo | undefined;

  try {
    // Remove headers and convert to forge cert
    const certContent = pemCert
      .replace('-----BEGIN CERTIFICATE-----', '')
      .replace('-----END CERTIFICATE-----', '')
      .replace(/\s/g, '');

    const cert = forge.pki.certificateFromPem(pemCert);

    // Extract certificate information
    certInfo = {
      subject: cert.subject.getField('CN').value,
      issuer: cert.issuer.getField('CN').value,
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

    // Verify certificate attributes
    if (!cert.subject.getField('CN')) {
      errors.push('Certificate missing Common Name (CN)');
      isValid = false;
    }

    // Check key usage (if present)
    const keyUsage = cert.getExtension('keyUsage');
    if (keyUsage && !keyUsage.digitalSignature) {
      errors.push('Certificate not valid for digital signatures');
      isValid = false;
    }
  } catch (error: any) {
    errors.push(`Certificate validation error: ${error.message}`);
    isValid = false;
  }

  return { isValid, errors, details: certInfo };
}

export function validateWWDRCertificate(pemCert: string): CertificateValidationResult {
  const result = validateCertificate(pemCert);
  
  // Additional WWDR-specific checks
  try {
    const cert = forge.pki.certificateFromPem(pemCert);
    
    // Verify it's an Apple WWDR certificate
    if (!cert.issuer.getField('CN').value.includes('Apple')) {
      result.errors.push('Not a valid Apple WWDR certificate');
      result.isValid = false;
    }
    
    // Check for specific WWDR extensions
    const extUsage = cert.getExtension('extKeyUsage');
    if (!extUsage || !extUsage.includes('1.2.840.113635.100.4.1')) {
      result.errors.push('Missing required Apple certificate extensions');
      result.isValid = false;
    }
  } catch (error: any) {
    result.errors.push(`WWDR certificate validation error: ${error.message}`);
    result.isValid = false;
  }

  return result;
}

export function diagnosePassCertificates(
  signingCert: string,
  signingKey: string,
  wwdrCert: string
): { isValid: boolean; diagnostics: string[] } {
  const diagnostics: string[] = [];
  let isValid = true;

  // Validate signing certificate
  const signingCertResult = validateCertificate(signingCert);
  if (!signingCertResult.isValid) {
    isValid = false;
    diagnostics.push('Signing Certificate Issues:');
    signingCertResult.errors.forEach(error => diagnostics.push(`- ${error}`));
  } else {
    diagnostics.push('✓ Signing Certificate is valid');
    const details = signingCertResult.details;
    if (details) {
      diagnostics.push(`  Subject: ${details.subject}`);
      diagnostics.push(`  Valid until: ${details.validTo.toLocaleDateString()}`);
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
    const details = wwdrResult.details;
    if (details) {
      diagnostics.push(`  Issuer: ${details.issuer}`);
      diagnostics.push(`  Valid until: ${details.validTo.toLocaleDateString()}`);
    }
  }

  return { isValid, diagnostics };
}
