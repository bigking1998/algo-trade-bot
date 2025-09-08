import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PortfolioOverview,
  PerformanceAttribution,
  Manager,
  Strategy,
  ComplianceRule,
  ComplianceViolation,
  RiskAlert,
  ClientReport,
  ReportTemplate,
  BenchmarkData,
  InstitutionalUser,
  ScenarioTest,
  DateRange,
  InstitutionalDataResponse,
  DataSubscription
} from '../types/institutional';

interface InstitutionalDataHookResult {
  // Data
  portfolioOverview: PortfolioOverview | null;
  performanceAttribution: PerformanceAttribution | null;
  managers: Manager[];
  strategies: Strategy[];
  complianceRules: ComplianceRule[];
  violations: ComplianceViolation[];
  alerts: RiskAlert[];
  reports: ClientReport[];
  templates: ReportTemplate[];
  benchmarks: BenchmarkData[];
  scenarios: ScenarioTest[];
  currentUser: InstitutionalUser | null;
  
  // Loading states
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  
  // Actions
  refreshData: () => Promise<void>;
  updateDateRange: (range: DateRange) => void;
  
  // Manager management
  createManager: (manager: Omit<Manager, 'id'>) => Promise<void>;
  updateManager: (managerId: string, updates: Partial<Manager>) => Promise<void>;
  deleteManager: (managerId: string) => Promise<void>;
  
  // Strategy management
  createStrategy: (strategy: Omit<Strategy, 'id'>) => Promise<void>;
  updateStrategy: (strategyId: string, updates: Partial<Strategy>) => Promise<void>;
  deleteStrategy: (strategyId: string) => Promise<void>;
  
  // Compliance management
  createComplianceRule: (rule: Omit<ComplianceRule, 'id' | 'lastChecked'>) => Promise<void>;
  updateComplianceRule: (ruleId: string, updates: Partial<ComplianceRule>) => Promise<void>;
  resolveViolation: (violationId: string, resolution: string) => Promise<void>;
  acknowledgeAlert: (alertId: string) => Promise<void>;
  
  // Reporting
  createReport: (report: Omit<ClientReport, 'id' | 'lastGenerated' | 'nextScheduled'>) => Promise<void>;
  updateReport: (reportId: string, updates: Partial<ClientReport>) => Promise<void>;
  generateReport: (reportId: string) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  createTemplate: (template: Omit<ReportTemplate, 'id'>) => Promise<void>;
  exportReport: (type: 'violations' | 'rules' | 'full') => Promise<void>;
  previewReport: (reportId: string) => Promise<void>;
  
  // Real-time subscriptions
  subscribeToUpdates: (type: DataSubscription['type'], entities: string[], callback: (data: any) => void) => () => void;
}

export const useInstitutionalData = (
  initialDateRange: DateRange = {
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    period: 'ytd'
  }
): InstitutionalDataHookResult => {
  // State
  const [portfolioOverview, setPortfolioOverview] = useState<PortfolioOverview | null>(null);
  const [performanceAttribution, setPerformanceAttribution] = useState<PerformanceAttribution | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [complianceRules, setComplianceRules] = useState<ComplianceRule[]>([]);
  const [violations, setViolations] = useState<ComplianceViolation[]>([]);
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [benchmarks, setBenchmarks] = useState<BenchmarkData[]>([]);
  const [scenarios, setScenarios] = useState<ScenarioTest[]>([]);
  const [currentUser, setCurrentUser] = useState<InstitutionalUser | null>(null);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(initialDateRange);
  
  // Subscriptions management
  const [subscriptions, setSubscriptions] = useState<Map<string, DataSubscription>>(new Map());

  // API Base URL
  const API_BASE = '/api/institutional';

  // Generic API call function
  const apiCall = async <T,>(endpoint: string, options: RequestInit = {}): Promise<InstitutionalDataResponse<T>> => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      if (!response.ok) {
        throw new Error(`API call failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Unknown API error');
    }
  };

  // Load initial data
  const loadData = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      // Parallel data loading for better performance
      const [
        portfolioResponse,
        attributionResponse,
        managersResponse,
        strategiesResponse,
        rulesResponse,
        violationsResponse,
        alertsResponse,
        reportsResponse,
        templatesResponse,
        benchmarksResponse,
        scenariosResponse,
        userResponse
      ] = await Promise.all([
        apiCall<PortfolioOverview>(`/portfolio/overview?period=${dateRange.period}`),
        apiCall<PerformanceAttribution>(`/portfolio/attribution?period=${dateRange.period}`),
        apiCall<Manager[]>('/managers'),
        apiCall<Strategy[]>('/strategies'),
        apiCall<ComplianceRule[]>('/compliance/rules'),
        apiCall<ComplianceViolation[]>('/compliance/violations'),
        apiCall<RiskAlert[]>('/alerts'),
        apiCall<ClientReport[]>('/reports'),
        apiCall<ReportTemplate[]>('/templates'),
        apiCall<BenchmarkData[]>('/benchmarks'),
        apiCall<ScenarioTest[]>('/scenarios'),
        apiCall<InstitutionalUser>('/user/current'),
      ]);

      // Update state with fetched data
      setPortfolioOverview(portfolioResponse.data);
      setPerformanceAttribution(attributionResponse.data);
      setManagers(managersResponse.data);
      setStrategies(strategiesResponse.data);
      setComplianceRules(rulesResponse.data);
      setViolations(violationsResponse.data);
      setAlerts(alertsResponse.data);
      setReports(reportsResponse.data);
      setTemplates(templatesResponse.data);
      setBenchmarks(benchmarksResponse.data);
      setScenarios(scenariosResponse.data);
      setCurrentUser(userResponse.data);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load institutional data');
      console.error('Error loading institutional data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange.period]);

  // Initial data load
  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // Refresh data function
  const refreshData = useCallback(async () => {
    await loadData(false);
  }, [loadData]);

  // Update date range
  const updateDateRange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  // Manager management
  const createManager = useCallback(async (manager: Omit<Manager, 'id'>) => {
    try {
      const response = await apiCall<Manager>('/managers', {
        method: 'POST',
        body: JSON.stringify(manager),
      });
      
      setManagers(prev => [...prev, response.data]);
    } catch (err) {
      throw new Error(`Failed to create manager: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const updateManager = useCallback(async (managerId: string, updates: Partial<Manager>) => {
    try {
      const response = await apiCall<Manager>(`/managers/${managerId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      
      setManagers(prev => prev.map(m => m.id === managerId ? response.data : m));
    } catch (err) {
      throw new Error(`Failed to update manager: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const deleteManager = useCallback(async (managerId: string) => {
    try {
      await apiCall(`/managers/${managerId}`, { method: 'DELETE' });
      setManagers(prev => prev.filter(m => m.id !== managerId));
    } catch (err) {
      throw new Error(`Failed to delete manager: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  // Strategy management
  const createStrategy = useCallback(async (strategy: Omit<Strategy, 'id'>) => {
    try {
      const response = await apiCall<Strategy>('/strategies', {
        method: 'POST',
        body: JSON.stringify(strategy),
      });
      
      setStrategies(prev => [...prev, response.data]);
    } catch (err) {
      throw new Error(`Failed to create strategy: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const updateStrategy = useCallback(async (strategyId: string, updates: Partial<Strategy>) => {
    try {
      const response = await apiCall<Strategy>(`/strategies/${strategyId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      
      setStrategies(prev => prev.map(s => s.id === strategyId ? response.data : s));
    } catch (err) {
      throw new Error(`Failed to update strategy: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const deleteStrategy = useCallback(async (strategyId: string) => {
    try {
      await apiCall(`/strategies/${strategyId}`, { method: 'DELETE' });
      setStrategies(prev => prev.filter(s => s.id !== strategyId));
    } catch (err) {
      throw new Error(`Failed to delete strategy: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  // Compliance management
  const createComplianceRule = useCallback(async (rule: Omit<ComplianceRule, 'id' | 'lastChecked'>) => {
    try {
      const response = await apiCall<ComplianceRule>('/compliance/rules', {
        method: 'POST',
        body: JSON.stringify(rule),
      });
      
      setComplianceRules(prev => [...prev, response.data]);
    } catch (err) {
      throw new Error(`Failed to create compliance rule: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const updateComplianceRule = useCallback(async (ruleId: string, updates: Partial<ComplianceRule>) => {
    try {
      const response = await apiCall<ComplianceRule>(`/compliance/rules/${ruleId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      
      setComplianceRules(prev => prev.map(r => r.id === ruleId ? response.data : r));
    } catch (err) {
      throw new Error(`Failed to update compliance rule: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const resolveViolation = useCallback(async (violationId: string, resolution: string) => {
    try {
      const response = await apiCall<ComplianceViolation>(`/compliance/violations/${violationId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ resolution }),
      });
      
      setViolations(prev => prev.map(v => v.id === violationId ? response.data : v));
    } catch (err) {
      throw new Error(`Failed to resolve violation: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      const response = await apiCall<RiskAlert>(`/alerts/${alertId}/acknowledge`, {
        method: 'POST',
      });
      
      setAlerts(prev => prev.map(a => a.id === alertId ? response.data : a));
    } catch (err) {
      throw new Error(`Failed to acknowledge alert: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  // Reporting functions
  const createReport = useCallback(async (report: Omit<ClientReport, 'id' | 'lastGenerated' | 'nextScheduled'>) => {
    try {
      const response = await apiCall<ClientReport>('/reports', {
        method: 'POST',
        body: JSON.stringify(report),
      });
      
      setReports(prev => [...prev, response.data]);
    } catch (err) {
      throw new Error(`Failed to create report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const updateReport = useCallback(async (reportId: string, updates: Partial<ClientReport>) => {
    try {
      const response = await apiCall<ClientReport>(`/reports/${reportId}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      
      setReports(prev => prev.map(r => r.id === reportId ? response.data : r));
    } catch (err) {
      throw new Error(`Failed to update report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const generateReport = useCallback(async (reportId: string) => {
    try {
      await apiCall(`/reports/${reportId}/generate`, { method: 'POST' });
      // Refresh reports to get updated lastGenerated timestamp
      const response = await apiCall<ClientReport[]>('/reports');
      setReports(response.data);
    } catch (err) {
      throw new Error(`Failed to generate report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const deleteReport = useCallback(async (reportId: string) => {
    try {
      await apiCall(`/reports/${reportId}`, { method: 'DELETE' });
      setReports(prev => prev.filter(r => r.id !== reportId));
    } catch (err) {
      throw new Error(`Failed to delete report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const createTemplate = useCallback(async (template: Omit<ReportTemplate, 'id'>) => {
    try {
      const response = await apiCall<ReportTemplate>('/templates', {
        method: 'POST',
        body: JSON.stringify(template),
      });
      
      setTemplates(prev => [...prev, response.data]);
    } catch (err) {
      throw new Error(`Failed to create template: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const exportReport = useCallback(async (type: 'violations' | 'rules' | 'full') => {
    try {
      const response = await fetch(`${API_BASE}/export/${type}`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Export failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      throw new Error(`Failed to export report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  const previewReport = useCallback(async (reportId: string) => {
    try {
      const response = await fetch(`${API_BASE}/reports/${reportId}/preview`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        throw new Error('Preview failed');
      }
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (err) {
      throw new Error(`Failed to preview report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, []);

  // Real-time subscriptions
  const subscribeToUpdates = useCallback((
    type: DataSubscription['type'], 
    entities: string[], 
    callback: (data: any) => void
  ): (() => void) => {
    const subscriptionId = `${type}_${entities.join('_')}_${Date.now()}`;
    
    const subscription: DataSubscription = {
      id: subscriptionId,
      type,
      entities,
      frequency: 5000, // 5 seconds
      callback
    };

    setSubscriptions(prev => new Map(prev).set(subscriptionId, subscription));

    // Set up WebSocket or polling mechanism
    const interval = setInterval(async () => {
      try {
        let endpoint = '';
        switch (type) {
          case 'portfolio':
            endpoint = `/portfolio/overview?period=${dateRange.period}`;
            break;
          case 'performance':
            endpoint = `/portfolio/attribution?period=${dateRange.period}`;
            break;
          case 'risk':
            endpoint = '/alerts';
            break;
          case 'alerts':
            endpoint = '/alerts';
            break;
        }
        
        if (endpoint) {
          const response = await apiCall(endpoint);
          callback(response.data);
        }
      } catch (error) {
        console.error('Subscription update error:', error);
      }
    }, subscription.frequency);

    // Return unsubscribe function
    return () => {
      clearInterval(interval);
      setSubscriptions(prev => {
        const newMap = new Map(prev);
        newMap.delete(subscriptionId);
        return newMap;
      });
    };
  }, [dateRange.period]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      subscriptions.forEach(subscription => {
        // Clear any intervals or WebSocket connections
      });
    };
  }, [subscriptions]);

  // Memoized computed values
  const computedValues = useMemo(() => ({
    portfolioOverview,
    performanceAttribution,
    managers,
    strategies,
    complianceRules,
    violations,
    alerts,
    reports,
    templates,
    benchmarks,
    scenarios,
    currentUser,
    loading,
    refreshing,
    error
  }), [
    portfolioOverview,
    performanceAttribution,
    managers,
    strategies,
    complianceRules,
    violations,
    alerts,
    reports,
    templates,
    benchmarks,
    scenarios,
    currentUser,
    loading,
    refreshing,
    error
  ]);

  return {
    ...computedValues,
    
    // Actions
    refreshData,
    updateDateRange,
    
    // Manager management
    createManager,
    updateManager,
    deleteManager,
    
    // Strategy management
    createStrategy,
    updateStrategy,
    deleteStrategy,
    
    // Compliance management
    createComplianceRule,
    updateComplianceRule,
    resolveViolation,
    acknowledgeAlert,
    
    // Reporting
    createReport,
    updateReport,
    generateReport,
    deleteReport,
    createTemplate,
    exportReport,
    previewReport,
    
    // Real-time subscriptions
    subscribeToUpdates
  };
};

export default useInstitutionalData;