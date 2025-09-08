import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from 'components/ui/card';
import { Button } from 'components/ui/button';
import { Badge } from 'components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';
import { Input } from 'components/ui/input';
import { Label } from 'components/ui/label';
import { Textarea } from 'components/ui/textarea';
import { Switch } from 'components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from 'components/ui/dialog';
import {
  FileText, Download, Calendar, Clock, Users, Mail, 
  Settings, Eye, Edit, Trash2, Plus, Send, RefreshCw,
  BarChart3, PieChart, TrendingUp, Filter, Search,
  Copy, Save, PlayCircle, PauseCircle, Palette,
  FileImage, FileSpreadsheet, FilePdf, Layout
} from 'lucide-react';

import {
  ClientReport,
  ReportTemplate,
  ReportSection,
  ReportFormatting,
  ChartConfiguration,
  InstitutionalUser,
  DateRange,
  PerformanceMetrics,
  Manager,
  Strategy
} from '../../types/institutional';

interface ClientReportingProps {
  reports: ClientReport[];
  templates: ReportTemplate[];
  managers: Manager[];
  strategies: Strategy[];
  currentUser: InstitutionalUser;
  onCreateReport: (report: Omit<ClientReport, 'id' | 'lastGenerated' | 'nextScheduled'>) => Promise<void>;
  onUpdateReport: (reportId: string, updates: Partial<ClientReport>) => Promise<void>;
  onGenerateReport: (reportId: string) => Promise<void>;
  onDeleteReport: (reportId: string) => Promise<void>;
  onCreateTemplate: (template: Omit<ReportTemplate, 'id'>) => Promise<void>;
  onPreviewReport: (reportId: string) => Promise<void>;
  className?: string;
}

export const ClientReporting: React.FC<ClientReportingProps> = ({
  reports,
  templates,
  managers,
  strategies,
  currentUser,
  onCreateReport,
  onUpdateReport,
  onGenerateReport,
  onDeleteReport,
  onCreateTemplate,
  onPreviewReport,
  className = ""
}) => {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedReport, setSelectedReport] = useState<ClientReport | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isTemplateDialog, setIsTemplateDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "performance" | "risk" | "compliance" | "custom">("all");
  const [refreshing, setRefreshing] = useState(false);

  // Form states for new report
  const [newReport, setNewReport] = useState<Partial<ClientReport>>({
    name: "",
    type: "performance",
    frequency: "monthly",
    recipients: [],
    status: "active"
  });

  const [newTemplate, setNewTemplate] = useState<Partial<ReportTemplate>>({
    name: "",
    sections: [],
    formatting: {
      theme: "corporate",
      colorScheme: ["#2563eb", "#059669", "#dc2626", "#7c2d12"],
    },
    charts: []
  });

  // Permission checks
  const canManageReports = currentUser.permissions.includes('generate_reports') || 
                          currentUser.role === 'portfolio_manager' ||
                          currentUser.role === 'administrator';

  // Filter and search
  const filteredReports = reports.filter(report => {
    const matchesSearch = searchTerm === "" || 
                         report.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || report.type === filterType;
    return matchesSearch && matchesType;
  });

  const getStatusColor = (status: ClientReport['status']): string => {
    return status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800';
  };

  const getFrequencyIcon = (frequency: ClientReport['frequency']) => {
    switch (frequency) {
      case 'daily': return <Clock className="h-4 w-4" />;
      case 'weekly': return <Calendar className="h-4 w-4" />;
      case 'monthly': return <Calendar className="h-4 w-4" />;
      case 'quarterly': return <Calendar className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getTypeIcon = (type: ClientReport['type']) => {
    switch (type) {
      case 'performance': return <TrendingUp className="h-4 w-4" />;
      case 'risk': return <BarChart3 className="h-4 w-4" />;
      case 'compliance': return <FileText className="h-4 w-4" />;
      case 'custom': return <Settings className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const formatDate = (date: Date): string => {
    return new Date(date).toLocaleDateString();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  };

  const handleCreateReport = async () => {
    if (!canManageReports || !newReport.name || !newReport.type || !newReport.frequency) return;
    
    try {
      await onCreateReport(newReport as Omit<ClientReport, 'id' | 'lastGenerated' | 'nextScheduled'>);
      setIsCreating(false);
      setNewReport({
        name: "",
        type: "performance",
        frequency: "monthly",
        recipients: [],
        status: "active"
      });
    } catch (error) {
      console.error('Failed to create report:', error);
    }
  };

  const handleUpdateReportStatus = async (reportId: string, status: ClientReport['status']) => {
    if (!canManageReports) return;
    try {
      await onUpdateReport(reportId, { status });
    } catch (error) {
      console.error('Failed to update report:', error);
    }
  };

  const addRecipient = (email: string) => {
    if (!email || newReport.recipients?.includes(email)) return;
    setNewReport(prev => ({
      ...prev,
      recipients: [...(prev.recipients || []), email]
    }));
  };

  const removeRecipient = (email: string) => {
    setNewReport(prev => ({
      ...prev,
      recipients: prev.recipients?.filter(r => r !== email) || []
    }));
  };

  // Statistics
  const activeReports = reports.filter(r => r.status === 'active');
  const scheduledToday = reports.filter(r => {
    const today = new Date();
    const nextScheduled = new Date(r.nextScheduled);
    return nextScheduled.toDateString() === today.toDateString();
  });

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Client Reporting</h1>
          <p className="text-muted-foreground">
            Create, manage, and distribute professional client reports
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-[200px]"
            />
          </div>
          
          <Select value={filterType} onValueChange={(value: any) => setFilterType(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="risk">Risk</SelectItem>
              <SelectItem value="compliance">Compliance</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
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
          
          {canManageReports && (
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Report
            </Button>
          )}
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeReports.length}</div>
            <p className="text-xs text-muted-foreground">
              {reports.length - activeReports.length} paused
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Due Today</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduledToday.length}</div>
            <p className="text-xs text-muted-foreground">
              Scheduled for generation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <Layout className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates.length}</div>
            <p className="text-xs text-muted-foreground">
              Available templates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recipients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(reports.flatMap(r => r.recipients)).size}
            </div>
            <p className="text-xs text-muted-foreground">
              Unique email addresses
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Recent Reports</CardTitle>
                <CardDescription>
                  Recently generated client reports
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredReports.slice(0, 5).map((report) => (
                    <div key={report.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getTypeIcon(report.type)}
                        <div>
                          <div className="font-medium">{report.name}</div>
                          <div className="text-sm text-muted-foreground">
                            Last generated: {formatDate(report.lastGenerated)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getStatusColor(report.status)}>
                          {report.status}
                        </Badge>
                        {canManageReports && (
                          <Button variant="outline" size="sm" onClick={() => onPreviewReport(report.id)}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming Schedule</CardTitle>
                <CardDescription>
                  Reports scheduled for generation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {reports
                    .filter(r => r.status === 'active')
                    .sort((a, b) => new Date(a.nextScheduled).getTime() - new Date(b.nextScheduled).getTime())
                    .slice(0, 5)
                    .map((report) => (
                      <div key={report.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getFrequencyIcon(report.frequency)}
                          <div>
                            <div className="font-medium">{report.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {report.frequency} • {report.recipients.length} recipients
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {formatDate(report.nextScheduled)}
                          </div>
                          {canManageReports && (
                            <Button variant="ghost" size="sm" onClick={() => onGenerateReport(report.id)}>
                              <PlayCircle className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Client Reports</CardTitle>
              <CardDescription>
                Manage all client reporting configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Report</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Last Generated</TableHead>
                    <TableHead>Next Scheduled</TableHead>
                    <TableHead>Status</TableHead>
                    {canManageReports && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getTypeIcon(report.type)}
                          <span className="font-medium">{report.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{report.type}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getFrequencyIcon(report.frequency)}
                          <span>{report.frequency}</span>
                        </div>
                      </TableCell>
                      <TableCell>{report.recipients.length}</TableCell>
                      <TableCell>{formatDate(report.lastGenerated)}</TableCell>
                      <TableCell>{formatDate(report.nextScheduled)}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(report.status)}>
                          {report.status}
                        </Badge>
                      </TableCell>
                      {canManageReports && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => onPreviewReport(report.id)}>
                              <Eye className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedReport(report)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => onGenerateReport(report.id)}>
                              <Send className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateReportStatus(report.id, report.status === 'active' ? 'paused' : 'active')}
                            >
                              {report.status === 'active' ? <PauseCircle className="h-3 w-3" /> : <PlayCircle className="h-3 w-3" />}
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">Report Templates</h3>
              <p className="text-sm text-muted-foreground">
                {templates.length} templates available for report generation
              </p>
            </div>
            {canManageReports && (
              <Button onClick={() => setIsTemplateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                New Template
              </Button>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Layout className="h-5 w-5" />
                    {template.name}
                  </CardTitle>
                  <CardDescription>
                    {template.sections.length} sections • {template.charts.length} charts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Palette className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{template.formatting.theme} theme</span>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="text-sm font-medium">Sections:</div>
                      <div className="space-y-1">
                        {template.sections.slice(0, 3).map((section) => (
                          <div key={section.id} className="text-sm text-muted-foreground">
                            • {section.title}
                          </div>
                        ))}
                        {template.sections.length > 3 && (
                          <div className="text-xs text-muted-foreground">
                            +{template.sections.length - 3} more sections
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {canManageReports && (
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm">
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <Edit className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Report Schedule</CardTitle>
              <CardDescription>
                View and manage the automated report generation schedule
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                Calendar-based schedule interface will be implemented here
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Report Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Report</DialogTitle>
            <DialogDescription>
              Configure a new client report with automated scheduling
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="report-name">Report Name</Label>
                <Input
                  id="report-name"
                  value={newReport.name || ""}
                  onChange={(e) => setNewReport(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Monthly Performance Report"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="report-type">Report Type</Label>
                <Select value={newReport.type} onValueChange={(value) => setNewReport(prev => ({ ...prev, type: value as ClientReport['type'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="risk">Risk Analysis</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="frequency">Frequency</Label>
                <Select value={newReport.frequency} onValueChange={(value) => setNewReport(prev => ({ ...prev, frequency: value as ClientReport['frequency'] }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="template">Template</Label>
                <Select value={newReport.template?.id || ""} onValueChange={(value) => {
                  const template = templates.find(t => t.id === value);
                  setNewReport(prev => ({ ...prev, template }));
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Recipients</Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email address"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        addRecipient(e.currentTarget.value);
                        e.currentTarget.value = "";
                      }
                    }}
                  />
                  <Button
                    type="button"
                    onClick={(e) => {
                      const input = e.currentTarget.previousElementSibling as HTMLInputElement;
                      addRecipient(input.value);
                      input.value = "";
                    }}
                  >
                    Add
                  </Button>
                </div>
                
                {newReport.recipients && newReport.recipients.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {newReport.recipients.map((email) => (
                      <Badge key={email} className="flex items-center gap-1">
                        {email}
                        <button onClick={() => removeRecipient(email)}>
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateReport}
              disabled={!newReport.name || !newReport.type || !newReport.frequency}
            >
              Create Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Template Creation Dialog */}
      <Dialog open={isTemplateDialog} onOpenChange={setIsTemplateDialog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Create New Template</DialogTitle>
            <DialogDescription>
              Design a custom report template with sections and formatting
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Template Name</Label>
              <Input
                id="template-name"
                value={newTemplate.name || ""}
                onChange={(e) => setNewTemplate(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Corporate Performance Template"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Theme</Label>
                <Select 
                  value={newTemplate.formatting?.theme} 
                  onValueChange={(value) => setNewTemplate(prev => ({
                    ...prev,
                    formatting: { ...prev.formatting!, theme: value as ReportFormatting['theme'] }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corporate">Corporate</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="minimal">Minimal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Color Scheme</Label>
                <div className="flex gap-2">
                  {newTemplate.formatting?.colorScheme?.map((color, index) => (
                    <div
                      key={index}
                      className="w-8 h-8 rounded border"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            <div className="h-[200px] flex items-center justify-center border-2 border-dashed border-gray-300 rounded-lg text-muted-foreground">
              Template builder interface will be implemented here
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTemplateDialog(false)}>
              Cancel
            </Button>
            <Button 
              disabled={!newTemplate.name}
            >
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};