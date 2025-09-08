/**
 * ModelEnsemble - Advanced model combination and ensemble strategies
 * 
 * Combines multiple ML models using various ensemble techniques including
 * weighted voting, stacking, and adaptive model selection based on performance.
 */

import { FeatureVector } from '../features/types';
import { PricePredictionModel, PricePredictionOutput } from '../models/PricePredictionModel';
import { MarketRegimeModel, RegimeClassification } from '../models/MarketRegimeModel';
import { VolatilityModel, VolatilityForecast } from '../models/VolatilityModel';

export type EnsembleMethod = 'WEIGHTED_AVERAGE' | 'VOTING' | 'STACKING' | 'ADAPTIVE' | 'REGIME_BASED';
export type SignalType = 'BUY' | 'SELL' | 'HOLD';
export type SignalStrength = 'WEAK' | 'MODERATE' | 'STRONG' | 'VERY_STRONG';

export interface EnsembleConfig {
  method: EnsembleMethod;
  models: {
    priceModels: string[]; // Model IDs
    regimeModel: boolean;
    volatilityModel: boolean;
  };
  weights: {
    price: number;
    regime: number;
    volatility: number;
  };
  confidenceThreshold: number;
  adaptiveLearningRate: number;
  regimeBasedWeights: Record<string, Record<string, number>>; // regime -> model -> weight
}

export interface EnsemblePrediction {
  signal: SignalType;
  strength: SignalStrength;
  confidence: number;
  
  // Combined predictions
  priceTarget: number;
  priceRange: [number, number];
  timeHorizon: number;
  
  // Risk assessment
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  volatilityForecast: number;
  maxDrawdownRisk: number;
  
  // Model contributions
  modelContributions: {
    modelId: string;
    prediction: any;
    weight: number;
    confidence: number;
    performance: number; // Recent performance score
  }[];
  
  // Ensemble metadata
  ensembleMethod: EnsembleMethod;
  agreementLevel: number; // How much models agree (0-1)
  uncertaintyLevel: number; // Prediction uncertainty
  
  // Market context
  marketRegime: string;
  volatilityRegime: string;
  regimeConfidence: number;
  
  // Validation metrics
  backtestMetrics?: {
    accuracy: number;
    sharpeRatio: number;
    maxDrawdown: number;
    winRate: number;
  };
}

export interface ModelPerformance {
  modelId: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  recentPerformance: number; // Last 50 predictions
  consistencyScore: number; // Variance in performance
  regimeSpecificPerformance: Record<string, number>;
  lastUpdated: Date;
}

export class ModelEnsemble {
  private config: EnsembleConfig;
  private priceModels: Map<string, PricePredictionModel> = new Map();
  private regimeModel: MarketRegimeModel | null = null;
  private volatilityModel: VolatilityModel | null = null;
  
  // Performance tracking
  private modelPerformance: Map<string, ModelPerformance> = new Map();
  private ensembleHistory: EnsemblePrediction[] = [];
  private adaptiveWeights: Map<string, number> = new Map();
  
  // Ensemble statistics
  private stats = {
    totalPredictions: 0,
    correctPredictions: 0,
    ensembleAccuracy: 0,
    bestModel: '',
    worstModel: '',
    lastUpdate: new Date()
  };

  constructor(config: EnsembleConfig) {
    this.config = config;
    this.initializeAdaptiveWeights();
  }

  /**
   * Add a price prediction model to the ensemble
   */
  addPriceModel(modelId: string, model: PricePredictionModel): void {
    this.priceModels.set(modelId, model);
    
    // Initialize performance tracking
    this.modelPerformance.set(modelId, {
      modelId,
      accuracy: 0.5,
      precision: 0.5,
      recall: 0.5,
      f1Score: 0.5,
      recentPerformance: 0.5,
      consistencyScore: 0.5,
      regimeSpecificPerformance: {},
      lastUpdated: new Date()
    });

    this.initializeAdaptiveWeights();
  }

  /**
   * Set the market regime model
   */
  setRegimeModel(model: MarketRegimeModel): void {
    this.regimeModel = model;
  }

  /**
   * Set the volatility model
   */
  setVolatilityModel(model: VolatilityModel): void {
    this.volatilityModel = model;
  }

  /**
   * Generate ensemble prediction
   */
  async predict(
    features: FeatureVector[],
    currentPrice: number,
    volume: number,
    symbol: string
  ): Promise<EnsemblePrediction> {
    try {
      console.log(`🧠 Generating ensemble prediction for ${symbol}...`);
      
      // Get individual model predictions
      const pricePredictions = await this.getPricePredictions(features, currentPrice, symbol);
      const regimeClassification = await this.getRegimeClassification(features, currentPrice, volume, symbol);
      const volatilityForecast = await this.getVolatilityForecast(features, currentPrice, symbol);
      
      // Determine current regime for adaptive weighting
      const currentRegime = regimeClassification?.primaryRegime || 'SIDEWAYS';
      
      // Calculate adaptive weights based on method
      const modelWeights = this.calculateModelWeights(currentRegime);
      
      // Combine predictions based on ensemble method
      const ensemblePrediction = await this.combinesPredictions(
        pricePredictions,
        regimeClassification,
        volatilityForecast,
        modelWeights,
        currentPrice,
        symbol
      );
      
      // Store prediction for learning
      this.ensembleHistory.push(ensemblePrediction);
      this.stats.totalPredictions++;
      
      // Cleanup history
      if (this.ensembleHistory.length > 1000) {
        this.ensembleHistory = this.ensembleHistory.slice(-500);
      }
      
      return ensemblePrediction;

    } catch (error) {
      console.error(`❌ Ensemble prediction failed:`, error);
      throw error;
    }
  }

  /**
   * Update model performance based on actual results
   */
  async updatePerformance(
    predictionId: string,
    actualPrice: number,
    actualDirection: SignalType,
    timeElapsed: number
  ): Promise<void> {
    // Find the corresponding prediction
    const prediction = this.ensembleHistory.find(p => 
      p.priceTarget && Math.abs(timeElapsed - p.timeHorizon) < 60
    );
    
    if (!prediction) return;

    // Calculate prediction accuracy
    const priceAccuracy = this.calculatePriceAccuracy(prediction.priceTarget, actualPrice);
    const directionAccuracy = prediction.signal === actualDirection ? 1 : 0;
    
    // Update individual model performance
    for (const contribution of prediction.modelContributions) {
      await this.updateModelPerformance(
        contribution.modelId,
        priceAccuracy,
        directionAccuracy,
        prediction.marketRegime
      );
    }
    
    // Update ensemble performance
    if (directionAccuracy === 1) {
      this.stats.correctPredictions++;
    }
    
    this.stats.ensembleAccuracy = this.stats.correctPredictions / this.stats.totalPredictions;
    
    // Adaptive weight updates
    if (this.config.method === 'ADAPTIVE') {
      await this.updateAdaptiveWeights(prediction, priceAccuracy, directionAccuracy);
    }
  }

  /**
   * Get ensemble performance metrics
   */
  getPerformanceMetrics() {
    return {
      ensemble: this.stats,
      modelPerformance: Object.fromEntries(this.modelPerformance),
      adaptiveWeights: Object.fromEntries(this.adaptiveWeights),
      recentPredictions: this.ensembleHistory.slice(-20),
      bestPerformingModel: this.getBestPerformingModel(),
      worstPerformingModel: this.getWorstPerformingModel()
    };
  }

  /**
   * Backtest the ensemble on historical data
   */
  async backtest(
    historicalData: {
      features: FeatureVector[][];
      prices: number[];
      volumes: number[];
      actualDirections: SignalType[];
    },
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    console.log(`📊 Running ensemble backtest from ${startDate} to ${endDate}...`);
    
    const results = {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      averageReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      returns: [] as number[],
      predictions: [] as EnsemblePrediction[]
    };
    
    try {
      for (let i = 100; i < historicalData.features.length - 1; i++) {
        const features = historicalData.features[i];
        const currentPrice = historicalData.prices[i];
        const volume = historicalData.volumes[i];
        const actualDirection = historicalData.actualDirections[i + 1];
        const actualPrice = historicalData.prices[i + 1];
        
        // Generate ensemble prediction
        const prediction = await this.predict(features, currentPrice, volume, 'BACKTEST');
        results.predictions.push(prediction);
        
        // Calculate trade result
        if (prediction.signal !== 'HOLD') {
          results.totalTrades++;
          
          const predictedReturn = (actualPrice - currentPrice) / currentPrice;
          const tradeReturn = prediction.signal === 'BUY' ? predictedReturn : -predictedReturn;
          
          results.returns.push(tradeReturn);
          
          if (tradeReturn > 0) {
            results.winningTrades++;
          } else {
            results.losingTrades++;
          }
          
          // Update model performance
          await this.updatePerformance('backtest', actualPrice, actualDirection, 30);
        }
      }
      
      // Calculate final metrics
      if (results.totalTrades > 0) {
        results.winRate = results.winningTrades / results.totalTrades;
        results.averageReturn = results.returns.reduce((sum, r) => sum + r, 0) / results.returns.length;
        results.sharpeRatio = this.calculateSharpeRatio(results.returns);
        results.maxDrawdown = this.calculateMaxDrawdown(results.returns);
      }
      
      console.log(`✅ Backtest completed. Win rate: ${(results.winRate * 100).toFixed(1)}%`);
      return results;

    } catch (error) {
      console.error(`❌ Backtest failed:`, error);
      throw error;
    }
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private async getPricePredictions(
    features: FeatureVector[],
    currentPrice: number,
    symbol: string
  ): Promise<Map<string, PricePredictionOutput>> {
    const predictions = new Map<string, PricePredictionOutput>();
    
    for (const [modelId, model] of this.priceModels.entries()) {
      try {
        const prediction = await model.predict(features, currentPrice, symbol);
        predictions.set(modelId, prediction);
      } catch (error) {
        console.warn(`Price prediction failed for model ${modelId}:`, error);
      }
    }
    
    return predictions;
  }

  private async getRegimeClassification(
    features: FeatureVector[],
    currentPrice: number,
    volume: number,
    symbol: string
  ): Promise<RegimeClassification | null> {
    if (!this.regimeModel) return null;
    
    try {
      return await this.regimeModel.classifyRegime(features, currentPrice, volume, symbol);
    } catch (error) {
      console.warn(`Regime classification failed:`, error);
      return null;
    }
  }

  private async getVolatilityForecast(
    features: FeatureVector[],
    currentPrice: number,
    symbol: string
  ): Promise<VolatilityForecast | null> {
    if (!this.volatilityModel) return null;
    
    try {
      return await this.volatilityModel.forecastVolatility(features, currentPrice, symbol);
    } catch (error) {
      console.warn(`Volatility forecast failed:`, error);
      return null;
    }
  }

  private calculateModelWeights(currentRegime: string): Map<string, number> {
    const weights = new Map<string, number>();
    
    switch (this.config.method) {
      case 'WEIGHTED_AVERAGE':
        // Use fixed weights
        for (const modelId of this.priceModels.keys()) {
          weights.set(modelId, 1 / this.priceModels.size);
        }
        break;
        
      case 'ADAPTIVE':
        // Use adaptive weights based on recent performance
        for (const [modelId, performance] of this.modelPerformance.entries()) {
          weights.set(modelId, performance.recentPerformance);
        }
        break;
        
      case 'REGIME_BASED':
        // Use regime-specific weights
        const regimeWeights = this.config.regimeBasedWeights[currentRegime];
        if (regimeWeights) {
          for (const [modelId, weight] of Object.entries(regimeWeights)) {
            weights.set(modelId, weight);
          }
        }
        break;
        
      default:
        // Equal weights fallback
        for (const modelId of this.priceModels.keys()) {
          weights.set(modelId, 1 / this.priceModels.size);
        }
    }
    
    // Normalize weights
    const totalWeight = Array.from(weights.values()).reduce((sum, w) => sum + w, 0);
    if (totalWeight > 0) {
      for (const [modelId, weight] of weights.entries()) {
        weights.set(modelId, weight / totalWeight);
      }
    }
    
    return weights;
  }

  private async combinesPredictions(
    pricePredictions: Map<string, PricePredictionOutput>,
    regimeClassification: RegimeClassification | null,
    volatilityForecast: VolatilityForecast | null,
    modelWeights: Map<string, number>,
    currentPrice: number,
    symbol: string
  ): Promise<EnsemblePrediction> {
    
    // Initialize ensemble prediction
    let weightedPrice = 0;
    let weightedConfidence = 0;
    let signalCounts = { BUY: 0, SELL: 0, HOLD: 0 };
    let totalWeight = 0;
    
    const modelContributions = [];
    
    // Combine price predictions
    for (const [modelId, prediction] of pricePredictions.entries()) {
      const weight = modelWeights.get(modelId) || 0;
      const performance = this.modelPerformance.get(modelId);
      
      weightedPrice += prediction.targetPrice * weight;
      weightedConfidence += prediction.priceConfidence * weight;
      signalCounts[prediction.direction]++;
      totalWeight += weight;
      
      modelContributions.push({
        modelId,
        prediction,
        weight,
        confidence: prediction.priceConfidence,
        performance: performance?.recentPerformance || 0.5
      });
    }
    
    // Normalize
    if (totalWeight > 0) {
      weightedPrice /= totalWeight;
      weightedConfidence /= totalWeight;
    }
    
    // Determine ensemble signal
    const signal = this.determineEnsembleSignal(signalCounts, pricePredictions);
    const strength = this.calculateSignalStrength(signalCounts, weightedConfidence);
    
    // Calculate agreement level
    const maxVotes = Math.max(...Object.values(signalCounts));
    const agreementLevel = maxVotes / pricePredictions.size;
    
    // Calculate price range
    const priceTargets = Array.from(pricePredictions.values()).map(p => p.targetPrice);
    const priceRange: [number, number] = [
      Math.min(...priceTargets),
      Math.max(...priceTargets)
    ];
    
    // Risk assessment
    const riskLevel = this.assessEnsembleRisk(
      volatilityForecast,
      regimeClassification,
      agreementLevel
    );
    
    // Time horizon (average of all models)
    const avgTimeHorizon = Array.from(pricePredictions.values())
      .reduce((sum, p) => sum + p.timeHorizonMinutes, 0) / pricePredictions.size;
    
    return {
      signal,
      strength,
      confidence: weightedConfidence,
      priceTarget: weightedPrice,
      priceRange,
      timeHorizon: avgTimeHorizon,
      riskLevel,
      volatilityForecast: volatilityForecast?.forecastedVolatility || 0.02,
      maxDrawdownRisk: this.calculateMaxDrawdownRisk(volatilityForecast, agreementLevel),
      modelContributions,
      ensembleMethod: this.config.method,
      agreementLevel,
      uncertaintyLevel: 1 - agreementLevel,
      marketRegime: regimeClassification?.primaryRegime || 'UNKNOWN',
      volatilityRegime: volatilityForecast?.volatilityRegime || 'NORMAL_VOL',
      regimeConfidence: regimeClassification?.confidence || 0.5
    };
  }

  private determineEnsembleSignal(
    signalCounts: Record<string, number>,
    pricePredictions: Map<string, PricePredictionOutput>
  ): SignalType {
    // Majority voting with confidence weighting
    let weightedBuy = 0;
    let weightedSell = 0;
    let weightedHold = 0;
    
    for (const prediction of pricePredictions.values()) {
      const weight = prediction.priceConfidence;
      
      switch (prediction.direction) {
        case 'UP':
          weightedBuy += weight;
          break;
        case 'DOWN':
          weightedSell += weight;
          break;
        default:
          weightedHold += weight;
      }
    }
    
    if (weightedBuy > weightedSell && weightedBuy > weightedHold) {
      return 'BUY';
    } else if (weightedSell > weightedBuy && weightedSell > weightedHold) {
      return 'SELL';
    }
    
    return 'HOLD';
  }

  private calculateSignalStrength(
    signalCounts: Record<string, number>,
    confidence: number
  ): SignalStrength {
    const totalCount = Object.values(signalCounts).reduce((sum, count) => sum + count, 0);
    const maxCount = Math.max(...Object.values(signalCounts));
    const consensus = maxCount / totalCount;
    
    const strength = consensus * confidence;
    
    if (strength > 0.8) return 'VERY_STRONG';
    if (strength > 0.6) return 'STRONG';
    if (strength > 0.4) return 'MODERATE';
    return 'WEAK';
  }

  private assessEnsembleRisk(
    volatilityForecast: VolatilityForecast | null,
    regimeClassification: RegimeClassification | null,
    agreementLevel: number
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    let riskScore = 0;
    
    // Volatility risk
    if (volatilityForecast) {
      if (volatilityForecast.riskLevel === 'EXTREME') riskScore += 3;
      else if (volatilityForecast.riskLevel === 'HIGH') riskScore += 2;
      else if (volatilityForecast.riskLevel === 'MEDIUM') riskScore += 1;
    }
    
    // Regime risk
    if (regimeClassification) {
      if (regimeClassification.primaryRegime === 'HIGH_VOLATILITY') riskScore += 1;
      if (regimeClassification.confidence < 0.5) riskScore += 1;
    }
    
    // Agreement risk (low agreement = higher risk)
    if (agreementLevel < 0.5) riskScore += 2;
    else if (agreementLevel < 0.7) riskScore += 1;
    
    if (riskScore >= 5) return 'EXTREME';
    if (riskScore >= 3) return 'HIGH';
    if (riskScore >= 1) return 'MEDIUM';
    return 'LOW';
  }

  private calculateMaxDrawdownRisk(
    volatilityForecast: VolatilityForecast | null,
    agreementLevel: number
  ): number {
    const baseRisk = 0.05; // 5% base drawdown risk
    const volMultiplier = volatilityForecast ? volatilityForecast.forecastedVolatility * 2 : 1;
    const agreementMultiplier = 2 - agreementLevel; // Lower agreement = higher risk
    
    return Math.min(0.5, baseRisk * volMultiplier * agreementMultiplier);
  }

  private calculatePriceAccuracy(predictedPrice: number, actualPrice: number): number {
    const error = Math.abs(predictedPrice - actualPrice) / actualPrice;
    return Math.max(0, 1 - error);
  }

  private async updateModelPerformance(
    modelId: string,
    priceAccuracy: number,
    directionAccuracy: number,
    regime: string
  ): Promise<void> {
    const performance = this.modelPerformance.get(modelId);
    if (!performance) return;
    
    // Update overall accuracy (exponential moving average)
    const alpha = 0.1;
    performance.accuracy = performance.accuracy * (1 - alpha) + directionAccuracy * alpha;
    performance.recentPerformance = performance.recentPerformance * (1 - alpha) + 
                                   (priceAccuracy * 0.7 + directionAccuracy * 0.3) * alpha;
    
    // Update regime-specific performance
    if (!performance.regimeSpecificPerformance[regime]) {
      performance.regimeSpecificPerformance[regime] = 0.5;
    }
    
    performance.regimeSpecificPerformance[regime] = 
      performance.regimeSpecificPerformance[regime] * (1 - alpha) + directionAccuracy * alpha;
    
    performance.lastUpdated = new Date();
    
    this.modelPerformance.set(modelId, performance);
  }

  private async updateAdaptiveWeights(
    prediction: EnsemblePrediction,
    priceAccuracy: number,
    directionAccuracy: number
  ): Promise<void> {
    const learningRate = this.config.adaptiveLearningRate;
    
    for (const contribution of prediction.modelContributions) {
      const currentWeight = this.adaptiveWeights.get(contribution.modelId) || 0.5;
      const performance = priceAccuracy * 0.7 + directionAccuracy * 0.3;
      
      // Update weight based on performance
      const newWeight = currentWeight + learningRate * (performance - 0.5);
      this.adaptiveWeights.set(contribution.modelId, Math.max(0.1, Math.min(1.0, newWeight)));
    }
  }

  private getBestPerformingModel(): string {
    let bestModel = '';
    let bestPerformance = 0;
    
    for (const [modelId, performance] of this.modelPerformance.entries()) {
      if (performance.recentPerformance > bestPerformance) {
        bestPerformance = performance.recentPerformance;
        bestModel = modelId;
      }
    }
    
    return bestModel;
  }

  private getWorstPerformingModel(): string {
    let worstModel = '';
    let worstPerformance = 1;
    
    for (const [modelId, performance] of this.modelPerformance.entries()) {
      if (performance.recentPerformance < worstPerformance) {
        worstPerformance = performance.recentPerformance;
        worstModel = modelId;
      }
    }
    
    return worstModel;
  }

  private calculateSharpeRatio(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const std = Math.sqrt(variance);
    
    return std > 0 ? mean / std : 0;
  }

  private calculateMaxDrawdown(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    let peak = 0;
    let maxDrawdown = 0;
    let cumulative = 0;
    
    for (const return_ of returns) {
      cumulative += return_;
      if (cumulative > peak) {
        peak = cumulative;
      }
      
      const drawdown = peak - cumulative;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }
    
    return maxDrawdown;
  }

  private initializeAdaptiveWeights(): void {
    for (const modelId of this.priceModels.keys()) {
      if (!this.adaptiveWeights.has(modelId)) {
        this.adaptiveWeights.set(modelId, 1 / this.priceModels.size);
      }
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    for (const model of this.priceModels.values()) {
      model.dispose();
    }
    
    if (this.regimeModel) {
      this.regimeModel.dispose();
    }
    
    if (this.volatilityModel) {
      this.volatilityModel.dispose();
    }
    
    this.priceModels.clear();
    this.modelPerformance.clear();
    this.adaptiveWeights.clear();
  }
}

// Default ensemble configurations
export const DEFAULT_ENSEMBLE_CONFIGS = {
  conservative: {
    method: 'WEIGHTED_AVERAGE' as EnsembleMethod,
    models: {
      priceModels: ['lstm-conservative', 'cnn-stable'],
      regimeModel: true,
      volatilityModel: true
    },
    weights: { price: 0.6, regime: 0.25, volatility: 0.15 },
    confidenceThreshold: 0.75,
    adaptiveLearningRate: 0.01,
    regimeBasedWeights: {}
  },
  
  aggressive: {
    method: 'ADAPTIVE' as EnsembleMethod,
    models: {
      priceModels: ['transformer-aggressive', 'lstm-fast', 'cnn-momentum'],
      regimeModel: true,
      volatilityModel: true
    },
    weights: { price: 0.7, regime: 0.2, volatility: 0.1 },
    confidenceThreshold: 0.6,
    adaptiveLearningRate: 0.05,
    regimeBasedWeights: {}
  },
  
  balanced: {
    method: 'REGIME_BASED' as EnsembleMethod,
    models: {
      priceModels: ['lstm-balanced', 'transformer-balanced', 'cnn-balanced'],
      regimeModel: true,
      volatilityModel: true
    },
    weights: { price: 0.65, regime: 0.2, volatility: 0.15 },
    confidenceThreshold: 0.7,
    adaptiveLearningRate: 0.02,
    regimeBasedWeights: {
      'BULL_TREND': { 'lstm-balanced': 0.4, 'transformer-balanced': 0.4, 'cnn-balanced': 0.2 },
      'BEAR_TREND': { 'lstm-balanced': 0.2, 'transformer-balanced': 0.4, 'cnn-balanced': 0.4 },
      'SIDEWAYS': { 'lstm-balanced': 0.33, 'transformer-balanced': 0.33, 'cnn-balanced': 0.34 }
    }
  }
};