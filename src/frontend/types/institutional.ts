// Institutional Dashboard Types
// Comprehensive type definitions for enterprise-grade trading platform

export interface Manager {
  id: string;
  name: string;
  type: 'internal' | 'external';
  allocation: number;
  aum: number; // Assets Under Management
  performance: ManagerPerformance;
  riskProfile: RiskProfile;
  contactInfo?: ContactInfo;
  mandateRestrictions?: MandateRestrictions;
}

export interface ManagerPerformance {
  mtd: number;
  qtd: number;
  ytd: number;
  oneYear: number;
  threeYear: number;
  fiveYear: number;
  sinceInception: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  informationRatio: number;
  trackingError: number;
  beta: number;
  alpha: number;
}

export interface ContactInfo {
  email: string;
  phone: string;
  address?: string;
}

export interface MandateRestrictions {
  maxConcentration: number;
  allowedAssetClasses: string[];
  forbiddenAssetClasses: string[];
  maxLeverage: number;
  esgCompliant: boolean;
}

export interface RiskProfile {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  targetVolatility: number;
  maxDrawdown: number;
  valueAtRisk: number; // VaR 95% 1-day
  conditionalVaR: number; // CVaR 95% 1-day
  leverageRatio: number;
}

export interface AssetClass {
  id: string;
  name: string;
  allocation: number;
  targetAllocation: number;
  deviation: number;
  performance: PerformanceMetrics;
  riskMetrics: AssetRiskMetrics;
  benchmarkId?: string;
}

export interface PerformanceMetrics {
  mtd: number;
  qtd: number;
  ytd: number;
  oneYear: number;
  threeYear?: number;
  fiveYear?: number;
  sinceInception?: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
}

export interface AssetRiskMetrics {
  beta: number;
  alpha: number;
  correlation: number;
  trackingError: number;
  informationRatio: number;
  treynorRatio: number;
  sortino: number;
}

export interface Strategy {
  id: string;
  name: string;
  category: StrategyCategory;
  managerId: string;
  allocation: number;
  targetAllocation: number;
  performance: PerformanceMetrics;
  riskMetrics: StrategyRiskMetrics;
  status: 'active' | 'paused' | 'terminated';
  inception: Date;
  capacity?: number;
  minimumInvestment?: number;
}

export type StrategyCategory = 
  | 'equity_long_short'
  | 'momentum'
  | 'mean_reversion'
  | 'arbitrage'
  | 'market_making'
  | 'volatility'
  | 'macro'
  | 'fixed_income'
  | 'multi_strategy';

export interface StrategyRiskMetrics extends AssetRiskMetrics {
  maxMonthlyLoss: number;
  maxDailyLoss: number;
  worstMonth: number;
  worstDay: number;
  calmarRatio: number;
}

export interface PortfolioOverview {
  totalAUM: number;
  totalPnL: number;
  totalPnLPercent: number;
  managersCount: number;
  strategiesCount: number;
  activePosistions: number;
  riskMetrics: PortfolioRiskMetrics;
  allocations: AssetClass[];
  topPerformers: Strategy[];
  bottomPerformers: Strategy[];
  alerts: RiskAlert[];
}

export interface PortfolioRiskMetrics {
  portfolioVaR: number; // Portfolio VaR 95% 1-day
  portfolioCVaR: number; // Portfolio CVaR 95% 1-day
  expectedShortfall: number;
  concentrationRisk: number;
  correlationRisk: number;
  liquidityRisk: number;
  leverageRatio: number;
  stress_scenario_1: number; // 2008 Financial Crisis
  stress_scenario_2: number; // COVID-19 March 2020
  stress_scenario_3: number; // Custom stress test
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertType = 'risk' | 'performance' | 'compliance' | 'operational';

export interface RiskAlert {
  id: string;
  timestamp: Date;
  severity: AlertSeverity;
  type: AlertType;
  title: string;
  description: string;
  affectedEntity: string; // Manager ID, Strategy ID, or Portfolio
  value: number;
  threshold: number;
  status: 'active' | 'acknowledged' | 'resolved';
  assignee?: string;
  resolvedAt?: Date;
  actions?: AlertAction[];
}

export interface AlertAction {
  id: string;
  action: string;
  timestamp: Date;
  performedBy: string;
  result: string;
}

export interface ComplianceRule {
  id: string;
  name: string;
  category: ComplianceCategory;
  description: string;
  type: 'position_limit' | 'concentration' | 'leverage' | 'exposure' | 'regulatory';
  threshold: number;
  entity: 'portfolio' | 'manager' | 'strategy';
  enabled: boolean;
  lastChecked: Date;
  violations: ComplianceViolation[];
}

export type ComplianceCategory = 
  | 'investment_limits'
  | 'risk_limits'
  | 'regulatory'
  | 'operational'
  | 'esg'
  | 'liquidity';

export interface ComplianceViolation {
  id: string;
  ruleId: string;
  timestamp: Date;
  entity: string;
  currentValue: number;
  limit: number;
  severity: AlertSeverity;
  status: 'active' | 'resolved' | 'waived';
  resolution?: string;
  resolvedBy?: string;
  resolvedAt?: Date;
}

export interface PerformanceAttribution {
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';
  totalReturn: number;
  benchmark: number;
  excessReturn: number;
  attributionBreakdown: {
    assetAllocation: number;
    securitySelection: number;
    interaction: number;
    currency: number;
    costs: number;
  };
  managerContributions: ManagerContribution[];
  sectorContributions: SectorContribution[];
}

export interface ManagerContribution {
  managerId: string;
  managerName: string;
  allocation: number;
  contribution: number;
  excess: number;
}

export interface SectorContribution {
  sector: string;
  allocation: number;
  contribution: number;
  excess: number;
}

export interface ClientReport {
  id: string;
  name: string;
  type: 'performance' | 'risk' | 'compliance' | 'custom';
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  template: ReportTemplate;
  recipients: string[];
  lastGenerated: Date;
  nextScheduled: Date;
  status: 'active' | 'paused';
}

export interface ReportTemplate {
  id: string;
  name: string;
  sections: ReportSection[];
  formatting: ReportFormatting;
  charts: ChartConfiguration[];
}

export interface ReportSection {
  id: string;
  type: 'summary' | 'performance' | 'attribution' | 'risk' | 'compliance' | 'positions' | 'custom';
  title: string;
  content: any;
  order: number;
}

export interface ReportFormatting {
  theme: 'corporate' | 'modern' | 'minimal';
  colorScheme: string[];
  logo?: string;
  header?: string;
  footer?: string;
}

export interface ChartConfiguration {
  id: string;
  type: 'line' | 'bar' | 'pie' | 'heatmap' | 'scatter' | 'treemap';
  dataSource: string;
  title: string;
  xAxis?: string;
  yAxis?: string;
  groupBy?: string;
}

export interface InstitutionalUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  permissions: Permission[];
  lastLogin: Date;
  isActive: boolean;
  department?: string;
  managedEntities?: string[]; // Manager/Strategy IDs they can access
}

export type UserRole = 
  | 'executive'
  | 'portfolio_manager'
  | 'risk_officer'
  | 'compliance_officer'
  | 'analyst'
  | 'operations'
  | 'client_relations'
  | 'administrator';

export type Permission = 
  | 'view_portfolio'
  | 'view_performance'
  | 'view_risk'
  | 'view_compliance'
  | 'manage_strategies'
  | 'manage_allocations'
  | 'acknowledge_alerts'
  | 'generate_reports'
  | 'manage_users'
  | 'system_settings';

export interface BenchmarkData {
  id: string;
  name: string;
  category: string;
  returns: { [date: string]: number };
  riskMetrics: PerformanceMetrics;
}

// Scenario Analysis Types
export interface ScenarioTest {
  id: string;
  name: string;
  type: 'historical' | 'monte_carlo' | 'stress' | 'custom';
  parameters: ScenarioParameters;
  results: ScenarioResults;
}

export interface ScenarioParameters {
  startDate?: Date;
  endDate?: Date;
  confidence?: number;
  iterations?: number;
  shocks?: MarketShock[];
}

export interface MarketShock {
  asset: string;
  shock: number; // percentage change
}

export interface ScenarioResults {
  expectedReturn: number;
  expectedLoss: number;
  probability: number;
  worstCase: number;
  bestCase: number;
  confidenceInterval: [number, number];
}

// Dashboard Filter and View States
export interface DashboardFilters {
  dateRange: DateRange;
  managers: string[];
  strategies: string[];
  assetClasses: string[];
  showBenchmark: boolean;
  currency: string;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
  period: 'custom' | 'mtd' | 'qtd' | 'ytd' | '1y' | '3y' | '5y' | 'inception';
}

export interface ViewState {
  activeTab: string;
  selectedPeriod: string;
  filters: DashboardFilters;
  chartSettings: ChartSettings;
}

export interface ChartSettings {
  theme: 'light' | 'dark';
  showGrid: boolean;
  showLegend: boolean;
  colorPalette: string;
  precision: number;
}

// API Response Types
export interface InstitutionalDataResponse<T> {
  data: T;
  timestamp: Date;
  status: 'success' | 'error' | 'partial';
  errors?: string[];
  metadata?: {
    source: string;
    lastUpdated: Date;
    dataQuality: 'high' | 'medium' | 'low';
  };
}

// Export utility type for nested updates
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

// Subscription types for real-time updates
export interface DataSubscription {
  id: string;
  type: 'portfolio' | 'performance' | 'risk' | 'alerts';
  entities: string[];
  frequency: number; // milliseconds
  callback: (data: any) => void;
}