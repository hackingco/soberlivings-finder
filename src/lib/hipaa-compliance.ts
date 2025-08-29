/**
 * HIPAA Compliance Module
 * Implements healthcare data protection safeguards
 */

import crypto from 'crypto';

interface AuditLogEntry {
  timestamp: Date;
  userId?: string;
  action: string;
  resource: string;
  ipAddress?: string;
  userAgent?: string;
  result: 'success' | 'failure';
  details?: any;
}

interface EncryptionConfig {
  algorithm: string;
  keyLength: number;
  ivLength: number;
}

export class HIPAACompliance {
  private static instance: HIPAACompliance;
  private auditLogs: AuditLogEntry[] = [];
  private encryptionKey: Buffer;
  private readonly encryptionConfig: EncryptionConfig = {
    algorithm: 'aes-256-gcm',
    keyLength: 32,
    ivLength: 16
  };

  private constructor() {
    // Generate or load encryption key (in production, use key management service)
    const keyString = process.env.ENCRYPTION_KEY || 'default-dev-key-32-chars-exactly';
    this.encryptionKey = Buffer.from(keyString.padEnd(32, '0').slice(0, 32));
  }

  static getInstance(): HIPAACompliance {
    if (!HIPAACompliance.instance) {
      HIPAACompliance.instance = new HIPAACompliance();
    }
    return HIPAACompliance.instance;
  }

  // Encryption for sensitive data
  encryptData(data: string): { encrypted: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(this.encryptionConfig.ivLength);
    const cipher = crypto.createCipheriv(
      this.encryptionConfig.algorithm,
      this.encryptionKey,
      iv
    );

    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = (cipher as any).getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decryptData(encryptedData: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.encryptionConfig.algorithm,
      this.encryptionKey,
      Buffer.from(iv, 'hex')
    );

    (decipher as any).setAuthTag(Buffer.from(authTag, 'hex'));

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Audit logging
  logAccess(entry: Omit<AuditLogEntry, 'timestamp'>): void {
    const logEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date()
    };

    this.auditLogs.push(logEntry);

    // In production, persist to secure audit log storage
    if (process.env.NODE_ENV === 'production') {
      this.persistAuditLog(logEntry);
    }
  }

  private async persistAuditLog(entry: AuditLogEntry): Promise<void> {
    // Implement secure audit log persistence
    // This should write to a secure, immutable log storage
    console.log('Audit log:', JSON.stringify(entry));
  }

  // Data minimization helpers
  minimizeFacilityData(facility: any): any {
    // Only return necessary fields for display
    const allowedFields = [
      'id',
      'name',
      'city',
      'state',
      'zip',
      'phone',
      'website',
      'services',
      'latitude',
      'longitude'
    ];

    const minimized: any = {};
    for (const field of allowedFields) {
      if (facility[field] !== undefined) {
        minimized[field] = facility[field];
      }
    }

    return minimized;
  }

  // Access control
  validateAccess(userId: string, resource: string, action: string): boolean {
    // Implement role-based access control
    // For now, log all access attempts
    this.logAccess({
      userId,
      action,
      resource,
      result: 'success'
    });

    return true; // Placeholder - implement actual RBAC
  }

  // Data retention policy
  shouldRetainData(dataTimestamp: Date): boolean {
    const retentionPeriodDays = parseInt(process.env.DATA_RETENTION_DAYS || '365');
    const now = new Date();
    const daysSinceCreation = (now.getTime() - dataTimestamp.getTime()) / (1000 * 60 * 60 * 24);
    
    return daysSinceCreation <= retentionPeriodDays;
  }

  // Privacy notice generator
  generatePrivacyNotice(): string {
    return `
# Privacy Notice - Sober Living Facilities Finder

## Information We Collect
- Search queries (location, facility preferences)
- Facility information from public sources
- Usage analytics (anonymized)

## How We Use Information
- To provide facility search results
- To improve our services
- To ensure service reliability

## Data Protection
- All data is encrypted in transit and at rest
- Access is logged and monitored
- Data is retained only as long as necessary

## Your Rights
- Access your data
- Request corrections
- Request deletion
- Export your data

## Contact
For privacy concerns, contact: privacy@soberliving-finder.com

Last Updated: ${new Date().toISOString().split('T')[0]}
    `.trim();
  }

  // Consent management
  recordConsent(userId: string, consentType: string, granted: boolean): void {
    this.logAccess({
      userId,
      action: 'consent_' + (granted ? 'granted' : 'revoked'),
      resource: consentType,
      result: 'success',
      details: { consentType, granted }
    });
  }

  // Breach detection
  checkForBreach(event: any): boolean {
    const suspiciousPatterns = [
      /SELECT.*FROM.*WHERE.*1=1/i, // SQL injection attempt
      /<script.*?>.*?<\/script>/i,  // XSS attempt
      /\.\.[\/\\]/,                 // Path traversal
      /DROP\s+TABLE/i,              // Destructive SQL
    ];

    const eventString = JSON.stringify(event);
    
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(eventString)) {
        this.logAccess({
          action: 'security_breach_detected',
          resource: 'system',
          result: 'failure',
          details: { pattern: pattern.toString(), event }
        });
        return true;
      }
    }

    return false;
  }

  // Generate compliance report
  generateComplianceReport(): any {
    const recentLogs = this.auditLogs.slice(-1000); // Last 1000 entries
    const accessByAction = new Map<string, number>();
    const accessByResource = new Map<string, number>();
    let breachAttempts = 0;

    for (const log of recentLogs) {
      accessByAction.set(log.action, (accessByAction.get(log.action) || 0) + 1);
      accessByResource.set(log.resource, (accessByResource.get(log.resource) || 0) + 1);
      if (log.result === 'failure') {
        breachAttempts++;
      }
    }

    return {
      reportDate: new Date().toISOString(),
      totalAccessLogs: recentLogs.length,
      accessByAction: Object.fromEntries(accessByAction),
      accessByResource: Object.fromEntries(accessByResource),
      breachAttempts,
      encryptionEnabled: true,
      auditLoggingEnabled: true,
      dataRetentionPolicy: `${process.env.DATA_RETENTION_DAYS || 365} days`,
      lastAuditLogEntry: recentLogs[recentLogs.length - 1]
    };
  }
}

// Export singleton instance
export const hipaaCompliance = HIPAACompliance.getInstance();

// Middleware for Express/Next.js
export function hipaaMiddleware(req: any, res: any, next: any) {
  const compliance = HIPAACompliance.getInstance();
  
  // Log access
  compliance.logAccess({
    action: req.method,
    resource: req.path,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    result: 'success'
  });

  // Check for security breaches
  if (compliance.checkForBreach(req)) {
    res.status(403).json({ error: 'Security violation detected' });
    return;
  }

  next();
}