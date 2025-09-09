/**
 * Strategy Templates Export - Task BE-015: Strategy Templates Implementation
 * 
 * Central export point for all production-ready strategy templates.
 * These templates demonstrate the full power of the technical analysis
 * and signal generation systems built in previous tasks.
 */

export { EMACrossoverStrategy, type EMACrossoverConfig } from './EMAcrossoverStrategy.js';
export { RSIMeanReversionStrategy, type RSIMeanReversionConfig } from './RSIMeanReversionStrategy.js';
export { MACDTrendStrategy, type MACDTrendConfig } from './MACDTrendStrategy.js';
export { BreakoutStrategy, type BreakoutConfig } from './BreakoutStrategy.js';

/**
 * Strategy template metadata for registration and discovery
 */
export const STRATEGY_TEMPLATES = {
  EMA_CROSSOVER: {
    name: 'EMA Crossover',
    description: 'Dual EMA crossover strategy with trend confirmation and dynamic risk management',
    category: 'Trend Following',
    difficulty: 'Beginner',
    timeframes: ['1m', '5m', '15m', '1h', '4h'],
    defaultConfig: {
      fastEmaPeriod: 12,
      slowEmaPeriod: 26,
      trendEmaPeriod: 50,
      minVolumeMultiple: 1.5,
      enableTrendConfirmation: true,
      enableVolumeConfirmation: true,
      minSignalStrength: 60
    }
  },
  
  RSI_MEAN_REVERSION: {
    name: 'RSI Mean Reversion',
    description: 'RSI-based mean reversion strategy with overbought/oversold signals and divergence confirmation',
    category: 'Mean Reversion',
    difficulty: 'Intermediate',
    timeframes: ['1m', '5m', '15m', '30m', '1h'],
    defaultConfig: {
      rsiPeriod: 14,
      oversoldThreshold: 30,
      overboughtThreshold: 70,
      extremeOversoldThreshold: 20,
      extremeOverboughtThreshold: 80,
      enableDivergenceConfirmation: true,
      enableVolumeConfirmation: true,
      minSignalStrength: 65
    }
  },
  
  MACD_TREND: {
    name: 'MACD Trend',
    description: 'MACD-based trend following strategy with histogram analysis and zero-line confirmation',
    category: 'Trend Following',
    difficulty: 'Intermediate',
    timeframes: ['5m', '15m', '30m', '1h', '4h'],
    defaultConfig: {
      macdFastPeriod: 12,
      macdSlowPeriod: 26,
      macdSignalPeriod: 9,
      enableZeroLineConfirmation: true,
      enableHistogramDivergence: true,
      enableTrendConfirmation: true,
      minSignalStrength: 65
    }
  },
  
  BREAKOUT: {
    name: 'Breakout',
    description: 'Support/resistance breakout strategy with volume confirmation and false breakout filtering',
    category: 'Breakout',
    difficulty: 'Advanced',
    timeframes: ['5m', '15m', '30m', '1h', '4h'],
    defaultConfig: {
      pivotMethod: 'STANDARD',
      breakoutConfirmationDistance: 0.5,
      minVolumeMultiple: 1.5,
      enableBollingerSqueeze: true,
      enableFalseBreakoutFilter: true,
      minSignalStrength: 70
    }
  }
} as const;

/**
 * Get strategy template by key
 */
export function getStrategyTemplate(key: keyof typeof STRATEGY_TEMPLATES) {
  return STRATEGY_TEMPLATES[key];
}

/**
 * Get all available strategy templates
 */
export function getAllStrategyTemplates() {
  return Object.entries(STRATEGY_TEMPLATES).map(([key, template]) => ({
    key,
    ...template
  }));
}

/**
 * Filter strategy templates by category
 */
export function getStrategyTemplatesByCategory(category: string) {
  return getAllStrategyTemplates().filter(template => template.category === category);
}

/**
 * Filter strategy templates by difficulty
 */
export function getStrategyTemplatesByDifficulty(difficulty: string) {
  return getAllStrategyTemplates().filter(template => template.difficulty === difficulty);
}

/**
 * Get strategy templates suitable for a specific timeframe
 */
export function getStrategyTemplatesForTimeframe(timeframe: string) {
  return getAllStrategyTemplates().filter(template => 
    template.timeframes.includes(timeframe)
  );
}