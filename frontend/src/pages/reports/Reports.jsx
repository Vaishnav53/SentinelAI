import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity, ShieldAlert, Users, AlertTriangle, ShieldCheck,
  TrendingUp, Calendar, RefreshCw, FileText, Download,
  Share2, FileSpreadsheet, Eye, ExternalLink, Cpu,
  Sparkles, Clock, ChevronRight, X, CheckCircle2, AlertCircle,
  Filter, Globe, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import apiClient from '../../api/client';
import './Reports.css';

// Mini Sparkline Component for KPI Cards
const MiniSparkline = ({ data, color }) => {
  if (!data || data.length === 0) return null;
  const points = data.map((val, idx) => ({ idx, val }));
  return (
    <div className="kpi-sparkline-wrap">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={color} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="val"
            stroke={color}
            strokeWidth={1.5}
            fill={`url(#grad-${color.replace('#', '')})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default function Reports() {
  const navigate = useNavigate();

  // Filter & State Controls
  const [timeRange, setTimeRange] = useState('7d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customStartInput, setCustomStartInput] = useState('');
  const [customEndInput, setCustomEndInput] = useState('');

  // Data & Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  // AI Executive Summary State
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiSummary, setAiSummary] = useState('');
  const [aiGeneratedAt, setAiGeneratedAt] = useState(null);
  const [aiModelUsed, setAiModelUsed] = useState(null);

  // Modals & Drawers
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [showSeverityModal, setShowSeverityModal] = useState(false);
  const [showTypesModal, setShowTypesModal] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const fetchAnalytics = useCallback(async (range = timeRange, sDate = startDate, eDate = endDate, isManualRefresh = false) => {
    try {
      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      let url = `/reports/analytics?range=${encodeURIComponent(range)}`;
      if (range === 'custom' && sDate && eDate) {
        url += `&start_date=${encodeURIComponent(sDate)}&end_date=${encodeURIComponent(eDate)}`;
      }

      const data = await apiClient.get(url);
      setAnalytics(data);
    } catch (err) {
      console.error('Failed to load reports analytics:', err);
      setError(err.message || 'Unable to load reporting data. Please refresh and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [timeRange, startDate, endDate]);

  useEffect(() => {
    fetchAnalytics(timeRange, startDate, endDate);
  }, [timeRange, startDate, endDate, fetchAnalytics]);

  const handleRangeChange = (newRange) => {
    if (newRange === 'custom') {
      setCustomModalOpen(true);
    } else {
      setTimeRange(newRange);
      setStartDate('');
      setEndDate('');
      setAiSummary('');
    }
  };

  const handleApplyCustomRange = () => {
    if (!customStartInput || !customEndInput) return;
    setStartDate(customStartInput);
    setEndDate(customEndInput);
    setTimeRange('custom');
    setCustomModalOpen(false);
    setAiSummary('');
  };

  const handleGenerateAiSummary = async () => {
    try {
      setAiGenerating(true);
      const res = await apiClient.post('/reports/ai-executive-summary', {
        time_range: timeRange,
        start_date: startDate || undefined,
        end_date: endDate || undefined
      });
      setAiSummary(res.markdown);
      setAiGeneratedAt(res.generated_at);
      setAiModelUsed(res.model);
      showToast('AI Executive Summary synthesized successfully with GPT-OSS 120B.');
    } catch (err) {
      console.error('Failed to generate AI executive summary:', err);
      showToast('Failed to generate AI summary. Using deterministic intelligence brief.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleExportCsv = () => {
    let url = `${import.meta.env.VITE_API_BASE_URL || '/api'}/reports/export-period-csv?range=${encodeURIComponent(timeRange)}`;
    if (timeRange === 'custom' && startDate && endDate) {
      url += `&start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
    }
    window.open(url, '_blank');
    showToast('Exporting security events CSV...');
  };

  const handleExportPdf = () => {
    if (!analytics) return;
    const printWindow = window.open('', '_blank', 'width=900,height=1000');
    if (!printWindow) {
      showToast('Pop-up blocked. Please allow pop-ups to print the PDF report.');
      return;
    }

    const reportTitle = `SentinelAI Security Report - ${analytics.range_label}`;
    const generatedTime = analytics.last_updated;
    const kpis = analytics.kpis;
    const summaryText = (aiSummary || analytics.deterministic_summary)
      .replace(/\n/g, '<br>')
      .replace(/### (.*?)(<br>)/g, '<h3 style="color:#0088cc;margin-top:14px;margin-bottom:4px;text-transform:uppercase;font-size:13px;">$1</h3>')
      .replace(/#### (.*?)(<br>)/g, '<h4 style="color:#333;margin-top:10px;margin-bottom:2px;font-size:12px;">$1</h4>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\* (.*?)(<br>)/g, '<li style="margin-bottom:3px;">$1</li>');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportTitle}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #1a202c; }
            h1 { font-size: 18px; color: #0f172a; margin-bottom: 2px; text-transform: uppercase; font-family: monospace; }
            .header-bar { display: flex; justify-content: space-between; border-bottom: 2px solid #0088cc; padding-bottom: 8px; margin-bottom: 16px; }
            .meta { font-size: 11px; color: #64748b; font-family: monospace; }
            .kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
            .kpi-box { border: 1px solid #cbd5e1; padding: 8px 10px; border-radius: 4px; background: #f8fafc; }
            .kpi-lbl { font-size: 9px; color: #64748b; font-weight: bold; text-transform: uppercase; font-family: monospace; }
            .kpi-val { font-size: 16px; font-weight: bold; color: #0f172a; margin-top: 2px; font-family: monospace; }
            .section { margin-bottom: 16px; }
            .section-title { font-size: 12px; font-weight: bold; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; margin-bottom: 8px; font-family: monospace; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; font-family: monospace; }
            th { background: #f1f5f9; text-align: left; padding: 6px; border: 1px solid #cbd5e1; font-weight: bold; }
            td { padding: 5px 6px; border: 1px solid #e2e8f0; }
            .summary-box { background: #f8fafc; border-left: 3px solid #0088cc; padding: 10px 14px; font-size: 11px; line-height: 1.5; border-radius: 0 4px 4px 0; }
            @media print { body { padding: 0; } button { display: none; } }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div>
              <h1>SENTINELAI CYBER DEFENSE COMPLIANCE AUDIT</h1>
              <div class="meta">PERIOD: ${analytics.range_label} | GENERATED: ${generatedTime}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px;font-weight:bold;color:#0088cc;">OFFICIAL SOC REPORT</div>
              <div class="meta">AUTHENTICATED ANALYST BRIEF</div>
            </div>
          </div>

          <div class="kpi-row">
            <div class="kpi-box"><div class="kpi-lbl">TOTAL EVENTS</div><div class="kpi-val">${kpis.total_events.count.toLocaleString()}</div></div>
            <div class="kpi-box"><div class="kpi-lbl">UNIQUE SOURCES</div><div class="kpi-val">${kpis.unique_sources.count.toLocaleString()}</div></div>
            <div class="kpi-box"><div class="kpi-lbl">CRITICAL / HIGH</div><div class="kpi-val">${kpis.critical_high_events.count.toLocaleString()}</div></div>
            <div class="kpi-box"><div class="kpi-lbl">BLOCKED / MITIGATED</div><div class="kpi-val">${kpis.blocked_events.count.toLocaleString()}</div></div>
            <div class="kpi-box"><div class="kpi-lbl">ATTACK TREND</div><div class="kpi-val">${kpis.attack_trend.level}</div></div>
          </div>

          <div class="section">
            <div class="section-title">EXECUTIVE INTELLIGENCE BRIEF</div>
            <div class="summary-box">${summaryText}</div>
          </div>

          <div class="section">
            <div class="section-title">PRIORITY SECURITY INCIDENTS</div>
            <table>
              <thead>
                <tr>
                  <th>SEVERITY</th>
                  <th>TIMESTAMP (UTC)</th>
                  <th>SOURCE IP</th>
                  <th>ATTACK VECTOR</th>
                  <th>TARGET</th>
                  <th>ACTION</th>
                </tr>
              </thead>
              <tbody>
                ${analytics.priority_incidents.map(inc => `
                  <tr>
                    <td style="font-weight:bold;color:${inc.severity === 'CRITICAL' ? '#ff3838' : (inc.severity === 'HIGH' ? '#ff9f1a' : '#0088cc')}">${inc.severity}</td>
                    <td>${inc.timestamp}</td>
                    <td>${inc.source}</td>
                    <td>${inc.attack_type}</td>
                    <td>${inc.target}</td>
                    <td>${inc.action}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div style="margin-top:20px;text-align:center;">
            <button onclick="window.print()" style="padding:8px 16px;background:#0088cc;color:#fff;border:none;border-radius:4px;cursor:pointer;font-family:monospace;font-weight:bold;">PRINT / SAVE AS PDF</button>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleShareReport = () => {
    if (!analytics) return;
    const summary = aiSummary || analytics.deterministic_summary;
    const textToCopy = `SENTINELAI SECURITY REPORT (${analytics.range_label})\nGenerated: ${analytics.last_updated}\n\n` +
      `TOTAL EVENTS: ${analytics.kpis.total_events.count}\n` +
      `UNIQUE SOURCES: ${analytics.kpis.unique_sources.count}\n` +
      `CRITICAL/HIGH: ${analytics.kpis.critical_high_events.count}\n` +
      `BLOCKED: ${analytics.kpis.blocked_events.count}\n` +
      `TREND: ${analytics.kpis.attack_trend.level}\n\n` +
      `BRIEFING:\n${summary.replace(/### /g, '').replace(/#### /g, '')}`;

    navigator.clipboard.writeText(textToCopy);
    showToast('Executive security report briefing copied to clipboard!');
  };

  // Custom Chart Tooltip
  const CustomTimelineTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: '#0a0e17', border: '1px solid #00e5ff', padding: '6px 10px', borderRadius: '4px', fontSize: '10px', fontFamily: 'monospace' }}>
          <div style={{ color: '#00e5ff', fontWeight: 'bold', marginBottom: '3px' }}>{label}</div>
          {payload.map((entry, index) => (
            <div key={`item-${index}`} style={{ color: entry.color, display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <span>{entry.name}:</span>
              <span style={{ fontWeight: 'bold' }}>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading && !analytics) {
    return (
      <div className="reports-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <RefreshCw className="animate-spin text-cyan" size={24} style={{ color: '#00e5ff' }} />
        <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#8b949e', marginTop: '12px' }}>
          Compiling SentinelAI SOC Reporting Analytics...
        </span>
      </div>
    );
  }

  if (error && !analytics) {
    return (
      <div className="reports-container" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <AlertCircle size={32} style={{ color: '#ff3838' }} />
        <span style={{ fontSize: '13px', fontFamily: 'monospace', color: '#ffffff', marginTop: '12px' }}>
          {error}
        </span>
        <button className="reports-control-item btn-report-primary" style={{ marginTop: '14px' }} onClick={() => fetchAnalytics()}>
          <RefreshCw size={12} /> Retry Analytics Load
        </button>
      </div>
    );
  }

  const kpis = analytics?.kpis;
  const sevDist = analytics?.severity_distribution || [];
  const topTypes = analytics?.top_attack_types || [];
  const topSources = analytics?.top_attack_sources || [];
  const priorityIncidents = analytics?.priority_incidents || [];
  const timeline = analytics?.timeline_series || [];

  return (
    <div className="reports-container">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="reports-toast">
          <CheckCircle2 size={14} style={{ color: '#00e5ff' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* TOP HEADER & CONTROLS */}
      <div className="reports-header-row">
        <div className="reports-title-area">
          <h1 className="reports-title">
            <ShieldAlert size={18} />
            SECURITY REPORTS
          </h1>
          <p className="reports-subtitle">
            Analyze security activity, trends, incidents and defensive posture.
          </p>
        </div>

        <div className="reports-controls-area">
          {/* Date Range Selector */}
          <div className="reports-control-item">
            <Calendar size={12} style={{ color: '#00e5ff' }} />
            <select
              className="reports-select"
              value={timeRange}
              onChange={(e) => handleRangeChange(e.target.value)}
            >
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            className="reports-control-item"
            onClick={() => fetchAnalytics(timeRange, startDate, endDate, true)}
            disabled={refreshing}
            title="Refresh analytics data"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} style={{ color: '#00e5ff' }} />
            <span>Refresh</span>
          </button>

          {/* Generate Report Button */}
          <button
            className="reports-control-item btn-report-primary"
            onClick={handleExportPdf}
            title="Generate and print comprehensive security audit PDF"
          >
            <FileText size={12} />
            <span>Generate Report</span>
          </button>

          {/* Last Updated Indicator */}
          <span className="last-updated-badge">
            LAST UPDATED: {analytics?.last_updated || 'RECENT'}
          </span>
        </div>
      </div>

      {/* 5 KPI CARDS IN ONE ROW */}
      <div className="reports-kpi-grid">
        {/* CARD 1: TOTAL SECURITY EVENTS */}
        <div className="report-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">TOTAL SECURITY EVENTS</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(0, 229, 255, 0.15)', color: '#00e5ff' }}>
              <Activity size={13} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{kpis?.total_events?.count?.toLocaleString() || 0}</span>
            <span className={`kpi-trend-pill ${kpis?.total_events?.diff_pct >= 0 ? 'positive' : 'negative'}`}>
              {kpis?.total_events?.diff_pct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(kpis?.total_events?.diff_pct || 0)}% vs prior
            </span>
          </div>
          <MiniSparkline data={kpis?.total_events?.sparkline} color="#00e5ff" />
        </div>

        {/* CARD 2: UNIQUE ATTACK SOURCES */}
        <div className="report-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">UNIQUE ATTACK SOURCES</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(113, 88, 226, 0.15)', color: '#7158e2' }}>
              <Globe size={13} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{kpis?.unique_sources?.count?.toLocaleString() || 0}</span>
            <span className={`kpi-trend-pill ${kpis?.unique_sources?.diff_pct >= 0 ? 'alert' : 'neutral'}`}>
              {kpis?.unique_sources?.diff_pct >= 0 ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
              {Math.abs(kpis?.unique_sources?.diff_pct || 0)}% vs prior
            </span>
          </div>
          <MiniSparkline data={kpis?.unique_sources?.sparkline} color="#7158e2" />
        </div>

        {/* CARD 3: CRITICAL + HIGH EVENTS */}
        <div className="report-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">CRITICAL + HIGH EVENTS</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(255, 56, 56, 0.15)', color: '#ff3838' }}>
              <AlertTriangle size={13} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{kpis?.critical_high_events?.count?.toLocaleString() || 0}</span>
            <span className={`kpi-trend-pill ${kpis?.critical_high_events?.diff_pct > 0 ? 'negative' : 'positive'}`}>
              {kpis?.critical_high_events?.diff_pct > 0 ? <ArrowUpRight size={10} /> : <Minus size={10} />}
              {Math.abs(kpis?.critical_high_events?.diff_pct || 0)}% vs prior
            </span>
          </div>
          <MiniSparkline data={kpis?.critical_high_events?.sparkline} color="#ff3838" />
        </div>

        {/* CARD 4: BLOCKED / MITIGATED */}
        <div className="report-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">BLOCKED / MITIGATED</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(46, 213, 115, 0.15)', color: '#2ed573' }}>
              <ShieldCheck size={13} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value">{kpis?.blocked_events?.count?.toLocaleString() || 0}</span>
            <span className="kpi-trend-pill positive">
              <ArrowUpRight size={10} />
              {Math.abs(kpis?.blocked_events?.diff_pct || 0)}% rate
            </span>
          </div>
          <MiniSparkline data={kpis?.blocked_events?.sparkline} color="#2ed573" />
        </div>

        {/* CARD 5: ATTACK TREND */}
        <div className="report-kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">ATTACK TREND</span>
            <div className="kpi-icon-wrap" style={{ background: 'rgba(255, 159, 26, 0.15)', color: '#ff9f1a' }}>
              <TrendingUp size={13} />
            </div>
          </div>
          <div className="kpi-value-row">
            <span className="kpi-value" style={{ color: '#ffd32a' }}>{kpis?.attack_trend?.level || 'Moderate'}</span>
            <span className="kpi-trend-pill alert" style={{ fontSize: '8.5px' }}>
              {kpis?.attack_trend?.description || 'Nominal velocity'}
            </span>
          </div>
          <MiniSparkline data={kpis?.attack_trend?.sparkline} color="#ff9f1a" />
        </div>
      </div>

      {/* MAIN ANALYTICS ROW (Activity Over Time + Severity Distribution) */}
      <div className="reports-main-analytics-grid">
        {/* LEFT: SECURITY ACTIVITY OVER TIME */}
        <div className="report-card">
          <div className="report-card-header">
            <div className="card-title-group">
              <Activity size={13} style={{ color: '#00e5ff' }} />
              <h2 className="card-title-text">SECURITY ACTIVITY OVER TIME</h2>
            </div>
            <div className="chart-legend-top">
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#00e5ff' }}></span>
                <span>Total Events</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#ff3838' }}></span>
                <span>High Severity</span>
              </div>
              <div className="legend-item">
                <span className="legend-dot" style={{ background: '#2ed573' }}></span>
                <span>Blocked</span>
              </div>
            </div>
          </div>

          <div className="activity-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#00e5ff" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ff3838" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ff3838" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="timestamp"
                  stroke="#4b5563"
                  fontSize={9}
                  tickLine={false}
                  fontFamily="monospace"
                />
                <YAxis
                  stroke="#4b5563"
                  fontSize={9}
                  tickLine={false}
                  fontFamily="monospace"
                  allowDecimals={false}
                />
                <Tooltip content={<CustomTimelineTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total_events"
                  name="Total Events"
                  stroke="#00e5ff"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorTotal)"
                />
                <Line
                  type="monotone"
                  dataKey="high_severity"
                  name="High Severity"
                  stroke="#ff3838"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="blocked_events"
                  name="Blocked Events"
                  stroke="#2ed573"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT: SEVERITY DISTRIBUTION */}
        <div className="report-card">
          <div className="report-card-header">
            <div className="card-title-group">
              <ShieldAlert size={13} style={{ color: '#00e5ff' }} />
              <h2 className="card-title-text">SEVERITY DISTRIBUTION</h2>
            </div>
            <button className="card-action-btn" onClick={() => setShowSeverityModal(true)}>
              <span>View full breakdown</span>
              <ChevronRight size={10} />
            </button>
          </div>

          <div className="severity-donut-layout">
            {/* Donut Pie */}
            <div className="donut-chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sevDist}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={46}
                    outerRadius={68}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {sevDist.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center-badge">
                <span className="donut-center-label">TOTAL</span>
                <span className="donut-center-value">{kpis?.total_events?.count?.toLocaleString() || 0}</span>
              </div>
            </div>

            {/* Severity List */}
            <div className="severity-breakdown-list">
              {sevDist.map((sev) => (
                <div key={sev.name} className="severity-list-row">
                  <div className="severity-list-left">
                    <span className="severity-sq" style={{ background: sev.color }}></span>
                    <span className="severity-name">{sev.name}</span>
                  </div>
                  <div>
                    <span className="severity-count">{sev.count.toLocaleString()}</span>
                    <span className="severity-pct">({sev.percentage}%)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SECOND ANALYTICS ROW (Top Types, Top Sources, Priority Incidents) */}
      <div className="reports-second-analytics-grid">
        {/* PANEL 1: TOP ATTACK TYPES */}
        <div className="report-card">
          <div className="report-card-header">
            <div className="card-title-group">
              <ShieldAlert size={13} style={{ color: '#00e5ff' }} />
              <h3 className="card-title-text">TOP ATTACK TYPES</h3>
            </div>
            <button className="card-action-btn" onClick={() => setShowTypesModal(true)}>
              <span>View all</span>
              <ChevronRight size={10} />
            </button>
          </div>

          <div className="attack-types-list">
            {topTypes.length === 0 ? (
              <div style={{ color: '#8b949e', fontSize: '10px', fontStyle: 'italic', padding: '10px 0' }}>
                No attack signatures observed in this period.
              </div>
            ) : (
              topTypes.map((type) => (
                <div key={type.name} className="attack-type-item">
                  <div className="attack-type-info-row">
                    <span className="attack-type-title" title={type.name}>{type.name}</span>
                    <div className="attack-type-stat">
                      <span className="attack-type-count">{type.count}</span>
                      <span>({type.percentage}%)</span>
                    </div>
                  </div>
                  <div className="attack-type-bar-bg">
                    <div
                      className="attack-type-bar-fill"
                      style={{ width: `${Math.max(type.percentage, 4)}%`, background: type.color }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* PANEL 2: TOP ATTACK SOURCES */}
        <div className="report-card">
          <div className="report-card-header">
            <div className="card-title-group">
              <Globe size={13} style={{ color: '#00e5ff' }} />
              <h3 className="card-title-text">TOP ATTACK SOURCES</h3>
            </div>
            <button className="card-action-btn" onClick={() => navigate('/attackers')}>
              <span>View all sources</span>
              <ChevronRight size={10} />
            </button>
          </div>

          {topSources.length === 0 ? (
            <div style={{ color: '#8b949e', fontSize: '10px', fontStyle: 'italic', padding: '10px 0' }}>
              No threat sources identified in this period.
            </div>
          ) : (
            <table className="reports-compact-table">
              <thead>
                <tr>
                  <th>SOURCE IP</th>
                  <th>EVENTS</th>
                  <th>SEVERITY</th>
                  <th>LAST SEEN</th>
                </tr>
              </thead>
              <tbody>
                {topSources.map((source) => (
                  <tr key={source.source_ip}>
                    <td>
                      <span
                        className="ip-link"
                        onClick={() => navigate(`/agent?enrich_ip=${source.source_ip}`)}
                        title="Analyze IP in AI Assistant"
                      >
                        {source.source_ip}
                      </span>
                    </td>
                    <td style={{ fontWeight: 'bold' }}>{source.event_count}</td>
                    <td>
                      <span className={`badge-sev ${source.highest_severity.toLowerCase()}`}>
                        {source.highest_severity}
                      </span>
                    </td>
                    <td style={{ color: '#8b949e', fontSize: '9px' }}>{source.last_seen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* PANEL 3: PRIORITY INCIDENTS */}
        <div className="report-card">
          <div className="report-card-header">
            <div className="card-title-group">
              <AlertTriangle size={13} style={{ color: '#00e5ff' }} />
              <h3 className="card-title-text">PRIORITY INCIDENTS</h3>
            </div>
            <button className="card-action-btn btn-table-sm" onClick={() => navigate('/incidents')}>
              <span>View All</span>
              <ExternalLink size={10} />
            </button>
          </div>

          {priorityIncidents.length === 0 ? (
            <div style={{ color: '#8b949e', fontSize: '10px', fontStyle: 'italic', padding: '10px 0' }}>
              No priority security incidents flagged in this period.
            </div>
          ) : (
            <table className="reports-compact-table">
              <thead>
                <tr>
                  <th>SEV</th>
                  <th>TIME</th>
                  <th>SOURCE</th>
                  <th>ATTACK TYPE</th>
                  <th>TARGET</th>
                  <th style={{ textAlign: 'right' }}>ACTION</th>
                </tr>
              </thead>
              <tbody>
                {priorityIncidents.map((inc) => (
                  <tr key={`${inc.type}-${inc.id}`}>
                    <td>
                      <span className={`badge-sev ${inc.severity.toLowerCase()}`}>
                        {inc.severity}
                      </span>
                    </td>
                    <td style={{ color: '#8b949e', fontSize: '9px', whiteSpace: 'nowrap' }}>
                      {inc.timestamp.split(' ')[1] || inc.timestamp}
                    </td>
                    <td>
                      <span className="ip-link" onClick={() => navigate(`/agent?enrich_ip=${inc.source}`)}>
                        {inc.source}
                      </span>
                    </td>
                    <td style={{ maxWidth: '110px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={inc.attack_type}>
                      {inc.attack_type}
                    </td>
                    <td style={{ color: '#8b949e' }}>{inc.target}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '4px' }}>
                        <button
                          className="btn-table-icon"
                          onClick={() => setSelectedIncident(inc)}
                          title="View Incident Evidence"
                        >
                          <Eye size={11} />
                        </button>
                        <button
                          className="btn-table-sm"
                          onClick={() => navigate(inc.type === 'incident' ? `/agent?analyze_incident=${inc.id}` : `/agent?analyze_attack=${inc.id}`)}
                          title="Investigate with AI Copilot"
                        >
                          <Cpu size={10} />
                          <span>Investigate</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* BOTTOM ROW (Executive Summary & Report Export) */}
      <div className="reports-bottom-grid">
        {/* LEFT: EXECUTIVE SECURITY SUMMARY */}
        <div className="report-card">
          <div className="report-card-header">
            <div className="card-title-group">
              <Sparkles size={13} style={{ color: '#7158e2' }} />
              <h3 className="card-title-text">EXECUTIVE SECURITY SUMMARY</h3>
              <span className="ai-badge">AI INSIGHTS</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {aiGeneratedAt && (
                <span style={{ fontSize: '9px', color: '#8b949e', fontFamily: 'monospace' }}>
                  Last generated: {aiGeneratedAt}
                </span>
              )}
              <button
                className="btn-table-sm"
                onClick={handleGenerateAiSummary}
                disabled={aiGenerating}
                style={{ background: 'rgba(113, 88, 226, 0.15)', borderColor: '#7158e2', color: '#a29bfe' }}
              >
                <Cpu size={11} className={aiGenerating ? 'animate-spin' : ''} />
                <span>{aiGenerating ? 'Synthesizing with 120B...' : 'Generate AI Summary'}</span>
              </button>
            </div>
          </div>

          <div className="executive-summary-content">
            {aiGenerating ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#00e5ff', fontStyle: 'italic', padding: '16px 0' }}>
                <RefreshCw size={14} className="animate-spin" />
                <span>Synthesizing comprehensive intelligence brief using GPT-OSS 120B...</span>
              </div>
            ) : (
              <div
                dangerouslySetInnerHTML={{
                  __html: (aiSummary || analytics?.deterministic_summary || 'No summary available.')
                    .replace(/\n/g, '<br>')
                    .replace(/### (.*?)(<br>)/g, '<h3>$1</h3>')
                    .replace(/#### (.*?)(<br>)/g, '<h4>$1</h4>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\* (.*?)(<br>)/g, '<li>$1</li>')
                }}
              />
            )}
          </div>
        </div>

        {/* RIGHT: REPORT EXPORT */}
        <div className="report-card">
          <div className="report-card-header">
            <div className="card-title-group">
              <Download size={13} style={{ color: '#00e5ff' }} />
              <h3 className="card-title-text">REPORT EXPORT</h3>
            </div>
            <span style={{ fontSize: '9.5px', color: '#8b949e' }}>Multi-format Compliance Export</span>
          </div>

          <div className="export-controls-grid">
            <p style={{ margin: '0 0 6px 0', fontSize: '10.5px', color: '#8b949e', lineHeight: 1.4 }}>
              Generate, download, or share certified security audit reports containing live KPI telemetry, vector breakdown, and incident logs.
            </p>

            <div className="export-btn-row">
              <button className="btn-export-tile" onClick={handleExportPdf}>
                <FileText size={16} className="export-tile-icon" />
                <span>PDF Report</span>
              </button>
              <button className="btn-export-tile" onClick={handleExportCsv}>
                <FileSpreadsheet size={16} className="export-tile-icon" style={{ color: '#2ed573' }} />
                <span>CSV Export</span>
              </button>
              <button className="btn-export-tile" onClick={handleShareReport}>
                <Share2 size={16} className="export-tile-icon" style={{ color: '#ffd32a' }} />
                <span>Share Report</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* INCIDENT DETAILS DRAWER / MODAL */}
      {selectedIncident && (
        <div className="report-modal-overlay" onClick={() => setSelectedIncident(null)}>
          <div className="report-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4 className="modal-title">
                Security Event Evidence #{selectedIncident.id}
              </h4>
              <button className="modal-close-btn" onClick={() => setSelectedIncident(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body-grid">
              <div className="modal-field-block">
                <span className="modal-field-label">Severity</span>
                <span className="modal-field-value">
                  <span className={`badge-sev ${selectedIncident.severity.toLowerCase()}`}>
                    {selectedIncident.severity}
                  </span>
                </span>
              </div>

              <div className="modal-field-block">
                <span className="modal-field-label">Timestamp (UTC)</span>
                <span className="modal-field-value">{selectedIncident.timestamp}</span>
              </div>

              <div className="modal-field-block">
                <span className="modal-field-label">Source IP</span>
                <span className="modal-field-value" style={{ color: '#00e5ff', fontWeight: 'bold' }}>
                  {selectedIncident.source}
                </span>
              </div>

              <div className="modal-field-block">
                <span className="modal-field-label">Target Asset</span>
                <span className="modal-field-value">{selectedIncident.target}</span>
              </div>

              <div className="modal-field-block" style={{ gridColumn: '1 / -1' }}>
                <span className="modal-field-label">Attack Vector Signature</span>
                <span className="modal-field-value" style={{ color: '#ffd32a' }}>
                  {selectedIncident.attack_type}
                </span>
              </div>

              <div className="modal-field-block" style={{ gridColumn: '1 / -1' }}>
                <span className="modal-field-label">Raw Intercept Payload</span>
                <span className="modal-field-value" style={{ fontFamily: 'monospace', fontSize: '10px', maxHeight: '100px', overflowY: 'auto' }}>
                  {selectedIncident.payload}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-table-sm" onClick={() => setSelectedIncident(null)}>
                Close
              </button>
              <button
                className="btn-table-sm btn-report-primary"
                onClick={() => {
                  const target = selectedIncident.type === 'incident' ? `/agent?analyze_incident=${selectedIncident.id}` : `/agent?analyze_attack=${selectedIncident.id}`;
                  setSelectedIncident(null);
                  navigate(target);
                }}
              >
                <Cpu size={12} />
                <span>Investigate in AI Assistant</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SEVERITY BREAKDOWN MODAL */}
      {showSeverityModal && (
        <div className="report-modal-overlay" onClick={() => setShowSeverityModal(false)}>
          <div className="report-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4 className="modal-title">Comprehensive Severity Classification Matrix</h4>
              <button className="modal-close-btn" onClick={() => setShowSeverityModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={{ fontSize: '11px', color: '#8b949e', margin: 0 }}>
                Breakdown of {kpis?.total_events?.count || 0} events classified by threat impact:
              </p>

              <table className="reports-compact-table">
                <thead>
                  <tr>
                    <th>SEVERITY LEVEL</th>
                    <th>COUNT</th>
                    <th>PERCENTAGE</th>
                    <th>POLICY THRESHOLD</th>
                  </tr>
                </thead>
                <tbody>
                  {sevDist.map((sev) => (
                    <tr key={sev.name}>
                      <td>
                        <span className={`badge-sev ${sev.name.toLowerCase()}`}>{sev.name}</span>
                      </td>
                      <td style={{ fontWeight: 'bold' }}>{sev.count.toLocaleString()}</td>
                      <td>{sev.percentage}%</td>
                      <td style={{ color: '#8b949e' }}>
                        {sev.name === 'Critical' ? 'Immediate SOC escalation & automated containment' :
                         (sev.name === 'High' ? 'WAF rule block & telemetry correlation' :
                          (sev.name === 'Medium' ? 'Honeypot payload tracking' : 'Standard logging'))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-footer">
              <button className="btn-table-sm" onClick={() => setShowSeverityModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ALL ATTACK TYPES MODAL */}
      {showTypesModal && (
        <div className="report-modal-overlay" onClick={() => setShowTypesModal(false)}>
          <div className="report-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4 className="modal-title">Observed Attack Vector Taxonomy</h4>
              <button className="modal-close-btn" onClick={() => setShowTypesModal(false)}>
                <X size={16} />
              </button>
            </div>

            <table className="reports-compact-table">
              <thead>
                <tr>
                  <th>ATTACK VECTOR</th>
                  <th>OBSERVED OCCURRENCES</th>
                  <th>PROPORTION</th>
                </tr>
              </thead>
              <tbody>
                {topTypes.map((t) => (
                  <tr key={t.name}>
                    <td style={{ fontWeight: 'bold', color: '#ffffff' }}>{t.name}</td>
                    <td style={{ color: '#00e5ff' }}>{t.count}</td>
                    <td>{t.percentage}%</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="modal-footer">
              <button className="btn-table-sm" onClick={() => setShowTypesModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM DATE RANGE MODAL */}
      {customModalOpen && (
        <div className="report-modal-overlay" onClick={() => setCustomModalOpen(false)}>
          <div className="report-modal-box" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h4 className="modal-title">Select Custom Date Range</h4>
              <button className="modal-close-btn" onClick={() => setCustomModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="modal-field-block">
                <span className="modal-field-label">Start Date & Time</span>
                <input
                  type="datetime-local"
                  value={customStartInput}
                  onChange={(e) => setCustomStartInput(e.target.value)}
                  style={{
                    background: 'rgba(2, 6, 12, 0.6)',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
              </div>

              <div className="modal-field-block">
                <span className="modal-field-label">End Date & Time</span>
                <input
                  type="datetime-local"
                  value={customEndInput}
                  onChange={(e) => setCustomEndInput(e.target.value)}
                  style={{
                    background: 'rgba(2, 6, 12, 0.6)',
                    border: '1px solid rgba(0, 229, 255, 0.3)',
                    borderRadius: '4px',
                    padding: '8px 10px',
                    color: '#ffffff',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-table-sm" onClick={() => setCustomModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn-table-sm btn-report-primary"
                onClick={handleApplyCustomRange}
                disabled={!customStartInput || !customEndInput}
              >
                Apply Range
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
