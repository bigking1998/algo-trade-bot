/**
 * VolatilityModel - Advanced volatility forecasting and risk assessment
 * 
 * Implements GARCH-inspired models and neural networks for volatility prediction,
 * with real-time volatility clustering detection and risk assessment.
 */

import * as tf from '@tensorflow/tfjs';
import { FeatureVector } from '../features/types';

export interface VolatilityConfig {
  forecastHorizon: number; // Minutes to forecast
  lookbackPeriod: number; // Historical data window
  garchLags: number; // GARCH model lags
  confidenceInterval: number; // e.g., 0.95 for 95% confidence
  updateFrequency: number; // Update frequency in minutes
  riskThreshold: number; // High volatility threshold
}

export interface VolatilityForecast {
  currentVolatility: number; // Current annualized volatility
  forecastedVolatility: number; // Predicted volatility
  volatilityTrend: 'INCREASING' | 'DECREASING' | 'STABLE';
  confidence: number; // Forecast confidence
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  volatilityRegime: 'CLUSTERING' | 'MEAN_REVERTING' | 'PERSISTENT';
  
  // Risk metrics
  valueAtRisk: {
    var95: number; // 95% VaR
    var99: number; // 99% VaR
    expectedShortfall: number; // Conditional VaR
  };
  
  // Volatility components
  components: {
    realized: number; // Historical realized volatility
    implied: number; // Model-implied volatility
    garch: number; // GARCH component
    jump: number; // Jump volatility component
  };
  
  // Time-based forecasts
  forecasts: {
    timeHorizon: number; // minutes
    volatility: number;
    lowerBound: number;
    upperBound: number;
  }[];
  
  // Volatility clustering information
  clustering: {
    isActive: boolean;
    intensity: number; // 0-1 scale
    expectedDuration: number; // minutes
    lastClusterStart: Date | null;
  };
}

export interface VolatilityAlert {
  type: 'SPIKE' | 'CLUSTER_START' | 'EXTREME_LEVEL' | 'REGIME_CHANGE';
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  message: string;
  threshold: number;
  currentValue: number;
  expectedDuration?: number;
  recommendedAction?: string;
}

export class VolatilityModel {
  private config: VolatilityConfig;
  private model: tf.LayersModel | null = null;
  private isInitialized = false;
  
  // Volatility state tracking
  private volatilityHistory: number[] = [];
  private returnsHistory: number[] = [];
  private currentVolatility = 0;
  private volatilityRegime: 'CLUSTERING' | 'MEAN_REVERTING' | 'PERSISTENT' = 'MEAN_REVERTING';
  
  // GARCH parameters (simplified implementation)
  private garchParams = {
    omega: 0.000001, // Long-term variance
    alpha: 0.1, // ARCH coefficient
    beta: 0.85, // GARCH coefficient
    gamma: 0.05 // Asymmetry parameter
  };
  
  // Performance tracking
  private forecastAccuracy = {
    mae: 0, // Mean Absolute Error
    mse: 0, // Mean Squared Error
    hit_rate: 0, // Directional accuracy
    total_forecasts: 0
  };
  
  // Clustering detection
  private clusterState = {
    isActive: false,
    startTime: null as Date | null,
    intensity: 0,
    threshold: 0.02 // 2% threshold for clustering
  };

  constructor(config: VolatilityConfig) {
    this.config = config;
  }

  /**
   * Initialize the volatility forecasting model
   */
  async initialize(): Promise<void> {
    try {
      console.log('📊 Initializing Volatility Model...');
      
      // Build volatility forecasting neural network
      this.model = this.buildVolatilityNN();
      
      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'meanSquaredError',
        metrics: ['mae']
      });

      // Initialize GARCH parameters
      this.initializeGarchParams();

      this.isInitialized = true;
      console.log('✅ Volatility Model initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Volatility Model:', error);
      throw error;
    }
  }

  /**
   * Generate volatility forecast
   */
  async forecastVolatility(
    features: FeatureVector[],
    currentPrice: number,
    symbol: string
  ): Promise<VolatilityForecast> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      // Update returns and volatility history
      this.updateVolatilityHistory(features, currentPrice);
      
      // Calculate current volatility
      const currentVol = this.calculateRealizedVolatility();
      this.currentVolatility = currentVol;
      
      // Generate GARCH forecast
      const garchForecast = this.garchForecast();
      
      // Generate neural network forecast
      const nnForecast = await this.neuralNetworkForecast(features);
      
      // Combine forecasts
      const combinedForecast = this.combineForecastsForVolatility(garchForecast, nnForecast);
      
      // Determine volatility trend and regime
      const volatilityTrend = this.analyzeVolatilityTrend();
      const regime = this.detectVolatilityRegime();
      
      // Calculate risk metrics
      const riskMetrics = this.calculateRiskMetrics(combinedForecast);
      
      // Generate time-based forecasts
      const timeForecasts = this.generateTimeBasedForecasts(combinedForecast);
      
      // Detect volatility clustering
      const clustering = this.detectVolatilityClustering();
      
      // Determine confidence
      const confidence = this.calculateForecastConfidence();

      return {
        currentVolatility: currentVol,
        forecastedVolatility: combinedForecast,
        volatilityTrend,
        confidence,
        riskLevel: this.assessRiskLevel(combinedForecast),
        volatilityRegime: regime,
        valueAtRisk: riskMetrics,
        components: {
          realized: currentVol,
          implied: combinedForecast,
          garch: garchForecast,
          jump: this.detectJumpComponent()
        },
        forecasts: timeForecasts,
        clustering
      };

    } catch (error) {
      console.error('❌ Volatility forecasting failed:', error);
      throw error;
    }
  }

  /**
   * Generate volatility alerts
   */
  generateAlerts(forecast: VolatilityForecast): VolatilityAlert[] {
    const alerts: VolatilityAlert[] = [];
    
    // Volatility spike detection
    if (forecast.currentVolatility > this.config.riskThreshold * 2) {
      alerts.push({
        type: 'SPIKE',
        severity: 'CRITICAL',
        message: `Extreme volatility spike detected: ${(forecast.currentVolatility * 100).toFixed(1)}%`,
        threshold: this.config.riskThreshold * 2,
        currentValue: forecast.currentVolatility,
        recommendedAction: 'Reduce position sizes and implement strict stop-losses'
      });
    }
    
    // Volatility clustering
    if (forecast.clustering.isActive && !this.clusterState.isActive) {
      alerts.push({
        type: 'CLUSTER_START',
        severity: 'WARNING',
        message: 'Volatility clustering detected - expect persistent high volatility',
        threshold: this.clusterState.threshold,
        currentValue: forecast.clustering.intensity,
        expectedDuration: forecast.clustering.expectedDuration,
        recommendedAction: 'Increase monitoring frequency and adjust risk parameters'
      });
    }
    
    // Extreme volatility levels
    if (forecast.riskLevel === 'EXTREME') {
      alerts.push({
        type: 'EXTREME_LEVEL',
        severity: 'CRITICAL',
        message: `Extreme volatility level: ${forecast.riskLevel}`,
        threshold: this.config.riskThreshold,
        currentValue: forecast.currentVolatility,
        recommendedAction: 'Consider halting trading or using extreme risk management'
      });
    }
    
    // Regime changes
    if (this.volatilityRegime !== forecast.volatilityRegime) {
      alerts.push({
        type: 'REGIME_CHANGE',
        severity: 'INFO',
        message: `Volatility regime changed from ${this.volatilityRegime} to ${forecast.volatilityRegime}`,
        threshold: 0,
        currentValue: 0,
        recommendedAction: 'Review and adjust volatility-based strategies'
      });
    }
    
    return alerts;
  }

  /**
   * Train the volatility model with historical data
   */
  async train(
    trainingData: {
      features: FeatureVector[][];
      volatilities: number[];
      returns: number[][];
    }
  ): Promise<void> {
    if (!this.isInitialized || !this.model) {
      throw new Error('Model not initialized');
    }

    console.log('🎯 Training Volatility Model...');

    try {
      // Prepare training tensors
      const xTrain = this.prepareVolatilityFeatures(trainingData.features);
      const yTrain = tf.tensor1d(trainingData.volatilities);

      // Train the model
      const history = await this.model.fit(xTrain, yTrain, {
        epochs: 100,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 20 === 0) {
              console.log(`Epoch ${epoch}: loss=${logs?.loss?.toFixed(6)}, val_loss=${logs?.val_loss?.toFixed(6)}`);
            }
          }
        }
      });

      // Update GARCH parameters using MLE (simplified)
      this.updateGarchParameters(trainingData.returns.flat());

      console.log(`✅ Volatility model training completed`);

      // Cleanup
      xTrain.dispose();
      yTrain.dispose();

    } catch (error) {
      console.error('❌ Volatility model training failed:', error);
      throw error;
    }
  }

  /**
   * Get model performance metrics
   */
  getPerformance() {
    return {
      accuracy: this.forecastAccuracy,
      volatilityHistory: this.volatilityHistory.slice(-100),
      returnsHistory: this.returnsHistory.slice(-100),
      currentVolatility: this.currentVolatility,
      garchParams: this.garchParams,
      clusterState: this.clusterState,
      regime: this.volatilityRegime
    };
  }

  /**
   * PRIVATE HELPER METHODS
   */

  private buildVolatilityNN(): tf.LayersModel {
    const model = tf.sequential();
    
    // Input layer - volatility-specific features
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      inputShape: [20] // 20 volatility features
    }));

    model.add(tf.layers.dropout({ rate: 0.2 }));

    // LSTM layer for temporal patterns
    model.add(tf.layers.reshape({ targetShape: [8, 8] })); // Reshape for LSTM
    
    model.add(tf.layers.lstm({
      units: 32,
      returnSequences: false,
      dropout: 0.2
    }));

    // Dense layers
    model.add(tf.layers.dense({
      units: 16,
      activation: 'relu'
    }));

    model.add(tf.layers.dropout({ rate: 0.1 }));

    // Output layer - single volatility forecast
    model.add(tf.layers.dense({
      units: 1,
      activation: 'linear'
    }));

    return model;
  }

  private updateVolatilityHistory(features: FeatureVector[], currentPrice: number): void {
    if (features.length < 2) return;
    
    // Calculate returns
    const prices = features.map(f => f.price.close || currentPrice);
    for (let i = 1; i < prices.length; i++) {
      const return_ = (prices[i] - prices[i-1]) / prices[i-1];
      this.returnsHistory.push(return_);
    }
    
    // Keep history manageable
    if (this.returnsHistory.length > 1000) {
      this.returnsHistory = this.returnsHistory.slice(-500);
    }
    
    // Update volatility history
    if (this.returnsHistory.length >= 20) {
      const recentReturns = this.returnsHistory.slice(-20);
      const vol = this.calculateVolatilityFromReturns(recentReturns);
      this.volatilityHistory.push(vol);
      
      if (this.volatilityHistory.length > 500) {
        this.volatilityHistory = this.volatilityHistory.slice(-250);
      }
    }
  }

  private calculateRealizedVolatility(): number {
    if (this.returnsHistory.length < 20) return 0.02; // Default 2%
    
    const recentReturns = this.returnsHistory.slice(-20);
    return this.calculateVolatilityFromReturns(recentReturns);
  }

  private calculateVolatilityFromReturns(returns: number[]): number {
    if (returns.length === 0) return 0;
    
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    // Annualize volatility (assuming daily data, adjust for your timeframe)
    return Math.sqrt(variance * 252); // 252 trading days
  }

  private garchForecast(): number {
    if (this.volatilityHistory.length < 2) {
      return this.currentVolatility;
    }
    
    const { omega, alpha, beta } = this.garchParams;
    const lastVolatility = this.volatilityHistory[this.volatilityHistory.length - 1];
    const lastReturn = this.returnsHistory[this.returnsHistory.length - 1] || 0;
    
    // GARCH(1,1) forecast: σ²(t+1) = ω + α*ε²(t) + β*σ²(t)
    const forecast = omega + alpha * Math.pow(lastReturn, 2) + beta * Math.pow(lastVolatility, 2);
    
    return Math.sqrt(Math.max(0, forecast));
  }

  private async neuralNetworkForecast(features: FeatureVector[]): Promise<number> {
    if (!this.model || features.length === 0) {
      return this.currentVolatility;
    }
    
    try {
      // Prepare input features
      const inputTensor = this.prepareVolatilityFeatures([features]);
      
      // Get prediction
      const prediction = this.model.predict(inputTensor) as tf.Tensor;
      const result = await prediction.data();
      
      // Cleanup
      inputTensor.dispose();
      prediction.dispose();
      
      return Math.max(0, result[0]);
      
    } catch (error) {
      console.warn('Neural network forecast failed, using GARCH:', error);
      return this.garchForecast();
    }
  }

  private combineForecastsForVolatility(garchForecast: number, nnForecast: number): number {
    // Weighted combination (can be made more sophisticated)
    const garchWeight = 0.6;
    const nnWeight = 0.4;
    
    return garchWeight * garchForecast + nnWeight * nnForecast;
  }

  private analyzeVolatilityTrend(): 'INCREASING' | 'DECREASING' | 'STABLE' {
    if (this.volatilityHistory.length < 10) return 'STABLE';
    
    const recent = this.volatilityHistory.slice(-10);
    const earlier = this.volatilityHistory.slice(-20, -10);
    
    if (earlier.length === 0) return 'STABLE';
    
    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, v) => sum + v, 0) / earlier.length;
    
    const change = (recentAvg - earlierAvg) / earlierAvg;
    
    if (change > 0.1) return 'INCREASING';
    if (change < -0.1) return 'DECREASING';
    return 'STABLE';
  }

  private detectVolatilityRegime(): 'CLUSTERING' | 'MEAN_REVERTING' | 'PERSISTENT' {
    if (this.volatilityHistory.length < 50) return 'MEAN_REVERTING';
    
    // Simple regime detection based on persistence and clustering
    const recent = this.volatilityHistory.slice(-30);
    const highVolPeriods = recent.filter(v => v > this.config.riskThreshold).length;
    
    if (highVolPeriods > 15) { // More than half
      return 'CLUSTERING';
    }
    
    // Check for persistence
    const autocorr = this.calculateAutocorrelation(recent);
    if (autocorr > 0.7) {
      return 'PERSISTENT';
    }
    
    return 'MEAN_REVERTING';
  }

  private calculateRiskMetrics(forecastedVol: number) {
    // Simplified VaR calculation assuming normal distribution
    const var95 = 1.645 * forecastedVol; // 95% VaR
    const var99 = 2.326 * forecastedVol; // 99% VaR
    const expectedShortfall = var95 * 1.2; // Approximation
    
    return {
      var95,
      var99,
      expectedShortfall
    };
  }

  private generateTimeBasedForecasts(baseVolatility: number): Array<{
    timeHorizon: number;
    volatility: number;
    lowerBound: number;
    upperBound: number;
  }> {
    const forecasts = [];
    const horizons = [15, 30, 60, 240, 1440]; // 15min, 30min, 1hr, 4hr, 1day
    
    for (const horizon of horizons) {
      // Volatility tends to mean-revert over longer horizons
      const meanReversion = Math.exp(-horizon / 1440); // Daily mean reversion
      const longTermVol = 0.20; // 20% long-term volatility
      const forecastVol = baseVolatility * meanReversion + longTermVol * (1 - meanReversion);
      
      // Confidence intervals widen with time
      const uncertainty = Math.sqrt(horizon / 1440) * 0.05;
      
      forecasts.push({
        timeHorizon: horizon,
        volatility: forecastVol,
        lowerBound: Math.max(0, forecastVol - uncertainty),
        upperBound: forecastVol + uncertainty
      });
    }
    
    return forecasts;
  }

  private detectVolatilityClustering(): {
    isActive: boolean;
    intensity: number;
    expectedDuration: number;
    lastClusterStart: Date | null;
  } {
    if (this.volatilityHistory.length < 20) {
      return {
        isActive: false,
        intensity: 0,
        expectedDuration: 0,
        lastClusterStart: null
      };
    }
    
    const recent = this.volatilityHistory.slice(-10);
    const highVolCount = recent.filter(v => v > this.clusterState.threshold).length;
    const intensity = highVolCount / recent.length;
    
    const isActive = intensity > 0.6; // 60% of recent periods are high volatility
    
    // Update cluster state
    if (isActive && !this.clusterState.isActive) {
      this.clusterState.startTime = new Date();
    }
    
    this.clusterState.isActive = isActive;
    this.clusterState.intensity = intensity;
    
    // Estimate duration based on historical patterns
    const expectedDuration = isActive ? 120 : 0; // 2 hours average
    
    return {
      isActive,
      intensity,
      expectedDuration,
      lastClusterStart: this.clusterState.startTime
    };
  }

  private detectJumpComponent(): number {
    if (this.returnsHistory.length < 10) return 0;
    
    const recent = this.returnsHistory.slice(-10);
    const threshold = 3 * this.currentVolatility; // 3 sigma threshold
    
    const jumps = recent.filter(r => Math.abs(r) > threshold);
    return jumps.length / recent.length;
  }

  private calculateForecastConfidence(): number {
    // Base confidence on historical accuracy and data availability
    let confidence = 0.7; // Base confidence
    
    // Adjust based on data availability
    if (this.volatilityHistory.length >= 100) {
      confidence += 0.1;
    }
    
    // Adjust based on historical accuracy
    if (this.forecastAccuracy.total_forecasts > 50) {
      const accuracy = 1 - this.forecastAccuracy.mae;
      confidence = Math.min(0.95, confidence * accuracy);
    }
    
    return Math.max(0.3, confidence);
  }

  private assessRiskLevel(volatility: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME' {
    if (volatility > this.config.riskThreshold * 2) return 'EXTREME';
    if (volatility > this.config.riskThreshold) return 'HIGH';
    if (volatility > this.config.riskThreshold * 0.5) return 'MEDIUM';
    return 'LOW';
  }

  private prepareVolatilityFeatures(featureBatches: FeatureVector[][]): tf.Tensor {
    const batchFeatures = featureBatches.map(features => {
      if (features.length === 0) return new Array(20).fill(0);
      
      const latest = features[features.length - 1];
      const volFeatures = [
        // Technical indicators
        latest.technical.atr || 0,
        latest.technical.bb_upper || 0,
        latest.technical.bb_lower || 0,
        latest.technical.rsi || 50,
        latest.technical.macd || 0,
        
        // Price features
        latest.price.high_low_ratio || 0,
        latest.price.open_close_ratio || 0,
        latest.price.price_change_pct || 0,
        
        // Volume features
        latest.volume.volume_sma_ratio || 1,
        latest.volume.vwap_price_ratio || 1,
        
        // Market structure
        latest.market_structure.volatility || 0.02,
        latest.market_structure.trend_strength || 0,
        
        // Additional volatility-specific features
        this.currentVolatility,
        this.volatilityHistory.slice(-5).reduce((sum, v) => sum + v, 0) / 5, // 5-period average
        Math.max(...this.volatilityHistory.slice(-10)), // Recent max
        Math.min(...this.volatilityHistory.slice(-10)), // Recent min
        
        // Returns-based features
        Math.abs(this.returnsHistory[this.returnsHistory.length - 1] || 0), // Last return
        this.returnsHistory.slice(-5).reduce((sum, r) => sum + Math.abs(r), 0) / 5, // Avg absolute return
        Math.max(...this.returnsHistory.slice(-10).map(Math.abs)), // Max recent return
        Math.min(...this.returnsHistory.slice(-10).map(Math.abs))  // Min recent return
      ];
      
      // Ensure we have exactly 20 features
      while (volFeatures.length < 20) {
        volFeatures.push(0);
      }
      
      return volFeatures.slice(0, 20);
    });
    
    return tf.tensor2d(batchFeatures);
  }

  private initializeGarchParams(): void {
    // Simple initialization - in practice, these would be estimated from data
    this.garchParams = {
      omega: 0.000001,
      alpha: 0.1,
      beta: 0.85,
      gamma: 0.05
    };
  }

  private updateGarchParameters(returns: number[]): void {
    if (returns.length < 100) return;
    
    // Simplified parameter update using method of moments
    const variance = returns.reduce((sum, r) => sum + r * r, 0) / returns.length;
    const persistence = this.calculateAutocorrelation(returns.map(r => r * r));
    
    this.garchParams.beta = Math.min(0.95, Math.max(0.7, persistence));
    this.garchParams.alpha = Math.min(0.3, (1 - this.garchParams.beta) * 0.5);
    this.garchParams.omega = variance * (1 - this.garchParams.alpha - this.garchParams.beta);
  }

  private calculateAutocorrelation(series: number[]): number {
    if (series.length < 10) return 0;
    
    const n = series.length;
    const mean = series.reduce((sum, x) => sum + x, 0) / n;
    
    let numerator = 0;
    let denominator = 0;
    
    for (let i = 1; i < n; i++) {
      numerator += (series[i] - mean) * (series[i-1] - mean);
    }
    
    for (let i = 0; i < n; i++) {
      denominator += Math.pow(series[i] - mean, 2);
    }
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isInitialized = false;
  }
}

// Default configuration
export const DEFAULT_VOLATILITY_CONFIG: VolatilityConfig = {
  forecastHorizon: 60, // 1 hour
  lookbackPeriod: 100,
  garchLags: 1,
  confidenceInterval: 0.95,
  updateFrequency: 5, // 5 minutes
  riskThreshold: 0.25 // 25% annualized volatility
};