import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { ShieldAlert, Radio, Cpu, Clock, Terminal } from 'lucide-react';
import apiClient from '../../api/client';
import './Dashboard.css';

// Animated Number Increment Helper
const AnimatedNumber = ({ value, suffix = "" }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const end = parseFloat(value);
    if (isNaN(end)) {
      setCurrent(value);
      return;
    }
    
    if (end === 0) {
      setCurrent(0);
      return;
    }

    let start = 0;
    const duration = 400; // ms
    const stepTime = Math.max(Math.floor(duration / Math.abs(end)), 15);
    
    const timer = setInterval(() => {
      start += Math.ceil(end / 20);
      if (start >= end) {
        clearInterval(timer);
        setCurrent(end);
      } else {
        setCurrent(start);
      }
    }, stepTime);

    return () => clearInterval(timer);
  }, [value]);

  if (typeof current === 'number' && !Number.isInteger(current)) {
    return <span>{current.toFixed(1)}{suffix}</span>;
  }
  return <span>{current}{suffix}</span>;
};

// Skeleton Loader component matching SOC panels
function DashboardSkeleton() {
  return (
    <div className="dashboard-root skeleton-root">
      <div className="telemetry-cards">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="telemetry-card skeleton-card animate-skeleton" style={{ height: '76px' }}></div>
        ))}
      </div>
      <div className="charts-grid">
        <div className="chart-box card-cyber skeleton-card animate-skeleton" style={{ height: '260px' }}></div>
        <div className="chart-box card-cyber skeleton-card animate-skeleton" style={{ height: '260px' }}></div>
      </div>
      <div className="details-grid">
        <div className="card-cyber details-box skeleton-card animate-skeleton" style={{ height: '250px' }}></div>
        <div className="card-cyber details-box skeleton-card animate-skeleton" style={{ height: '250px' }}></div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [sensorCount, setSensorCount] = useState(0);
  const [recentAttacks, setRecentAttacks] = useState([]);

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const [statsData, metricsData, sensorsData, attacksList] = await Promise.all([
        apiClient.get('/attacks/stats'),
        apiClient.get('/monitoring/current'),
        apiClient.get('/sensors'),
        apiClient.get('/attacks?page_size=5')
      ]);
      
      setStats(statsData);
      setMetrics(metricsData);
      setSensorCount(sensorsData.length);
      setRecentAttacks(attacksList);
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // Real-time efficient background polling refresh every 5 seconds
    const interval = setInterval(() => fetchData(true), 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  if (error && !stats) {
    return <div className="error-state">Error loading SOC metrics: {error}</div>;
  }

  const formatUptime = (sec) => {
    if (!sec) return '0s';
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const severityColors = {
    LOW: '#00ff88',
    MEDIUM: '#ffd32a',
    HIGH: '#ff9f43',
    CRITICAL: '#ff3860'
  };

  const severityPieData = stats?.severity_distribution?.map(item => ({
    name: item.severity,
    value: item.count
  })) || [];

  return (
    <div className="dashboard-root animate-fade-in">
      {/* Top Telemetry row */}
      <div className="telemetry-cards">
        <div className="telemetry-card glow-border">
          <div className="card-header-icon bg-red-dim">
            <ShieldAlert className="text-red" size={20} />
          </div>
          <div className="card-details">
            <span className="card-label">Total Detections</span>
            <span className="card-value text-red">
              <AnimatedNumber value={stats?.total_count || 0} />
            </span>
          </div>
        </div>

        <div className="telemetry-card glow-border">
          <div className="card-header-icon bg-cyan-dim">
            <Radio className="text-cyan pulse" size={20} />
          </div>
          <div className="card-details">
            <span className="card-label">Active Sensors</span>
            <span className="card-value text-cyan">
              <AnimatedNumber value={sensorCount || 0} />
            </span>
          </div>
        </div>

        <div className="telemetry-card glow-border">
          <div className="card-header-icon bg-purple-dim">
            <Cpu className="text-purple" size={20} />
          </div>
          <div className="card-details">
            <span className="card-label">Host CPU / RAM</span>
            <span className="card-value text-purple">
              <AnimatedNumber value={metrics?.cpu_percent || 0} suffix="%" />
              <span className="divider-val"> / </span>
              <AnimatedNumber value={metrics?.memory_percent || 0} suffix="%" />
            </span>
          </div>
        </div>

        <div className="telemetry-card glow-border">
          <div className="card-header-icon bg-blue-dim">
            <Clock className="text-blue" size={20} />
          </div>
          <div className="card-details">
            <span className="card-label">Engine Uptime</span>
            <span className="card-value text-blue">{formatUptime(metrics?.uptime_seconds)}</span>
          </div>
        </div>
      </div>

      {/* Main Charts grid */}
      <div className="charts-grid">
        {/* Timeline Area Chart */}
        <div className="chart-box card-cyber">
          <h3 className="chart-title">Attack Ingestion Timeline</h3>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={stats?.timeline}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="time" stroke="#6b7c9b" fontSize={11} tickLine={false} />
                <YAxis stroke="#6b7c9b" fontSize={11} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#06101f', borderColor: 'rgba(0,212,255,0.2)', color: '#e5f7ff' }} 
                />
                <Area type="monotone" dataKey="count" stroke="#00d4ff" strokeWidth={2} fillOpacity={1} fill="url(#colorCount)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Severity Distribution Pie Chart */}
        <div className="chart-box card-cyber distribution-box">
          <h3 className="chart-title">Severity Distribution</h3>
          <div className="pie-wrapper">
            <div className="pie-chart-container">
              <ResponsiveContainer width="100%" height={150}>
                <PieChart>
                  <Pie
                    data={severityPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={60}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {severityPieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={severityColors[entry.name] || '#6b7c9b'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            <div className="pie-legend font-mono">
              {severityPieData.map((entry, idx) => (
                <div key={entry.name} className="legend-item">
                  <span className="legend-dot" style={{ backgroundColor: severityColors[entry.name] }}></span>
                  <span className="legend-label">{entry.name}:</span>
                  <span className="legend-value"><AnimatedNumber value={entry.value} /></span>
                </div>
              ))}
              {severityPieData.length === 0 && <div className="legend-item text-muted">No telemetry</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Grid: Recent Activity & AI Advisory */}
      <div className="details-grid">
        {/* Recent Events table */}
        <div className="card-cyber details-box">
          <h3 className="chart-title">Real-Time Ingestion Feed</h3>
          <div className="table-responsive">
            <table className="recent-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>IP Address</th>
                  <th>Attack Type</th>
                  <th>Service</th>
                  <th>Severity</th>
                </tr>
              </thead>
              <tbody>
                {recentAttacks.map((attack) => {
                  const isCritical = attack.severity === 'CRITICAL';
                  return (
                    <tr key={attack.id} className={isCritical ? 'critical-pulse-row' : ''}>
                      <td className="font-mono">{new Date(attack.created_at).toLocaleTimeString()}</td>
                      <td className="font-mono">{attack.source_ip}</td>
                      <td className={isCritical ? 'text-red font-bold' : ''}>{attack.attack_type}</td>
                      <td><span className="service-tag font-mono">{attack.target_service}</span></td>
                      <td>
                        <span className={`badge badge-${attack.severity.toLowerCase()}`}>
                          {attack.severity}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {recentAttacks.length === 0 && (
                  <tr>
                    <td colSpan="5" className="text-center text-muted font-mono">No incoming attack signatures detected</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick AI Advisor */}
        <div className="card-cyber details-box ai-advisor-box">
          <div className="ai-advisor-header">
            <Terminal className="text-purple" size={18} />
            <h3 className="chart-title text-purple">AI Incident Analyst</h3>
          </div>
          <div className="ai-advisor-content">
            <p className="ai-quote">
              "System analysis indicates high severity SSH login attempts targeting port 2222. Source IP 192.168.1.102 has initiated multiple dictionary probes. Recommendation: Consider enforcing SSH key authentication and temporary IP blocking."
            </p>
            <div className="ai-advisor-footer">
              <span className="ai-status-pulse"></span>
              <span className="ai-status-label font-mono">LLM Advisory Active</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
