import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'components/ui/tabs';
import { Button } from 'components/ui/button';
import { Badge } from 'components/ui/badge';
import { Alert, AlertDescription } from 'components/ui/alert';
import { 
  Building2, Shield, TrendingUp, FileText, Users, 
  AlertTriangle, Loader2, RefreshCw
} from 'lucide-react';

import { ExecutiveDashboard } from './ExecutiveDashboard';
import { RiskGovernance } from './RiskGovernance';
import { PerformanceAttribution } from './PerformanceAttribution';
import { RegulatoryCompliance } from './RegulatoryCompliance';
import { ClientReporting } from './ClientReporting';
import { useInstitutionalData } from '../../hooks/useInstitutionalData';
import {
  InstitutionalUser,
  DateRange,
  PortfolioOverview,
  Manager,
  Strategy,
  RiskAlert
} from '../../types/institutional';

interface InstitutionalDashboardProps {
  className?: string;
}

export const InstitutionalDashboard: React.FC<InstitutionalDashboardProps> = ({
  className = ""
}) => {
  const [activeTab, setActiveTab] = useState("executive");
  const [dateRange, setDateRange] = useState<DateRange>({
    startDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
    endDate: new Date(),
    period: 'ytd'
  });

  const {
    // Data
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
    
    // Loading states
    loading,
    refreshing,
    error,
    
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
  } = useInstitutionalData();

  // Permission checks
  const canViewExecutive = currentUser?.role === 'executive' || currentUser?.role === 'administrator';
  const canViewRisk = currentUser?.permissions.includes('view_risk') || 
                     ['risk_officer', 'portfolio_manager', 'administrator'].includes(currentUser?.role || '');
  const canViewCompliance = currentUser?.permissions.includes('view_compliance') || 
                            ['compliance_officer', 'risk_officer', 'administrator'].includes(currentUser?.role || '');
  const canViewReports = currentUser?.permissions.includes('generate_reports') || 
                        ['portfolio_manager', 'client_relations', 'administrator'].includes(currentUser?.role || '');

  // Handle date range updates
  const handleDateRangeChange = (range: DateRange) => {
    setDateRange(range);
    updateDateRange(range);
  };

  // Get tab access based on user permissions
  const availableTabs = [
    {
      id: 'executive',
      label: 'Executive',
      icon: Building2,
      available: canViewExecutive,
      description: 'Portfolio overview and key metrics'
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: TrendingUp,
      available: true, // All users can view performance
      description: 'Performance attribution analysis'
    },
    {
      id: 'risk',
      label: 'Risk',
      icon: Shield,
      available: canViewRisk,
      description: 'Risk management and governance'
    },
    {
      id: 'compliance',
      label: 'Compliance',
      icon: AlertTriangle,
      available: canViewCompliance,
      description: 'Regulatory compliance monitoring'
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: FileText,
      available: canViewReports,
      description: 'Client reporting and templates'
    }
  ].filter(tab => tab.available);

  // Set default tab based on user role
  useEffect(() => {
    if (currentUser && availableTabs.length > 0) {
      const defaultTab = currentUser.role === 'executive' ? 'executive' :
                        currentUser.role === 'risk_officer' ? 'risk' :
                        currentUser.role === 'compliance_officer' ? 'compliance' :
                        currentUser.role === 'client_relations' ? 'reports' :
                        'performance';
      
      if (availableTabs.find(tab => tab.id === defaultTab)) {
        setActiveTab(defaultTab);
      } else {
        setActiveTab(availableTabs[0].id);
      }
    }
  }, [currentUser, availableTabs.length]);

  // Subscribe to real-time updates based on active tab
  useEffect(() => {
    if (!currentUser) return;

    let unsubscribe: (() => void) | undefined;

    switch (activeTab) {
      case 'executive':
        unsubscribe = subscribeToUpdates('portfolio', [], (data) => {
          // Handle real-time portfolio updates
          console.log('Portfolio update:', data);
        });
        break;
      case 'performance':
        unsubscribe = subscribeToUpdates('performance', [], (data) => {
          // Handle real-time performance updates
          console.log('Performance update:', data);
        });
        break;
      case 'risk':
        unsubscribe = subscribeToUpdates('risk', [], (data) => {
          // Handle real-time risk updates
          console.log('Risk update:', data);
        });
        break;
      case 'compliance':
        unsubscribe = subscribeToUpdates('alerts', [], (data) => {
          // Handle real-time alert updates
          console.log('Alerts update:', data);
        });
        break;
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [activeTab, currentUser, subscribeToUpdates]);

  // Loading state
  if (loading && !portfolioOverview) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${className}`}>
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">Loading Institutional Dashboard</h3>
            <p className="text-muted-foreground">Fetching portfolio data and analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !portfolioOverview) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${className}`}>
        <Alert className="max-w-lg">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">Failed to load institutional dashboard</p>
              <p>{error}</p>
              <Button onClick={refreshData} size="sm">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No access state
  if (!currentUser || availableTabs.length === 0) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${className}`}>
        <Alert className="max-w-lg">
          <Users className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-semibold">Access Restricted</p>
              <p>You don't have permission to access the institutional dashboard.</p>
              <p className="text-sm text-muted-foreground">
                Contact your administrator to request access.
              </p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header with user info and alerts */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Institutional Dashboard</h1>
              <p className="text-muted-foreground">
                Welcome back, {currentUser?.name} • {currentUser?.role.replace('_', ' ')}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Critical alerts indicator */}
          {alerts.filter(a => a.severity === 'critical' && a.status === 'active').length > 0 && (
            <Badge className="bg-red-100 text-red-800 animate-pulse">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {alerts.filter(a => a.severity === 'critical' && a.status === 'active').length} Critical Alerts
            </Badge>
          )}
          
          {/* Refresh indicator */}
          {refreshing && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Refreshing...</span>
            </div>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={refreshData}
            disabled={refreshing}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Dashboard Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${availableTabs.length}, 1fr)` }}>
          {availableTabs.map(tab => {
            const IconComponent = tab.icon;
            return (
              <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
                <IconComponent className="h-4 w-4" />
                {tab.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        {/* Executive Dashboard */}
        <TabsContent value="executive" className="space-y-0">
          {portfolioOverview && (
            <ExecutiveDashboard
              portfolioData={portfolioOverview}
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
            />
          )}
        </TabsContent>

        {/* Performance Attribution */}
        <TabsContent value="performance" className="space-y-0">
          {performanceAttribution && (
            <PerformanceAttribution
              attribution={performanceAttribution}
              managers={managers}
              strategies={strategies}
              assetClasses={portfolioOverview?.allocations || []}
              benchmarks={benchmarks}
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
              onExportData={() => exportReport('full')}
            />
          )}
        </TabsContent>

        {/* Risk Governance */}
        <TabsContent value="risk" className="space-y-0">
          {portfolioOverview && (
            <RiskGovernance
              riskMetrics={portfolioOverview.riskMetrics}
              complianceRules={complianceRules}
              violations={violations}
              alerts={alerts}
              managers={managers}
              strategies={strategies}
              scenarioTests={scenarios}
              currentUser={currentUser}
              onUpdateRule={updateComplianceRule}
              onAcknowledgeAlert={acknowledgeAlert}
              onResolveViolation={resolveViolation}
            />
          )}
        </TabsContent>

        {/* Regulatory Compliance */}
        <TabsContent value="compliance" className="space-y-0">
          <RegulatoryCompliance
            rules={complianceRules}
            violations={violations}
            alerts={alerts}
            managers={managers}
            strategies={strategies}
            currentUser={currentUser}
            onUpdateRule={updateComplianceRule}
            onResolveViolation={resolveViolation}
            onCreateRule={createComplianceRule}
            onExportReport={exportReport}
          />
        </TabsContent>

        {/* Client Reporting */}
        <TabsContent value="reports" className="space-y-0">
          <ClientReporting
            reports={reports}
            templates={templates}
            managers={managers}
            strategies={strategies}
            currentUser={currentUser}
            onCreateReport={createReport}
            onUpdateReport={updateReport}
            onGenerateReport={generateReport}
            onDeleteReport={deleteReport}
            onCreateTemplate={createTemplate}
            onPreviewReport={previewReport}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};