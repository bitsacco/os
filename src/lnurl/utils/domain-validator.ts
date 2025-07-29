import * as https from 'https';
import * as http from 'http';
import * as tls from 'tls';
import { X509Certificate } from 'crypto';
import { URL } from 'url';

// Domain whitelist - trusted domains that don't require additional validation
const DOMAIN_WHITELIST = [
  'bitsacco.com',
  'getalby.com',
  'walletofsatoshi.com',
  'strike.me',
  'zebedee.io',
  'lnpay.co',
];

// Domain blacklist - known problematic or malicious domains
const DOMAIN_BLACKLIST: string[] = [
  // Add known malicious domains here
];

/**
 * Check if a domain is whitelisted
 * @param domain The domain to check
 * @returns True if domain is whitelisted
 */
export function isDomainWhitelisted(domain: string): boolean {
  return DOMAIN_WHITELIST.includes(domain.toLowerCase());
}

/**
 * Check if a domain is blacklisted
 * @param domain The domain to check
 * @returns True if domain is blacklisted
 */
export function isDomainBlacklisted(domain: string): boolean {
  return DOMAIN_BLACKLIST.includes(domain.toLowerCase());
}

/**
 * Validate a domain's SSL certificate with comprehensive security checks
 * @param domain The domain to validate
 * @returns Promise resolving to validation result
 */
export async function validateSSLCertificate(
  domain: string,
): Promise<{ valid: boolean; error?: string; details?: any }> {
  return new Promise((resolve) => {
    const options: https.RequestOptions & { minVersion?: string } = {
      hostname: domain,
      port: 443,
      path: '/',
      method: 'HEAD',
      timeout: 10000,
      // Enforce minimum TLS version
      minVersion: 'TLSv1.2',
      // Reject unauthorized certificates
      rejectUnauthorized: true,
      // Custom agent with stricter settings
      agent: new https.Agent({
        maxCachedSessions: 0, // Disable session caching for security
        minVersion: 'TLSv1.2' as any,
      }),
    };

    const req = https.request(options, async (res) => {
      try {
        const tlsSocket = res.socket as tls.TLSSocket;

        // Get the full certificate chain
        const certChain = tlsSocket.getPeerCertificate(true);

        if (!certChain || Object.keys(certChain).length === 0) {
          resolve({ valid: false, error: 'No certificate found' });
          return;
        }

        // Validate the certificate chain
        const chainValidation = validateCertificateChain(certChain);
        if (!chainValidation.valid) {
          resolve({
            valid: false,
            error: `Certificate chain validation failed: ${chainValidation.error}`,
            details: chainValidation.details,
          });
          return;
        }

        // Check certificate validity dates
        const now = new Date();
        const validFrom = new Date(certChain.valid_from);
        const validTo = new Date(certChain.valid_to);

        if (now < validFrom) {
          resolve({
            valid: false,
            error: 'Certificate not yet valid',
            details: { validFrom: validFrom.toISOString() },
          });
          return;
        }

        if (now > validTo) {
          resolve({
            valid: false,
            error: 'Certificate expired',
            details: { validTo: validTo.toISOString() },
          });
          return;
        }

        // Enhanced domain matching
        const domainValidation = validateDomainMatch(domain, certChain);
        if (!domainValidation.valid) {
          resolve({
            valid: false,
            error: domainValidation.error,
            details: domainValidation.details,
          });
          return;
        }

        // Check for weak algorithms
        const algorithmCheck = checkCertificateAlgorithm(certChain);
        if (!algorithmCheck.valid) {
          resolve({
            valid: false,
            error: algorithmCheck.error,
            details: algorithmCheck.details,
          });
          return;
        }

        // Check certificate revocation status
        const revocationCheck = await checkCertificateRevocation(certChain);
        if (!revocationCheck.valid) {
          resolve({
            valid: false,
            error: revocationCheck.error,
            details: revocationCheck.details,
          });
          return;
        }

        // Get protocol and cipher information
        const protocol = tlsSocket.getProtocol();
        const cipher = tlsSocket.getCipher();

        // Verify TLS version
        if (protocol && ['TLSv1', 'TLSv1.1'].includes(protocol)) {
          resolve({
            valid: false,
            error: `Insecure TLS version: ${protocol}`,
            details: { protocol },
          });
          return;
        }

        resolve({
          valid: true,
          details: {
            protocol,
            cipher: cipher?.name,
            issuer: certChain.issuer,
            subject: certChain.subject,
            validFrom: validFrom.toISOString(),
            validTo: validTo.toISOString(),
          },
        });
      } catch (error) {
        resolve({
          valid: false,
          error: `Certificate validation error: ${error.message}`,
        });
      }
    });

    req.on('error', (error) => {
      if (error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
        resolve({
          valid: false,
          error: 'Certificate chain could not be verified',
        });
      } else if (error.code === 'CERT_HAS_EXPIRED') {
        resolve({
          valid: false,
          error: 'Certificate has expired',
        });
      } else {
        resolve({
          valid: false,
          error: `SSL connection error: ${error.message}`,
        });
      }
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ valid: false, error: 'Connection timeout' });
    });

    req.end();
  });
}

/**
 * Validate the certificate chain
 */
function validateCertificateChain(cert: tls.DetailedPeerCertificate): {
  valid: boolean;
  error?: string;
  details?: any;
} {
  const chain: tls.DetailedPeerCertificate[] = [];
  let current: tls.DetailedPeerCertificate | null = cert;

  // Build the certificate chain
  while (current) {
    chain.push(current);
    // Check for self-signed certificate (issuer equals subject)
    if (current.issuerCertificate === current) {
      break;
    }
    current =
      (current.issuerCertificate as tls.DetailedPeerCertificate) || null;
  }

  // Verify we have a complete chain
  if (chain.length < 2) {
    return {
      valid: false,
      error: 'Incomplete certificate chain',
      details: { chainLength: chain.length },
    };
  }

  // Check each certificate in the chain
  for (let i = 0; i < chain.length - 1; i++) {
    const cert = chain[i];
    const issuer = chain[i + 1];

    // Verify the issuer relationship
    if (!verifyIssuerRelationship(cert, issuer)) {
      return {
        valid: false,
        error: `Invalid issuer relationship at chain position ${i}`,
        details: {
          certSubject: cert.subject,
          expectedIssuer: cert.issuer,
          actualIssuer: issuer.subject,
        },
      };
    }
  }

  return { valid: true };
}

/**
 * Verify issuer relationship between certificates
 */
function verifyIssuerRelationship(
  cert: tls.DetailedPeerCertificate,
  issuer: tls.DetailedPeerCertificate,
): boolean {
  // Compare issuer DN with subject DN
  const certIssuer = JSON.stringify(cert.issuer);
  const issuerSubject = JSON.stringify(issuer.subject);
  return certIssuer === issuerSubject;
}

/**
 * Enhanced domain matching with wildcard support
 */
function validateDomainMatch(
  domain: string,
  cert: tls.DetailedPeerCertificate,
): {
  valid: boolean;
  error?: string;
  details?: any;
} {
  const certDomains: string[] = [];

  // Add CN if present
  if (cert.subject?.CN) {
    certDomains.push(cert.subject.CN);
  }

  // Add all SANs
  if (cert.subjectaltname) {
    const altNames = cert.subjectaltname.split(', ');
    altNames.forEach((name) => {
      if (name.startsWith('DNS:')) {
        certDomains.push(name.substring(4));
      }
    });
  }

  // Check if domain matches any certificate domain
  const domainLower = domain.toLowerCase();
  const matched = certDomains.some((certDomain) => {
    const certDomainLower = certDomain.toLowerCase();

    // Exact match
    if (certDomainLower === domainLower) {
      return true;
    }

    // Wildcard match
    if (certDomainLower.startsWith('*.')) {
      const wildcardBase = certDomainLower.substring(2);
      // Ensure we're matching a subdomain, not partial domain
      if (domainLower.endsWith(wildcardBase)) {
        const subdomainPart = domainLower.substring(
          0,
          domainLower.length - wildcardBase.length,
        );
        // Ensure it's a valid subdomain (no dots in the subdomain part for wildcard)
        return (
          subdomainPart.endsWith('.') &&
          !subdomainPart.slice(0, -1).includes('.')
        );
      }
    }

    return false;
  });

  if (!matched) {
    return {
      valid: false,
      error: 'Domain does not match certificate',
      details: {
        requestedDomain: domain,
        certificateDomains: certDomains,
      },
    };
  }

  return { valid: true };
}

/**
 * Check certificate algorithm strength
 */
function checkCertificateAlgorithm(cert: tls.DetailedPeerCertificate): {
  valid: boolean;
  error?: string;
  details?: any;
} {
  // List of weak/deprecated algorithms
  const weakAlgorithms = ['md5', 'sha1'];
  const signatureAlg = cert.signatureAlgorithm?.toLowerCase() || '';

  if (weakAlgorithms.some((weak) => signatureAlg.includes(weak))) {
    return {
      valid: false,
      error: 'Certificate uses weak signature algorithm',
      details: { signatureAlgorithm: cert.signatureAlgorithm },
    };
  }

  // Check key size for RSA
  if (cert.bits && cert.bits < 2048) {
    return {
      valid: false,
      error: 'Certificate key size too small',
      details: { keySize: cert.bits, minimum: 2048 },
    };
  }

  return { valid: true };
}

/**
 * Check certificate revocation status via OCSP
 * Note: This is a simplified implementation. In production, consider using
 * a dedicated OCSP library or service for comprehensive revocation checking.
 */
async function checkCertificateRevocation(
  cert: tls.DetailedPeerCertificate,
): Promise<{
  valid: boolean;
  error?: string;
  details?: any;
}> {
  try {
    // Extract OCSP URLs from certificate
    const ocspUrls = extractOCSPUrls(cert);

    if (ocspUrls.length === 0) {
      // No OCSP URLs found, consider implementing CRL checking as fallback
      return {
        valid: true,
        details: { note: 'No OCSP URLs found in certificate' },
      };
    }

    // For now, we'll implement a basic check
    // In production, implement full OCSP request/response handling
    return {
      valid: true,
      details: {
        note: 'OCSP checking requires additional implementation',
        ocspUrls,
      },
    };
  } catch (error) {
    return {
      valid: false,
      error: `Revocation check failed: ${error.message}`,
    };
  }
}

/**
 * Extract OCSP URLs from certificate extensions
 */
function extractOCSPUrls(cert: tls.DetailedPeerCertificate): string[] {
  const urls: string[] = [];

  // Check for Authority Information Access extension
  if (cert.infoAccess) {
    // Parse the info access data
    const infoAccessStr = cert.infoAccess.toString();
    const ocspMatches = infoAccessStr.match(/OCSP - URI:(https?:\/\/[^\s]+)/g);

    if (ocspMatches) {
      ocspMatches.forEach((match) => {
        const url = match.replace('OCSP - URI:', '').trim();
        urls.push(url);
      });
    }
  }

  return urls;
}

/**
 * Validate a complete URL
 * @param url The URL to validate
 * @returns Validation result with details
 */
export async function validateUrl(
  url: string,
): Promise<{ valid: boolean; error?: string; domain?: string }> {
  try {
    const parsed = new URL(url);

    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'URL must use HTTPS' };
    }

    const domain = parsed.hostname;

    // Check blacklist first
    if (isDomainBlacklisted(domain)) {
      return { valid: false, error: 'Domain is blacklisted' };
    }

    // Skip SSL validation for whitelisted domains
    if (isDomainWhitelisted(domain)) {
      return { valid: true, domain };
    }

    // Validate SSL certificate
    const sslResult = await validateSSLCertificate(domain);
    if (!sslResult.valid) {
      return {
        valid: false,
        error: `SSL validation failed: ${sslResult.error}`,
      };
    }

    return { valid: true, domain };
  } catch (error) {
    return { valid: false, error: `Invalid URL: ${error.message}` };
  }
}

/**
 * Check if a URL is reachable
 * @param url The URL to check
 * @param timeout Timeout in milliseconds
 * @returns True if URL is reachable
 */
export async function isUrlReachable(
  url: string,
  timeout: number = 5000,
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const module = parsed.protocol === 'https:' ? https : http;

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname,
        method: 'HEAD',
        timeout,
      };

      const req = module.request(options, (res) => {
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });

      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });

      req.end();
    } catch {
      resolve(false);
    }
  });
}

/**
 * Extract and validate domain from Lightning Address
 * @param address The Lightning Address
 * @returns Domain if valid, null otherwise
 */
export function extractDomainFromAddress(address: string): string | null {
  try {
    const parts = address.split('@');
    if (parts.length !== 2) {
      return null;
    }

    const domain = parts[1];

    // Basic domain validation
    const domainPattern = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!domainPattern.test(domain)) {
      return null;
    }

    return domain;
  } catch {
    return null;
  }
}
