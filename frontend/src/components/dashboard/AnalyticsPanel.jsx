import React from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, Radar } from 'recharts';

export default function AnalyticsPanel({ stats, totalCount = 1248 }) {
  const severityColors = {
    CRITICAL: '#ff3860',
    HIGH: '#ff9f43',
    MEDIUM: '#ffd32a',
    LOW: '#00ff88',
    INFO: '#38a3a5'
  };

  // Severity Donut Chart data
  const severityPieData = stats?.severity_distribution?.map(item => ({
    name: item.severity,
    value: item.count
  })) || [
    { name: 'CRITICAL', value: 342 },
    { name: 'HIGH', value: 412 },
    { name: 'MEDIUM', value: 298 },
    { name: 'LOW', value: 154 },
    { name: 'INFO', value: 42 }
  ];

  // Top Attack Types horizontal bar data
  const attackTypesData = [
    { name: 'SQL Injection', count: 482 },
    { name: 'XSS Attempts', count: 328 },
    { name: 'Admin Probes', count: 243 },
    { name: 'Brute Force', count: 198 },
    { name: 'File Inclusion', count: 124 }
  ];

  // Sensor Activity radar data
  const sensorRadarData = [
    { subject: 'Active', value: 12 },
    { subject: 'Idle', value: 0 },
    { subject: 'Warning', value: 0 },
    { subject: 'Offline', value: 0 }
  ];

  // Top Attacker IPs list data
  const topIps = [
    { ip: '203.0.113.45', percentage: 92 },
    { ip: '198.51.100.23', percentage: 78 },
    { ip: '192.0.2.78', percentage: 60 },
    { ip: '203.0.113.10', percentage: 48 },
    { ip: '198.51.100.99', percentage: 35 }
  ];

  return (
    <div className="dashboard-column right-analytics-column">
      
      {/* 1. THREAT TREND (24H) */}
      <div className="card-cyber analytics-card-v2">
        <h3 className="chart-title text-cyan">THREAT TREND (24H)</h3>
        <div className="chart-wrapper mt-2">
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={stats?.timeline || [
              { time: '12AM', count: 12 },
              { time: '04AM', count: 25 },
              { time: '08AM', count: 42 },
              { time: '12PM', count: 31 },
              { time: '04PM', count: 56 },
              { time: '08PM', count: 48 }
            ]}>
              <defs>
                <linearGradient id="colorCountV2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00e5ff" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#00e5ff" stopOpacity={0}/>
                </linearGradient>
                <filter id="neonGlowV2" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <XAxis dataKey="time" stroke="#5f748d" fontSize={8} tickLine={false} />
              <YAxis stroke="#5f748d" fontSize={8} tickLine={false} hide />
              <Tooltip 
                contentStyle={{ backgroundColor: 'rgba(6, 14, 28, 0.95)', borderColor: 'rgba(0, 229, 255, 0.25)', color: '#f0f7ff', fontSize: 9 }} 
              />
              <Area type="monotone" dataKey="count" stroke="#00e5ff" strokeWidth={1.5} fillOpacity={1} fill="url(#colorCountV2)" filter="url(#neonGlowV2)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. ATTACKS BY SEVERITY Donut Chart */}
      <div className="card-cyber analytics-card-v2">
        <h3 className="chart-title text-cyan">ATTACKS BY SEVERITY</h3>
        <div className="pie-wrapper mt-2 flex items-center justify-between" style={{ height: '90px' }}>
          <div className="pie-chart-container relative" style={{ width: '90px', height: '90px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={severityPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={28}
                  outerRadius={38}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {severityPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={severityColors[entry.name] || '#5f748d'} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            {/* Center Total label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center font-mono" style={{ pointerEvents: 'none' }}>
              <span className="text-xxs text-muted">TOTAL</span>
              <span className="text-xs font-bold text-cyan" style={{ fontSize: '9px' }}>{totalCount}</span>
            </div>
          </div>
          
          <div className="pie-legend font-mono text-xxs flex-1" style={{ fontSize: '8px', marginLeft: '12px' }}>
            {severityPieData.slice(0, 4).map((entry) => (
              <div key={entry.name} className="legend-item py-0.5" style={{ background: 'none', border: 'none', padding: 0 }}>
                <span className="legend-dot" style={{ backgroundColor: severityColors[entry.name] }}></span>
                <span className="legend-label text-muted" style={{ marginRight: '6px' }}>{entry.name}:</span>
                <span className="legend-value font-bold">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. TOP ATTACK TYPES horizontal bar chart */}
      <div className="card-cyber analytics-card-v2">
        <h3 className="chart-title text-cyan">TOP ATTACK TYPES</h3>
        <div className="chart-wrapper mt-2">
          <ResponsiveContainer width="100%" height={90}>
            <BarChart layout="vertical" data={attackTypesData} margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis dataKey="name" type="category" stroke="#5f748d" fontSize={8} width={65} tickLine={false} />
              <Bar dataKey="count" fill="rgba(155, 92, 255, 0.65)" radius={[0, 3, 3, 0]}>
                {attackTypesData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index % 2 === 0 ? 'var(--purple)' : 'var(--cyan-primary)'} opacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. SENSOR ACTIVITY Radar Chart */}
      <div className="card-cyber analytics-card-v2">
        <h3 className="chart-title text-cyan">SENSOR ACTIVITY</h3>
        <div className="chart-wrapper mt-2">
          <ResponsiveContainer width="100%" height={90}>
            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={sensorRadarData}>
              <PolarGrid stroke="rgba(255, 255, 255, 0.05)" />
              <PolarAngleAxis dataKey="subject" stroke="#5f748d" fontSize={8} />
              <Radar name="Sensors" dataKey="value" stroke="var(--cyan-primary)" fill="rgba(0, 229, 255, 0.2)" fillOpacity={0.6} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 5. TOP ATTACKER IPS progress bars list */}
      <div className="card-cyber analytics-card-v2">
        <h3 className="chart-title text-cyan">TOP ATTACKER IPS</h3>
        <div className="attacker-ips-list font-mono text-xxs mt-2 flex flex-col gap-1.5">
          {topIps.map(item => (
            <div key={item.ip} className="ip-row-v2 flex items-center justify-between">
              <span className="ip-text text-secondary" style={{ fontSize: '8px' }}>{item.ip}</span>
              <div className="progress-bar-v2 flex-1 mx-3" style={{ background: 'rgba(255, 255, 255, 0.03)', height: '4px', borderRadius: '2px', overflow: 'hidden' }}>
                <div className="progress-bar-fill-v2" style={{ background: 'var(--critical-red)', width: `${item.percentage}%`, height: '100%' }}></div>
              </div>
              <span className="ip-percent text-red font-bold" style={{ fontSize: '8px' }}>{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
