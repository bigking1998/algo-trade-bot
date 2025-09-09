// =============================================================================
// PARAMETER SANITIZER - BE-009 Implementation
// =============================================================================
// Comprehensive parameter sanitization system with security validation,
// trading-specific normalization, and environment-aware processing.
//
// Key Features:
// - Multi-layer security validation (XSS, SQL injection, malicious patterns)
// - Trading-specific parameter normalization (symbols, timeframes)
// - Configurable sanitization options for different environments
// - Detailed change tracking and validation results
// =============================================================================

// Local interfaces for sanitization
export interface SanitizationChange {
  path: string;
  original: unknown;
  sanitized: unknown;
  reason: string;
}

export interface SanitizationResult<T = unknown> {
  original: T;
  sanitized: T;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  changes: SanitizationChange[];
  securityFlags: string[];
  metadata: {
    processingTime: number;
    rulesApplied: string[];
    environment: string;
  };
}

export interface SanitizationOptions {
  features: {
    trimStrings: boolean;
    normalizeCase: boolean;
    validateEncoding: boolean;
    removeControlChars: boolean;
    sanitizeHtml: boolean;
    validateSqlInjection: boolean;
    normalizeNumbers: boolean;
    validateArrays: boolean;
    validateObjects: boolean;
  };
  security: {
    maxStringLength?: number;
    maxArrayLength?: number;
    maxObjectDepth?: number;
    allowedProtocols?: string[];
    blockedPatterns?: RegExp[];
    requireSafeCharacters?: boolean;
  };
  trading: {
    normalizeSymbols: boolean;
    validateTimeframes: boolean;
    sanitizeExchanges: boolean;
    normalizeCurrency: boolean;
  };
}

export interface SanitizationContext {
  parameterPath: string;
  parameterType: string;
  environment?: 'development' | 'testing' | 'production';
  depth: number;
  parent?: unknown;
}

// =============================================================================
// PARAMETER SANITIZER CLASS
// =============================================================================

/**
 * Advanced parameter sanitization system with comprehensive security validation
 */
export class ParameterSanitizer {
  private options: SanitizationOptions;

  constructor(options?: Partial<SanitizationOptions>) {
    this.options = this.mergeWithDefaults(options || {});
  }

  /**
   * Main sanitization entry point
   */
  async sanitize<T>(
    value: T,
    context: Omit<SanitizationContext, 'depth'>
  ): Promise<SanitizationResult<T>> {
    const fullContext: SanitizationContext = {
      ...context,
      depth: 0
    };

    const result: SanitizationResult<T> = {
      original: value,
      sanitized: value,
      isValid: true,
      errors: [],
      warnings: [],
      changes: [],
      securityFlags: [],
      metadata: {
        processingTime: 0,
        rulesApplied: [],
        environment: context.environment || 'development'
      }
    };

    const startTime = Date.now();

    try {
      // Depth validation
      if (fullContext.depth > (this.options.security.maxObjectDepth || 10)) {
        result.errors.push('Maximum object depth exceeded');
        result.isValid = false;
        return result;
      }

      // Sanitize the value
      result.sanitized = await this.sanitizeValue(value, fullContext, result);

      // Final validation
      this.validateSanitizedValue(result.sanitized, fullContext, result);

    } catch (error) {
      result.errors.push(`Sanitization failed: ${error instanceof Error ? error.message : String(error)}`);
      result.isValid = false;
    }

    result.metadata.processingTime = Date.now() - startTime;
    return result;
  }

  /**
   * Sanitize value based on type
   */
  private async sanitizeValue<T>(
    value: T,
    context: SanitizationContext,
    result: SanitizationResult<T>
  ): Promise<T> {
    if (value === null || value === undefined) {
      return value;
    }

    const valueType = Array.isArray(value) ? 'array' : typeof value;

    switch (valueType) {
      case 'string':
        return this.sanitizeString(value as unknown as string, context, result) as unknown as T;

      case 'number':
        return this.sanitizeNumber(value as unknown as number, context, result) as unknown as T;

      case 'boolean':
        return this.sanitizeBoolean(value as unknown as boolean, context, result) as unknown as T;

      case 'object':
        if (value instanceof Date) {
          return this.sanitizeDate(value as unknown as Date, context, result) as unknown as T;
        } else {
          return this.sanitizeObject(value as unknown as Record<string, unknown>, context, result) as unknown as T;
        }

      case 'array':
        return this.sanitizeArray(value as unknown as unknown[], context, result) as unknown as T;

      default:
        result.warnings.push(`Unsupported value type: ${valueType}`);
        return value;
    }
  }

  /**
   * Sanitize string values with security validation
   */
  private sanitizeString(
    value: string,
    context: SanitizationContext,
    result: SanitizationResult
  ): string {
    let sanitized = value;
    const original = value;

    // Length validation
    if (this.options.security.maxStringLength && sanitized.length > this.options.security.maxStringLength) {
      sanitized = sanitized.substring(0, this.options.security.maxStringLength);
      result.changes.push({
        path: context.parameterPath,
        original: original,
        sanitized: sanitized,
        reason: 'String truncated due to length limit'
      });
      result.warnings.push(`String truncated from ${original.length} to ${sanitized.length} characters`);
    }

    // Trim whitespace
    if (this.options.features.trimStrings) {
      const trimmed = sanitized.trim();
      if (trimmed !== sanitized) {
        result.changes.push({
          path: context.parameterPath,
          original: sanitized,
          sanitized: trimmed,
          reason: 'Whitespace trimmed'
        });
        sanitized = trimmed;
      }
    }

    // Remove control characters
    if (this.options.features.removeControlChars) {
      const cleaned = sanitized.replace(/[\x00-\x1F\x7F-\x9F]/g, '');
      if (cleaned !== sanitized) {
        result.changes.push({
          path: context.parameterPath,
          original: sanitized,
          sanitized: cleaned,
          reason: 'Control characters removed'
        });
        result.securityFlags.push('control_characters_detected');
        sanitized = cleaned;
      }
    }

    // SQL injection detection
    if (this.options.features.validateSqlInjection) {
      const sqlPatterns = [
        /('|(\-\-)|(;)|(\|)|(\*)|(%))/i,
        /\b(union|select|insert|delete|update|drop|create|alter|exec|execute)\b/i,
        /\b(script|javascript|vbscript|onload|onerror|onclick)\b/i
      ];

      for (const pattern of sqlPatterns) {
        if (pattern.test(sanitized)) {
          result.securityFlags.push('potential_sql_injection');
          result.errors.push('String contains potentially malicious patterns');
          result.isValid = false;
          break;
        }
      }
    }

    // HTML sanitization
    if (this.options.features.sanitizeHtml) {
      const htmlCleaned = sanitized
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&');

      if (htmlCleaned !== sanitized) {
        result.changes.push({
          path: context.parameterPath,
          original: sanitized,
          sanitized: htmlCleaned,
          reason: 'HTML tags removed'
        });
        result.securityFlags.push('html_content_detected');
        sanitized = htmlCleaned;
      }
    }

    // Trading-specific sanitization
    if (context.parameterType === 'symbol' && this.options.trading.normalizeSymbols) {
      const normalized = this.normalizeSymbol(sanitized);
      if (normalized !== sanitized) {
        result.changes.push({
          path: context.parameterPath,
          original: sanitized,
          sanitized: normalized,
          reason: 'Symbol normalized'
        });
        sanitized = normalized;
      }
    }

    if (context.parameterType === 'timeframe' && this.options.trading.validateTimeframes) {
      const validTimeframes = ['1m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '1w'];
      if (!validTimeframes.includes(sanitized)) {
        result.errors.push(`Invalid timeframe: ${sanitized}`);
        result.isValid = false;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize numeric values
   */
  private sanitizeNumber(
    value: number,
    context: SanitizationContext,
    result: SanitizationResult
  ): number {
    let sanitized = value;

    // Validate finite number
    if (!Number.isFinite(value)) {
      result.errors.push('Number is not finite');
      result.isValid = false;
      return 0; // Safe fallback
    }

    // NaN check
    if (Number.isNaN(value)) {
      result.errors.push('Value is NaN');
      result.isValid = false;
      return 0; // Safe fallback
    }

    // Number normalization
    if (this.options.features.normalizeNumbers) {
      // Round to reasonable precision for financial data
      if (context.parameterType === 'price' || context.parameterType === 'amount') {
        const rounded = Math.round(value * 100000000) / 100000000; // 8 decimal places
        if (rounded !== value) {
          result.changes.push({
            path: context.parameterPath,
            original: value,
            sanitized: rounded,
            reason: 'Number rounded to 8 decimal places'
          });
          sanitized = rounded;
        }
      }

      // Risk parameter validation
      if (context.parameterPath.toLowerCase().includes('risk')) {
        if (value < 0) {
          result.warnings.push('Risk parameter should not be negative');
        }
        if (value > 100) {
          result.warnings.push('Risk parameter above 100 may indicate incorrect units');
        }
      }
    }

    return sanitized;
  }

  /**
   * Sanitize boolean values
   */
  private sanitizeBoolean(
    value: boolean,
    _context: SanitizationContext,
    result: SanitizationResult
  ): boolean {
    // Boolean values are generally safe, just validate type
    if (typeof value !== 'boolean') {
      result.warnings.push('Value is not a proper boolean');
      // Attempt conversion
      return Boolean(value);
    }

    return value;
  }

  /**
   * Sanitize date values
   */
  private sanitizeDate(
    value: Date,
    _context: SanitizationContext,
    result: SanitizationResult
  ): Date {
    if (!(value instanceof Date) || isNaN(value.getTime())) {
      result.errors.push('Invalid date object');
      result.isValid = false;
      return new Date(); // Safe fallback to current date
    }

    // Validate reasonable date range
    const now = new Date();
    const minDate = new Date('1970-01-01');
    const maxDate = new Date(now.getFullYear() + 10, 11, 31); // 10 years in future

    if (value < minDate || value > maxDate) {
      result.warnings.push(`Date ${value.toISOString()} is outside reasonable range`);
    }

    return value;
  }

  /**
   * Sanitize object values recursively
   */
  private async sanitizeObject(
    value: Record<string, unknown>,
    context: SanitizationContext,
    result: SanitizationResult
  ): Promise<Record<string, unknown>> {
    if (value === null) {
      return value;
    }

    const sanitized: Record<string, unknown> = {};
    const keys = Object.keys(value);

    // Key validation
    for (const key of keys) {
      // Validate key safety
      if (this.options.security.requireSafeCharacters && !/^[a-zA-Z0-9_]+$/.test(key)) {
        result.warnings.push(`Object key '${key}' contains unsafe characters`);
      }

      // Recursively sanitize values
      const childContext: SanitizationContext = {
        ...context,
        parameterPath: `${context.parameterPath}.${key}`,
        depth: context.depth + 1,
        parent: value
      };

      sanitized[key] = await this.sanitizeValue(value[key], childContext, result);
    }

    return sanitized;
  }

  /**
   * Sanitize array values
   */
  private async sanitizeArray(
    value: unknown[],
    context: SanitizationContext,
    result: SanitizationResult
  ): Promise<unknown[]> {
    // Length validation
    if (this.options.security.maxArrayLength && value.length > this.options.security.maxArrayLength) {
      const truncated = value.slice(0, this.options.security.maxArrayLength);
      result.changes.push({
        path: context.parameterPath,
        original: value,
        sanitized: truncated,
        reason: 'Array truncated due to length limit'
      });
      result.warnings.push(`Array truncated from ${value.length} to ${truncated.length} items`);
      value = truncated;
    }

    // Sanitize each element
    const sanitized = [];
    for (let i = 0; i < value.length; i++) {
      const childContext: SanitizationContext = {
        ...context,
        parameterPath: `${context.parameterPath}[${i}]`,
        depth: context.depth + 1,
        parent: value
      };

      sanitized.push(await this.sanitizeValue(value[i], childContext, result));
    }

    return sanitized;
  }

  /**
   * Normalize trading symbol format
   */
  private normalizeSymbol(symbol: string): string {
    // Convert to uppercase and normalize separators
    return symbol
      .toUpperCase()
      .replace(/[/_]/g, '-') // Convert / and _ to -
      .replace(/^([A-Z]+)([A-Z]+)$/, '$1-$2'); // Add separator if missing
  }

  /**
   * Final validation of sanitized value
   */
  private validateSanitizedValue<T>(
    value: T,
    context: SanitizationContext,
    result: SanitizationResult<T>
  ): void {
    // Check for blocked patterns
    if (this.options.security.blockedPatterns && typeof value === 'string') {
      for (const pattern of this.options.security.blockedPatterns) {
        if (pattern.test(value)) {
          result.securityFlags.push('blocked_pattern_detected');
          result.errors.push('Value contains blocked pattern');
          result.isValid = false;
        }
      }
    }

    // Environment-specific validation
    if (context.environment === 'production') {
      if (typeof value === 'string' && value.toLowerCase().includes('test')) {
        result.warnings.push('Test-related content detected in production environment');
      }
    }
  }

  /**
   * Merge user options with defaults
   */
  private mergeWithDefaults(options: Partial<SanitizationOptions>): SanitizationOptions {
    const defaults: SanitizationOptions = {
      features: {
        trimStrings: true,
        normalizeCase: true,
        validateEncoding: true,
        removeControlChars: true,
        sanitizeHtml: true,
        validateSqlInjection: true,
        normalizeNumbers: true,
        validateArrays: true,
        validateObjects: true
      },
      security: {
        maxStringLength: 10000,
        maxArrayLength: 1000,
        maxObjectDepth: 10,
        allowedProtocols: ['http:', 'https:', 'ws:', 'wss:'],
        blockedPatterns: [
          /<script[^>]*>/i,
          /javascript:/i,
          /data:text\/html/i,
          /vbscript:/i
        ],
        requireSafeCharacters: false
      },
      trading: {
        normalizeSymbols: true,
        validateTimeframes: true,
        sanitizeExchanges: true,
        normalizeCurrency: true
      }
    };

    return {
      features: { ...defaults.features, ...options.features },
      security: { ...defaults.security, ...options.security },
      trading: { ...defaults.trading, ...options.trading }
    };
  }
}

// =============================================================================
// PARAMETER SANITIZATION FACTORY
// =============================================================================

/**
 * Create a parameter sanitizer with default options
 */
export function createParameterSanitizer(options?: Partial<SanitizationOptions>): ParameterSanitizer {
  return new ParameterSanitizer(options);
}

/**
 * Create a production-safe parameter sanitizer
 */
export function createProductionSanitizer(): ParameterSanitizer {
  return new ParameterSanitizer({
    features: {
      trimStrings: true,
      normalizeCase: true,
      validateEncoding: true,
      removeControlChars: true,
      sanitizeHtml: true,
      validateSqlInjection: true,
      normalizeNumbers: true,
      validateArrays: true,
      validateObjects: true
    },
    security: {
      maxStringLength: 1000,
      maxArrayLength: 100,
      maxObjectDepth: 5,
      requireSafeCharacters: true,
      blockedPatterns: [
        /<script[^>]*>/i,
        /javascript:/i,
        /data:text\/html/i,
        /vbscript:/i,
        /\b(eval|function|setTimeout|setInterval)\b/i,
        /\b(union|select|insert|delete|update|drop)\b/i
      ]
    },
    trading: {
      normalizeSymbols: true,
      validateTimeframes: true,
      sanitizeExchanges: true,
      normalizeCurrency: true
    }
  });
}

/**
 * Create a development-friendly parameter sanitizer
 */
export function createDevelopmentSanitizer(): ParameterSanitizer {
  return new ParameterSanitizer({
    features: {
      trimStrings: true,
      normalizeCase: false, // Allow mixed case in dev
      validateEncoding: false,
      removeControlChars: false,
      sanitizeHtml: false,
      validateSqlInjection: false,
      normalizeNumbers: true,
      validateArrays: true,
      validateObjects: true
    },
    security: {
      maxStringLength: 100000,
      maxArrayLength: 10000,
      maxObjectDepth: 20,
      requireSafeCharacters: false,
      blockedPatterns: []
    },
    trading: {
      normalizeSymbols: true,
      validateTimeframes: false, // Allow custom timeframes in dev
      sanitizeExchanges: false,
      normalizeCurrency: true
    }
  });
}

/**
 * Quick sanitization function for simple use cases
 */
export async function sanitizeParameter<T>(
  value: T,
  parameterName: string,
  parameterType: string = 'unknown'
): Promise<T> {
  const sanitizer = createParameterSanitizer();

  const result = await sanitizer.sanitize(value, {
    parameterPath: parameterName,
    parameterType
  });

  if (!result.isValid) {
    throw new Error(`Parameter sanitization failed: ${result.errors.join(', ')}`);
  }

  return result.sanitized;
}