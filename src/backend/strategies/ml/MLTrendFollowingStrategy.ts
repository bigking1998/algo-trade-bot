/**
 * ML-Enhanced Trend Following Strategy - Task BE-026: ML Strategy Templates
 * 
 * Advanced trend following strategy enhanced with machine learning for:
 * - Trend strength prediction and validation
 * - Dynamic trend change detection
 * - Optimal entry/exit timing
 * - Multi-timeframe trend analysis
 * - Adaptive parameter optimization
 */

import { BaseMLStrategy, MLStrategyConfig, MLPrediction } from './BaseMLStrategy.js';
import { StrategyContext, StrategySignal } from '../types.js';

/**
 * ML Trend Following Strategy configuration
 */
export interface MLTrendFollowingConfig extends MLStrategyConfig {
  trendFollowing: {
    // Trend detection parameters
    trendStrengthThreshold: number; // Minimum trend strength (0-1)
    trendConfidenceThreshold: number; // ML confidence for trend signals
    minTrendDuration: number; // Minimum trend duration in candles
    
    // Multi-timeframe analysis
    timeframes: string[]; // e.g., ['1m', '5m', '15m', '1h']
    timeframeWeights: number[]; // Weights for each timeframe
    
    // Trend validation
    volumeConfirmation: boolean; // Require volume confirmation
    momentumConfirmation: boolean; // Require momentum confirmation
    volatilityFilter: boolean; // Filter out high volatility periods
    
    // Dynamic parameters
    adaptiveStops: boolean; // Use ML to adjust stop losses
    dynamicTakeProfit: boolean; // Use ML to optimize take profits
    trendStrengthScaling: boolean; // Scale position size by trend strength
    
    // Risk management
    maxTrendAge: number; // Maximum trend age before exit
    antiTrendThreshold: number; // Threshold for counter-trend signals
    correlationFilter: boolean; // Filter trades based on market correlation
  };
}

/**
 * Trend analysis result
 */
interface TrendAnalysis {
  direction: 'UP' | 'DOWN' | 'SIDEWAYS';
  strength: number; // 0-1
  confidence: number; // 0-1
  duration: number; // in candles
  momentum: number;
  volume_confirmation: boolean;
  volatility: number;
  support_levels: number[];
  resistance_levels: number[];
  fibonacci_levels: Record<string, number>;
  timeframe_alignment: Record<string, {
    direction: string;
    strength: number;
    weight: number;
  }>;
}

/**
 * ML-Enhanced Trend Following Strategy
 */
export class MLTrendFollowingStrategy extends BaseMLStrategy {
  private trendConfig: MLTrendFollowingConfig['trendFollowing'];
  private trendHistory: Array<{
    timestamp: Date;
    analysis: TrendAnalysis;
    price: number;
  }> = [];
  
  private currentTrend?: TrendAnalysis;
  private trendStartTime?: Date;
  private lastTrendSignal?: StrategySignal;

  constructor(config: MLTrendFollowingConfig) {
    super({
      ...config,
      ml: {
        ...config.ml,
        modelTypes: ['PRICE_PREDICTION', 'MARKET_REGIME', 'VOLATILITY'],
        featureEngineeringConfig: {
          technicalIndicators: [
            'sma_20', 'sma_50', 'sma_200', 'ema_12', 'ema_26',
            'macd', 'macd_signal', 'macd_histogram',
            'rsi', 'adx', 'cci', 'williams_r',
            'bollinger_upper', 'bollinger_lower', 'bollinger_width',
            'atr', 'momentum', 'rate_of_change'
          ],
          lookbackPeriods: [5, 10, 20, 50, 100],
          priceFeatures: true,
          volumeFeatures: true,
          volatilityFeatures: true,
          marketStructureFeatures: true
        },
        predictionHorizon: 60, // 1 hour prediction horizon
        ensembleStrategy: 'WEIGHTED'
      }
    });
    
    this.trendConfig = config.trendFollowing;
  }

  /**
   * Define training strategy for trend prediction models
   */
  async defineTrainingStrategy(): Promise<{
    targetVariable: string;
    featureSelection: string[];
    modelArchitecture: any;
    trainingParameters: any;
  }> {
    return {
      targetVariable: 'trend_direction_future', // Predict future trend direction
      featureSelection: [
        'price_trend_strength', 'volume_trend', 'momentum_indicators',
        'volatility_metrics', 'support_resistance_levels', 'fibonacci_ratios',
        'multi_timeframe_alignment', 'market_structure_features'
      ],
      modelArchitecture: {
        type: 'LSTM_ENSEMBLE',
        layers: [
          {
            type: 'LSTM',
            units: 128,
            returnSequences: true,
            dropout: 0.3
          },
          {
            type: 'LSTM', 
            units: 64,
            dropout: 0.3
          },
          {
            type: 'Dense',
            units: 32,
            activation: 'relu'
          },
          {
            type: 'Dense',
            units: 3, // UP, DOWN, SIDEWAYS
            activation: 'softmax'
          }
        ],
        optimizer: 'adam',
        learningRate: 0.001
      },
      trainingParameters: {
        sequenceLength: 60,
        batchSize: 32,
        epochs: 200,
        validationSplit: 0.2,
        earlyStoppingPatience: 20,
        lossFunction: 'categorical_crossentropy',
        metrics: ['accuracy', 'precision', 'recall']
      }
    };
  }

  /**
   * Process ML prediction into trend following signal
   */
  async processPrediction(prediction: MLPrediction, context: StrategyContext): Promise<StrategySignal | null> {
    // Perform comprehensive trend analysis
    const trendAnalysis = await this.analyzeTrend(context, prediction);
    
    // Store trend analysis
    this.storeTrendAnalysis(trendAnalysis, context.marketData.close);
    
    // Validate trend signal
    if (!this.validateTrendSignal(trendAnalysis, prediction, context)) {
      return null;
    }
    
    // Generate signal based on trend analysis
    return await this.generateTrendSignal(trendAnalysis, prediction, context);
  }

  /**
   * Validate ML prediction quality for trend following
   */
  validatePrediction(prediction: MLPrediction, context: StrategyContext): boolean {
    // Check confidence threshold
    if (prediction.confidence < this.trendConfig.trendConfidenceThreshold) {
      return false;
    }
    
    // Ensure we have trend-relevant predictions
    if (prediction.signal === 'HOLD' && prediction.confidence < 0.8) {
      return false;
    }
    
    // Check for conflicting timeframe signals
    if (this.trendConfig.timeframes.length > 1) {
      const alignment = this.checkTimeframeAlignment(prediction);
      if (alignment < 0.6) {
        return false;
      }
    }
    
    // Volatility filter
    if (this.trendConfig.volatilityFilter && 
        prediction.explanation.volatilityPrediction > 0.05) {
      return false;
    }
    
    return true;
  }

  /**
   * Handle model performance degradation
   */
  async onModelDegradation(modelId: string, currentMetrics: any): Promise<void> {
    console.log(`🔄 Handling model degradation for trend model ${modelId}`);
    
    // Increase confidence thresholds temporarily
    this.trendConfig.trendConfidenceThreshold = Math.min(
      this.trendConfig.trendConfidenceThreshold * 1.2, 
      0.9
    );
    
    // Reduce position sizing
    // This would be implemented in the position sizing logic
    
    // Trigger model retraining if pipeline is available
    if (this.trainingPipeline) {
      try {
        // Get recent market data for retraining
        const recentData: any[] = []; // Would fetch real data
        await this.trainingPipeline.updateWithNewData(recentData, 'BTC-USD', true);
      } catch (error) {
        console.error('Failed to trigger model retraining:', error);
      }
    }
  }

  /**
   * PRIVATE IMPLEMENTATION METHODS
   */

  /**
   * Perform comprehensive trend analysis
   */
  private async analyzeTrend(context: StrategyContext, prediction: MLPrediction): Promise<TrendAnalysis> {
    const marketData = context.marketData;
    const features = prediction.features;
    
    // Determine trend direction using ML + technical analysis
    const direction = this.determineTrendDirection(prediction, features);
    
    // Calculate trend strength
    const strength = this.calculateTrendStrength(features, prediction);
    
    // Calculate trend confidence
    const confidence = this.calculateTrendConfidence(prediction, features);
    
    // Estimate trend duration
    const duration = this.estimateTrendDuration(features);
    
    // Calculate momentum
    const momentum = features.momentum || 0;
    
    // Check volume confirmation
    const volume_confirmation = this.checkVolumeConfirmation(features, direction);
    
    // Calculate volatility
    const volatility = prediction.explanation.volatilityPrediction;
    
    // Identify key levels
    const supportLevels = this.identifySupportLevels(context);
    const resistanceLevels = this.identifyResistanceLevels(context);
    const fibonacciLevels = this.calculateFibonacciLevels(context);
    
    // Multi-timeframe alignment analysis
    const timeframe_alignment = this.analyzeTimeframeAlignment(prediction, features);
    
    return {
      direction,
      strength,
      confidence,
      duration,
      momentum,
      volume_confirmation,
      volatility,
      support_levels: supportLevels,
      resistance_levels: resistanceLevels,
      fibonacci_levels: fibonacciLevels,
      timeframe_alignment
    };
  }

  /**
   * Determine trend direction from ML prediction and features
   */
  private determineTrendDirection(prediction: MLPrediction, features: any): 'UP' | 'DOWN' | 'SIDEWAYS' {
    // Use ML prediction as primary signal
    if (prediction.signal === 'BUY') return 'UP';
    if (prediction.signal === 'SELL') return 'DOWN';
    
    // Use technical indicators as backup
    const sma20 = features.sma_20 || 0;
    const sma50 = features.sma_50 || 0;
    const price = features.close || 0;
    
    if (price > sma20 && sma20 > sma50) return 'UP';
    if (price < sma20 && sma20 < sma50) return 'DOWN';
    
    return 'SIDEWAYS';
  }

  /**
   * Calculate trend strength
   */
  private calculateTrendStrength(features: any, prediction: MLPrediction): number {
    let strength = prediction.confidence;
    
    // Factor in ADX if available
    if (features.adx) {
      const adxStrength = Math.min(features.adx / 50, 1); // Normalize ADX
      strength = (strength + adxStrength) / 2;
    }
    
    // Factor in momentum
    if (features.momentum) {
      const momentumStrength = Math.min(Math.abs(features.momentum) / 0.02, 1);
      strength = (strength + momentumStrength) / 2;
    }
    
    // Factor in MACD
    if (features.macd && features.macd_signal) {
      const macdStrength = Math.abs(features.macd - features.macd_signal) / 0.001;
      strength = (strength + Math.min(macdStrength, 1)) / 2;
    }
    
    return Math.max(0, Math.min(1, strength));
  }

  /**
   * Calculate trend confidence
   */
  private calculateTrendConfidence(prediction: MLPrediction, features: any): number {
    let confidence = prediction.confidence;
    
    // Boost confidence with ensemble agreement
    if (prediction.modelPredictions && Object.keys(prediction.modelPredictions).length > 1) {
      const agreement = this.calculateEnsembleAgreement(prediction);
      confidence = (confidence + agreement) / 2;
    }
    
    // Factor in volatility (lower volatility = higher confidence)
    const volatilityPenalty = Math.min(prediction.explanation.volatilityPrediction * 10, 0.3);
    confidence = Math.max(0, confidence - volatilityPenalty);
    
    return confidence;
  }

  /**
   * Estimate trend duration
   */
  private estimateTrendDuration(features: any): number {
    // Use moving average convergence/divergence to estimate duration
    const sma20 = features.sma_20 || 0;
    const sma50 = features.sma_50 || 0;
    const price = features.close || 0;
    
    const shortTermTrend = (price - sma20) / sma20;
    const longTermTrend = (sma20 - sma50) / sma50;
    
    // If trends align, expect longer duration
    if (Math.sign(shortTermTrend) === Math.sign(longTermTrend)) {
      return Math.min(Math.abs(longTermTrend) * 1000, 100); // Max 100 candles
    }
    
    return Math.max(5, Math.abs(shortTermTrend) * 500); // Min 5 candles
  }

  /**
   * Check volume confirmation
   */
  private checkVolumeConfirmation(features: any, direction: string): boolean {
    if (!this.trendConfig.volumeConfirmation) return true;
    
    const volume = features.volume || 0;
    const volumeAverage = features.volume_sma_20 || 0;
    
    // For trend following, we want above-average volume
    return volume > volumeAverage * 1.2;
  }

  /**
   * Identify support levels
   */
  private identifySupportLevels(context: StrategyContext): number[] {
    // Simplified support level identification
    const price = context.marketData.close;
    const low = context.marketData.low;
    
    // Calculate basic support levels
    return [
      low * 0.98, // Recent low support
      price * 0.95, // 5% below current price
      price * 0.90  // 10% below current price
    ];
  }

  /**
   * Identify resistance levels
   */
  private identifyResistanceLevels(context: StrategyContext): number[] {
    // Simplified resistance level identification
    const price = context.marketData.close;
    const high = context.marketData.high;
    
    // Calculate basic resistance levels
    return [
      high * 1.02, // Recent high resistance
      price * 1.05, // 5% above current price
      price * 1.10  // 10% above current price
    ];
  }

  /**
   * Calculate Fibonacci retracement levels
   */
  private calculateFibonacciLevels(context: StrategyContext): Record<string, number> {
    const high = context.marketData.high;
    const low = context.marketData.low;
    const range = high - low;
    
    return {
      '0%': high,
      '23.6%': high - (range * 0.236),
      '38.2%': high - (range * 0.382),
      '50%': high - (range * 0.5),
      '61.8%': high - (range * 0.618),
      '100%': low
    };
  }

  /**
   * Analyze timeframe alignment
   */
  private analyzeTimeframeAlignment(prediction: MLPrediction, features: any): Record<string, any> {
    const alignment: Record<string, any> = {};
    
    // For each configured timeframe, analyze trend
    this.trendConfig.timeframes.forEach((timeframe, index) => {
      const weight = this.trendConfig.timeframeWeights[index] || 1;
      
      // This would analyze different timeframes - simplified for now
      alignment[timeframe] = {
        direction: prediction.signal === 'BUY' ? 'UP' : prediction.signal === 'SELL' ? 'DOWN' : 'SIDEWAYS',
        strength: prediction.confidence,
        weight
      };
    });
    
    return alignment;
  }

  /**
   * Check timeframe alignment quality
   */
  private checkTimeframeAlignment(prediction: MLPrediction): number {
    // Simplified - in reality would check actual timeframe alignment
    return prediction.confidence; // Use confidence as proxy for alignment
  }

  /**
   * Validate trend signal
   */
  private validateTrendSignal(analysis: TrendAnalysis, prediction: MLPrediction, context: StrategyContext): boolean {
    // Check minimum trend strength
    if (analysis.strength < this.trendConfig.trendStrengthThreshold) {
      return false;
    }
    
    // Check trend confidence
    if (analysis.confidence < this.trendConfig.trendConfidenceThreshold) {
      return false;
    }
    
    // Check volume confirmation if required
    if (this.trendConfig.volumeConfirmation && !analysis.volume_confirmation) {
      return false;
    }
    
    // Check momentum confirmation if required
    if (this.trendConfig.momentumConfirmation && Math.abs(analysis.momentum) < 0.01) {
      return false;
    }
    
    // Check for trend exhaustion
    if (this.currentTrend && this.trendStartTime) {
      const trendAge = (Date.now() - this.trendStartTime.getTime()) / (1000 * 60); // minutes
      if (trendAge > this.trendConfig.maxTrendAge) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Generate trend-following signal
   */
  private async generateTrendSignal(
    analysis: TrendAnalysis, 
    prediction: MLPrediction, 
    context: StrategyContext
  ): Promise<StrategySignal | null> {
    
    const price = context.marketData.close;
    
    // Determine signal type
    let action: 'BUY' | 'SELL';
    if (analysis.direction === 'UP') {
      action = 'BUY';
    } else if (analysis.direction === 'DOWN') {
      action = 'SELL';
    } else {
      return null; // No signal for sideways trend
    }
    
    // Calculate dynamic stop loss
    const stopLoss = this.calculateDynamicStopLoss(analysis, price);
    
    // Calculate dynamic take profit
    const takeProfit = this.calculateDynamicTakeProfit(analysis, price);
    
    // Calculate confidence (combine trend and ML confidence)
    const signalConfidence = (analysis.confidence + prediction.confidence) / 2;
    
    const signal: StrategySignal = {
      symbol: context.marketData.symbol,
      action,
      entryPrice: price,
      stopLoss,
      takeProfit,
      confidence: signalConfidence,
      timestamp: new Date(),
      reason: `ML Trend Following: ${analysis.direction} trend detected with ${(analysis.strength * 100).toFixed(1)}% strength`,
      metadata: {
        strategy: 'ML_TREND_FOLLOWING',
        trendDirection: analysis.direction,
        trendStrength: analysis.strength,
        trendDuration: analysis.duration,
        momentum: analysis.momentum,
        volatility: analysis.volatility,
        supportLevels: analysis.support_levels,
        resistanceLevels: analysis.resistance_levels,
        fibonacciLevels: analysis.fibonacci_levels,
        timeframeAlignment: analysis.timeframe_alignment,
        mlPrediction: {
          signal: prediction.signal,
          confidence: prediction.confidence,
          keyFactors: prediction.explanation.keyFactors
        }
      }
    };
    
    // Store as last signal
    this.lastTrendSignal = signal;
    
    // Update current trend tracking
    this.currentTrend = analysis;
    if (!this.trendStartTime || this.trendDirectionChanged(analysis)) {
      this.trendStartTime = new Date();
    }
    
    return signal;
  }

  /**
   * Calculate dynamic stop loss based on trend analysis
   */
  private calculateDynamicStopLoss(analysis: TrendAnalysis, price: number): number {
    if (!this.trendConfig.adaptiveStops) {
      // Use fixed stop loss based on ATR or percentage
      return analysis.direction === 'UP' ? 
        price * 0.98 : // 2% stop for long
        price * 1.02;  // 2% stop for short
    }
    
    // Use ML-enhanced adaptive stops
    const volatilityMultiplier = Math.max(1, analysis.volatility * 10);
    const trendStrengthMultiplier = Math.max(0.5, 2 - analysis.strength);
    
    const stopDistance = 0.02 * volatilityMultiplier * trendStrengthMultiplier;
    
    return analysis.direction === 'UP' ? 
      price * (1 - stopDistance) :
      price * (1 + stopDistance);
  }

  /**
   * Calculate dynamic take profit based on trend analysis
   */
  private calculateDynamicTakeProfit(analysis: TrendAnalysis, price: number): number {
    if (!this.trendConfig.dynamicTakeProfit) {
      // Use fixed take profit
      return analysis.direction === 'UP' ?
        price * 1.04 : // 4% take profit for long
        price * 0.96;  // 4% take profit for short
    }
    
    // Use trend strength to set take profit
    const trendMultiplier = Math.max(1, analysis.strength * 3);
    const profitDistance = 0.03 * trendMultiplier; // Base 3% scaled by trend strength
    
    // Consider resistance/support levels
    if (analysis.direction === 'UP' && analysis.resistance_levels.length > 0) {
      const nearestResistance = analysis.resistance_levels
        .filter(level => level > price)
        .sort((a, b) => a - b)[0];
      
      if (nearestResistance) {
        const resistanceProfit = price * (1 + profitDistance);
        return Math.min(resistanceProfit, nearestResistance * 0.99);
      }
    }
    
    return analysis.direction === 'UP' ?
      price * (1 + profitDistance) :
      price * (1 - profitDistance);
  }

  /**
   * Check if trend direction changed
   */
  private trendDirectionChanged(analysis: TrendAnalysis): boolean {
    return !this.currentTrend || this.currentTrend.direction !== analysis.direction;
  }

  /**
   * Store trend analysis for historical tracking
   */
  private storeTrendAnalysis(analysis: TrendAnalysis, price: number): void {
    this.trendHistory.push({
      timestamp: new Date(),
      analysis,
      price
    });
    
    // Keep history bounded
    if (this.trendHistory.length > 1000) {
      this.trendHistory.shift();
    }
  }

  /**
   * Get trend history for analysis
   */
  public getTrendHistory(): Array<{ timestamp: Date; analysis: TrendAnalysis; price: number; }> {
    return [...this.trendHistory];
  }

  /**
   * Get current trend analysis
   */
  public getCurrentTrend(): TrendAnalysis | undefined {
    return this.currentTrend;
  }
}

export default MLTrendFollowingStrategy;