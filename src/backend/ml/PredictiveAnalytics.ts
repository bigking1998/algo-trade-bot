/**
 * Predictive Analytics Suite - Task ML-009
 * 
 * Price prediction, volatility forecasting, trend strength prediction, and market timing models.
 */

import * as tf from '@tensorflow/tfjs';
import { EventEmitter } from 'events';
import { FeatureEngineeringPipeline, CandleData } from './FeatureEngineering';

export interface PricePrediction {
  predictedPrice: number;
  confidence: number;
  timeHorizon: number; // minutes
  priceRange: [number, number];
  direction: 'UP' | 'DOWN' | 'SIDEWAYS';
}

export interface VolatilityForecast {
  forecastedVolatility: number;
  confidence: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'EXTREME';
  timeHorizon: number; // minutes
}

export interface TrendStrengthAnalysis {
  strength: number; // 0-1
  direction: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  confidence: number;
  momentum: number;
  sustainability: number;
}

export interface MarketTimingSignal {
  signal: 'ENTER' | 'EXIT' | 'HOLD';
  strength: number;
  confidence: number;
  reasoning: string[];
  optimalTimeframe: string;
}

export class PredictiveAnalyticsEngine extends EventEmitter {
  private featureEngine: FeatureEngineeringPipeline;
  private priceModel: tf.LayersModel | null = null;
  private volatilityModel: tf.LayersModel | null = null;
  private trendModel: tf.LayersModel | null = null;

  constructor() {
    super();
    this.featureEngine = new FeatureEngineeringPipeline({
      lookbackPeriod: 50,
      includePrice: true,
      includeVolume: true,
      includeTechnical: true,
      includePriceAction: true,
      normalization: 'zscore'
    });
  }

  async predictPrice(
    candleData: CandleData[],
    symbol: string,
    timeHorizon: number = 30
  ): Promise<PricePrediction> {
    try {
      if (!this.priceModel) {
        throw new Error('Price prediction model not loaded');
      }

      const features = await this.featureEngine.extractFeatures(candleData, symbol);
      const inputTensor = tf.tensor2d([Array.from(features.features)]);
      
      const prediction = this.priceModel.predict(inputTensor) as tf.Tensor;
      const predictionValue = (await prediction.data())[0];
      
      const currentPrice = candleData[candleData.length - 1].close;
      const predictedPrice = currentPrice * (1 + predictionValue);
      
      // Calculate confidence based on model uncertainty (simplified)
      const confidence = Math.max(0.1, Math.min(0.95, 1 - Math.abs(predictionValue)));
      
      // Determine direction
      let direction: 'UP' | 'DOWN' | 'SIDEWAYS' = 'SIDEWAYS';
      if (predictionValue > 0.005) direction = 'UP';
      else if (predictionValue < -0.005) direction = 'DOWN';
      
      // Calculate price range
      const volatility = this.estimateVolatility(candleData);
      const range: [number, number] = [
        predictedPrice * (1 - volatility),
        predictedPrice * (1 + volatility)
      ];

      inputTensor.dispose();
      prediction.dispose();

      const result: PricePrediction = {
        predictedPrice,
        confidence,
        timeHorizon,
        priceRange: range,
        direction
      };

      console.log(`📈 Price prediction: $${predictedPrice.toFixed(4)} (${direction}, confidence: ${(confidence * 100).toFixed(1)}%)`);
      
      this.emit('pricePredicted', result);
      return result;

    } catch (error) {
      console.error('❌ Price prediction failed:', error);
      throw error;
    }
  }

  async forecastVolatility(
    candleData: CandleData[],
    symbol: string,
    timeHorizon: number = 60
  ): Promise<VolatilityForecast> {
    try {
      const features = await this.featureEngine.extractFeatures(candleData, symbol);
      
      // Calculate historical volatility
      const returns = this.calculateReturns(candleData.map(c => c.close));
      const historicalVolatility = this.calculateVolatility(returns);
      
      // Use model if available, otherwise use historical volatility
      let forecastedVolatility = historicalVolatility;
      let confidence = 0.6;

      if (this.volatilityModel) {
        const inputTensor = tf.tensor2d([Array.from(features.features)]);
        const prediction = this.volatilityModel.predict(inputTensor) as tf.Tensor;
        const predictionValue = (await prediction.data())[0];
        
        forecastedVolatility = Math.max(0.001, predictionValue);
        confidence = 0.8;
        
        inputTensor.dispose();
        prediction.dispose();
      }

      // Determine risk level
      let riskLevel: VolatilityForecast['riskLevel'] = 'LOW';
      if (forecastedVolatility > 0.05) riskLevel = 'EXTREME';
      else if (forecastedVolatility > 0.03) riskLevel = 'HIGH';
      else if (forecastedVolatility > 0.015) riskLevel = 'MEDIUM';

      const result: VolatilityForecast = {
        forecastedVolatility,
        confidence,
        riskLevel,
        timeHorizon
      };

      console.log(`📊 Volatility forecast: ${(forecastedVolatility * 100).toFixed(2)}% (${riskLevel} risk)`);
      
      this.emit('volatilityForecasted', result);
      return result;

    } catch (error) {
      console.error('❌ Volatility forecast failed:', error);
      throw error;
    }
  }

  analyzeTrendStrength(candleData: CandleData[]): TrendStrengthAnalysis {
    try {
      const closes = candleData.map(c => c.close);
      const volumes = candleData.map(c => c.volume);
      
      // Calculate trend indicators
      const sma20 = this.sma(closes, 20);
      const sma50 = this.sma(closes, 50);
      const rsi = this.rsi(closes, 14);
      
      const currentPrice = closes[closes.length - 1];
      const currentSMA20 = sma20[sma20.length - 1];
      const currentSMA50 = sma50[sma50.length - 1];
      const currentRSI = rsi[rsi.length - 1];
      
      // Calculate trend strength (0-1)
      let strength = 0;
      let direction: TrendStrengthAnalysis['direction'] = 'NEUTRAL';
      
      // Price vs moving averages
      if (currentPrice > currentSMA20 && currentSMA20 > currentSMA50) {
        strength += 0.4;
        direction = 'BULLISH';
      } else if (currentPrice < currentSMA20 && currentSMA20 < currentSMA50) {
        strength += 0.4;
        direction = 'BEARISH';
      }
      
      // RSI confirmation
      if ((direction === 'BULLISH' && currentRSI > 50) || (direction === 'BEARISH' && currentRSI < 50)) {
        strength += 0.2;
      }
      
      // Volume confirmation
      const avgVolume = volumes.slice(-10).reduce((a, b) => a + b, 0) / 10;
      const currentVolume = volumes[volumes.length - 1];
      if (currentVolume > avgVolume) {
        strength += 0.2;
      }
      
      // Momentum calculation
      const momentum = closes.length >= 10 
        ? (currentPrice - closes[closes.length - 10]) / closes[closes.length - 10]
        : 0;
      
      // Sustainability (trend consistency)
      const sustainability = this.calculateTrendConsistency(closes.slice(-20));
      
      const confidence = Math.min(0.95, strength + 0.1);

      const result: TrendStrengthAnalysis = {
        strength: Math.min(1, strength),
        direction,
        confidence,
        momentum,
        sustainability
      };

      console.log(`📈 Trend analysis: ${direction} (strength: ${(strength * 100).toFixed(1)}%)`);
      
      this.emit('trendAnalyzed', result);
      return result;

    } catch (error) {
      console.error('❌ Trend analysis failed:', error);
      throw error;
    }
  }

  generateMarketTimingSignal(
    pricePrediction: PricePrediction,
    volatilityForecast: VolatilityForecast,
    trendAnalysis: TrendStrengthAnalysis
  ): MarketTimingSignal {
    const reasoning: string[] = [];
    let signalStrength = 0;
    let signal: MarketTimingSignal['signal'] = 'HOLD';

    // Analyze price prediction
    if (pricePrediction.direction === 'UP' && pricePrediction.confidence > 0.7) {
      signalStrength += 0.4;
      reasoning.push('Strong upward price prediction');
    } else if (pricePrediction.direction === 'DOWN' && pricePrediction.confidence > 0.7) {
      signalStrength -= 0.4;
      reasoning.push('Strong downward price prediction');
    }

    // Analyze trend
    if (trendAnalysis.direction === 'BULLISH' && trendAnalysis.strength > 0.6) {
      signalStrength += 0.3;
      reasoning.push('Strong bullish trend detected');
    } else if (trendAnalysis.direction === 'BEARISH' && trendAnalysis.strength > 0.6) {
      signalStrength -= 0.3;
      reasoning.push('Strong bearish trend detected');
    }

    // Consider volatility
    if (volatilityForecast.riskLevel === 'HIGH' || volatilityForecast.riskLevel === 'EXTREME') {
      signalStrength *= 0.7; // Reduce signal strength in high volatility
      reasoning.push('High volatility reduces signal confidence');
    }

    // Determine final signal
    if (signalStrength > 0.5) {
      signal = 'ENTER';
    } else if (signalStrength < -0.3) {
      signal = 'EXIT';
    }

    const confidence = Math.min(0.95, Math.abs(signalStrength) + 0.1);
    const optimalTimeframe = volatilityForecast.riskLevel === 'LOW' ? '1h' : '15m';

    const result: MarketTimingSignal = {
      signal,
      strength: Math.abs(signalStrength),
      confidence,
      reasoning,
      optimalTimeframe
    };

    console.log(`⏰ Market timing: ${signal} (strength: ${(result.strength * 100).toFixed(1)}%)`);
    
    this.emit('timingSignalGenerated', result);
    return result;
  }

  // Utility methods
  private calculateReturns(prices: number[]): number[] {
    const returns: number[] = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    return returns;
  }

  private calculateVolatility(returns: number[]): number {
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    return Math.sqrt(variance);
  }

  private estimateVolatility(candleData: CandleData[]): number {
    const returns = this.calculateReturns(candleData.map(c => c.close));
    return this.calculateVolatility(returns.slice(-20)); // Last 20 periods
  }

  private sma(values: number[], period: number): number[] {
    const result: number[] = [];
    for (let i = period - 1; i < values.length; i++) {
      const sum = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
    return result;
  }

  private rsi(values: number[], period: number): number[] {
    const changes = this.calculateReturns(values);
    const gains = changes.map(c => c > 0 ? c : 0);
    const losses = changes.map(c => c < 0 ? -c : 0);
    
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    const rsi: number[] = [];
    
    for (let i = period; i < changes.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
      
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      rsi.push(100 - (100 / (1 + rs)));
    }
    
    return rsi;
  }

  private calculateTrendConsistency(prices: number[]): number {
    if (prices.length < 2) return 0;
    
    let consistent = 0;
    const direction = prices[prices.length - 1] > prices[0] ? 1 : -1;
    
    for (let i = 1; i < prices.length; i++) {
      const moveDirection = prices[i] > prices[i - 1] ? 1 : -1;
      if (moveDirection === direction) {
        consistent++;
      }
    }
    
    return consistent / (prices.length - 1);
  }

  async loadModels(modelPaths: {
    priceModel?: string;
    volatilityModel?: string;
    trendModel?: string;
  }): Promise<void> {
    try {
      if (modelPaths.priceModel) {
        this.priceModel = await tf.loadLayersModel(modelPaths.priceModel);
        console.log('✅ Price prediction model loaded');
      }
      
      if (modelPaths.volatilityModel) {
        this.volatilityModel = await tf.loadLayersModel(modelPaths.volatilityModel);
        console.log('✅ Volatility forecasting model loaded');
      }
      
      if (modelPaths.trendModel) {
        this.trendModel = await tf.loadLayersModel(modelPaths.trendModel);
        console.log('✅ Trend analysis model loaded');
      }
      
      this.emit('modelsLoaded');
      
    } catch (error) {
      console.error('❌ Failed to load predictive models:', error);
      throw error;
    }
  }

  dispose(): void {
    if (this.priceModel) {
      this.priceModel.dispose();
      this.priceModel = null;
    }
    
    if (this.volatilityModel) {
      this.volatilityModel.dispose();
      this.volatilityModel = null;
    }
    
    if (this.trendModel) {
      this.trendModel.dispose();
      this.trendModel = null;
    }
    
    console.log('🧹 Predictive Analytics Engine disposed');
  }
}