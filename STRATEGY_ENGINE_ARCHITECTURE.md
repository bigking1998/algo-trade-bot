# Strategy Execution Engine Architecture
## Technical Implementation Specification

*Based on Freqtrade Analysis & TypeScript Adaptation*

---

## Overview

This document details the technical architecture for our strategy execution engine, adapted from Freqtrade's proven patterns but implemented in TypeScript with modern performance optimizations and real-time capabilities.

## Core Architecture Patterns (From Freqtrade Analysis)

### 1. Strategy Interface Design

**Freqtrade Pattern:**
- Abstract base class with mandatory methods
- DataFrames for vectorized calculations
- Signal generation through boolean columns
- Configurable parameters via class attributes

**Our TypeScript Adaptation:**

```typescript
// Base Strategy Interface
abstract class BaseStrategy {
  // Strategy Metadata
  abstract readonly name: string;
  abstract readonly version: string;
  abstract readonly description: string;
  abstract readonly author: string;
  abstract readonly timeframe: Timeframe;
  
  // Strategy Configuration
  abstract readonly config: StrategyConfig;
  
  // Core Methods (mirroring Freqtrade)
  abstract populateIndicators(dataframe: MarketDataFrame): Promise<IndicatorDataFrame>;
  abstract populateEntryTrend(dataframe: IndicatorDataFrame): Promise<SignalDataFrame>;
  abstract populateExitTrend(dataframe: SignalDataFrame): Promise<SignalDataFrame>;
  
  // Advanced Features
  customStakeAmount?(pair: string, currentPrice: number, balance: number): number;
  customEntryPrice?(pair: string, side: 'long' | 'short', currentPrice: number): number;
  customExitPrice?(pair: string, trade: Trade, currentPrice: number): number;
  
  // Risk Management Hooks
  shouldEnterTrade?(signal: TradingSignal, portfolio: Portfolio): boolean;
  shouldExitTrade?(trade: Trade, currentPrice: number, indicators: IndicatorData): boolean;
  
  // Informative Data (multi-timeframe support)
  informativePairs?(): InformativePair[];
  
  // Strategy Lifecycle
  onStrategyStart?(): Promise<void>;
  onStrategyStop?(): Promise<void>;
  onTradeEnter?(trade: Trade): Promise<void>;
  onTradeExit?(trade: Trade, exitReason: ExitReason): Promise<void>;
}

// Market Data Structure (optimized for performance)
interface MarketDataFrame {
  timestamp: number[];
  open: number[];
  high: number[];
  low: number[];
  close: number[];
  volume: number[];
  
  // Utility methods
  length: number;
  slice(start: number, end?: number): MarketDataFrame;
  append(candle: DydxCandle): MarketDataFrame;
  getLatest(): CandleData;
  getRange(bars: number): MarketDataFrame;
}

// Indicator Data Structure  
interface IndicatorDataFrame extends MarketDataFrame {
  indicators: Record<string, number[]>;
  
  // Indicator access helpers
  get(indicatorName: string, offset?: number): number | undefined;
  getArray(indicatorName: string, length?: number): number[];
  has(indicatorName: string): boolean;
}

// Signal Data Structure
interface SignalDataFrame extends IndicatorDataFrame {
  signals: {
    enterLong: boolean[];
    enterShort: boolean[];
    exitLong: boolean[];
    exitShort: boolean[];
    enterTag?: string[];
    exitTag?: string[];
  };
  
  // Signal helpers
  hasEntrySignal(index: number, side: 'long' | 'short'): boolean;
  hasExitSignal(index: number, side: 'long' | 'short'): boolean;
  getLatestSignal(): TradingSignal | null;
}
```

### 2. Technical Indicators Engine

**Architecture Principles:**
- Vectorized calculations for performance
- Lazy evaluation and caching
- Extensible indicator library
- Memory-efficient rolling windows

```typescript
// Technical Indicators Core
class TechnicalIndicators {
  // Simple Moving Average
  static SMA(data: number[], period: number): number[] {
    const result: number[] = new Array(data.length).fill(NaN);
    let sum = 0;
    
    // Calculate initial SMA
    for (let i = 0; i < Math.min(period, data.length); i++) {
      sum += data[i];
      if (i === period - 1) result[i] = sum / period;
    }
    
    // Rolling calculation for efficiency
    for (let i = period; i < data.length; i++) {
      sum = sum - data[i - period] + data[i];
      result[i] = sum / period;
    }
    
    return result;
  }
  
  // Exponential Moving Average
  static EMA(data: number[], period: number): number[] {
    const result: number[] = new Array(data.length).fill(NaN);
    const alpha = 2 / (period + 1);
    
    // Initialize with first valid value
    let ema = data.find(val => !isNaN(val));
    if (ema === undefined) return result;
    
    for (let i = 0; i < data.length; i++) {
      if (!isNaN(data[i])) {
        ema = alpha * data[i] + (1 - alpha) * ema;
        result[i] = ema;
      }
    }
    
    return result;
  }
  
  // Relative Strength Index
  static RSI(data: number[], period: number): number[] {
    const changes = data.slice(1).map((val, i) => val - data[i]);
    const gains = changes.map(change => Math.max(change, 0));
    const losses = changes.map(change => Math.abs(Math.min(change, 0)));
    
    const avgGains = this.EMA(gains, period);
    const avgLosses = this.EMA(losses, period);
    
    const rs = avgGains.map((gain, i) => 
      avgLosses[i] === 0 ? 100 : gain / avgLosses[i]
    );
    
    return [NaN, ...rs.map(r => 100 - (100 / (1 + r)))];
  }
  
  // MACD (Moving Average Convergence Divergence)
  static MACD(data: number[], fastPeriod = 12, slowPeriod = 26, signalPeriod = 9): {
    macd: number[];
    signal: number[];
    histogram: number[];
  } {
    const emaFast = this.EMA(data, fastPeriod);
    const emaSlow = this.EMA(data, slowPeriod);
    
    const macd = emaFast.map((fast, i) => fast - emaSlow[i]);
    const signal = this.EMA(macd, signalPeriod);
    const histogram = macd.map((m, i) => m - signal[i]);
    
    return { macd, signal, histogram };
  }
  
  // Bollinger Bands
  static BollingerBands(data: number[], period = 20, stdDev = 2): {
    upper: number[];
    middle: number[];
    lower: number[];
  } {
    const middle = this.SMA(data, period);
    const variance = this.calculateRollingVariance(data, period);
    const std = variance.map(v => Math.sqrt(v));
    
    const upper = middle.map((m, i) => m + (stdDev * std[i]));
    const lower = middle.map((m, i) => m - (stdDev * std[i]));
    
    return { upper, middle, lower };
  }
  
  // Average True Range (for volatility-based stops)
  static ATR(high: number[], low: number[], close: number[], period = 14): number[] {
    const trueRanges: number[] = [];
    
    for (let i = 1; i < high.length; i++) {
      const tr1 = high[i] - low[i];
      const tr2 = Math.abs(high[i] - close[i - 1]);
      const tr3 = Math.abs(low[i] - close[i - 1]);
      trueRanges.push(Math.max(tr1, tr2, tr3));
    }
    
    return [NaN, ...this.EMA(trueRanges, period)];
  }
  
  // Helper: Rolling Variance
  private static calculateRollingVariance(data: number[], period: number): number[] {
    const result: number[] = new Array(data.length).fill(NaN);
    
    for (let i = period - 1; i < data.length; i++) {
      const window = data.slice(i - period + 1, i + 1);
      const mean = window.reduce((sum, val) => sum + val, 0) / period;
      const variance = window.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      result[i] = variance;
    }
    
    return result;
  }
}

// Indicator Pipeline (for batch calculation)
class IndicatorPipeline {
  private cache = new Map<string, number[]>();
  private dependencies = new Map<string, string[]>();
  
  constructor(private config: IndicatorConfig[]) {
    this.buildDependencyGraph();
  }
  
  async calculate(dataframe: MarketDataFrame): Promise<IndicatorDataFrame> {
    const indicators: Record<string, number[]> = {};
    const calculated = new Set<string>();
    
    // Topological sort for dependency resolution
    const sortedIndicators = this.topologicalSort();
    
    for (const indicator of sortedIndicators) {
      if (calculated.has(indicator.name)) continue;
      
      const cacheKey = this.getCacheKey(indicator, dataframe);
      
      if (this.cache.has(cacheKey)) {
        indicators[indicator.name] = this.cache.get(cacheKey)!;
      } else {
        indicators[indicator.name] = await this.calculateIndicator(
          indicator, 
          dataframe, 
          indicators
        );
        this.cache.set(cacheKey, indicators[indicator.name]);
      }
      
      calculated.add(indicator.name);
    }
    
    return {
      ...dataframe,
      indicators
    } as IndicatorDataFrame;
  }
  
  private async calculateIndicator(
    config: IndicatorConfig,
    dataframe: MarketDataFrame,
    calculatedIndicators: Record<string, number[]>
  ): Promise<number[]> {
    const sourceData = this.getSourceData(config.source, dataframe);
    
    switch (config.type) {
      case 'SMA':
        return TechnicalIndicators.SMA(sourceData, config.period!);
      case 'EMA':
        return TechnicalIndicators.EMA(sourceData, config.period!);
      case 'RSI':
        return TechnicalIndicators.RSI(sourceData, config.period!);
      case 'MACD':
        const macd = TechnicalIndicators.MACD(
          sourceData, 
          config.params?.fastPeriod, 
          config.params?.slowPeriod, 
          config.params?.signalPeriod
        );
        return macd.macd; // Return main MACD line
      case 'BBANDS':
        const bb = TechnicalIndicators.BollingerBands(
          sourceData,
          config.period,
          config.params?.stdDev
        );
        return bb.middle; // Return middle band by default
      case 'ATR':
        return TechnicalIndicators.ATR(
          dataframe.high,
          dataframe.low,
          dataframe.close,
          config.period!
        );
      default:
        throw new Error(`Unknown indicator type: ${config.type}`);
    }
  }
  
  private getSourceData(source: string, dataframe: MarketDataFrame): number[] {
    switch (source) {
      case 'open': return dataframe.open;
      case 'high': return dataframe.high;
      case 'low': return dataframe.low;
      case 'close': return dataframe.close;
      case 'hl2': return dataframe.high.map((h, i) => (h + dataframe.low[i]) / 2);
      case 'hlc3': return dataframe.high.map((h, i) => 
        (h + dataframe.low[i] + dataframe.close[i]) / 3
      );
      default: return dataframe.close;
    }
  }
  
  private buildDependencyGraph(): void {
    // Build dependency relationships between indicators
    // This allows for efficient calculation order
  }
  
  private topologicalSort(): IndicatorConfig[] {
    // Implement topological sorting for dependency resolution
    return this.config; // Simplified
  }
  
  private getCacheKey(indicator: IndicatorConfig, dataframe: MarketDataFrame): string {
    const dataHash = this.hashDataframe(dataframe);
    return `${indicator.name}_${indicator.period}_${dataHash}`;
  }
  
  private hashDataframe(dataframe: MarketDataFrame): string {
    // Create a hash of the dataframe for caching
    const lastCandle = dataframe.close[dataframe.length - 1];
    return `${dataframe.length}_${lastCandle}`;
  }
}
```

### 3. Signal Generation Engine

```typescript
// Condition Evaluation System
class ConditionEvaluator {
  static evaluate(
    condition: TradingCondition, 
    dataframe: IndicatorDataFrame,
    index: number
  ): boolean {
    const left = this.getValue(condition.indicator1, dataframe, index);
    const right = this.getValue(condition.indicator2, dataframe, index);
    
    if (left === undefined || right === undefined) return false;
    
    switch (condition.operator) {
      case '>':
        return left > right;
      case '<':
        return left < right;
      case '>=':
        return left >= right;
      case '<=':
        return left <= right;
      case '==':
        return Math.abs(left - right) < 1e-10;
      case 'crosses_above':
        return this.checkCrossAbove(
          condition.indicator1,
          condition.indicator2,
          dataframe,
          index
        );
      case 'crosses_below':
        return this.checkCrossBelow(
          condition.indicator1,
          condition.indicator2,
          dataframe,
          index
        );
      default:
        return false;
    }
  }
  
  private static getValue(
    indicator: string | number,
    dataframe: IndicatorDataFrame,
    index: number
  ): number | undefined {
    if (typeof indicator === 'number') return indicator;
    
    // Check if it's a price field
    if (['open', 'high', 'low', 'close', 'volume'].includes(indicator)) {
      return dataframe[indicator as keyof MarketDataFrame][index] as number;
    }
    
    // Check if it's an indicator
    return dataframe.get(indicator, index);
  }
  
  private static checkCrossAbove(
    indicator1: string,
    indicator2: string | number,
    dataframe: IndicatorDataFrame,
    index: number
  ): boolean {
    if (index === 0) return false;
    
    const current1 = this.getValue(indicator1, dataframe, index);
    const previous1 = this.getValue(indicator1, dataframe, index - 1);
    const current2 = this.getValue(indicator2, dataframe, index);
    const previous2 = this.getValue(indicator2, dataframe, index - 1);
    
    if (!current1 || !previous1 || !current2 || !previous2) return false;
    
    return previous1 <= previous2 && current1 > current2;
  }
  
  private static checkCrossBelow(
    indicator1: string,
    indicator2: string | number,
    dataframe: IndicatorDataFrame,
    index: number
  ): boolean {
    if (index === 0) return false;
    
    const current1 = this.getValue(indicator1, dataframe, index);
    const previous1 = this.getValue(indicator1, dataframe, index - 1);
    const current2 = this.getValue(indicator2, dataframe, index);
    const previous2 = this.getValue(indicator2, dataframe, index - 1);
    
    if (!current1 || !previous1 || !current2 || !previous2) return false;
    
    return previous1 >= previous2 && current1 < current2;
  }
}

// Signal Generator
class SignalGenerator {
  static generateSignals(
    conditions: { long: TradingCondition[]; short: TradingCondition[] },
    dataframe: IndicatorDataFrame
  ): SignalDataFrame {
    const enterLong: boolean[] = new Array(dataframe.length).fill(false);
    const enterShort: boolean[] = new Array(dataframe.length).fill(false);
    const exitLong: boolean[] = new Array(dataframe.length).fill(false);
    const exitShort: boolean[] = new Array(dataframe.length).fill(false);
    
    for (let i = 0; i < dataframe.length; i++) {
      // Evaluate long entry conditions
      enterLong[i] = conditions.long.every(condition =>
        ConditionEvaluator.evaluate(condition, dataframe, i)
      );
      
      // Evaluate short entry conditions  
      enterShort[i] = conditions.short.every(condition =>
        ConditionEvaluator.evaluate(condition, dataframe, i)
      );
    }
    
    return {
      ...dataframe,
      signals: {
        enterLong,
        enterShort,
        exitLong,
        exitShort
      }
    } as SignalDataFrame;
  }
}
```

### 4. Strategy Engine Core

```typescript
// Main Strategy Engine
class StrategyEngine {
  private strategies = new Map<string, BaseStrategy>();
  private activeStrategies = new Set<string>();
  private dataProvider: MarketDataProvider;
  private positionManager: PositionManager;
  private riskManager: RiskManager;
  
  constructor(
    dataProvider: MarketDataProvider,
    positionManager: PositionManager,
    riskManager: RiskManager
  ) {
    this.dataProvider = dataProvider;
    this.positionManager = positionManager;
    this.riskManager = riskManager;
  }
  
  // Strategy Management
  async loadStrategy(strategy: BaseStrategy): Promise<void> {
    await this.validateStrategy(strategy);
    this.strategies.set(strategy.name, strategy);
    await strategy.onStrategyStart?.();
  }
  
  async unloadStrategy(strategyName: string): Promise<void> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) return;
    
    this.activeStrategies.delete(strategyName);
    await strategy.onStrategyStop?.();
    this.strategies.delete(strategyName);
  }
  
  async startStrategy(strategyName: string): Promise<void> {
    if (!this.strategies.has(strategyName)) {
      throw new Error(`Strategy '${strategyName}' not found`);
    }
    this.activeStrategies.add(strategyName);
  }
  
  async stopStrategy(strategyName: string): Promise<void> {
    this.activeStrategies.delete(strategyName);
  }
  
  // Main Execution Loop
  async processMarketData(symbol: string, candles: DydxCandle[]): Promise<void> {
    const dataframe = this.createDataFrame(candles);
    
    for (const strategyName of this.activeStrategies) {
      const strategy = this.strategies.get(strategyName)!;
      
      try {
        await this.executeStrategy(strategy, symbol, dataframe);
      } catch (error) {
        console.error(`Strategy '${strategyName}' execution error:`, error);
        // Implement error handling and recovery
      }
    }
  }
  
  private async executeStrategy(
    strategy: BaseStrategy,
    symbol: string,
    dataframe: MarketDataFrame
  ): Promise<void> {
    // Step 1: Calculate indicators
    const indicatorDataframe = await strategy.populateIndicators(dataframe);
    
    // Step 2: Generate entry signals
    const entryDataframe = await strategy.populateEntryTrend(indicatorDataframe);
    
    // Step 3: Generate exit signals  
    const signalDataframe = await strategy.populateExitTrend(entryDataframe);
    
    // Step 4: Process signals
    await this.processSignals(strategy, symbol, signalDataframe);
  }
  
  private async processSignals(
    strategy: BaseStrategy,
    symbol: string,
    dataframe: SignalDataFrame
  ): Promise<void> {
    const latestSignal = dataframe.getLatestSignal();
    if (!latestSignal) return;
    
    // Check if we should enter a trade
    if (latestSignal.type === 'entry') {
      const position = await this.positionManager.getPosition(symbol);
      
      if (!position || position.size === 0) {
        const shouldEnter = strategy.shouldEnterTrade?.(latestSignal, this.positionManager.portfolio) ?? true;
        
        if (shouldEnter && this.riskManager.checkTradeRisk(latestSignal).approved) {
          await this.enterTrade(strategy, symbol, latestSignal);
        }
      }
    }
    
    // Check if we should exit a trade
    if (latestSignal.type === 'exit') {
      const position = await this.positionManager.getPosition(symbol);
      
      if (position && position.size !== 0) {
        await this.exitTrade(strategy, symbol, latestSignal);
      }
    }
  }
  
  private async enterTrade(
    strategy: BaseStrategy,
    symbol: string,
    signal: TradingSignal
  ): Promise<void> {
    // Calculate position size
    const balance = await this.positionManager.getAvailableBalance();
    const positionSize = strategy.customStakeAmount?.(symbol, signal.price, balance) ?? 
                       this.riskManager.calculatePositionSize(signal, balance);
    
    // Calculate entry price
    const entryPrice = strategy.customEntryPrice?.(symbol, signal.side, signal.price) ?? 
                      signal.price;
    
    // Create and submit order
    const order: OrderRequest = {
      symbol,
      side: signal.side === 'long' ? 'BUY' : 'SELL',
      type: 'MARKET',
      quantity: positionSize,
      price: entryPrice
    };
    
    const trade = await this.positionManager.enterPosition(order);
    await strategy.onTradeEnter?.(trade);
  }
  
  private async exitTrade(
    strategy: BaseStrategy,
    symbol: string,
    signal: TradingSignal
  ): Promise<void> {
    const position = await this.positionManager.getPosition(symbol);
    if (!position) return;
    
    // Calculate exit price
    const exitPrice = strategy.customExitPrice?.(symbol, position, signal.price) ?? 
                     signal.price;
    
    // Create and submit exit order
    const order: OrderRequest = {
      symbol,
      side: position.side === 'long' ? 'SELL' : 'BUY',
      type: 'MARKET',
      quantity: Math.abs(position.size),
      price: exitPrice
    };
    
    const trade = await this.positionManager.exitPosition(order);
    await strategy.onTradeExit?.(trade, signal.reason || 'SIGNAL');
  }
  
  private createDataFrame(candles: DydxCandle[]): MarketDataFrame {
    return {
      timestamp: candles.map(c => c.time),
      open: candles.map(c => c.open),
      high: candles.map(c => c.high),
      low: candles.map(c => c.low),
      close: candles.map(c => c.close),
      volume: candles.map(c => c.volume),
      length: candles.length,
      
      slice: function(start: number, end?: number) {
        const endIndex = end ?? this.length;
        return {
          timestamp: this.timestamp.slice(start, endIndex),
          open: this.open.slice(start, endIndex),
          high: this.high.slice(start, endIndex),
          low: this.low.slice(start, endIndex),
          close: this.close.slice(start, endIndex),
          volume: this.volume.slice(start, endIndex),
          length: endIndex - start,
          slice: this.slice,
          append: this.append,
          getLatest: this.getLatest,
          getRange: this.getRange
        };
      },
      
      append: function(candle: DydxCandle) {
        this.timestamp.push(candle.time);
        this.open.push(candle.open);
        this.high.push(candle.high);
        this.low.push(candle.low);
        this.close.push(candle.close);
        this.volume.push(candle.volume);
        this.length++;
        return this;
      },
      
      getLatest: function() {
        const i = this.length - 1;
        return {
          timestamp: this.timestamp[i],
          open: this.open[i],
          high: this.high[i],
          low: this.low[i],
          close: this.close[i],
          volume: this.volume[i]
        };
      },
      
      getRange: function(bars: number) {
        return this.slice(Math.max(0, this.length - bars));
      }
    };
  }
  
  private async validateStrategy(strategy: BaseStrategy): Promise<void> {
    // Validate strategy configuration
    if (!strategy.name || !strategy.version) {
      throw new Error('Strategy must have name and version');
    }
    
    if (!strategy.timeframe || !TF_OPTIONS.includes(strategy.timeframe)) {
      throw new Error('Strategy must have valid timeframe');
    }
    
    // Validate indicators
    for (const [name, config] of Object.entries(strategy.config.indicators)) {
      if (!config.type || !config.period) {
        throw new Error(`Invalid indicator configuration: ${name}`);
      }
    }
    
    // Validate conditions
    if (!strategy.config.entryConditions.long.length && 
        !strategy.config.entryConditions.short.length) {
      throw new Error('Strategy must have at least one entry condition');
    }
  }
}
```

---

## Performance Optimization Strategies

### 1. Memory Management
- Use typed arrays for large datasets
- Implement circular buffers for real-time data
- Cache indicator calculations with LRU eviction
- Lazy evaluation of complex indicators

### 2. Computation Efficiency
- Vectorized operations where possible
- Web Workers for heavy calculations
- Streaming data processing
- Incremental indicator updates

### 3. Real-time Processing
- Event-driven architecture
- Minimal latency data pipelines
- Optimized signal generation
- Efficient condition evaluation

### 4. Scalability Patterns
- Strategy isolation and sandboxing
- Parallel strategy execution
- Resource pooling and sharing
- Graceful degradation under load

---

## Integration Points

### 1. Market Data Integration
```typescript
interface MarketDataProvider {
  getHistoricalData(symbol: string, timeframe: Timeframe, bars: number): Promise<DydxCandle[]>;
  subscribeToRealTimeData(symbol: string, timeframe: Timeframe, callback: (candle: DydxCandle) => void): void;
  unsubscribeFromRealTimeData(symbol: string, timeframe: Timeframe): void;
}
```

### 2. Position Management Integration  
```typescript
interface PositionManager {
  enterPosition(order: OrderRequest): Promise<Trade>;
  exitPosition(order: OrderRequest): Promise<Trade>;
  getPosition(symbol: string): Promise<Position | null>;
  getAllPositions(): Promise<Position[]>;
  getAvailableBalance(): Promise<number>;
  portfolio: Portfolio;
}
```

### 3. Risk Management Integration
```typescript
interface RiskManager {
  checkTradeRisk(signal: TradingSignal): RiskAssessment;
  calculatePositionSize(signal: TradingSignal, balance: number): number;
  shouldHaltTrading(metrics: PortfolioMetrics): boolean;
}
```

---

## Next Steps

1. **Implement Core Data Structures**: Start with MarketDataFrame and IndicatorDataFrame
2. **Build Technical Indicators Library**: Implement the most common indicators first
3. **Create Signal Generation System**: Build condition evaluation and signal generation
4. **Develop Strategy Engine**: Implement the main execution loop and strategy management
5. **Add Performance Optimizations**: Implement caching, vectorization, and memory management
6. **Integration Testing**: Test with real market data and validate against known strategies

This architecture provides a solid foundation that scales from simple strategies to complex multi-timeframe, multi-asset trading systems while maintaining the performance and reliability needed for live trading environments.