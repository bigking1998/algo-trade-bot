import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { Button } from 'components/ui/button';
import { Badge } from 'components/ui/badge';
import { Progress } from 'components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'components/ui/tabs';
import { Switch } from 'components/ui/switch';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { Textarea } from 'components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'components/ui/table';
import {
  Shield, CheckCircle, XCircle, AlertTriangle, FileText, 
  Clock, Calendar, Download, Upload, Search, Filter,
  Scale, Gavel, Eye, Settings, Users, Building,
  RefreshCw, Bell, Archive, BookOpen, Zap
} from 'lucide-react';

import {
  ComplianceRule,
  ComplianceViolation,
  ComplianceCategory,
  AlertSeverity,
  InstitutionalUser,
  RiskAlert,
  Manager,
  Strategy
} from '../../types/institutional';

interface RegulatoryComplianceProps {
  rules: ComplianceRule[];
  violations: ComplianceViolation[];
  alerts: RiskAlert[];
  managers: Manager[];
  strategies: Strategy[];
  currentUser: InstitutionalUser;
  onUpdateRule: (ruleId: string, updates: Partial<ComplianceRule>) => Promise<void>;
  onResolveViolation: (violationId: string, resolution: string) => Promise<void>;
  onCreateRule: (rule: Omit<ComplianceRule, 'id' | 'lastChecked'>) => Promise<void>;
  onExportReport: (type: 'violations' | 'rules' | 'full') => Promise<void>;
  className?: string;
}

export const RegulatoryCompliance: React.FC<RegulatoryComplianceProps> = ({
  rules,
  violations,
  alerts,
  managers,
  strategies,
  currentUser,
  onUpdateRule,
  onResolveViolation,
  onCreateRule,
  onExportReport,
  className = ""
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [filterCategory, setFilterCategory] = useState<ComplianceCategory | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "resolved" | "waived">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedViolation, setSelectedViolation] = useState<ComplianceViolation | null>(null);
  const [resolutionNote, setResolutionNote] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Permission checks
  const canManageRules = currentUser.permissions.includes('manage_strategies') || 
                         currentUser.role === 'compliance_officer' || 
                         currentUser.role === 'administrator';

  const canResolveViolations = currentUser.permissions.includes('acknowledge_alerts') ||
                               currentUser.role === 'compliance_officer' ||
                               currentUser.role === 'risk_officer';

  // Filter functions
  const filteredRules = rules.filter(rule => {
    const matchesCategory = filterCategory === "all" || rule.category === filterCategory;
    const matchesSearch = searchTerm === "" || 
                         rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         rule.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const filteredViolations = violations.filter(violation => {
    const matchesStatus = filterStatus === "all" || violation.status === filterStatus;
    const matchesSearch = searchTerm === "" ||
                         violation.entity.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Statistics
  const activeViolations = violations.filter(v => v.status === 'active');
  const resolvedViolations = violations.filter(v => v.status === 'resolved');
  const waivedViolations = violations.filter(v => v.status === 'waived');
  const criticalViolations = violations.filter(v => v.severity === 'critical' && v.status === 'active');
  
  const complianceScore = Math.max(0, 100 - (activeViolations.length * 5));
  const enabledRules = rules.filter(r => r.enabled);

  const getCategoryIcon = (category: ComplianceCategory) => {
    switch (category) {
      case 'regulatory': return <Gavel className="h-4 w-4" />;
      case 'risk_limits': return <Shield className="h-4 w-4" />;
      case 'investment_limits': return <Scale className="h-4 w-4" />;
      case 'operational': return <Settings className="h-4 w-4" />;
      case 'esg': return <Building className="h-4 w-4" />;
      case 'liquidity': return <Zap className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getSeverityColor = (severity: AlertSeverity): string => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'low': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  const getViolationIcon = (status: ComplianceViolation['status']) => {
    switch (status) {
      case 'active': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'resolved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'waived': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    if (!canManageRules) return;
    try {
      await onUpdateRule(ruleId, { enabled });
    } catch (error) {
      console.error('Failed to update rule:', error);
    }
  };

  const handleResolveViolation = async (violationId: string) => {
    if (!canResolveViolations || !resolutionNote.trim()) return;
    try {
      await onResolveViolation(violationId, resolutionNote);
      setSelectedViolation(null);
      setResolutionNote("");
    } catch (error) {
      console.error('Failed to resolve violation:', error);
    }
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString();
  };

  const formatDateTime = (date: Date): string => {
    return new Date(date).toLocaleString();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Regulatory Compliance</h1>
          <p className="text-muted-foreground">
            Monitor compliance rules, track violations, and maintain regulatory oversight
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search rules and violations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[250px]"
            />
          </div>
          
          <Select value={filterCategory} onValueChange={(value: ComplianceCategory | "all") => setFilterCategory(value)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="regulatory">Regulatory</SelectItem>
              <SelectItem value="risk_limits">Risk Limits</SelectItem>
              <SelectItem value="investment_limits">Investment Limits</SelectItem>
              <SelectItem value="operational">Operational</SelectItem>
              <SelectItem value="esg">ESG</SelectItem>
              <SelectItem value="liquidity">Liquidity</SelectItem>
            </SelectContent>
          </Select>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          
          <Button 
            variant="outline" 
            size="icon"
            onClick={() => onExportReport('full')}
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <Shield className={`h-4 w-4 ${complianceScore >= 90 ? 'text-green-600' : complianceScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${complianceScore >= 90 ? 'text-green-600' : complianceScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
              {complianceScore}%
            </div>
            <p className="text-xs text-muted-foreground">
              Overall compliance health
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Violations</CardTitle>
            <XCircle className={`h-4 w-4 ${activeViolations.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${activeViolations.length > 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {activeViolations.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {criticalViolations.length} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {enabledRules.length}
            </div>
            <p className="text-xs text-muted-foreground">
              of {rules.length} total rules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Audit</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatDate(new Date())}
            </div>
            <p className="text-xs text-muted-foreground">
              System automated check
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="rules">Rules Management</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="audit">Audit Trail</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Compliance Status Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Compliance Status
                </CardTitle>
                <CardDescription>
                  Current compliance health overview
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm">Overall Score</span>
                    <span className={`text-sm font-medium ${complianceScore >= 90 ? 'text-green-600' : complianceScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {complianceScore}%
                    </span>
                  </div>
                  <Progress value={complianceScore} className="h-2" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{resolvedViolations.length}</div>
                    <div className="text-xs text-muted-foreground">Resolved</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{activeViolations.length}</div>
                    <div className="text-xs text-muted-foreground">Active</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Violations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Recent Violations
                </CardTitle>
                <CardDescription>
                  Latest compliance violations
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {activeViolations.slice(0, 4).map((violation) => {
                    const rule = rules.find(r => r.id === violation.ruleId);
                    return (
                      <div key={violation.id} className="flex items-start gap-3">
                        {getViolationIcon(violation.status)}
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium">{rule?.name}</p>
                          <div className="flex items-center gap-2">
                            <Badge className={getSeverityColor(violation.severity)} size="sm">
                              {violation.severity}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(violation.timestamp)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {activeViolations.length === 0 && (
                    <div className="text-center py-4 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600 opacity-50" />
                      <p className="text-sm">No active violations</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Rule Categories */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Rule Categories
                </CardTitle>
                <CardDescription>
                  Compliance rules by category
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {['regulatory', 'risk_limits', 'investment_limits', 'operational', 'esg', 'liquidity'].map((category) => {
                    const categoryRules = rules.filter(r => r.category === category);
                    const activeRules = categoryRules.filter(r => r.enabled);
                    return (
                      <div key={category} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getCategoryIcon(category as ComplianceCategory)}
                          <span className="text-sm capitalize">{category.replace('_', ' ')}</span>
                        </div>
                        <div className="text-sm font-medium">
                          {activeRules.length}/{categoryRules.length}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Compliance Rules</h3>
              <p className="text-sm text-muted-foreground">
                {enabledRules.length} of {rules.length} rules are currently active
              </p>
            </div>
            {canManageRules && (
              <Button>
                <FileText className="h-4 w-4 mr-2" />
                Create Rule
              </Button>
            )}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Threshold</TableHead>
                    <TableHead>Last Checked</TableHead>
                    <TableHead>Status</TableHead>
                    {canManageRules && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRules.map((rule) => {
                    const hasViolation = violations.some(v => v.ruleId === rule.id && v.status === 'active');
                    return (
                      <TableRow key={rule.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {getCategoryIcon(rule.category)}
                              <span className="font-medium">{rule.name}</span>
                              {hasViolation && <XCircle className="h-4 w-4 text-red-600" />}
                            </div>
                            <p className="text-sm text-muted-foreground">{rule.description}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {rule.category.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            {rule.type.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>{rule.threshold}</TableCell>
                        <TableCell>{formatDateTime(rule.lastChecked)}</TableCell>
                        <TableCell>
                          <Badge className={rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                            {rule.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        {canManageRules && (
                          <TableCell>
                            <Switch
                              checked={rule.enabled}
                              onCheckedChange={(enabled) => handleToggleRule(rule.id, enabled)}
                            />
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="waived">Waived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Compliance Violations</CardTitle>
              <CardDescription>
                {filteredViolations.length} violations match your filters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredViolations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-600 opacity-50" />
                    <p>No violations match your filters</p>
                    <p className="text-sm">Try adjusting your search or status filters</p>
                  </div>
                ) : (
                  filteredViolations.map((violation) => {
                    const rule = rules.find(r => r.id === violation.ruleId);
                    return (
                      <div key={violation.id} className="flex items-start gap-4 p-4 border rounded-lg">
                        {getViolationIcon(violation.status)}
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="font-medium">{rule?.name}</h4>
                                <Badge className={getSeverityColor(violation.severity)}>
                                  {violation.severity}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{rule?.description}</p>
                            </div>
                            
                            {canResolveViolations && violation.status === 'active' && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setSelectedViolation(violation)}
                              >
                                Resolve
                              </Button>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Entity: </span>
                              <span className="font-medium">{violation.entity}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Current: </span>
                              <span className="font-medium text-red-600">{violation.currentValue}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Limit: </span>
                              <span className="font-medium">{violation.limit}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{formatDateTime(violation.timestamp)}</span>
                            {violation.resolvedBy && (
                              <span>Resolved by: {violation.resolvedBy}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>

          {/* Resolution Dialog */}
          {selectedViolation && canResolveViolations && (
            <Card className="border-2 border-primary">
              <CardHeader>
                <CardTitle>Resolve Violation</CardTitle>
                <CardDescription>
                  Provide resolution details for this violation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="resolution">Resolution Notes</Label>
                  <Textarea
                    id="resolution"
                    placeholder="Describe how this violation was resolved..."
                    value={resolutionNote}
                    onChange={(e) => setResolutionNote(e.target.value)}
                    className="mt-2"
                  />
                </div>
                
                <div className="flex justify-end gap-2">
                  <Button 
                    variant="outline" 
                    onClick={() => setSelectedViolation(null)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => handleResolveViolation(selectedViolation.id)}
                    disabled={!resolutionNote.trim()}
                  >
                    Resolve Violation
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Compliance Reports</CardTitle>
                <CardDescription>Generate regulatory compliance reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => onExportReport('violations')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Violations Report
                </Button>
                
                <Button 
                  onClick={() => onExportReport('rules')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <BookOpen className="h-4 w-4 mr-2" />
                  Rules Summary
                </Button>
                
                <Button 
                  onClick={() => onExportReport('full')}
                  className="w-full justify-start"
                  variant="outline"
                >
                  <Archive className="h-4 w-4 mr-2" />
                  Full Compliance Report
                </Button>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Scheduled Reports</CardTitle>
                <CardDescription>Automated compliance reporting</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Scheduled reports configuration will be implemented here
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Audit Documentation</CardTitle>
                <CardDescription>Supporting documentation and evidence</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                  Document management interface will be implemented here
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Trail</CardTitle>
              <CardDescription>
                Complete history of compliance activities and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Audit trail interface will be implemented here
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};