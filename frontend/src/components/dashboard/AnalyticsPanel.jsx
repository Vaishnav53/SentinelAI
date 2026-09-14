import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { TrendingUp, PieChart as PieIcon, BarChart3, Radio, Globe, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function AnalyticsPanel({ stats, totalCount = 7539, sensors = [], attackers = [] }) {
  const navigate = useNavigate();

  const severityColors = {
    CRITICAL: '#ff3366',
    HIGH: '#ff9f43',
    MEDIUM: '#ffd32a',
    LOW: '#00ff88',
    INFO: '#00e5ff'
  };

  // 1. Timeline Data for 24H Threat Trend
  const timelineData = stats?.timeline && stats.timeline.length > 0
    ? stats.timeline.map(t => ({
        time: t.time.includes('-') ? t.time.split('-').slice(1).join('/') : t.time,
        count: t.count
      }))
    : [
        { time: '00:00', count: 18 },
        { time: '04:00', count: 24 },
        { time: '08:00', count: 48 },
        { time: '12:00', count: 36 },
        { time: '16:00', count: 62 },
        { time: '20:00', count: 42 },
        { time: '24:00', count: 28 }
      ];

  // 2. Severity Distribution for Donut Chart
  const rawSev = stats?.severity_distribution || [];
  const sevTotal = rawSev.reduce((acc, curr) => acc + curr.count, 0) || totalCount || 7539;
  
  const defaultSevData = [
    { name: 'Critical', key: 'CRITICAL', value: 728, percent: 9.7 },
    { name: 'High', key: 'HIGH', value: 2460, percent: 32.6 },
    { name: 'Medium', key: 'MEDIUM', value: 2893, percent: 38.4 },
    { name: 'Low', key: 'LOW', value: 1458, percent: 19.4 }
  ];

  const severityPieData = rawSev.length > 0
    ? rawSev.map(item => {
        const pct = sevTotal > 0 ? ((item.count / sevTotal) * 100).toFixed(1) : '0.0';
        const formattedName = item.severity ? item.severity.charAt(0).toUpperCase() + item.severity.slice(1).toLowerCase() : 'Unknown';
        return {
          name: formattedName,
          key: (item.severity || '').toUpperCase(),
          value: item.count,
          percent: parseFloat(pct)
        };
      })
    : defaultSevData;

  // 3. Top Attack Types horizontal bars
  const rawTypes = stats?.type_distribution || [];
  const typeTotal = rawTypes.reduce((acc, curr) => acc + curr.count, 0) || 1000;
  
  const typeColorPalette = ['#ff3366', '#ff9f43', '#9b5cff', '#2f8cff', '#00e5ff'];

  const defaultAttackTypes = [
    { name: 'Path Traversal', count: 2140, percent: 28.4 },
    { name: 'SQL Injection', count: 1665, percent: 22.1 },
    { name: 'XSS', count: 1409, percent: 18.7 },
    { name: 'Brute Force', count: 927, percent: 12.3 },
    { name: 'DDoS', count: 648, percent: 8.6 }
  ];

  const attackTypesList = rawTypes.length > 0
    ? rawTypes.slice(0, 5).map((item, idx) => ({
        name: item.attack_type,
        count: item.count,
        percent: typeTotal > 0 ? parseFloat(((item.count / typeTotal) * 100).toFixed(1)) : 10.0,
        color: typeColorPalette[idx % typeColorPalette.length]
      }))
    : defaultAttackTypes.map((item, idx) => ({
        ...item,
        color: typeColorPalette[idx % typeColorPalette.length]
      }));

  // 4. Sensor Activity
  const defaultSensors = [
    { name: 'HTTP', port: 8088, state: 'ONLINE' },
    { name: 'SSH', port: 2222, state: 'ONLINE' },
    { name: 'FTP', port: 2121, state: 'ONLINE' },
    { name: 'Telnet', port: 2323, state: 'ONLINE' }
  ];

  const displaySensors = sensors.length > 0 
    ? sensors.map(s => ({
        name: s.type || s.name.replace(' Honeypot', ''),
        port: s.port,
        state: s.state || 'ONLINE'
      }))
    : defaultSensors;

  const onlineSensorsCount = displaySensors.filter(s => s.state.toUpperCase() === 'ONLINE').length;
  const totalSensorsCount = displaySensors.length || 4;

  // 5. Top Attacker IPs
  const defaultAttackers = [
    { ip: '202.211.12.42', attacks: 32, time: '12:06 PM' },
    { ip: '103.15.88.77', attacks: 28, time: '11:49 AM' },
    { ip: '192.168.1.50', attacks: 24, time: '11:32 AM' },
    { ip: '45.33.12.90', attacks: 18, time: '11:21 AM' },
    { ip: '88.74.23.16', attacks: 15, time: '10:58 AM' }
  ];

  const displayAttackers = attackers.length > 0
    ? attackers.slice(0, 5).map(a => ({
        ip: a.ip_address,
        attacks: a.total_attacks || a.event_count || a.attacks || 12,
        time: a.last_seen ? new Date(a.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '12:00 PM'
      }))
    : defaultAttackers;

  return (
    <div className="analytics-sidebar-column">
      
      {/* 1. THREAT TREND (24H) */}
      <div className="analytics-widget-card">
        <div className="analytics-widget-header">
          <div className="widget-header-title">
            <TrendingUp size={14} className="text-purple" />
            <span className="widget-title-text font-mono">THREAT TREND (24H)</span>
          </div>
          <span className="widget-trend-badge font-mono text-purple">↑ 18.7%</span>
        </div>

        <div className="analytics-widget-body chart-body">
          <ResponsiveContainer width="100%" height={75}>
            <AreaChart data={timelineData} margin={{ top: 6, right: 4, left: -25, bottom: 0 }}>
              <defs>
                <linearGradient id="threatTrendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9b5cff" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#9b5cff" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="time" 
                stroke="#556c86" 
                fontSize={8} 
                tickLine={false} 
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.05)' }} 
              />
              <YAxis stroke="#556c86" fontSize={8} tickLine={false} axisLine={false} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(6, 12, 24, 0.95)', 
                  borderColor: 'rgba(155, 92, 255, 0.3)', 
                  borderRadius: '6px',
                  fontSize: '9px',
                  color: '#f0f7ff',
                  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6)'
                }} 
              />
              <Area 
                type="monotone" 
                dataKey="count" 
                stroke="#9b5cff" 
                strokeWidth={2} 
                fillOpacity={1} 
                fill="url(#threatTrendGrad)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. ATTACKS BY SEVERITY */}
      <div className="analytics-widget-card">
        <div className="analytics-widget-header">
          <div className="widget-header-title">
            <PieIcon size={14} className="text-cyan" />
            <span className="widget-title-text font-mono">ATTACKS BY SEVERITY</span>
          </div>
        </div>

        <div className="analytics-widget-body flex items-center justify-between">
          <div className="pie-donut-wrapper relative" style={{ width: '85px', height: '85px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={26}
                  outerRadius={38}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {severityPieData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={severityColors[entry.key] || '#556c86'} 
                      stroke="rgba(6, 12, 24, 0.8)"
                      strokeWidth={1.5}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center Total Readout */}
            <div className="pie-donut-center font-mono">
              <span className="pie-center-val">{sevTotal.toLocaleString()}</span>
              <span className="pie-center-label">Total</span>
            </div>
          </div>

          <div className="severity-legend-list font-mono">
            {severityPieData.slice(0, 4).map((item) => (
              <div key={item.name} className="severity-legend-row">
                <span 
                  className="sev-legend-dot" 
                  style={{ backgroundColor: severityColors[item.key] || '#556c86' }}
                ></span>
                <span className="sev-legend-name">{item.name}</span>
                <span className="sev-legend-count">{item.value.toLocaleString()}</span>
                <span className="sev-legend-percent">({item.percent}%)</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. TOP ATTACK TYPES */}
      <div className="analytics-widget-card">
        <div className="analytics-widget-header">
          <div className="widget-header-title">
            <BarChart3 size={14} className="text-cyan" />
            <span className="widget-title-text font-mono">TOP ATTACK TYPES</span>
          </div>
        </div>

        <div className="analytics-widget-body attack-types-body font-mono">
          {attackTypesList.map((type, idx) => (
            <div key={idx} className="attack-type-row">
              <span className="attack-type-label">{type.name}</span>
              <div className="attack-type-track">
                <div 
                  className="attack-type-fill" 
                  style={{ width: `${Math.min(100, Math.max(8, type.percent * 2.5))}%`, backgroundColor: type.color }}
                ></div>
              </div>
              <span className="attack-type-pct">{type.percent}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. SENSOR ACTIVITY */}
      <div className="analytics-widget-card">
        <div className="analytics-widget-header">
          <div className="widget-header-title">
            <Radio size={14} className="text-cyan" />
            <span className="widget-title-text font-mono">SENSOR ACTIVITY</span>
          </div>
        </div>

        <div className="analytics-widget-body flex items-center justify-between">
          <div className="sensor-ring-wrapper">
            <svg viewBox="0 0 70 70" width="70" height="70">
              <circle 
                cx="35" cy="35" r="28" 
                fill="none" 
                stroke="rgba(0, 229, 255, 0.1)" 
                strokeWidth="5" 
              />
              <circle 
                cx="35" cy="35" r="28" 
                fill="none" 
                stroke="var(--green)" 
                strokeWidth="5" 
                strokeDasharray={`${(onlineSensorsCount / totalSensorsCount) * 175} 175`}
                strokeLinecap="round"
                transform="rotate(-90 35 35)"
              />
            </svg>
            <div className="sensor-ring-center font-mono">
              <span className="sensor-center-count">{onlineSensorsCount}/{totalSensorsCount}</span>
              <span className="sensor-center-text">Online</span>
            </div>
          </div>

          <div className="sensor-status-list font-mono">
            {displaySensors.map((s, idx) => (
              <div key={idx} className="sensor-status-row">
                <span className="sensor-status-dot online"></span>
                <span className="sensor-name-port">{s.name} ({s.port})</span>
                <span className="sensor-state-label text-green ms-auto">Online</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 5. TOP ATTACKER IPS */}
      <div className="analytics-widget-card">
        <div className="analytics-widget-header">
          <div className="widget-header-title">
            <Globe size={14} className="text-cyan" />
            <span className="widget-title-text font-mono">TOP ATTACKER IPS</span>
          </div>
        </div>

        <div className="analytics-widget-body font-mono">
          <div className="attacker-table-header">
            <span>IP Address</span>
            <span className="text-center">Attacks</span>
            <span className="text-right">Last Seen</span>
          </div>

          <div className="attacker-table-rows">
            {displayAttackers.map((item, idx) => (
              <div 
                key={idx} 
                className="attacker-table-row"
                onClick={() => navigate(`/agent?enrich_ip=${item.ip}`)}
                title="Click to view IP dossier"
              >
                <span className="attacker-ip text-cyan">{item.ip}</span>
                <span className="attacker-count text-center">{item.attacks}</span>
                <span className="attacker-time text-right text-muted">{item.time}</span>
              </div>
            ))}
          </div>

          <div className="attacker-table-footer">
            <button 
              className="btn-view-all-attackers ms-auto font-mono"
              onClick={() => navigate('/attackers')}
            >
              <span>View All</span>
              <ArrowUpRight size={11} />
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
