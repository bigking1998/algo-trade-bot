/**
 * Pivot Points Indicator - Task BE-010
 * 
 * Calculates pivot points and support/resistance levels used in trading.
 * Uses the previous period's High, Low, and Close to calculate pivot levels.
 * 
 * Standard Pivot Point Formula:
 * PP = (High + Low + Close) / 3
 * R1 = (2 × PP) - Low, S1 = (2 × PP) - High  
 * R2 = PP + (High - Low), S2 = PP - (High - Low)
 * R3 = High + 2 × (PP - Low), S3 = Low - 2 × (High - PP)
 */

import { TechnicalIndicator } from '../base/TechnicalIndicator.js';
import { OHLCV, IndicatorConfig, StreamingContext } from '../base/types.js';

export interface PivotPointsConfig extends IndicatorConfig {
  /** Pivot calculation method */
  method?: 'STANDARD' | 'FIBONACCI' | 'WOODIE' | 'CAMARILLA' | 'DEMARK';
  /** Time frame for pivot calculation */
  timeframe?: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  /** Include mid-point levels */
  includeMidPoints?: boolean;
}

export interface PivotPointsResult {
  /** Main pivot point */
  pivot: number;
  /** Resistance levels */
  resistance: {
    r1: number;
    r2: number;
    r3: number;
    r4?: number;
  };
  /** Support levels */
  support: {
    s1: number;
    s2: number;
    s3: number;
    s4?: number;
  };
  /** Mid-point levels (optional) */
  midPoints?: {
    m1: number;  // Between S1 and PP
    m2: number;  // Between PP and R1
    m3: number;  // Between S2 and S1
    m4: number;  // Between R1 and R2
  };
  /** Previous period's OHLC values used for calculation */
  previousPeriod: {
    high: number;
    low: number;
    close: number;
    open?: number;
  };
}

/**
 * Pivot Points implementation with multiple calculation methods
 */
export class PivotPoints extends TechnicalIndicator<PivotPointsResult> {
  private readonly method: string;
  private readonly timeframe: string;
  private readonly includeMidPoints: boolean;

  private previousHigh?: number;
  private previousLow?: number;
  private previousClose?: number;
  private previousOpen?: number;

  constructor(config: PivotPointsConfig) {
    super('PivotPoints', { ...config, period: config.period || 1 });
    
    this.method = config.method || 'STANDARD';
    this.timeframe = config.timeframe || 'DAILY';
    this.includeMidPoints = config.includeMidPoints || false;
  }

  /**
   * Calculate Pivot Points for given data
   */
  protected calculateValue(data: OHLCV[]): PivotPointsResult {
    if (data.length < 2) {
      return this.createEmptyResult();
    }

    // Use the previous candle for pivot calculation
    const previousCandle = data[data.length - 2];
    
    return this.calculatePivotPoints(
      previousCandle.high,
      previousCandle.low,
      previousCandle.close,
      previousCandle.open
    );
  }

  /**
   * Streaming update for real-time calculation
   */
  protected streamingUpdate(newCandle: OHLCV, context?: StreamingContext): PivotPointsResult {
    const dataBuffer = this.dataBuffer.getAll();
    
    if (dataBuffer.length < 2) {
      // Store values for next calculation
      this.previousHigh = newCandle.high;
      this.previousLow = newCandle.low;
      this.previousClose = newCandle.close;
      this.previousOpen = newCandle.open;
      return this.createEmptyResult();
    }

    // Use the previous candle for pivot calculation
    const previousCandle = dataBuffer[dataBuffer.length - 2];
    
    return this.calculatePivotPoints(
      previousCandle.high,
      previousCandle.low,
      previousCandle.close,
      previousCandle.open
    );
  }

  /**
   * Calculate pivot points based on selected method
   */
  private calculatePivotPoints(high: number, low: number, close: number, open?: number): PivotPointsResult {
    const previousPeriod = { high, low, close, open };
    
    switch (this.method) {
      case 'FIBONACCI':
        return this.calculateFibonacciPivots(high, low, close, previousPeriod);
      case 'WOODIE':
        return this.calculateWoodiePivots(high, low, close, open, previousPeriod);
      case 'CAMARILLA':
        return this.calculateCamarillaPivots(high, low, close, previousPeriod);
      case 'DEMARK':
        return this.calculateDeMarkPivots(high, low, close, open, previousPeriod);
      case 'STANDARD':
      default:
        return this.calculateStandardPivots(high, low, close, previousPeriod);
    }
  }

  /**
   * Calculate Standard Pivot Points
   */
  private calculateStandardPivots(
    high: number, 
    low: number, 
    close: number,
    previousPeriod: any
  ): PivotPointsResult {
    const pivot = (high + low + close) / 3;
    const range = high - low;

    const resistance = {
      r1: (2 * pivot) - low,
      r2: pivot + range,
      r3: high + 2 * (pivot - low)
    };

    const support = {
      s1: (2 * pivot) - high,
      s2: pivot - range,
      s3: low - 2 * (high - pivot)
    };

    const result: PivotPointsResult = {
      pivot,
      resistance,
      support,
      previousPeriod
    };

    if (this.includeMidPoints) {
      result.midPoints = {
        m1: (support.s1 + pivot) / 2,
        m2: (pivot + resistance.r1) / 2,
        m3: (support.s2 + support.s1) / 2,
        m4: (resistance.r1 + resistance.r2) / 2
      };
    }

    return result;
  }

  /**
   * Calculate Fibonacci Pivot Points
   */
  private calculateFibonacciPivots(
    high: number, 
    low: number, 
    close: number,
    previousPeriod: any
  ): PivotPointsResult {
    const pivot = (high + low + close) / 3;
    const range = high - low;

    const resistance = {
      r1: pivot + 0.382 * range,
      r2: pivot + 0.618 * range,
      r3: pivot + range
    };

    const support = {
      s1: pivot - 0.382 * range,
      s2: pivot - 0.618 * range,
      s3: pivot - range
    };

    const result: PivotPointsResult = {
      pivot,
      resistance,
      support,
      previousPeriod
    };

    if (this.includeMidPoints) {
      result.midPoints = {
        m1: (support.s1 + pivot) / 2,
        m2: (pivot + resistance.r1) / 2,
        m3: (support.s2 + support.s1) / 2,
        m4: (resistance.r1 + resistance.r2) / 2
      };
    }

    return result;
  }

  /**
   * Calculate Woodie Pivot Points
   */
  private calculateWoodiePivots(
    high: number, 
    low: number, 
    close: number, 
    open: number = close,
    previousPeriod: any
  ): PivotPointsResult {
    const pivot = (high + low + 2 * close) / 4;
    
    const resistance = {
      r1: (2 * pivot) - low,
      r2: pivot + high - low,
      r3: high + 2 * (pivot - low)
    };

    const support = {
      s1: (2 * pivot) - high,
      s2: pivot - high + low,
      s3: low - 2 * (high - pivot)
    };

    const result: PivotPointsResult = {
      pivot,
      resistance,
      support,
      previousPeriod
    };

    if (this.includeMidPoints) {
      result.midPoints = {
        m1: (support.s1 + pivot) / 2,
        m2: (pivot + resistance.r1) / 2,
        m3: (support.s2 + support.s1) / 2,
        m4: (resistance.r1 + resistance.r2) / 2
      };
    }

    return result;
  }

  /**
   * Calculate Camarilla Pivot Points
   */
  private calculateCamarillaPivots(
    high: number, 
    low: number, 
    close: number,
    previousPeriod: any
  ): PivotPointsResult {
    const pivot = close; // Camarilla uses close as pivot
    const range = high - low;

    const resistance = {
      r1: close + range * 0.1091,
      r2: close + range * 0.1818,
      r3: close + range * 0.2727,
      r4: close + range * 0.55
    };

    const support = {
      s1: close - range * 0.1091,
      s2: close - range * 0.1818,
      s3: close - range * 0.2727,
      s4: close - range * 0.55
    };

    const result: PivotPointsResult = {
      pivot,
      resistance,
      support,
      previousPeriod
    };

    if (this.includeMidPoints) {
      result.midPoints = {
        m1: (support.s1 + pivot) / 2,
        m2: (pivot + resistance.r1) / 2,
        m3: (support.s2 + support.s1) / 2,
        m4: (resistance.r1 + resistance.r2) / 2
      };
    }

    return result;
  }

  /**
   * Calculate DeMark Pivot Points
   */
  private calculateDeMarkPivots(
    high: number, 
    low: number, 
    close: number, 
    open: number = close,
    previousPeriod: any
  ): PivotPointsResult {
    let x: number;

    // DeMark's conditional logic
    if (close < open) {
      x = high + 2 * low + close;
    } else if (close > open) {
      x = 2 * high + low + close;
    } else {
      x = high + low + 2 * close;
    }

    const pivot = x / 4;

    const resistance = {
      r1: x / 2 - low,
      r2: pivot + (high - low),
      r3: high + 2 * (pivot - low)
    };

    const support = {
      s1: x / 2 - high,
      s2: pivot - (high - low),
      s3: low - 2 * (high - pivot)
    };

    const result: PivotPointsResult = {
      pivot,
      resistance,
      support,
      previousPeriod
    };

    if (this.includeMidPoints) {
      result.midPoints = {
        m1: (support.s1 + pivot) / 2,
        m2: (pivot + resistance.r1) / 2,
        m3: (support.s2 + support.s1) / 2,
        m4: (resistance.r1 + resistance.r2) / 2
      };
    }

    return result;
  }

  /**
   * Create empty result when insufficient data
   */
  private createEmptyResult(): PivotPointsResult {
    const emptyLevel = 0;
    return {
      pivot: emptyLevel,
      resistance: {
        r1: emptyLevel,
        r2: emptyLevel,
        r3: emptyLevel
      },
      support: {
        s1: emptyLevel,
        s2: emptyLevel,
        s3: emptyLevel
      },
      previousPeriod: {
        high: emptyLevel,
        low: emptyLevel,
        close: emptyLevel
      }
    };
  }

  /**
   * Reset indicator state
   */
  reset(): void {
    super.reset();
    this.previousHigh = undefined;
    this.previousLow = undefined;
    this.previousClose = undefined;
    this.previousOpen = undefined;
  }

  /**
   * Validate Pivot Points configuration
   */
  protected validateIndicatorConfig(config: IndicatorConfig): void {
    const pivotConfig = config as PivotPointsConfig;

    const validMethods = ['STANDARD', 'FIBONACCI', 'WOODIE', 'CAMARILLA', 'DEMARK'];
    if (pivotConfig.method && !validMethods.includes(pivotConfig.method)) {
      throw new Error(`Invalid pivot method: ${pivotConfig.method}. Valid methods: ${validMethods.join(', ')}`);
    }

    const validTimeframes = ['DAILY', 'WEEKLY', 'MONTHLY'];
    if (pivotConfig.timeframe && !validTimeframes.includes(pivotConfig.timeframe)) {
      throw new Error(`Invalid timeframe: ${pivotConfig.timeframe}. Valid timeframes: ${validTimeframes.join(', ')}`);
    }
  }

  /**
   * Get Pivot Points metadata
   */
  protected getResultMetadata(value: PivotPointsResult, data: OHLCV[]): Record<string, any> {
    return {
      ...super.getResultMetadata(value, data),
      method: this.method,
      timeframe: this.timeframe,
      includeMidPoints: this.includeMidPoints,
      levelsCount: this.getLevelsCount(value)
    };
  }

  /**
   * Get total number of levels calculated
   */
  private getLevelsCount(result: PivotPointsResult): number {
    let count = 7; // PP + R1,R2,R3 + S1,S2,S3
    if (result.resistance.r4) count += 2; // R4 + S4
    if (result.midPoints) count += 4; // M1,M2,M3,M4
    return count;
  }

  /**
   * Get nearest support level for given price
   */
  getNearestSupport(price: number): { level: number; name: string } | null {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return null;

    const result = latestResult.value as PivotPointsResult;
    const supports = [
      { level: result.support.s1, name: 'S1' },
      { level: result.support.s2, name: 'S2' },
      { level: result.support.s3, name: 'S3' }
    ];

    if (result.support.s4) {
      supports.push({ level: result.support.s4, name: 'S4' });
    }

    // Add mid-points if available
    if (result.midPoints) {
      supports.push({ level: result.midPoints.m1, name: 'M1' });
      supports.push({ level: result.midPoints.m3, name: 'M3' });
    }

    // Find nearest support below current price
    const validSupports = supports.filter(s => s.level < price);
    if (validSupports.length === 0) return null;

    return validSupports.reduce((nearest, current) => 
      current.level > nearest.level ? current : nearest
    );
  }

  /**
   * Get nearest resistance level for given price
   */
  getNearestResistance(price: number): { level: number; name: string } | null {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return null;

    const result = latestResult.value as PivotPointsResult;
    const resistances = [
      { level: result.resistance.r1, name: 'R1' },
      { level: result.resistance.r2, name: 'R2' },
      { level: result.resistance.r3, name: 'R3' }
    ];

    if (result.resistance.r4) {
      resistances.push({ level: result.resistance.r4, name: 'R4' });
    }

    // Add mid-points if available
    if (result.midPoints) {
      resistances.push({ level: result.midPoints.m2, name: 'M2' });
      resistances.push({ level: result.midPoints.m4, name: 'M4' });
    }

    // Find nearest resistance above current price
    const validResistances = resistances.filter(r => r.level > price);
    if (validResistances.length === 0) return null;

    return validResistances.reduce((nearest, current) => 
      current.level < nearest.level ? current : nearest
    );
  }

  /**
   * Check if price is near a pivot level
   */
  isPriceNearLevel(price: number, threshold: number = 0.001): { 
    isNear: boolean; 
    level?: { value: number; name: string }; 
    distance?: number 
  } {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return { isNear: false };

    const result = latestResult.value as PivotPointsResult;
    const allLevels = [
      { value: result.pivot, name: 'Pivot' },
      { value: result.resistance.r1, name: 'R1' },
      { value: result.resistance.r2, name: 'R2' },
      { value: result.resistance.r3, name: 'R3' },
      { value: result.support.s1, name: 'S1' },
      { value: result.support.s2, name: 'S2' },
      { value: result.support.s3, name: 'S3' }
    ];

    if (result.resistance.r4) allLevels.push({ value: result.resistance.r4, name: 'R4' });
    if (result.support.s4) allLevels.push({ value: result.support.s4, name: 'S4' });

    if (result.midPoints) {
      allLevels.push({ value: result.midPoints.m1, name: 'M1' });
      allLevels.push({ value: result.midPoints.m2, name: 'M2' });
      allLevels.push({ value: result.midPoints.m3, name: 'M3' });
      allLevels.push({ value: result.midPoints.m4, name: 'M4' });
    }

    // Find the closest level
    let closestLevel = allLevels[0];
    let minDistance = Math.abs(price - closestLevel.value);

    for (const level of allLevels) {
      const distance = Math.abs(price - level.value);
      if (distance < minDistance) {
        minDistance = distance;
        closestLevel = level;
      }
    }

    const relativeDistance = price > 0 ? minDistance / price : minDistance;
    const isNear = relativeDistance <= threshold;

    return {
      isNear,
      level: closestLevel,
      distance: minDistance
    };
  }

  /**
   * Get all pivot levels as sorted array
   */
  getAllLevels(): Array<{ value: number; name: string; type: 'SUPPORT' | 'RESISTANCE' | 'PIVOT' | 'MIDPOINT' }> {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) return [];

    const result = latestResult.value as PivotPointsResult;
    const levels = [
      { value: result.pivot, name: 'Pivot', type: 'PIVOT' as const },
      { value: result.resistance.r1, name: 'R1', type: 'RESISTANCE' as const },
      { value: result.resistance.r2, name: 'R2', type: 'RESISTANCE' as const },
      { value: result.resistance.r3, name: 'R3', type: 'RESISTANCE' as const },
      { value: result.support.s1, name: 'S1', type: 'SUPPORT' as const },
      { value: result.support.s2, name: 'S2', type: 'SUPPORT' as const },
      { value: result.support.s3, name: 'S3', type: 'SUPPORT' as const }
    ];

    if (result.resistance.r4) levels.push({ value: result.resistance.r4, name: 'R4', type: 'RESISTANCE' });
    if (result.support.s4) levels.push({ value: result.support.s4, name: 'S4', type: 'SUPPORT' });

    if (result.midPoints) {
      levels.push({ value: result.midPoints.m1, name: 'M1', type: 'MIDPOINT' });
      levels.push({ value: result.midPoints.m2, name: 'M2', type: 'MIDPOINT' });
      levels.push({ value: result.midPoints.m3, name: 'M3', type: 'MIDPOINT' });
      levels.push({ value: result.midPoints.m4, name: 'M4', type: 'MIDPOINT' });
    }

    return levels.sort((a, b) => a.value - b.value);
  }

  /**
   * Get current pivot point value
   */
  getCurrentPivot(): number | undefined {
    const latestResult = this.getLatestResult();
    return latestResult?.isValid ? (latestResult.value as PivotPointsResult).pivot : undefined;
  }

  /**
   * Check if price is above/below pivot
   */
  isPriceAbovePivot(price: number): boolean | undefined {
    const pivot = this.getCurrentPivot();
    return pivot !== undefined ? price > pivot : undefined;
  }

  /**
   * Get trading zone for current price
   */
  getTradingZone(price: number): string {
    const nearestSupport = this.getNearestSupport(price);
    const nearestResistance = this.getNearestResistance(price);
    const pivot = this.getCurrentPivot();

    if (pivot === undefined) return 'UNKNOWN';

    if (price > pivot) {
      if (nearestResistance) return `ABOVE_PIVOT_TOWARDS_${nearestResistance.name}`;
      return 'ABOVE_PIVOT_HIGH';
    } else {
      if (nearestSupport) return `BELOW_PIVOT_TOWARDS_${nearestSupport.name}`;
      return 'BELOW_PIVOT_LOW';
    }
  }

  /**
   * Get string representation
   */
  toString(): string {
    const latestResult = this.getLatestResult();
    if (!latestResult?.isValid) {
      return `PivotPoints(${this.method}) [${this.getStatus()}] Value: N/A`;
    }

    const result = latestResult.value as PivotPointsResult;
    const levelsCount = this.getLevelsCount(result);
    
    return `PivotPoints(${this.method}) [${this.getStatus()}] ` +
           `Pivot: ${result.pivot.toFixed(4)}, Levels: ${levelsCount}, ` +
           `Range: ${result.support.s3.toFixed(4)}-${result.resistance.r3.toFixed(4)}`;
  }
}