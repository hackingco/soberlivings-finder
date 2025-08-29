/**
 * Data validation utility for ETL pipeline
 */

import { TransformedFacility, ValidationResult } from '../types';

export class DataValidator {
  /**
   * Validate a transformed facility record
   */
  validate(record: TransformedFacility): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    let qualityScore = 1.0;

    // Required fields validation
    if (!record.id) {
      errors.push('Missing required field: id');
    }

    if (!record.name || record.name.trim().length === 0) {
      errors.push('Missing required field: name');
    }

    if (!record.city || record.city.trim().length === 0) {
      errors.push('Missing required field: city');
    }

    if (!record.state || record.state.length !== 2) {
      errors.push('Invalid state: must be 2-letter abbreviation');
    }

    // Data quality checks
    if (!record.phone) {
      warnings.push('Missing phone number');
      qualityScore -= 0.1;
    } else if (!this.isValidPhone(record.phone)) {
      warnings.push('Invalid phone number format');
      qualityScore -= 0.05;
    }

    if (!record.latitude || !record.longitude) {
      warnings.push('Missing coordinates');
      qualityScore -= 0.15;
    } else if (!this.isValidCoordinate(record.latitude, record.longitude)) {
      errors.push('Invalid coordinates');
    }

    if (record.website && !this.isValidUrl(record.website)) {
      warnings.push('Invalid website URL');
      qualityScore -= 0.05;
    }

    if (!record.services || record.services.length === 0) {
      warnings.push('No services listed');
      qualityScore -= 0.2;
    }

    if (!record.description || record.description.length < 10) {
      warnings.push('Description too short or missing');
      qualityScore -= 0.1;
    }

    // Check for suspicious data
    if (this.containsSuspiciousContent(record)) {
      errors.push('Record contains suspicious content');
    }

    // Calculate final quality score
    qualityScore = Math.max(0, Math.min(1, qualityScore));

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      qualityScore
    };
  }

  /**
   * Validate phone number format
   */
  private isValidPhone(phone: string): boolean {
    // Accept various formats: (123) 456-7890, 123-456-7890, 1234567890
    const phoneRegex = /^(\+1)?[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  }

  /**
   * Validate coordinates
   */
  private isValidCoordinate(lat: number | null, lng: number | null): boolean {
    if (lat === null || lng === null) return false;
    
    // Check valid ranges
    if (lat < -90 || lat > 90) return false;
    if (lng < -180 || lng > 180) return false;
    
    // Check if in US bounds (rough check)
    if (lat < 24 || lat > 50) return false; // Continental US latitude range
    if (lng < -125 || lng > -66) return false; // Continental US longitude range
    
    return true;
  }

  /**
   * Validate URL format
   */
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check for suspicious content
   */
  private containsSuspiciousContent(record: TransformedFacility): boolean {
    const suspiciousPatterns = [
      /test/i,
      /demo/i,
      /example/i,
      /lorem ipsum/i,
      /xxx/i,
      /^n\/a$/i
    ];

    const fieldsToCheck = [
      record.name,
      record.description,
      record.street
    ];

    for (const field of fieldsToCheck) {
      if (!field) continue;
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(field)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Batch validation
   */
  validateBatch(records: TransformedFacility[]): {
    valid: TransformedFacility[];
    invalid: Array<{ record: TransformedFacility; validation: ValidationResult }>;
    summary: {
      total: number;
      valid: number;
      invalid: number;
      averageQuality: number;
    };
  } {
    const valid: TransformedFacility[] = [];
    const invalid: Array<{ record: TransformedFacility; validation: ValidationResult }> = [];
    let totalQuality = 0;

    for (const record of records) {
      const validation = this.validate(record);
      
      if (validation.isValid) {
        valid.push(record);
      } else {
        invalid.push({ record, validation });
      }
      
      totalQuality += validation.qualityScore;
    }

    return {
      valid,
      invalid,
      summary: {
        total: records.length,
        valid: valid.length,
        invalid: invalid.length,
        averageQuality: records.length > 0 ? totalQuality / records.length : 0
      }
    };
  }
}