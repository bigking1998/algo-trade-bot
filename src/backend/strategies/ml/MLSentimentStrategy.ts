/**
 * ML-Powered Sentiment-Based Trading Strategy - Task BE-026: ML Strategy Templates
 * 
 * Advanced sentiment analysis trading strategy enhanced with machine learning for:
 * - Multi-source sentiment aggregation and analysis
 * - Real-time social media and news sentiment processing
 * - Sentiment momentum and trend detection
 * - Contrarian and momentum sentiment strategies
 * - Cross-asset sentiment correlation analysis
 */

import { BaseMLStrategy, MLStrategyConfig, MLPrediction } from './BaseMLStrategy.js';
import { StrategyContext, StrategySignal } from '../types.js';

/**
 * Sentiment data source
 */
interface SentimentSource {
  source: 'TWITTER' | 'REDDIT' | 'NEWS' | 'FEAR_GREED' | 'FUNDING_RATES' | 'OPTIONS_FLOW';
  sentiment: number; // -1 to 1 (negative to positive)
  confidence: number; // 0 to 1
  volume: number; // Activity volume
  timestamp: Date;
  metadata: Record<string, any>;
}

/**
 * ML Sentiment Strategy configuration
 */
export interface MLSentimentConfig extends MLStrategyConfig {
  sentiment: {
    // Data sources and weights
    sources: {
      twitter: { enabled: boolean; weight: number; };
      reddit: { enabled: boolean; weight: number; };
      news: { enabled: boolean; weight: number; };
      fearGreed: { enabled: boolean; weight: number; };
      fundingRates: { enabled: boolean; weight: number; };
      optionsFlow: { enabled: boolean; weight: number; };
    };
    
    // Sentiment processing
    sentimentThreshold: number; // Minimum sentiment strength
    confidenceThreshold: number; // Minimum confidence for sentiment signals
    volumeWeighting: boolean; // Weight sentiment by activity volume
    timeDecay: number; // How fast sentiment decays (hours)
    
    // Strategy type
    strategyType: 'MOMENTUM' | 'CONTRARIAN' | 'ADAPTIVE';
    momentumThreshold: number; // Threshold for momentum vs contrarian
    adaptiveLearn: boolean; // Learn optimal strategy type
    
    // Sentiment analysis
    sentimentLookback: number; // Hours to look back for sentiment
    volatilityFilter: boolean; // Filter by volatility
    volumeFilter: boolean; // Require volume confirmation
    
    // Cross-asset analysis
    crossAssetSentiment: boolean; // Use BTC/ETH sentiment for alts
    correlationThreshold: number; // Minimum correlation to use cross-asset sentiment
    marketSentimentWeight: number; // Weight of overall market sentiment
    
    // Risk management
    sentimentReversal: boolean; // Exit on sentiment reversal
    maxSentimentAge: number; // Max age of sentiment data (hours)
    sentimentVolatility: boolean; // Consider sentiment volatility in sizing
    
    // Performance optimization
    learningRate: number; // Rate of strategy adaptation
    memoryPeriod: number; // Period for performance memory (days)
    recalibrationFreq: number; // How often to recalibrate (hours)
  };
}

/**
 * Aggregated sentiment analysis
 */
interface SentimentAnalysis {
  aggregatedSentiment: number; // -1 to 1
  confidence: number; // 0 to 1
  strength: number; // 0 to 1
  momentum: number; // Sentiment momentum
  volatility: number; // Sentiment volatility
  sources: {
    count: number;
    breakdown: Record<string, { sentiment: number; weight: number; volume: number; }>;
  };
  crossAsset: {
    btcSentiment: number;
    ethSentiment: number;
    correlation: number;
    marketSentiment: number;
  };
  signals: {
    primary: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    contrarian: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    momentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    recommended: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  };
  riskFactors: string[];
  qualityScore: number; // Overall quality of sentiment data
}

/**
 * ML-Powered Sentiment Trading Strategy
 */
export class MLSentimentStrategy extends BaseMLStrategy {
  private sentimentConfig: MLSentimentConfig['sentiment'];
  private sentimentHistory: Array<{
    timestamp: Date;
    analysis: SentimentAnalysis;
    price: number;
  }> = [];
  
  private rawSentimentData: SentimentSource[] = [];
  private performanceByStrategy: {
    momentum: { wins: number; losses: number; totalReturn: number; };
    contrarian: { wins: number; losses: number; totalReturn: number; };
  } = {
    momentum: { wins: 0, losses: 0, totalReturn: 0 },
    contrarian: { wins: 0, losses: 0, totalReturn: 0 }
  };
  
  private currentSentimentSignal?: {
    signal: SentimentAnalysis;
    strategyType: 'MOMENTUM' | 'CONTRARIAN';
    strength: number;
  };

  constructor(config: MLSentimentConfig) {
    super({
      ...config,
      ml: {
        ...config.ml,
        modelTypes: ['SENTIMENT', 'MARKET_REGIME', 'VOLATILITY'],
        featureEngineeringConfig: {
          technicalIndicators: [
            'rsi', 'macd', 'momentum', 'volume_oscillator',
            'fear_greed_index', 'funding_rate', 'open_interest',
            'put_call_ratio', 'vix_equivalent'
          ],
          lookbackPeriods: [6, 12, 24, 48], // Hours for sentiment
          priceFeatures: true,
          volumeFeatures: true,
          volatilityFeatures: true,
          marketStructureFeatures: true
        },
        predictionHorizon: 120, // 2 hour prediction for sentiment
        ensembleStrategy: 'WEIGHTED'
      }
    });
    
    this.sentimentConfig = config.sentiment;
    
    // Start sentiment data collection
    this.initializeSentimentCollection();
  }

  /**
   * Define training strategy for sentiment prediction models
   */
  async defineTrainingStrategy(): Promise<{
    targetVariable: string;
    featureSelection: string[];
    modelArchitecture: any;
    trainingParameters: any;
  }> {
    return {
      targetVariable: 'sentiment_price_impact', // Predict how sentiment affects price
      featureSelection: [
        'aggregated_sentiment', 'sentiment_momentum', 'sentiment_volatility',
        'social_volume', 'news_sentiment', 'fear_greed_index', 'funding_rates',
        'cross_asset_sentiment', 'market_sentiment', 'sentiment_divergence',
        'technical_indicators', 'price_momentum', 'volume_indicators'
      ],
      modelArchitecture: {
        type: 'HYBRID_SENTIMENT_MODEL',
        components: [
          {
            name: 'sentiment_processor',
            type: 'TRANSFORMER',
            layers: [
              { type: 'MultiHeadAttention', heads: 8, dModel: 64 },
              { type: 'FeedForward', dModel: 64, dff: 256 },
              { type: 'LayerNorm' },
              { type: 'Dropout', rate: 0.2 }
            ]
          },
          {
            name: 'time_series_processor', 
            type: 'LSTM',
            layers: [
              { type: 'LSTM', units: 128, returnSequences: true, dropout: 0.3 },
              { type: 'LSTM', units: 64, dropout: 0.3 }
            ]
          },
          {
            name: 'fusion_layer',
            type: 'Dense',
            layers: [
              { type: 'Dense', units: 64, activation: 'relu' },
              { type: 'Dropout', rate: 0.3 },
              { type: 'Dense', units: 32, activation: 'relu' },
              { type: 'Dense', units: 3, activation: 'softmax' } // BULLISH, BEARISH, NEUTRAL
            ]
          }
        ],
        optimizer: 'adamw',
        learningRate: 0.0001
      },
      trainingParameters: {
        sequenceLength: 48, // 48 hours of sentiment data
        batchSize: 16,
        epochs: 300,
        validationSplit: 0.2,
        earlyStoppingPatience: 25,
        lossFunction: 'categorical_crossentropy',
        metrics: ['accuracy', 'f1_macro'],
        classWeights: { 0: 1.0, 1: 1.2, 2: 1.0 } // Slightly boost bearish class
      }
    };
  }

  /**
   * Process ML prediction into sentiment-based signal
   */
  async processPrediction(prediction: MLPrediction, context: StrategyContext): Promise<StrategySignal | null> {
    // Collect and analyze sentiment data
    const sentimentAnalysis = await this.analyzeSentiment(context);
    
    // Store sentiment analysis
    this.storeSentimentAnalysis(sentimentAnalysis, context.marketData.close);
    
    // Validate sentiment signal quality
    if (!this.validateSentimentSignal(sentimentAnalysis, prediction, context)) {
      return null;
    }
    
    // Generate sentiment-based trading signal
    return await this.generateSentimentSignal(sentimentAnalysis, prediction, context);
  }

  /**
   * Validate ML prediction quality for sentiment trading
   */
  validatePrediction(prediction: MLPrediction, context: StrategyContext): boolean {
    // Check confidence threshold
    if (prediction.confidence < this.sentimentConfig.confidenceThreshold) {
      return false;
    }
    
    // Sentiment trading requires clear directional signals
    if (prediction.signal === 'HOLD' && prediction.confidence < 0.8) {
      return false;
    }
    
    // Check that we have recent sentiment data
    const recentSentiment = this.getRecentSentimentData(1); // Last 1 hour
    if (recentSentiment.length === 0) {
      return false;
    }
    
    return true;
  }

  /**
   * Handle model performance degradation
   */
  async onModelDegradation(modelId: string, currentMetrics: any): Promise<void> {
    console.log(`🔄 Handling model degradation for sentiment model ${modelId}`);
    
    // Increase confidence thresholds
    this.sentimentConfig.confidenceThreshold = Math.min(
      this.sentimentConfig.confidenceThreshold * 1.25,
      0.9
    );
    
    this.sentimentConfig.sentimentThreshold = Math.min(
      this.sentimentConfig.sentimentThreshold * 1.2,
      0.8
    );
    
    // Switch to more conservative strategy temporarily
    if (this.sentimentConfig.strategyType === 'MOMENTUM') {
      console.log('📊 Temporarily switching to contrarian sentiment strategy');
      // Would temporarily adjust strategy logic
    }
    
    // Analyze recent performance to understand failure modes
    const recentPerformance = this.analyzeStrategyPerformance();
    if (recentPerformance.momentum.wins < recentPerformance.contrarian.wins) {
      console.log('📈 Contrarian sentiment signals performing better');
      // Could adjust strategy weights
    }
  }

  /**
   * PRIVATE IMPLEMENTATION METHODS
   */

  /**
   * Initialize sentiment data collection
   */
  private initializeSentimentCollection(): void {
    console.log('🎭 Initializing sentiment data collection...');
    
    // In production, this would setup real-time sentiment data feeds
    // For now, we'll simulate sentiment data
    setInterval(() => {
      this.collectSentimentData();
    }, 300000); // Every 5 minutes
    
    console.log('✅ Sentiment data collection initialized');
  }

  /**
   * Collect sentiment data from various sources
   */
  private collectSentimentData(): void {
    const timestamp = new Date();
    const sources: SentimentSource[] = [];
    
    // Simulate collecting sentiment from various sources
    if (this.sentimentConfig.sources.twitter.enabled) {
      sources.push({
        source: 'TWITTER',
        sentiment: (Math.random() - 0.5) * 2, // -1 to 1
        confidence: Math.random() * 0.5 + 0.5, // 0.5 to 1
        volume: Math.random() * 1000 + 100,
        timestamp,
        metadata: { tweets: Math.floor(Math.random() * 1000 + 500) }
      });
    }
    
    if (this.sentimentConfig.sources.reddit.enabled) {
      sources.push({
        source: 'REDDIT',
        sentiment: (Math.random() - 0.5) * 2,
        confidence: Math.random() * 0.4 + 0.4,
        volume: Math.random() * 500 + 50,
        timestamp,
        metadata: { posts: Math.floor(Math.random() * 100 + 50) }
      });
    }
    
    if (this.sentimentConfig.sources.news.enabled) {
      sources.push({
        source: 'NEWS',
        sentiment: (Math.random() - 0.5) * 2,
        confidence: Math.random() * 0.6 + 0.4,
        volume: Math.random() * 200 + 20,
        timestamp,
        metadata: { articles: Math.floor(Math.random() * 50 + 10) }
      });
    }
    
    if (this.sentimentConfig.sources.fearGreed.enabled) {
      sources.push({
        source: 'FEAR_GREED',
        sentiment: (Math.random() - 0.5) * 2,
        confidence: 0.9, // Fear & Greed index is usually reliable
        volume: 1, // Single data point
        timestamp,
        metadata: { index: Math.floor(Math.random() * 100) }
      });
    }
    
    // Add to raw sentiment data
    this.rawSentimentData.push(...sources);
    
    // Keep data bounded (last 24 hours)
    const cutoffTime = timestamp.getTime() - (24 * 60 * 60 * 1000);
    this.rawSentimentData = this.rawSentimentData.filter(data => 
      data.timestamp.getTime() > cutoffTime
    );
  }

  /**
   * Get recent sentiment data
   */
  private getRecentSentimentData(hoursBack: number): SentimentSource[] {
    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
    return this.rawSentimentData.filter(data => 
      data.timestamp.getTime() > cutoffTime
    );
  }

  /**
   * Analyze aggregated sentiment from all sources
   */
  private async analyzeSentiment(context: StrategyContext): Promise<SentimentAnalysis> {
    const recentData = this.getRecentSentimentData(this.sentimentConfig.sentimentLookback);
    
    if (recentData.length === 0) {
      return this.getDefaultSentimentAnalysis();
    }
    
    // Calculate time-weighted sentiment with decay
    const aggregatedSentiment = this.calculateAggregatedSentiment(recentData);
    
    // Calculate confidence based on source agreement
    const confidence = this.calculateSentimentConfidence(recentData);
    
    // Calculate sentiment strength (absolute value)
    const strength = Math.abs(aggregatedSentiment);
    
    // Calculate sentiment momentum
    const momentum = this.calculateSentimentMomentum(recentData);
    
    // Calculate sentiment volatility
    const volatility = this.calculateSentimentVolatility(recentData);
    
    // Source breakdown
    const sources = this.analyzeSentimentSources(recentData);
    
    // Cross-asset sentiment analysis
    const crossAsset = await this.analyzeCrossAssetSentiment();
    
    // Generate signals for different strategies
    const signals = this.generateSentimentSignals(
      aggregatedSentiment, confidence, momentum, crossAsset
    );
    
    // Identify risk factors
    const riskFactors = this.identifySentimentRiskFactors(
      recentData, aggregatedSentiment, volatility
    );
    
    // Calculate overall quality score
    const qualityScore = this.calculateSentimentQualityScore(
      recentData, confidence, sources.count
    );
    
    return {
      aggregatedSentiment,
      confidence,
      strength,
      momentum,
      volatility,
      sources,
      crossAsset,
      signals,
      riskFactors,
      qualityScore
    };
  }

  /**
   * Calculate aggregated sentiment with time decay and source weighting
   */
  private calculateAggregatedSentiment(data: SentimentSource[]): number {
    let weightedSum = 0;
    let totalWeight = 0;
    const now = Date.now();
    
    for (const source of data) {
      const sourceConfig = this.sentimentConfig.sources[source.source.toLowerCase() as keyof typeof this.sentimentConfig.sources];
      if (!sourceConfig) continue;
      
      let weight = sourceConfig.weight;
      
      // Apply volume weighting if enabled
      if (this.sentimentConfig.volumeWeighting) {
        const volumeWeight = Math.log(source.volume + 1) / 10; // Log scale
        weight *= (1 + volumeWeight);
      }
      
      // Apply time decay
      const ageHours = (now - source.timestamp.getTime()) / (1000 * 60 * 60);
      const decayFactor = Math.exp(-ageHours / this.sentimentConfig.timeDecay);
      weight *= decayFactor;
      
      // Apply confidence weighting
      weight *= source.confidence;
      
      weightedSum += source.sentiment * weight;
      totalWeight += weight;
    }
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Calculate sentiment confidence based on source agreement
   */
  private calculateSentimentConfidence(data: SentimentSource[]): number {
    if (data.length < 2) return 0.5;
    
    const sentiments = data.map(d => d.sentiment);
    const mean = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sentiments.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower standard deviation = higher confidence
    const agreementScore = Math.max(0, 1 - stdDev);
    
    // Factor in number of sources (more sources = higher confidence)
    const sourceScore = Math.min(data.length / 5, 1); // Cap at 5 sources
    
    // Factor in average source confidence
    const avgSourceConfidence = data.reduce((sum, d) => sum + d.confidence, 0) / data.length;
    
    return (agreementScore + sourceScore + avgSourceConfidence) / 3;
  }

  /**
   * Calculate sentiment momentum
   */
  private calculateSentimentMomentum(data: SentimentSource[]): number {
    if (data.length < 2) return 0;
    
    // Sort by timestamp
    const sorted = data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Calculate sentiment over time
    const recentSentiment = this.calculateAggregatedSentiment(sorted.slice(-Math.floor(sorted.length / 2)));
    const olderSentiment = this.calculateAggregatedSentiment(sorted.slice(0, Math.floor(sorted.length / 2)));
    
    return recentSentiment - olderSentiment;
  }

  /**
   * Calculate sentiment volatility
   */
  private calculateSentimentVolatility(data: SentimentSource[]): number {
    if (data.length < 2) return 0;
    
    const sentiments = data.map(d => d.sentiment);
    const mean = sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length;
    const variance = sentiments.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / sentiments.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Analyze sentiment by source
   */
  private analyzeSentimentSources(data: SentimentSource[]): {
    count: number;
    breakdown: Record<string, { sentiment: number; weight: number; volume: number; }>;
  } {
    const breakdown: Record<string, { sentiment: number; weight: number; volume: number; }> = {};
    
    for (const source of data) {
      const sourceName = source.source.toLowerCase();
      if (!breakdown[sourceName]) {
        breakdown[sourceName] = { sentiment: 0, weight: 0, volume: 0 };
      }
      
      const config = this.sentimentConfig.sources[sourceName as keyof typeof this.sentimentConfig.sources];
      if (config) {
        breakdown[sourceName].sentiment += source.sentiment;
        breakdown[sourceName].weight += config.weight;
        breakdown[sourceName].volume += source.volume;
      }
    }
    
    return { count: data.length, breakdown };
  }

  /**
   * Analyze cross-asset sentiment
   */
  private async analyzeCrossAssetSentiment(): Promise<{
    btcSentiment: number;
    ethSentiment: number;
    correlation: number;
    marketSentiment: number;
  }> {
    // Simplified cross-asset sentiment analysis
    // In production, this would analyze BTC/ETH sentiment from collected data
    
    return {
      btcSentiment: (Math.random() - 0.5) * 2,
      ethSentiment: (Math.random() - 0.5) * 2,
      correlation: Math.random() * 0.5 + 0.5,
      marketSentiment: (Math.random() - 0.5) * 2
    };
  }

  /**
   * Generate sentiment signals for different strategies
   */
  private generateSentimentSignals(
    sentiment: number,
    confidence: number,
    momentum: number,
    crossAsset: any
  ): {
    primary: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    contrarian: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    momentum: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    recommended: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  } {
    
    const threshold = this.sentimentConfig.sentimentThreshold;
    
    // Primary signal based on aggregated sentiment
    const primary = sentiment > threshold ? 'BULLISH' : 
                    sentiment < -threshold ? 'BEARISH' : 'NEUTRAL';
    
    // Contrarian signal (opposite of extreme sentiment)
    const contrarian = sentiment > 0.7 ? 'BEARISH' :
                      sentiment < -0.7 ? 'BULLISH' : 'NEUTRAL';
    
    // Momentum signal based on sentiment momentum
    const momentumSignal = momentum > 0.1 ? 'BULLISH' :
                          momentum < -0.1 ? 'BEARISH' : 'NEUTRAL';
    
    // Recommended signal based on strategy type and performance
    let recommended: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
    
    if (this.sentimentConfig.strategyType === 'MOMENTUM') {
      recommended = momentumSignal;
    } else if (this.sentimentConfig.strategyType === 'CONTRARIAN') {
      recommended = contrarian;
    } else { // ADAPTIVE
      const performance = this.analyzeStrategyPerformance();
      const momentumPerf = performance.momentum.wins / Math.max(performance.momentum.wins + performance.momentum.losses, 1);
      const contrarianPerf = performance.contrarian.wins / Math.max(performance.contrarian.wins + performance.contrarian.losses, 1);
      
      recommended = momentumPerf > contrarianPerf ? momentumSignal : contrarian;
    }
    
    return { primary, contrarian, momentum: momentumSignal, recommended };
  }

  /**
   * Identify sentiment risk factors
   */
  private identifySentimentRiskFactors(
    data: SentimentSource[],
    sentiment: number,
    volatility: number
  ): string[] {
    const riskFactors: string[] = [];
    
    // High sentiment volatility
    if (volatility > 0.5) {
      riskFactors.push('High sentiment volatility detected');
    }
    
    // Extreme sentiment levels
    if (Math.abs(sentiment) > 0.8) {
      riskFactors.push('Extreme sentiment levels - potential reversal risk');
    }
    
    // Low data volume
    if (data.length < 3) {
      riskFactors.push('Limited sentiment data availability');
    }
    
    // Old sentiment data
    const oldestData = Math.min(...data.map(d => d.timestamp.getTime()));
    const ageHours = (Date.now() - oldestData) / (1000 * 60 * 60);
    if (ageHours > this.sentimentConfig.maxSentimentAge) {
      riskFactors.push('Stale sentiment data');
    }
    
    // Conflicting sources
    const positiveCount = data.filter(d => d.sentiment > 0.2).length;
    const negativeCount = data.filter(d => d.sentiment < -0.2).length;
    if (positiveCount > 0 && negativeCount > 0 && Math.abs(positiveCount - negativeCount) <= 1) {
      riskFactors.push('Conflicting sentiment signals from sources');
    }
    
    return riskFactors;
  }

  /**
   * Calculate sentiment quality score
   */
  private calculateSentimentQualityScore(
    data: SentimentSource[],
    confidence: number,
    sourceCount: number
  ): number {
    let score = 0;
    
    // Data freshness (30%)
    const avgAge = data.reduce((sum, d) => sum + (Date.now() - d.timestamp.getTime()), 0) / data.length / (1000 * 60 * 60);
    const freshnessScore = Math.max(0, 1 - avgAge / 24); // Decay over 24 hours
    score += freshnessScore * 0.3;
    
    // Confidence (25%)
    score += confidence * 0.25;
    
    // Source diversity (25%)
    const diversityScore = Math.min(sourceCount / 4, 1); // Up to 4 sources
    score += diversityScore * 0.25;
    
    // Data volume (20%)
    const avgVolume = data.reduce((sum, d) => sum + d.volume, 0) / data.length;
    const volumeScore = Math.min(avgVolume / 500, 1); // Normalize to 500
    score += volumeScore * 0.2;
    
    return Math.max(0, Math.min(1, score));
  }

  /**
   * Get default sentiment analysis when no data available
   */
  private getDefaultSentimentAnalysis(): SentimentAnalysis {
    return {
      aggregatedSentiment: 0,
      confidence: 0,
      strength: 0,
      momentum: 0,
      volatility: 0,
      sources: { count: 0, breakdown: {} },
      crossAsset: { btcSentiment: 0, ethSentiment: 0, correlation: 0, marketSentiment: 0 },
      signals: { primary: 'NEUTRAL', contrarian: 'NEUTRAL', momentum: 'NEUTRAL', recommended: 'NEUTRAL' },
      riskFactors: ['No sentiment data available'],
      qualityScore: 0
    };
  }

  /**
   * Validate sentiment signal quality
   */
  private validateSentimentSignal(
    analysis: SentimentAnalysis,
    prediction: MLPrediction,
    context: StrategyContext
  ): boolean {
    
    // Check sentiment quality score
    if (analysis.qualityScore < 0.3) {
      return false;
    }
    
    // Check sentiment strength
    if (analysis.strength < this.sentimentConfig.sentimentThreshold) {
      return false;
    }
    
    // Check confidence
    if (analysis.confidence < this.sentimentConfig.confidenceThreshold) {
      return false;
    }
    
    // Check for neutral recommended signal
    if (analysis.signals.recommended === 'NEUTRAL') {
      return false;
    }
    
    // Volatility filter
    if (this.sentimentConfig.volatilityFilter && 
        prediction.explanation.volatilityPrediction > 0.06) {
      return false;
    }
    
    // Volume filter
    if (this.sentimentConfig.volumeFilter) {
      const volume = context.marketData.volume || 0;
      const avgVolume = prediction.features.volume_sma_20 || volume;
      if (volume < avgVolume * 0.8) {
        return false;
      }
    }
    
    // Risk factor filter
    if (analysis.riskFactors.length > 3) {
      return false;
    }
    
    return true;
  }

  /**
   * Generate sentiment-based trading signal
   */
  private async generateSentimentSignal(
    analysis: SentimentAnalysis,
    prediction: MLPrediction,
    context: StrategyContext
  ): Promise<StrategySignal> {
    
    const currentPrice = context.marketData.close;
    const recommendedSignal = analysis.signals.recommended;
    
    // Determine action
    const action = recommendedSignal === 'BULLISH' ? 'BUY' : 'SELL';
    
    // Calculate confidence combining sentiment and ML confidence
    const sentimentConfidence = analysis.confidence;
    const mlConfidence = prediction.confidence;
    const combinedConfidence = (sentimentConfidence + mlConfidence) / 2;
    
    // Calculate stop loss based on sentiment strength
    const stopLoss = this.calculateSentimentStopLoss(analysis, currentPrice, action);
    
    // Calculate take profit based on sentiment target
    const takeProfit = this.calculateSentimentTakeProfit(analysis, currentPrice, action);
    
    const signal: StrategySignal = {
      symbol: context.marketData.symbol,
      action,
      entryPrice: currentPrice,
      stopLoss,
      takeProfit,
      confidence: combinedConfidence,
      timestamp: new Date(),
      reason: `${this.sentimentConfig.strategyType} Sentiment: ${recommendedSignal} (${(analysis.aggregatedSentiment * 100).toFixed(1)}% sentiment)`,
      metadata: {
        strategy: 'ML_SENTIMENT',
        sentimentAnalysis: analysis,
        strategyType: this.sentimentConfig.strategyType,
        sentimentScore: analysis.aggregatedSentiment,
        sentimentStrength: analysis.strength,
        sentimentMomentum: analysis.momentum,
        sentimentVolatility: analysis.volatility,
        qualityScore: analysis.qualityScore,
        riskFactors: analysis.riskFactors,
        mlPrediction: {
          signal: prediction.signal,
          confidence: prediction.confidence,
          keyFactors: prediction.explanation.keyFactors
        }
      }
    };
    
    // Store current signal
    this.currentSentimentSignal = {
      signal: analysis,
      strategyType: this.sentimentConfig.strategyType,
      strength: analysis.strength
    };
    
    return signal;
  }

  /**
   * Calculate sentiment-based stop loss
   */
  private calculateSentimentStopLoss(
    analysis: SentimentAnalysis,
    price: number,
    action: 'BUY' | 'SELL'
  ): number {
    
    // Base stop distance on sentiment volatility
    const baseStop = 0.02; // 2% base
    const volatilityMultiplier = 1 + analysis.volatility;
    const confidenceMultiplier = 2 - analysis.confidence; // Lower confidence = wider stop
    
    const stopDistance = baseStop * volatilityMultiplier * confidenceMultiplier;
    
    return action === 'BUY' ? 
      price * (1 - stopDistance) :
      price * (1 + stopDistance);
  }

  /**
   * Calculate sentiment-based take profit
   */
  private calculateSentimentTakeProfit(
    analysis: SentimentAnalysis,
    price: number,
    action: 'BUY' | 'SELL'
  ): number {
    
    // Base profit target on sentiment strength
    const baseProfit = 0.03; // 3% base
    const strengthMultiplier = 1 + analysis.strength;
    const momentumMultiplier = 1 + Math.abs(analysis.momentum);
    
    const profitDistance = baseProfit * strengthMultiplier * momentumMultiplier;
    
    return action === 'BUY' ?
      price * (1 + profitDistance) :
      price * (1 - profitDistance);
  }

  /**
   * Store sentiment analysis for historical tracking
   */
  private storeSentimentAnalysis(analysis: SentimentAnalysis, price: number): void {
    this.sentimentHistory.push({
      timestamp: new Date(),
      analysis,
      price
    });
    
    // Keep history bounded
    if (this.sentimentHistory.length > 1000) {
      this.sentimentHistory.shift();
    }
  }

  /**
   * Analyze strategy performance for adaptive optimization
   */
  private analyzeStrategyPerformance(): {
    momentum: { wins: number; losses: number; totalReturn: number; };
    contrarian: { wins: number; losses: number; totalReturn: number; };
  } {
    return this.performanceByStrategy;
  }

  /**
   * Get sentiment history for analysis
   */
  public getSentimentHistory(): Array<{
    timestamp: Date;
    analysis: SentimentAnalysis;
    price: number;
  }> {
    return [...this.sentimentHistory];
  }

  /**
   * Get raw sentiment data
   */
  public getRawSentimentData(): SentimentSource[] {
    return [...this.rawSentimentData];
  }

  /**
   * Get current sentiment signal
   */
  public getCurrentSentimentSignal(): typeof this.currentSentimentSignal {
    return this.currentSentimentSignal;
  }

  /**
   * Update strategy performance for learning
   */
  public updateStrategyPerformance(strategyType: 'momentum' | 'contrarian', outcome: 'win' | 'loss', returnPct: number): void {
    const strategy = this.performanceByStrategy[strategyType];
    if (outcome === 'win') {
      strategy.wins++;
    } else {
      strategy.losses++;
    }
    strategy.totalReturn += returnPct;
  }
}

export default MLSentimentStrategy;