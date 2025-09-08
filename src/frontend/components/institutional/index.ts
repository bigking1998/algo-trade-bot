// Institutional Dashboard Components
// Enterprise-grade trading platform components for institutional users

export { ExecutiveDashboard } from './ExecutiveDashboard';
export { RiskGovernance } from './RiskGovernance';
export { PerformanceAttribution } from './PerformanceAttribution';
export { RegulatoryCompliance } from './RegulatoryCompliance';
export { ClientReporting } from './ClientReporting';
export { InstitutionalDashboard } from './InstitutionalDashboard';

// Re-export types for convenience
export type {
  PortfolioOverview,
  PerformanceAttribution as PerformanceAttributionData,
  Manager,
  Strategy,
  ComplianceRule,
  ComplianceViolation,
  RiskAlert,
  ClientReport,
  ReportTemplate,
  InstitutionalUser,
  DateRange,
  AlertSeverity,
  ComplianceCategory,
  UserRole,
  Permission
} from '../../types/institutional';