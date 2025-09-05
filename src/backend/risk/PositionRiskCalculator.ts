/**
 * Position Risk Calculator - Task BE-019: Risk Assessment Engine Implementation
 * 
 * Individual position risk analysis including:
 * - Position-level VaR calculations
 * - Liquidity risk assessment
 * - Leverage and margin metrics
 * - Greeks calculations (for derivatives)
 * - Risk contribution analysis
 */

import type {
  Position,
  PositionRiskAssessment,
  LiquidityRiskMetrics,
  PriceRiskMetrics,
  Greeks,
  RiskLevel,
  LeverageMetrics,
  RiskContribution
} from './types.js';
import type { DydxCandle } from '../../shared/types/trading.js';
import { VaRCalculator } from './VaRCalculator.js';

export class PositionRiskCalculator {
  private static instance: PositionRiskCalculator;
  private varCalculator: VaRCalculator;
  
  private constructor() {
    this.varCalculator = VaRCalculator.getInstance();
  }
  
  public static getInstance(): PositionRiskCalculator {
    if (!PositionRiskCalculator.instance) {
      PositionRiskCalculator.instance = new PositionRiskCalculator();
    }
    return PositionRiskCalculator.instance;
  }

  /**
   * Calculate comprehensive position risk assessment
   */
  async calculatePositionRisk(
    position: Position,
    portfolio: Position[],
    marketData: DydxCandle[],
    portfolioValue: number
  ): Promise<PositionRiskAssessment> {
    // Calculate basic metrics
    const portfolioPercentage = (position.marketValue / portfolioValue) * 100;
    
    // Calculate position VaR at multiple confidence levels
    const positionVaR95 = await this.calculatePositionVaR(position, 0.95, marketData);
    const positionVaR99 = await this.calculatePositionVaR(position, 0.99, marketData);
    const expectedShortfall = await this.calculatePositionExpectedShortfall(position, 0.95, marketData);
    
    // Calculate Greeks if applicable (derivatives)
    const greeks = await this.calculateGreeks(position, marketData);
    
    // Assess liquidity risk
    const liquidityRisk = await this.assessLiquidityRisk(position, marketData);
    
    // Assess price risk
    const priceRisk = await this.assessPriceRisk(position, marketData);
    
    // Calculate risk contribution to portfolio
    const marginalVaR = await this.calculateMarginalVaR(position, portfolio);
    const componentVaR = await this.calculateComponentVaR(position, portfolio);
    const riskContributionPercent = await this.calculateRiskContribution(position, portfolio);
    
    // Calculate overall risk score
    const riskScore = this.calculatePositionRiskScore(
      portfolioPercentage,
      positionVaR95,
      liquidityRisk,
      priceRisk,
      position
    );
    
    const riskLevel = this.determineRiskLevel(riskScore);
    
    // Generate alerts and recommendations
    const { alerts, recommendations } = this.generateRiskAlertsAndRecommendations(
      position,
      portfolioPercentage,
      riskScore,
      liquidityRisk,
      priceRisk
    );

    return {
      positionId: position.id,
      symbol: position.symbol,
      timestamp: new Date(),
      marketValue: position.marketValue,
      portfolioPercentage,
      leverage: position.leverage || 1,
      positionVaR95,
      positionVaR99,
      expectedShortfall,
      greeks,
      liquidityRisk,
      priceRisk,
      marginalVaR,
      componentVaR,
      riskContributionPercent,
      riskScore,
      riskLevel,
      alerts,
      recommendations
    };
  }

  /**
   * Calculate Position-level VaR
   */
  async calculatePositionVaR(
    position: Position,
    confidence: number,
    marketData: DydxCandle[]
  ): Promise<number> {
    if (marketData.length === 0) {
      throw new Error('No market data available for VaR calculation');
    }

    // Calculate historical returns from market data
    const returns = this.calculateReturnsFromCandles(marketData);
    
    // Calculate historical VaR for the position
    const varResult = await this.varCalculator.historicalVaR(returns, confidence);
    
    // Scale by position size
    return varResult.value * position.marketValue;
  }

  /**
   * Calculate Position Expected Shortfall (CVaR)
   */
  async calculatePositionExpectedShortfall(
    position: Position,
    confidence: number,
    marketData: DydxCandle[]
  ): Promise<number> {
    const returns = this.calculateReturnsFromCandles(marketData);
    const expectedShortfall = await this.varCalculator.expectedShortfall(returns, confidence);
    
    return expectedShortfall * position.marketValue;
  }

  /**
   * Assess liquidity risk for position
   */
  async assessLiquidityRisk(
    position: Position,
    marketData: DydxCandle[]
  ): Promise<LiquidityRiskMetrics> {
    // Calculate average daily volume
    const averageDailyVolume = this.calculateAverageDailyVolume(marketData);
    
    // Estimate bid-ask spread (simplified - in practice would get from order book)
    const bidAskSpread = this.estimateBidAskSpread(marketData);
    
    // Calculate market depth proxy
    const marketDepth = averageDailyVolume * 0.1; // Assume 10% of daily volume in order book
    
    // Estimate liquidation time based on position size vs volume
    const positionVolumeRatio = position.size / averageDailyVolume;
    const estimatedLiquidationTime = Math.max(0.1, positionVolumeRatio * 24); // Hours
    
    // Estimate market impact
    const marketImpact = this.calculateMarketImpact(position.size, averageDailyVolume, bidAskSpread);
    
    // Calculate liquidity score (0-100, higher is more liquid)
    const liquidityScore = this.calculateLiquidityScore(
      averageDailyVolume,
      bidAskSpread,
      estimatedLiquidationTime,
      marketImpact
    );
    
    const liquidityRating = this.getLiquidityRating(liquidityScore);

    return {
      symbol: position.symbol,
      averageDailyVolume,
      bidAskSpread,
      marketDepth,
      estimatedLiquidationTime,
      marketImpact,
      liquidityScore,
      liquidityRating
    };
  }

  /**
   * Assess price risk metrics for position
   */
  async assessPriceRisk(
    position: Position,
    marketData: DydxCandle[]
  ): Promise<PriceRiskMetrics> {
    const returns = this.calculateReturnsFromCandles(marketData);
    
    // Calculate various volatility measures
    const historicalVolatility = this.calculateHistoricalVolatility(returns) * Math.sqrt(252); // Annualized
    const garchVolatility = this.calculateGarchVolatility(returns); // Simplified GARCH
    
    // Calculate Average True Range
    const atr = this.calculateAverageTrueRange(marketData);
    
    // Assess price gap risk
    const priceGapRisk = this.calculatePriceGapRisk(marketData);
    
    // Calculate tail risk measures
    const skewness = this.calculateSkewness(returns);
    const kurtosis = this.calculateKurtosis(returns);
    const tailRisk = this.calculateTailRisk(returns);
    
    // Calculate support and resistance levels
    const { supportLevels, resistanceLevels } = this.calculateSupportResistance(marketData);
    const technicalRiskScore = this.calculateTechnicalRiskScore(
      position.currentPrice,
      supportLevels,
      resistanceLevels
    );
    
    // Overall price risk score
    const priceRiskScore = this.calculatePriceRiskScore(
      historicalVolatility,
      atr,
      priceGapRisk,
      tailRisk,
      technicalRiskScore
    );

    return {
      symbol: position.symbol,
      historicalVolatility,
      garchVolatility,
      averageTrueRange: atr,
      priceGapRisk,
      skewness,
      kurtosis,
      tailRisk,
      supportLevels,
      resistanceLevels,
      technicalRiskScore,
      priceRiskScore
    };
  }

  /**
   * Calculate Greeks for derivatives positions
   */
  async calculateGreeks(
    position: Position,
    marketData: DydxCandle[]
  ): Promise<Greeks | undefined> {
    // For now, return undefined for non-derivative positions
    // In a real implementation, this would check if position is a derivative
    // and calculate appropriate Greeks using Black-Scholes or other models
    
    if (!this.isDerivative(position)) {
      return undefined;
    }

    // Simplified Greeks calculation (placeholder)
    return {
      delta: 0.5,      // Placeholder values
      gamma: 0.01,
      theta: -0.05,
      vega: 0.2,
      rho: 0.1,
      charm: -0.001,
      vanna: 0.05,
      volga: 0.02
    };
  }

  /**
   * Calculate leverage metrics
   */
  async calculateLeverage(position: Position): Promise<LeverageMetrics> {
    const leverage = position.leverage || 1;
    const margin = position.margin || position.marketValue / leverage;
    const marginRatio = margin / position.marketValue;
    const leverageRisk = this.calculateLeverageRisk(leverage);
    
    return {
      currentLeverage: leverage,
      margin,
      marginRatio,
      leverageRisk,
      liquidationPrice: position.liquidationPrice || 0,
      marginCallPrice: this.calculateMarginCallPrice(position),
      maxLeverage: this.getMaxAllowedLeverage(position.symbol),
      leverageUtilization: leverage / this.getMaxAllowedLeverage(position.symbol)
    };
  }

  /**
   * Calculate marginal VaR for position
   */
  private async calculateMarginalVaR(position: Position, portfolio: Position[]): Promise<number> {
    // Simplified calculation - in practice would use full portfolio VaR methodology
    const positionWeight = position.marketValue / this.getTotalPortfolioValue(portfolio);
    const portfolioVolatility = 0.02; // Assumed 2% daily portfolio volatility
    
    return position.marketValue * portfolioVolatility * positionWeight * 1.645; // 95% confidence
  }

  /**
   * Calculate component VaR for position
   */
  private async calculateComponentVaR(position: Position, portfolio: Position[]): Promise<number> {
    const marginalVaR = await this.calculateMarginalVaR(position, portfolio);
    const positionWeight = position.marketValue / this.getTotalPortfolioValue(portfolio);
    
    return marginalVaR * positionWeight;
  }

  /**
   * Calculate risk contribution percentage
   */
  private async calculateRiskContribution(position: Position, portfolio: Position[]): Promise<number> {
    const componentVaR = await this.calculateComponentVaR(position, portfolio);
    const portfolioVaR = this.estimatePortfolioVaR(portfolio);
    
    return (componentVaR / portfolioVaR) * 100;
  }

  /**
   * Calculate returns from candlestick data
   */
  private calculateReturnsFromCandles(candles: DydxCandle[]): number[] {
    if (candles.length < 2) return [];
    
    const returns: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const currentPrice = candles[i].close;
      const previousPrice = candles[i - 1].close;
      const return_ = (currentPrice - previousPrice) / previousPrice;
      returns.push(return_);
    }
    
    return returns;
  }

  /**
   * Calculate average daily volume
   */
  private calculateAverageDailyVolume(candles: DydxCandle[]): number {
    if (candles.length === 0) return 0;
    
    const totalVolume = candles.reduce((sum, candle) => sum + candle.volume, 0);
    return totalVolume / candles.length;
  }

  /**
   * Estimate bid-ask spread from candlestick data
   */
  private estimateBidAskSpread(candles: DydxCandle[]): number {
    if (candles.length === 0) return 0;
    
    // Simplified estimation based on high-low spread
    const avgSpread = candles.reduce((sum, candle) => {
      return sum + ((candle.high - candle.low) / candle.close);
    }, 0) / candles.length;
    
    return avgSpread * 0.1; // Assume bid-ask is ~10% of high-low spread
  }

  /**
   * Calculate market impact of position
   */
  private calculateMarketImpact(positionSize: number, averageVolume: number, spread: number): number {
    const volumeRatio = positionSize / averageVolume;
    
    // Simple square root model for market impact
    const temporaryImpact = spread * 0.5 * Math.sqrt(volumeRatio);
    const permanentImpact = spread * 0.1 * volumeRatio;
    
    return temporaryImpact + permanentImpact;
  }

  /**
   * Calculate liquidity score (0-100)
   */
  private calculateLiquidityScore(
    volume: number,
    spread: number,
    liquidationTime: number,
    marketImpact: number
  ): number {
    // Normalize factors and combine into score
    const volumeScore = Math.min(100, Math.log10(volume + 1) * 20);
    const spreadScore = Math.max(0, 100 - spread * 10000); // Lower spread = higher score
    const timeScore = Math.max(0, 100 - liquidationTime * 10); // Faster liquidation = higher score
    const impactScore = Math.max(0, 100 - marketImpact * 1000); // Lower impact = higher score
    
    return (volumeScore + spreadScore + timeScore + impactScore) / 4;
  }

  /**
   * Get liquidity rating based on score
   */
  private getLiquidityRating(score: number): 'very_low' | 'low' | 'medium' | 'high' | 'very_high' {
    if (score >= 80) return 'very_high';
    if (score >= 60) return 'high';
    if (score >= 40) return 'medium';
    if (score >= 20) return 'low';
    return 'very_low';
  }

  /**
   * Calculate historical volatility
   */
  private calculateHistoricalVolatility(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / (returns.length - 1);
    
    return Math.sqrt(variance);
  }

  /**
   * Calculate GARCH volatility (simplified)
   */
  private calculateGarchVolatility(returns: number[]): number {
    // Simplified GARCH(1,1) implementation
    const historicalVol = this.calculateHistoricalVolatility(returns);
    
    // GARCH parameters (simplified)
    const omega = 0.000001;
    const alpha = 0.1;
    const beta = 0.85;
    
    let garchVariance = historicalVol * historicalVol;
    
    // Update variance based on recent returns
    if (returns.length > 0) {
      const lastReturn = returns[returns.length - 1];
      garchVariance = omega + alpha * lastReturn * lastReturn + beta * garchVariance;
    }
    
    return Math.sqrt(garchVariance) * Math.sqrt(252); // Annualized
  }

  /**
   * Calculate Average True Range
   */
  private calculateAverageTrueRange(candles: DydxCandle[], period: number = 14): number {
    if (candles.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    
    for (let i = 1; i < candles.length; i++) {
      const current = candles[i];
      const previous = candles[i - 1];
      
      const highLow = current.high - current.low;
      const highClosePrev = Math.abs(current.high - previous.close);
      const lowClosePrev = Math.abs(current.low - previous.close);
      
      const trueRange = Math.max(highLow, highClosePrev, lowClosePrev);
      trueRanges.push(trueRange);
    }
    
    // Calculate simple moving average of true ranges
    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((sum, tr) => sum + tr, 0) / recentTRs.length;
  }

  /**
   * Calculate price gap risk
   */
  private calculatePriceGapRisk(candles: DydxCandle[]): number {
    if (candles.length < 2) return 0;
    
    let totalGaps = 0;
    let gapCount = 0;
    
    for (let i = 1; i < candles.length; i++) {
      const currentOpen = candles[i].open;
      const previousClose = candles[i - 1].close;
      const gap = Math.abs(currentOpen - previousClose) / previousClose;
      
      if (gap > 0.001) { // Gap > 0.1%
        totalGaps += gap;
        gapCount++;
      }
    }
    
    return gapCount > 0 ? totalGaps / gapCount : 0;
  }

  /**
   * Calculate skewness of returns
   */
  private calculateSkewness(returns: number[]): number {
    if (returns.length < 3) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);
    
    if (std === 0) return 0;
    
    const skewness = returns.reduce((sum, ret) => sum + Math.pow((ret - mean) / std, 3), 0) / returns.length;
    return skewness;
  }

  /**
   * Calculate kurtosis of returns
   */
  private calculateKurtosis(returns: number[]): number {
    if (returns.length < 4) return 0;
    
    const mean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);
    
    if (std === 0) return 0;
    
    const kurtosis = returns.reduce((sum, ret) => sum + Math.pow((ret - mean) / std, 4), 0) / returns.length;
    return kurtosis - 3; // Excess kurtosis
  }

  /**
   * Calculate tail risk measure
   */
  private calculateTailRisk(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const tail5Percent = sortedReturns.slice(0, Math.ceil(returns.length * 0.05));
    
    if (tail5Percent.length === 0) return 0;
    
    const tailMean = tail5Percent.reduce((sum, ret) => sum + ret, 0) / tail5Percent.length;
    const overallMean = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
    
    return Math.abs(tailMean - overallMean);
  }

  /**
   * Calculate support and resistance levels
   */
  private calculateSupportResistance(candles: DydxCandle[]): {
    supportLevels: number[];
    resistanceLevels: number[];
  } {
    if (candles.length < 20) {
      return { supportLevels: [], resistanceLevels: [] };
    }
    
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    
    // Simple pivot point calculation
    const supportLevels: number[] = [];
    const resistanceLevels: number[] = [];
    
    // Find local minima (support) and maxima (resistance)
    for (let i = 2; i < candles.length - 2; i++) {
      const current = candles[i];
      
      // Check for local minimum (support)
      if (current.low < candles[i-1].low && current.low < candles[i-2].low &&
          current.low < candles[i+1].low && current.low < candles[i+2].low) {
        supportLevels.push(current.low);
      }
      
      // Check for local maximum (resistance)
      if (current.high > candles[i-1].high && current.high > candles[i-2].high &&
          current.high > candles[i+1].high && current.high > candles[i+2].high) {
        resistanceLevels.push(current.high);
      }
    }
    
    // Return most recent levels
    return {
      supportLevels: supportLevels.slice(-3),
      resistanceLevels: resistanceLevels.slice(-3)
    };
  }

  /**
   * Calculate technical risk score based on proximity to support/resistance
   */
  private calculateTechnicalRiskScore(
    currentPrice: number,
    supportLevels: number[],
    resistanceLevels: number[]
  ): number {
    let riskScore = 50; // Base score
    
    // Check proximity to support (lower risk near support)
    const nearestSupport = supportLevels
      .filter(level => level < currentPrice)
      .sort((a, b) => Math.abs(currentPrice - a) - Math.abs(currentPrice - b))[0];
    
    if (nearestSupport) {
      const supportDistance = (currentPrice - nearestSupport) / currentPrice;
      if (supportDistance < 0.05) { // Within 5% of support
        riskScore -= 20;
      }
    }
    
    // Check proximity to resistance (higher risk near resistance)
    const nearestResistance = resistanceLevels
      .filter(level => level > currentPrice)
      .sort((a, b) => Math.abs(currentPrice - a) - Math.abs(currentPrice - b))[0];
    
    if (nearestResistance) {
      const resistanceDistance = (nearestResistance - currentPrice) / currentPrice;
      if (resistanceDistance < 0.05) { // Within 5% of resistance
        riskScore += 20;
      }
    }
    
    return Math.max(0, Math.min(100, riskScore));
  }

  /**
   * Calculate overall price risk score
   */
  private calculatePriceRiskScore(
    volatility: number,
    atr: number,
    gapRisk: number,
    tailRisk: number,
    technicalScore: number
  ): number {
    // Normalize and combine risk factors
    const volScore = Math.min(100, volatility * 200); // Scale volatility
    const atrScore = Math.min(100, atr * 1000);
    const gapScore = Math.min(100, gapRisk * 1000);
    const tailScore = Math.min(100, tailRisk * 1000);
    
    // Weighted combination
    const combinedScore = (volScore * 0.3) + (atrScore * 0.2) + (gapScore * 0.2) + 
                         (tailScore * 0.15) + (technicalScore * 0.15);
    
    return Math.min(100, combinedScore);
  }

  /**
   * Calculate overall position risk score
   */
  private calculatePositionRiskScore(
    portfolioPercentage: number,
    positionVaR: number,
    liquidityRisk: LiquidityRiskMetrics,
    priceRisk: PriceRiskMetrics,
    position: Position
  ): number {
    // Concentration risk (higher percentage = higher risk)
    const concentrationScore = Math.min(100, portfolioPercentage * 2);
    
    // VaR risk (scale based on position value)
    const varScore = Math.min(100, (positionVaR / position.marketValue) * 100);
    
    // Liquidity risk (invert score since higher liquidity score = lower risk)
    const liquidityScore = 100 - liquidityRisk.liquidityScore;
    
    // Price risk
    const priceRiskScore = priceRisk.priceRiskScore;
    
    // Leverage risk
    const leverage = position.leverage || 1;
    const leverageScore = Math.min(100, (leverage - 1) * 20);
    
    // Weighted combination
    const overallScore = (concentrationScore * 0.25) + (varScore * 0.25) + 
                        (liquidityScore * 0.2) + (priceRiskScore * 0.2) + 
                        (leverageScore * 0.1);
    
    return Math.min(100, overallScore);
  }

  /**
   * Determine risk level based on risk score
   */
  private determineRiskLevel(riskScore: number): RiskLevel {
    if (riskScore >= 90) return 'critical';
    if (riskScore >= 75) return 'very_high';
    if (riskScore >= 60) return 'high';
    if (riskScore >= 40) return 'medium';
    if (riskScore >= 20) return 'low';
    return 'very_low';
  }

  /**
   * Generate risk alerts and recommendations
   */
  private generateRiskAlertsAndRecommendations(
    position: Position,
    portfolioPercentage: number,
    riskScore: number,
    liquidityRisk: LiquidityRiskMetrics,
    priceRisk: PriceRiskMetrics
  ): { alerts: string[]; recommendations: string[] } {
    const alerts: string[] = [];
    const recommendations: string[] = [];
    
    // Concentration alerts
    if (portfolioPercentage > 20) {
      alerts.push(`High concentration: Position represents ${portfolioPercentage.toFixed(1)}% of portfolio`);
      recommendations.push('Consider reducing position size to improve diversification');
    }
    
    // Liquidity alerts
    if (liquidityRisk.liquidityScore < 30) {
      alerts.push('Low liquidity warning: Position may be difficult to liquidate quickly');
      recommendations.push('Consider gradual position reduction or maintain smaller position size');
    }
    
    // Volatility alerts
    if (priceRisk.historicalVolatility > 0.5) { // > 50% annualized volatility
      alerts.push('High volatility warning: Asset shows significant price swings');
      recommendations.push('Consider tighter stop-loss levels due to high volatility');
    }
    
    // Leverage alerts
    if (position.leverage && position.leverage > 3) {
      alerts.push(`High leverage warning: Position leveraged ${position.leverage}x`);
      recommendations.push('Monitor margin requirements closely and consider reducing leverage');
    }
    
    // Overall risk alerts
    if (riskScore > 80) {
      alerts.push('Critical risk level: Position shows multiple risk factors');
      recommendations.push('Immediate risk review recommended - consider position reduction');
    } else if (riskScore > 60) {
      alerts.push('High risk level: Enhanced monitoring recommended');
      recommendations.push('Review stop-loss levels and position sizing');
    }
    
    return { alerts, recommendations };
  }

  /**
   * Helper methods
   */
  private isDerivative(position: Position): boolean {
    // In a real implementation, this would check the position type
    // For now, assume all positions are spot
    return false;
  }

  private calculateLeverageRisk(leverage: number): number {
    // Simple leverage risk calculation
    return Math.min(100, (leverage - 1) * 25);
  }

  private calculateMarginCallPrice(position: Position): number {
    if (!position.leverage || position.leverage <= 1) {
      return 0; // No margin call for unleveraged positions
    }
    
    // Simplified margin call calculation
    const maintenanceMargin = 0.1; // 10% maintenance margin
    const marginCallDistance = 1 - maintenanceMargin;
    
    if (position.side === 'long') {
      return position.entryPrice * marginCallDistance / position.leverage;
    } else {
      return position.entryPrice * (1 + marginCallDistance / position.leverage);
    }
  }

  private getMaxAllowedLeverage(symbol: string): number {
    // In practice, this would be based on asset class and regulations
    return 10; // Default max leverage
  }

  private getTotalPortfolioValue(portfolio: Position[]): number {
    return portfolio.reduce((total, position) => total + position.marketValue, 0);
  }

  private estimatePortfolioVaR(portfolio: Position[]): number {
    // Simplified portfolio VaR estimation
    const totalValue = this.getTotalPortfolioValue(portfolio);
    return totalValue * 0.02; // Assume 2% portfolio VaR
  }
}

// Leverage Metrics interface (add to types.ts if not already present)
interface LeverageMetrics {
  currentLeverage: number;
  margin: number;
  marginRatio: number;
  leverageRisk: number;
  liquidationPrice: number;
  marginCallPrice: number;
  maxLeverage: number;
  leverageUtilization: number;
}