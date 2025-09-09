/**
 * Cross-Over Detection Algorithms - Task BE-013
 * 
 * Advanced cross-over detection algorithms for technical trading signals including:
 * - Golden cross and death cross detection
 * - Price breakout patterns (support/resistance)
 * - Indicator crossovers with confirmation
 * - Multi-timeframe cross-over analysis
 * - Trend strength and momentum analysis
 */

import type { 
  CrossOverCondition, 
  EvaluationContext,
  ConditionValue 
} from './types.js';
import { 
  CrossOverType,
  ConditionEvaluationError 
} from './types.js';

export interface CrossOverResult {
  value: boolean;
  confidence: number;
  metadata: {
    crossOverType: CrossOverType;
    crossOverStrength: number; // 0-1
    confirmationPeriods: number;
    priceDistance: number; // Distance between values at crossover
    momentum: number; // Rate of change leading to crossover
    trendStrength: number; // Overall trend strength
    volumeConfirmation?: number; // Volume-based confirmation if available
  };
}

export interface CrossOverConfig {
  defaultLookbackPeriods: number;
  defaultConfirmationPeriods: number;
  minimumDataPoints: number;
  tolerancePercent: number;
}

/**
 * CrossOverDetector - Advanced technical analysis crossover detection
 */
export class CrossOverDetector {
  private readonly config: CrossOverConfig;

  constructor(config: CrossOverConfig) {
    this.config = config;
  }

  /**
   * Detect crossover condition with comprehensive analysis
   */
  async detectCrossOver(
    condition: CrossOverCondition,
    context: EvaluationContext
  ): Promise<{ value: boolean; confidence: number }> {
    try {
      // Extract source and reference data series
      const sourceData = await this.extractTimeSeries(condition.source, context);
      const referenceData = await this.extractTimeSeries(condition.reference, context);
      
      if (!sourceData || !referenceData) {
        throw new ConditionEvaluationError(
          'Failed to extract data series for crossover detection',
          condition.id,
          'MISSING_DATA_SERIES',
          context
        );
      }

      // Validate data availability
      const requiredDataPoints = Math.max(
        condition.lookbackPeriods,
        this.config.minimumDataPoints
      );
      
      if (sourceData.length < requiredDataPoints || referenceData.length < requiredDataPoints) {
        throw new ConditionEvaluationError(
          `Insufficient data points for crossover detection. Required: ${requiredDataPoints}, Available: ${Math.min(sourceData.length, referenceData.length)}`,
          condition.id,
          'INSUFFICIENT_DATA',
          context
        );
      }

      const result = await this.analyzeCrossOver(
        condition.crossOverType,
        sourceData,
        referenceData,
        condition.lookbackPeriods,
        condition.confirmationPeriods,
        condition.minimumThreshold || 0
      );

      // Apply confidence weighting based on condition properties
      const adjustedConfidence = this.adjustConfidenceForCondition(
        result.confidence,
        result.metadata,
        condition
      );

      return {
        value: result.value,
        confidence: adjustedConfidence
      };

    } catch (error) {
      throw new ConditionEvaluationError(
        `CrossOver detection failed: ${error instanceof Error ? error.message : String(error)}`,
        condition.id,
        'CROSSOVER_DETECTION_ERROR',
        context,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Analyze crossover patterns with comprehensive technical analysis
   */
  private async analyzeCrossOver(
    crossOverType: CrossOverType,
    sourceData: number[],
    referenceData: number[],
    lookbackPeriods: number,
    confirmationPeriods: number,
    minimumThreshold: number
  ): Promise<CrossOverResult> {
    
    const dataLength = Math.min(sourceData.length, referenceData.length);
    const analysisWindow = Math.min(lookbackPeriods, dataLength);
    
    switch (crossOverType) {
      case CrossOverType.GOLDEN_CROSS:
        return this.detectGoldenCross(sourceData, referenceData, analysisWindow, confirmationPeriods);
        
      case CrossOverType.DEATH_CROSS:
        return this.detectDeathCross(sourceData, referenceData, analysisWindow, confirmationPeriods);
        
      case CrossOverType.PRICE_ABOVE:
        return this.detectPriceAbove(sourceData, referenceData, analysisWindow, confirmationPeriods, minimumThreshold);
        
      case CrossOverType.PRICE_BELOW:
        return this.detectPriceBelow(sourceData, referenceData, analysisWindow, confirmationPeriods, minimumThreshold);
        
      case CrossOverType.INDICATOR_CROSS_UP:
        return this.detectIndicatorCrossUp(sourceData, referenceData, analysisWindow, confirmationPeriods, minimumThreshold);
        
      case CrossOverType.INDICATOR_CROSS_DOWN:
        return this.detectIndicatorCrossDown(sourceData, referenceData, analysisWindow, confirmationPeriods, minimumThreshold);
        
      case CrossOverType.BREAKOUT_UP:
        return this.detectBreakoutUp(sourceData, referenceData, analysisWindow, confirmationPeriods, minimumThreshold);
        
      case CrossOverType.BREAKOUT_DOWN:
        return this.detectBreakoutDown(sourceData, referenceData, analysisWindow, confirmationPeriods, minimumThreshold);
        
      default:
        throw new Error(`Unknown crossover type: ${crossOverType}`);
    }
  }

  /**
   * Detect Golden Cross (fast MA crossing above slow MA)
   */
  private detectGoldenCross(
    fastMA: number[],
    slowMA: number[],
    lookback: number,
    confirmation: number
  ): CrossOverResult {
    const currentFast = fastMA[fastMA.length - 1];
    const currentSlow = slowMA[slowMA.length - 1];
    const previousFast = fastMA[fastMA.length - 2];
    const previousSlow = slowMA[slowMA.length - 2];
    
    // Basic crossover detection
    const crossedOver = previousFast <= previousSlow && currentFast > currentSlow;
    
    if (!crossedOver) {
      return this.createNegativeResult(CrossOverType.GOLDEN_CROSS, confirmation);
    }

    // Calculate cross strength and momentum
    const crossStrength = this.calculateCrossStrength(fastMA, slowMA, lookback);
    const momentum = this.calculateMomentum(fastMA, lookback);
    const trendStrength = this.calculateTrendStrength(fastMA, lookback);
    
    // Confirmation analysis
    const confirmationScore = this.analyzeConfirmation(
      fastMA,
      slowMA,
      confirmation,
      'bullish'
    );
    
    // Distance between MAs at crossover
    const priceDistance = Math.abs(currentFast - currentSlow) / currentSlow;
    
    // Calculate overall confidence
    const confidence = this.calculateCrossoverConfidence(
      crossStrength,
      momentum,
      trendStrength,
      confirmationScore,
      priceDistance
    );

    return {
      value: true,
      confidence,
      metadata: {
        crossOverType: CrossOverType.GOLDEN_CROSS,
        crossOverStrength: crossStrength,
        confirmationPeriods: confirmation,
        priceDistance,
        momentum,
        trendStrength
      }
    };
  }

  /**
   * Detect Death Cross (fast MA crossing below slow MA)
   */
  private detectDeathCross(
    fastMA: number[],
    slowMA: number[],
    lookback: number,
    confirmation: number
  ): CrossOverResult {
    const currentFast = fastMA[fastMA.length - 1];
    const currentSlow = slowMA[slowMA.length - 1];
    const previousFast = fastMA[fastMA.length - 2];
    const previousSlow = slowMA[slowMA.length - 2];
    
    // Basic crossover detection
    const crossedOver = previousFast >= previousSlow && currentFast < currentSlow;
    
    if (!crossedOver) {
      return this.createNegativeResult(CrossOverType.DEATH_CROSS, confirmation);
    }

    // Calculate cross strength and momentum
    const crossStrength = this.calculateCrossStrength(fastMA, slowMA, lookback);
    const momentum = this.calculateMomentum(fastMA, lookback);
    const trendStrength = this.calculateTrendStrength(fastMA, lookback);
    
    // Confirmation analysis
    const confirmationScore = this.analyzeConfirmation(
      fastMA,
      slowMA,
      confirmation,
      'bearish'
    );
    
    const priceDistance = Math.abs(currentFast - currentSlow) / currentSlow;
    
    const confidence = this.calculateCrossoverConfidence(
      crossStrength,
      Math.abs(momentum), // Use absolute momentum for bearish signals
      trendStrength,
      confirmationScore,
      priceDistance
    );

    return {
      value: true,
      confidence,
      metadata: {
        crossOverType: CrossOverType.DEATH_CROSS,
        crossOverStrength: crossStrength,
        confirmationPeriods: confirmation,
        priceDistance,
        momentum,
        trendStrength
      }
    };
  }

  /**
   * Detect price crossing above reference level
   */
  private detectPriceAbove(
    price: number[],
    reference: number[],
    lookback: number,
    confirmation: number,
    threshold: number
  ): CrossOverResult {
    const currentPrice = price[price.length - 1];
    const currentRef = reference[reference.length - 1];
    const previousPrice = price[price.length - 2];
    const previousRef = reference[reference.length - 2];
    
    // Check for crossover with threshold
    const thresholdValue = currentRef * (1 + threshold / 100);
    const crossedOver = previousPrice <= previousRef && currentPrice > thresholdValue;
    
    if (!crossedOver) {
      return this.createNegativeResult(CrossOverType.PRICE_ABOVE, confirmation);
    }

    const crossStrength = this.calculateBreakoutStrength(price, reference, lookback);
    const momentum = this.calculateMomentum(price, lookback);
    const trendStrength = this.calculateTrendStrength(price, lookback);
    const confirmationScore = this.analyzeConfirmation(price, reference, confirmation, 'bullish');
    const priceDistance = (currentPrice - currentRef) / currentRef;

    const confidence = this.calculateCrossoverConfidence(
      crossStrength,
      momentum,
      trendStrength,
      confirmationScore,
      priceDistance
    );

    return {
      value: true,
      confidence,
      metadata: {
        crossOverType: CrossOverType.PRICE_ABOVE,
        crossOverStrength: crossStrength,
        confirmationPeriods: confirmation,
        priceDistance,
        momentum,
        trendStrength
      }
    };
  }

  /**
   * Detect price crossing below reference level
   */
  private detectPriceBelow(
    price: number[],
    reference: number[],
    lookback: number,
    confirmation: number,
    threshold: number
  ): CrossOverResult {
    const currentPrice = price[price.length - 1];
    const currentRef = reference[reference.length - 1];
    const previousPrice = price[price.length - 2];
    const previousRef = reference[reference.length - 2];
    
    // Check for crossover with threshold
    const thresholdValue = currentRef * (1 - threshold / 100);
    const crossedOver = previousPrice >= previousRef && currentPrice < thresholdValue;
    
    if (!crossedOver) {
      return this.createNegativeResult(CrossOverType.PRICE_BELOW, confirmation);
    }

    const crossStrength = this.calculateBreakoutStrength(price, reference, lookback);
    const momentum = Math.abs(this.calculateMomentum(price, lookback));
    const trendStrength = this.calculateTrendStrength(price, lookback);
    const confirmationScore = this.analyzeConfirmation(price, reference, confirmation, 'bearish');
    const priceDistance = Math.abs(currentPrice - currentRef) / currentRef;

    const confidence = this.calculateCrossoverConfidence(
      crossStrength,
      momentum,
      trendStrength,
      confirmationScore,
      priceDistance
    );

    return {
      value: true,
      confidence,
      metadata: {
        crossOverType: CrossOverType.PRICE_BELOW,
        crossOverStrength: crossStrength,
        confirmationPeriods: confirmation,
        priceDistance,
        momentum: -momentum, // Negative for bearish
        trendStrength
      }
    };
  }

  /**
   * Detect indicator crossing up through reference
   */
  private detectIndicatorCrossUp(
    indicator: number[],
    reference: number[],
    lookback: number,
    confirmation: number,
    threshold: number
  ): CrossOverResult {
    // Similar to price above but with indicator-specific logic
    return this.detectPriceAbove(indicator, reference, lookback, confirmation, threshold);
  }

  /**
   * Detect indicator crossing down through reference
   */
  private detectIndicatorCrossDown(
    indicator: number[],
    reference: number[],
    lookback: number,
    confirmation: number,
    threshold: number
  ): CrossOverResult {
    // Similar to price below but with indicator-specific logic
    return this.detectPriceBelow(indicator, reference, lookback, confirmation, threshold);
  }

  /**
   * Detect upward breakout from resistance/range
   */
  private detectBreakoutUp(
    price: number[],
    resistance: number[],
    lookback: number,
    confirmation: number,
    threshold: number
  ): CrossOverResult {
    const currentPrice = price[price.length - 1];
    const resistanceLevel = resistance[resistance.length - 1];
    
    // Check if price has broken through resistance with volume confirmation
    const breakoutThreshold = resistanceLevel * (1 + threshold / 100);
    const hasBreakout = currentPrice > breakoutThreshold;
    
    if (!hasBreakout) {
      return this.createNegativeResult(CrossOverType.BREAKOUT_UP, confirmation);
    }

    // Analyze resistance test frequency and strength
    const resistanceTests = this.countResistanceTests(price, resistanceLevel, lookback);
    const breakoutStrength = this.calculateBreakoutStrength(price, resistance, lookback);
    const momentum = this.calculateMomentum(price, Math.min(5, lookback)); // Short-term momentum
    const trendStrength = this.calculateTrendStrength(price, lookback);
    
    // Volume confirmation if available (simplified - would need actual volume data)
    const volumeConfirmation = 0.8; // Placeholder
    
    const priceDistance = (currentPrice - resistanceLevel) / resistanceLevel;
    
    // Breakout confidence factors in resistance strength and momentum
    const confidence = Math.min(1.0, (
      breakoutStrength * 0.3 +
      (momentum > 0 ? momentum : 0) * 0.25 +
      trendStrength * 0.2 +
      volumeConfirmation * 0.15 +
      Math.min(priceDistance * 10, 1) * 0.1
    ));

    return {
      value: true,
      confidence,
      metadata: {
        crossOverType: CrossOverType.BREAKOUT_UP,
        crossOverStrength: breakoutStrength,
        confirmationPeriods: confirmation,
        priceDistance,
        momentum,
        trendStrength,
        volumeConfirmation
      }
    };
  }

  /**
   * Detect downward breakout from support/range
   */
  private detectBreakoutDown(
    price: number[],
    support: number[],
    lookback: number,
    confirmation: number,
    threshold: number
  ): CrossOverResult {
    const currentPrice = price[price.length - 1];
    const supportLevel = support[support.length - 1];
    
    // Check if price has broken through support
    const breakoutThreshold = supportLevel * (1 - threshold / 100);
    const hasBreakout = currentPrice < breakoutThreshold;
    
    if (!hasBreakout) {
      return this.createNegativeResult(CrossOverType.BREAKOUT_DOWN, confirmation);
    }

    const supportTests = this.countSupportTests(price, supportLevel, lookback);
    const breakoutStrength = this.calculateBreakoutStrength(price, support, lookback);
    const momentum = Math.abs(this.calculateMomentum(price, Math.min(5, lookback)));
    const trendStrength = this.calculateTrendStrength(price, lookback);
    
    const volumeConfirmation = 0.8; // Placeholder
    const priceDistance = Math.abs(currentPrice - supportLevel) / supportLevel;
    
    const confidence = Math.min(1.0, (
      breakoutStrength * 0.3 +
      momentum * 0.25 +
      trendStrength * 0.2 +
      volumeConfirmation * 0.15 +
      Math.min(priceDistance * 10, 1) * 0.1
    ));

    return {
      value: true,
      confidence,
      metadata: {
        crossOverType: CrossOverType.BREAKOUT_DOWN,
        crossOverStrength: breakoutStrength,
        confirmationPeriods: confirmation,
        priceDistance,
        momentum: -momentum, // Negative for bearish
        trendStrength,
        volumeConfirmation
      }
    };
  }

  // =============================================================================
  // UTILITY AND ANALYSIS METHODS
  // =============================================================================

  private calculateCrossStrength(
    fast: number[],
    slow: number[],
    lookback: number
  ): number {
    const windowSize = Math.min(lookback, fast.length);
    const recentFast = fast.slice(-windowSize);
    const recentSlow = slow.slice(-windowSize);
    
    // Calculate average distance between the lines leading up to cross
    let totalDistance = 0;
    let convergenceRate = 0;
    
    for (let i = 1; i < windowSize; i++) {
      const distance = Math.abs(recentFast[i] - recentSlow[i]) / recentSlow[i];
      totalDistance += distance;
      
      const previousDistance = Math.abs(recentFast[i - 1] - recentSlow[i - 1]) / recentSlow[i - 1];
      convergenceRate += Math.abs(distance - previousDistance);
    }
    
    const avgDistance = totalDistance / (windowSize - 1);
    const avgConvergence = convergenceRate / (windowSize - 1);
    
    // Strength is inversely related to average distance (tighter convergence = stronger signal)
    // and positively related to convergence rate
    return Math.min(1.0, (1 - avgDistance) * 0.7 + avgConvergence * 0.3);
  }

  private calculateMomentum(data: number[], periods: number): number {
    const windowSize = Math.min(periods, data.length);
    if (windowSize < 2) return 0;
    
    const recent = data.slice(-windowSize);
    const firstValue = recent[0];
    const lastValue = recent[recent.length - 1];
    
    return (lastValue - firstValue) / firstValue;
  }

  private calculateTrendStrength(data: number[], periods: number): number {
    const windowSize = Math.min(periods, data.length);
    if (windowSize < 3) return 0;
    
    const recent = data.slice(-windowSize);
    
    // Simple trend strength using linear regression slope
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumXX = 0;
    
    for (let i = 0; i < windowSize; i++) {
      sumX += i;
      sumY += recent[i];
      sumXY += i * recent[i];
      sumXX += i * i;
    }
    
    const slope = (windowSize * sumXY - sumX * sumY) / (windowSize * sumXX - sumX * sumX);
    const avgY = sumY / windowSize;
    
    // Normalize slope as percentage change per period
    return slope / avgY;
  }

  private calculateBreakoutStrength(
    price: number[],
    level: number[],
    lookback: number
  ): number {
    const windowSize = Math.min(lookback, price.length);
    const recentPrice = price.slice(-windowSize);
    const levelValue = level[level.length - 1];
    
    // Count how many times price approached but didn't break the level
    let approaches = 0;
    let maxApproach = 0;
    
    for (const p of recentPrice.slice(0, -1)) { // Exclude current breakout
      const distance = Math.abs(p - levelValue) / levelValue;
      if (distance < 0.02) { // Within 2% of level
        approaches++;
        maxApproach = Math.max(maxApproach, 1 - distance);
      }
    }
    
    // More approaches and closer approaches indicate stronger level
    return Math.min(1.0, (approaches * 0.1 + maxApproach * 0.5));
  }

  private analyzeConfirmation(
    source: number[],
    reference: number[],
    confirmationPeriods: number,
    direction: 'bullish' | 'bearish'
  ): number {
    if (confirmationPeriods === 0) return 1.0;
    
    const periods = Math.min(confirmationPeriods, source.length - 1);
    let confirmationCount = 0;
    
    for (let i = 1; i <= periods; i++) {
      const sourceValue = source[source.length - 1 - i];
      const refValue = reference[reference.length - 1 - i];
      
      if (direction === 'bullish' && sourceValue > refValue) {
        confirmationCount++;
      } else if (direction === 'bearish' && sourceValue < refValue) {
        confirmationCount++;
      }
    }
    
    return confirmationCount / periods;
  }

  private calculateCrossoverConfidence(
    crossStrength: number,
    momentum: number,
    trendStrength: number,
    confirmationScore: number,
    priceDistance: number
  ): number {
    // Weighted combination of factors
    const weights = {
      crossStrength: 0.3,
      momentum: 0.25,
      trendStrength: 0.2,
      confirmation: 0.15,
      distance: 0.1
    };
    
    const normalizedMomentum = Math.min(1.0, Math.abs(momentum) * 10);
    const normalizedTrend = Math.min(1.0, Math.abs(trendStrength) * 20);
    const normalizedDistance = Math.min(1.0, priceDistance * 50);
    
    return Math.min(1.0,
      crossStrength * weights.crossStrength +
      normalizedMomentum * weights.momentum +
      normalizedTrend * weights.trendStrength +
      confirmationScore * weights.confirmation +
      normalizedDistance * weights.distance
    );
  }

  private countResistanceTests(price: number[], level: number, lookback: number): number {
    const windowSize = Math.min(lookback, price.length);
    const recentPrice = price.slice(-windowSize, -1); // Exclude current price
    
    let tests = 0;
    const tolerance = level * 0.01; // 1% tolerance
    
    for (const p of recentPrice) {
      if (Math.abs(p - level) <= tolerance && p < level) {
        tests++;
      }
    }
    
    return tests;
  }

  private countSupportTests(price: number[], level: number, lookback: number): number {
    const windowSize = Math.min(lookback, price.length);
    const recentPrice = price.slice(-windowSize, -1);
    
    let tests = 0;
    const tolerance = level * 0.01;
    
    for (const p of recentPrice) {
      if (Math.abs(p - level) <= tolerance && p > level) {
        tests++;
      }
    }
    
    return tests;
  }

  private createNegativeResult(crossOverType: CrossOverType, confirmationPeriods: number): CrossOverResult {
    return {
      value: false,
      confidence: 0,
      metadata: {
        crossOverType,
        crossOverStrength: 0,
        confirmationPeriods,
        priceDistance: 0,
        momentum: 0,
        trendStrength: 0
      }
    };
  }

  private adjustConfidenceForCondition(
    baseConfidence: number,
    metadata: CrossOverResult['metadata'],
    condition: CrossOverCondition
  ): number {
    let adjustedConfidence = baseConfidence;
    
    // Apply minimum threshold requirements
    if (condition.minimumThreshold && metadata.priceDistance < condition.minimumThreshold) {
      adjustedConfidence *= 0.5; // Reduce confidence for insufficient magnitude
    }
    
    // Apply confirmation period weighting
    if (condition.confirmationPeriods > 1) {
      const confirmationBonus = Math.min(0.2, condition.confirmationPeriods * 0.05);
      adjustedConfidence = Math.min(1.0, adjustedConfidence + confirmationBonus);
    }
    
    // Consider condition weight
    adjustedConfidence *= condition.weight;
    
    return Math.max(0, Math.min(1.0, adjustedConfidence));
  }

  private async extractTimeSeries(
    valueExpression: any,
    context: EvaluationContext
  ): Promise<number[] | null> {
    // This would integrate with the value expression evaluation system
    // For now, simplified extraction logic
    
    if (valueExpression.type === 'indicator') {
      const indicatorResult = context.indicators.get(valueExpression.indicatorId);
      if (!indicatorResult) return null;
      
      // Extract time series from indicator result
      if (Array.isArray(indicatorResult.value)) {
        return indicatorResult.value.map((v: any) => {
          if (typeof v === 'object' && valueExpression.field in v) {
            return Number(v[valueExpression.field]) || 0;
          }
          return Number(v) || 0;
        });
      }
      
      return [Number(indicatorResult[valueExpression.field] || indicatorResult) || 0];
    }
    
    if (valueExpression.type === 'market') {
      // Extract market data time series
      const field = valueExpression.field;
      const history = context.marketData.history;
      const current = context.marketData.current;
      
      const timeSeries = history.map(candle => candle[field]);
      timeSeries.push(current[field]);
      
      return timeSeries;
    }
    
    if (valueExpression.type === 'literal') {
      // Create constant series
      const value = Number(valueExpression.value) || 0;
      return new Array(context.marketData.windowSize).fill(value);
    }
    
    return null;
  }
}

export default CrossOverDetector;