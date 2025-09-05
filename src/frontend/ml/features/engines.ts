/**
 * Feature Computation Engines - Task ML-002
 * 
 * Collection of specialized engines for different types of feature computation.
 * Separated from types to avoid naming conflicts.
 */

import { 
  OHLCV, 
  PriceFeatures, 
  VolumeFeatures, 
  MarketStructureFeatures,
  MarketRegime
} from './types';

// Re-export the technical indicator engine
export { TechnicalIndicatorEngine } from './TechnicalIndicatorEngine';

/**
 * Price action feature extraction engine
 */
export class PriceActionEngine {
  calculatePriceFeatures(data: OHLCV[]): PriceFeatures {
    if (data.length === 0) return {};
    
    const features: PriceFeatures = {};
    
    try {
      // Price returns for different periods
      const periods = [1, 5, 10, 20];
      const closes = data.map(d => d.close);
      
      for (const period of periods) {
        if (closes.length > period) {
          const current = closes[closes.length - 1];
          const past = closes[closes.length - 1 - period];
          if (past !== 0) {
            features[`return_${period}` as keyof PriceFeatures] = (current - past) / past;
          }
        }
      }
      
      // Price range features
      const current = data[data.length - 1];
      const previous = data.length > 1 ? data[data.length - 2] : current;
      
      const trueRange = this.calculateTrueRange(current, previous);
      const highLowRange = current.high - current.low;
      
      features.true_range = trueRange;
      features.high_low_ratio = highLowRange > 0 ? current.high / current.low : 1;
      features.close_position = highLowRange > 0 ? (current.close - current.low) / highLowRange : 0.5;
      features.body_size = Math.abs(current.close - current.open);
      
      const upperWick = current.high - Math.max(current.open, current.close);
      const lowerWick = Math.min(current.open, current.close) - current.low;
      
      features.upper_wick_ratio = highLowRange > 0 ? upperWick / highLowRange : 0;
      features.lower_wick_ratio = highLowRange > 0 ? lowerWick / highLowRange : 0;
      features.total_wick_ratio = features.upper_wick_ratio + features.lower_wick_ratio;
      
      // Candlestick patterns (simplified)
      features.doji = Math.abs(current.close - current.open) / highLowRange < 0.1 ? 1 : 0;
      features.hammer = (lowerWick > features.body_size * 2 && upperWick < features.body_size * 0.5) ? 1 : 0;
      
      // Price momentum
      if (data.length >= 3) {
        const prices = closes.slice(-3);
        const velocity = (prices[2] - prices[1]) / prices[1];
        const prevVelocity = (prices[1] - prices[0]) / prices[0];
        
        features.price_velocity = velocity;
        features.price_acceleration = velocity - prevVelocity;
      }
      
    } catch (error) {
      console.warn('[PriceActionEngine] Error calculating price features:', error);
    }
    
    return features;
  }
  
  private calculateTrueRange(current: OHLCV, previous: OHLCV): number {
    const tr1 = current.high - current.low;
    const tr2 = Math.abs(current.high - previous.close);
    const tr3 = Math.abs(current.low - previous.close);
    return Math.max(tr1, tr2, tr3);
  }
}

/**
 * Volume analysis engine
 */
export class VolumeAnalysisEngine {
  calculateVolumeFeatures(data: OHLCV[]): VolumeFeatures {
    if (data.length === 0) return {};
    
    const features: VolumeFeatures = {};
    
    try {
      const volumes = data.map(d => d.volume);
      const closes = data.map(d => d.close);
      
      // Volume ratio (current vs average)
      if (data.length >= 20) {
        const avgVolume = volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20;
        const currentVolume = volumes[volumes.length - 1];
        features.volume_ratio = avgVolume > 0 ? currentVolume / avgVolume : 1;
        features.volume_sma_20 = avgVolume;
      }
      
      // Volume patterns
      if (data.length >= 2) {
        const current = volumes[volumes.length - 1];
        const previous = volumes[volumes.length - 2];
        const avgVolume = data.length >= 20 ? 
          volumes.slice(-20).reduce((sum, v) => sum + v, 0) / 20 : 
          volumes.reduce((sum, v) => sum + v, 0) / volumes.length;
          
        features.volume_spike = current > avgVolume * 2 ? 1 : 0;
        
        // Volume confirmation with price
        const priceUp = closes[closes.length - 1] > closes[closes.length - 2];
        const volumeUp = current > previous;
        features.volume_confirmation = (priceUp && volumeUp) || (!priceUp && !volumeUp) ? 1 : 0;
      }
      
      // On-Balance Volume (simplified)
      if (data.length >= 2) {
        let obv = 0;
        for (let i = 1; i < data.length; i++) {
          if (closes[i] > closes[i - 1]) {
            obv += volumes[i];
          } else if (closes[i] < closes[i - 1]) {
            obv -= volumes[i];
          }
        }
        // Note: obv property exists in VolumeFeatures interface but may show as error in IDE
        (features as any).obv = obv;
      }
      
      // Volume-Weighted Average Price (VWAP)
      let totalVolumePrice = 0;
      let totalVolume = 0;
      
      for (const candle of data) {
        const typicalPrice = (candle.high + candle.low + candle.close) / 3;
        totalVolumePrice += typicalPrice * candle.volume;
        totalVolume += candle.volume;
      }
      
      // Note: vwap property exists in VolumeFeatures interface but may show as error in IDE  
      (features as any).vwap = totalVolume > 0 ? totalVolumePrice / totalVolume : closes[closes.length - 1];
      
    } catch (error) {
      console.warn('[VolumeAnalysisEngine] Error calculating volume features:', error);
    }
    
    return features;
  }
}

/**
 * Market structure analysis engine
 */
export class MarketRegimeEngine {
  calculateMarketStructureFeatures(data: OHLCV[]): MarketStructureFeatures {
    if (data.length === 0) {
      return {
        regime_trending: 0,
        regime_ranging: 0,
        regime_volatile: 0,
        regime_confidence: 0.5,
        trend_direction: 0,
        trend_strength: 0,
        trend_duration: 0,
        volatility_regime: 0.5,
        volatility_percentile: 0.5,
        volatility_clustering: 0
      };
    }
    
    const features: MarketStructureFeatures = {};
    
    try {
      const closes = data.map(d => d.close);
      
      // Trend analysis
      const trendAnalysis = this.analyzeTrend(closes);
      features.trend_direction = this.encodeTrendDirection(trendAnalysis.direction);
      features.trend_strength = trendAnalysis.strength;
      features.trend_duration = trendAnalysis.duration;
      
      // Volatility analysis
      const volatilityAnalysis = this.analyzeVolatility(closes);
      features.volatility_regime = this.encodeVolatilityLevel(volatilityAnalysis.level);
      features.volatility_percentile = volatilityAnalysis.percentile / 100;
      features.volatility_clustering = volatilityAnalysis.clustering ? 1 : 0;
      
      // Regime classification
      const regime = this.classifyRegime(data);
      features.regime_trending = regime.type === 'trending' ? 1 : 0;
      features.regime_ranging = regime.type === 'ranging' ? 1 : 0;  
      features.regime_volatile = regime.type === 'volatile' ? 1 : 0;
      features.regime_confidence = this.calculateRegimeConfidence(data, regime);
      
    } catch (error) {
      console.warn('[MarketRegimeEngine] Error calculating market structure features:', error);
      
      // Return default values on error
      features.regime_trending = 0;
      features.regime_ranging = 1;
      features.regime_volatile = 0;
      features.regime_confidence = 0.5;
      features.trend_direction = 0;
      features.trend_strength = 0;
      features.trend_duration = 0;
      features.volatility_regime = 0.5;
      features.volatility_percentile = 0.5;
      features.volatility_clustering = 0;
    }
    
    return features;
  }
  
  private analyzeTrend(closes: number[]): { direction: 'up' | 'down' | 'sideways', strength: number, duration: number } {
    if (closes.length < 10) {
      return { direction: 'sideways', strength: 0, duration: 0 };
    }
    
    const lookback = Math.min(20, closes.length);
    const recent = closes.slice(-lookback);
    
    // Linear regression slope
    const n = recent.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = recent;
    
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const avgPrice = sumY / n;
    
    const normalizedSlope = slope / avgPrice;
    const strength = Math.min(1, Math.abs(normalizedSlope) * 1000);
    
    let direction: 'up' | 'down' | 'sideways';
    if (Math.abs(normalizedSlope) < 0.001) {
      direction = 'sideways';
    } else {
      direction = normalizedSlope > 0 ? 'up' : 'down';
    }
    
    return { direction, strength, duration: 1 }; // Simplified duration
  }
  
  private analyzeVolatility(closes: number[]): { level: 'low' | 'medium' | 'high', percentile: number, clustering: boolean } {
    if (closes.length < 20) {
      return { level: 'medium', percentile: 50, clustering: false };
    }
    
    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < closes.length; i++) {
      if (closes[i - 1] !== 0) {
        returns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      }
    }
    
    // Calculate rolling volatility
    const windowSize = Math.min(20, returns.length);
    const volatilities: number[] = [];
    
    for (let i = windowSize - 1; i < returns.length; i++) {
      const window = returns.slice(i - windowSize + 1, i + 1);
      const mean = window.reduce((sum, r) => sum + r, 0) / window.length;
      const variance = window.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / window.length;
      volatilities.push(Math.sqrt(variance));
    }
    
    if (volatilities.length === 0) {
      return { level: 'medium', percentile: 50, clustering: false };
    }
    
    const currentVol = volatilities[volatilities.length - 1];
    const sortedVols = [...volatilities].sort((a, b) => a - b);
    const percentile = (sortedVols.findIndex(v => v >= currentVol) / sortedVols.length) * 100;
    
    let level: 'low' | 'medium' | 'high';
    if (percentile < 33) {
      level = 'low';
    } else if (percentile > 67) {
      level = 'high';
    } else {
      level = 'medium';
    }
    
    // Simple clustering detection
    const avgVol = volatilities.reduce((sum, v) => sum + v, 0) / volatilities.length;
    const highVolPeriods = volatilities.filter(v => v > avgVol * 1.5).length;
    const clustering = highVolPeriods > volatilities.length * 0.3;
    
    return { level, percentile, clustering };
  }
  
  private classifyRegime(data: OHLCV[]): MarketRegime {
    const closes = data.map(d => d.close);
    
    if (closes.length < 20) {
      return { type: 'ranging', width: 0, center: closes[closes.length - 1] };
    }
    
    const trend = this.analyzeTrend(closes);
    const volatility = this.analyzeVolatility(closes);
    
    if (trend.strength > 0.7) {
      return { 
        type: 'trending', 
        direction: trend.direction === 'sideways' ? 'up' : trend.direction, 
        strength: trend.strength 
      };
    }
    
    if (volatility.level === 'high') {
      return { type: 'volatile', intensity: volatility.percentile / 100 };
    }
    
    // Default to ranging
    const recent = closes.slice(-20);
    const high = Math.max(...recent);
    const low = Math.min(...recent);
    
    return {
      type: 'ranging',
      width: (high - low) / low,
      center: (high + low) / 2
    };
  }
  
  private calculateRegimeConfidence(_data: OHLCV[], regime: MarketRegime): number {
    // Simplified confidence based on regime characteristics
    switch (regime.type) {
      case 'trending':
        return Math.min(1, ('strength' in regime ? regime.strength : 0.5) * 1.5);
      case 'volatile':
        return Math.min(1, ('intensity' in regime ? regime.intensity : 0.5) * 1.2);
      case 'ranging':
        return 0.6; // Moderate confidence for ranging markets
      default:
        return 0.5;
    }
  }
  
  private encodeTrendDirection(direction: 'up' | 'down' | 'sideways'): number {
    switch (direction) {
      case 'up': return 1;
      case 'down': return -1;
      case 'sideways': return 0;
    }
  }
  
  private encodeVolatilityLevel(level: 'low' | 'medium' | 'high'): number {
    switch (level) {
      case 'low': return 0;
      case 'medium': return 0.5;
      case 'high': return 1;
    }
  }
}