/**
 * Feature Engineering Types - Task ML-002
 * 
 * Comprehensive type definitions for the feature engineering pipeline
 * supporting ML-enhanced algorithmic trading strategies.
 */

// import { DydxCandle } from '../../../shared/types/trading'; // Not directly used in types

/**
 * OHLCV data structure for feature calculations
 */
export interface OHLCV {
  time: Date | number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  symbol?: string;
  timeframe?: string;
}

/**
 * Feature configuration for ML models
 */
export interface FeatureConfig {
  technical_indicators: {
    trend: string[];      // ['sma_20', 'ema_12', 'macd']
    momentum: string[];   // ['rsi_14', 'stoch_14', 'williams_r']
    volatility: string[]; // ['bb_bands', 'atr_14']
    volume: string[];     // ['obv', 'ad_line', 'vwap']
  };
  price_features: {
    returns: number[];    // [1, 5, 10, 20] periods
    patterns: boolean;    // Enable candlestick pattern detection
    support_resistance: boolean;
  };
  market_structure: {
    regime_detection: boolean;
    trend_classification: boolean;
    volatility_regime: boolean;
  };
  normalization: {
    method: 'minmax' | 'zscore' | 'robust';
    window_size: number;
    lookback_period: number;
  };
}

/**
 * Feature vector containing all computed features
 */
export interface FeatureVector {
  timestamp: Date;
  symbol: string;
  timeframe: string;
  
  // Technical indicator features
  technical: TechnicalFeatures;
  
  // Price action features
  price: PriceFeatures;
  
  // Volume-based features
  volume: VolumeFeatures;
  
  // Market structure features
  market_structure: MarketStructureFeatures;
  
  // Raw feature values for debugging
  raw_values: Record<string, number>;
  
  // Feature metadata
  metadata: FeatureMetadata;
}

/**
 * Technical indicator features
 */
export interface TechnicalFeatures {
  // Trend indicators
  sma_5?: number;
  sma_10?: number;
  sma_20?: number;
  sma_50?: number;
  ema_12?: number;
  ema_26?: number;
  macd?: number;
  macd_signal?: number;
  macd_histogram?: number;
  adx?: number;
  trend_strength?: number;
  
  // Momentum indicators
  rsi_14?: number;
  stoch_k?: number;
  stoch_d?: number;
  williams_r?: number;
  cci?: number;
  momentum?: number;
  roc?: number;
  
  // Volatility indicators
  bb_upper?: number;
  bb_middle?: number;
  bb_lower?: number;
  bb_width?: number;
  bb_position?: number;
  atr_14?: number;
  bollinger_position?: number;
  
  // Volume indicators
  obv?: number;
  ad_line?: number;
  vwap?: number;
  mfi?: number;
  volume_ratio?: number;
}

/**
 * Price action features
 */
export interface PriceFeatures {
  // Price returns for different periods
  return_1?: number;
  return_5?: number;
  return_10?: number;
  return_20?: number;
  
  // Price ranges and ratios
  true_range?: number;
  high_low_ratio?: number;
  close_position?: number; // Where close is within high-low range (0-1)
  gap_size?: number;
  body_size?: number;
  
  // Wick analysis
  upper_wick_ratio?: number;
  lower_wick_ratio?: number;
  total_wick_ratio?: number;
  
  // Price patterns (boolean flags)
  doji?: number;
  hammer?: number;
  shooting_star?: number;
  engulfing_bullish?: number;
  engulfing_bearish?: number;
  
  // Support/resistance levels
  support_level?: number;
  resistance_level?: number;
  support_distance?: number;
  resistance_distance?: number;
  
  // Price momentum
  price_acceleration?: number;
  price_velocity?: number;
}

/**
 * Volume-based features
 */
export interface VolumeFeatures {
  // Volume indicators
  volume_sma_20?: number;
  volume_ratio?: number;
  volume_profile?: number;
  
  // Volume price analysis
  price_volume_trend?: number;
  ease_of_movement?: number;
  volume_weighted_price?: number;
  
  // Volume patterns
  volume_spike?: number;
  volume_breakout?: number;
  volume_confirmation?: number;
  
  // Money flow
  chaikin_money_flow?: number;
  money_flow_index?: number;
  accumulation_distribution?: number;
}

/**
 * Market structure features
 */
export interface MarketStructureFeatures {
  // Market regime
  regime_trending?: number;
  regime_ranging?: number;
  regime_volatile?: number;
  regime_confidence?: number;
  
  // Trend classification
  trend_direction?: number; // -1: down, 0: sideways, 1: up
  trend_strength?: number;  // 0-1 scale
  trend_duration?: number;  // periods in current trend
  
  // Volatility regime
  volatility_regime?: number; // low, medium, high (0, 0.5, 1)
  volatility_percentile?: number;
  volatility_clustering?: number;
  
  // Market microstructure (when available)
  bid_ask_spread?: number;
  market_impact?: number;
  liquidity_score?: number;
}

/**
 * Feature metadata for quality tracking
 */
export interface FeatureMetadata {
  computation_time_ms: number;
  data_quality_score: number;
  missing_values: number;
  outlier_count: number;
  feature_count: number;
  confidence_score: number;
}

/**
 * Feature context for streaming updates
 */
export interface FeatureContext {
  lookback_window: OHLCV[];
  previous_features: FeatureVector[];
  market_session: 'pre_market' | 'regular' | 'after_hours' | 'closed';
  market_conditions: 'normal' | 'high_volatility' | 'low_liquidity';
}

/**
 * Feature update for real-time streaming
 */
export interface FeatureUpdate {
  features: FeatureVector;
  changed_features: string[];
  update_type: 'full' | 'incremental';
  confidence: number;
  processing_latency_ms: number;
}

/**
 * Candlestick pattern signals
 */
export interface PatternSignals {
  // Reversal patterns
  doji: boolean;
  hammer: boolean;
  shooting_star: boolean;
  hanging_man: boolean;
  inverted_hammer: boolean;
  
  // Continuation patterns
  marubozu: boolean;
  spinning_top: boolean;
  
  // Multi-candle patterns
  engulfing_bullish: boolean;
  engulfing_bearish: boolean;
  piercing_pattern: boolean;
  dark_cloud_cover: boolean;
  morning_star: boolean;
  evening_star: boolean;
  
  // Pattern strength (0-1)
  pattern_strength: number;
  reliability_score: number;
}

/**
 * Support and resistance levels
 */
export interface SRLevels {
  support_levels: number[];
  resistance_levels: number[];
  current_support: number;
  current_resistance: number;
  support_strength: number;
  resistance_strength: number;
  breakout_probability: number;
}

/**
 * Price range analysis
 */
export interface PriceRangeFeatures {
  true_range: number;
  high_low_ratio: number;
  close_position: number; // Where close is within high-low range
  gap_size: number;
  body_size: number;
  wick_ratios: { upper: number; lower: number };
}

/**
 * Market regime classification
 */
export type MarketRegime = 
  | { type: 'trending'; direction: 'up' | 'down'; strength: number; }
  | { type: 'ranging'; width: number; center: number; }
  | { type: 'volatile'; intensity: number; };

/**
 * Trend classification result
 */
export interface TrendClassification {
  direction: 'up' | 'down' | 'sideways';
  strength: number; // 0-1
  duration: number; // periods
  confidence: number; // 0-1
  turning_point_probability: number; // 0-1
}

/**
 * Volatility regime analysis
 */
export interface VolatilityRegime {
  level: 'low' | 'medium' | 'high';
  percentile: number; // 0-100
  clustering: boolean;
  mean_reversion_speed: number;
  persistence: number;
}

/**
 * Microstructure features (for when order book data is available)
 */
export interface MicrostructureFeatures {
  bid_ask_spread: number;
  spread_percentage: number;
  order_imbalance: number;
  market_impact: number;
  effective_spread: number;
  price_improvement: number;
  liquidity_ratio: number;
}

/**
 * Feature quality metrics
 */
export interface QualityReport {
  overall_score: number; // 0-1
  issues: QualityIssue[];
  recommendations: string[];
  data_coverage: number; // 0-1
  freshness_score: number; // 0-1
}

/**
 * Quality issue types
 */
export interface QualityIssue {
  type: 'missing_values' | 'outliers' | 'stale_data' | 'correlation' | 'distribution';
  severity: 'low' | 'medium' | 'high';
  description: string;
  affected_features: string[];
  suggested_action: string;
}

/**
 * Missing value report
 */
export interface MissingValueReport {
  total_features: number;
  missing_features: string[];
  missing_percentage: number;
  consecutive_missing: number;
  impact_assessment: 'low' | 'medium' | 'high';
}

/**
 * Outlier detection result
 */
export interface OutlierReport {
  outlier_features: string[];
  outlier_values: Record<string, number[]>;
  detection_method: 'iqr' | 'zscore' | 'isolation_forest';
  outlier_percentage: number;
  severity_distribution: Record<'low' | 'medium' | 'high', number>;
}

/**
 * Feature correlation matrix
 */
export interface CorrelationMatrix {
  features: string[];
  matrix: number[][];
  high_correlations: Array<{
    feature1: string;
    feature2: string;
    correlation: number;
    significance: number;
  }>;
  redundant_features: string[];
}

/**
 * Feature importance scores
 */
export interface ImportanceScores {
  features: string[];
  scores: number[];
  ranking: Array<{
    feature: string;
    score: number;
    rank: number;
  }>;
  method: 'mutual_info' | 'correlation' | 'permutation' | 'shap';
}

/**
 * Default feature configuration
 */
export const DEFAULT_FEATURE_CONFIG: FeatureConfig = {
  technical_indicators: {
    trend: ['sma_20', 'ema_12', 'ema_26', 'macd', 'adx'],
    momentum: ['rsi_14', 'stoch_14', 'williams_r', 'cci'],
    volatility: ['bb_bands', 'atr_14'],
    volume: ['obv', 'vwap', 'mfi']
  },
  price_features: {
    returns: [1, 5, 10, 20],
    patterns: true,
    support_resistance: true
  },
  market_structure: {
    regime_detection: true,
    trend_classification: true,
    volatility_regime: true
  },
  normalization: {
    method: 'zscore',
    window_size: 100,
    lookback_period: 500
  }
};