import React, { useState, useEffect } from 'react';
import { ShieldAlert, Radio, Activity, Cpu, Compass, Clock, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';

// Import Reusable Dashboard Components
import BackgroundEffects from '../../components/dashboard/BackgroundEffects';
import StatusRibbon from '../../components/dashboard/StatusRibbon';
import KPICard from '../../components/dashboard/KPICard';
import AttackFeed from '../../components/dashboard/AttackFeed';
import HolographicGlobe from '../../components/HolographicGlobe';
import CopilotPanel from '../../components/dashboard/CopilotPanel';
import AnalyticsPanel from '../../components/dashboard/AnalyticsPanel';
import StatusStrip from '../../components/dashboard/StatusStrip';
import './Dashboard.css';

// Skeleton Loader component matching V2 layout
function DashboardSkeleton() {
  return (
    <div className="dashboard-root skeleton-root">
      <div className="telemetry-cards">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="telemetry-card skeleton-card animate-skeleton" style={{ height: '76px' }}></div>
        ))}
      </div>
      <div className="dashboard-grid-layout command-center-v2">
        <div className="dashboard-column event-feed-v2 skeleton-card animate-skeleton" style={{ height: '400px' }}></div>
        <div className="centerpiece-globe-v2 skeleton-card animate-skeleton" style={{ height: '400px' }}></div>
        <div className="dashboard-column right-analytics-column skeleton-card animate-skeleton" style={{ height: '400px' }}></div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [sensorCount, setSensorCount] = useState(0);
  const [recentAttacks, setRecentAttacks] = useState([]);
  
  // Track hovered node coordinates from globe
  const [hoveredGlobeNode, setHoveredGlobeNode] = useState(null);

  // Dynamic status bar DOM injection side effects (CPU, RAM monitor & Quick Actions)
  useEffect(() => {
    const sidebar = document.querySelector('.sidebar');
    if (!sidebar) return;

    // Add V2 progress metrics
    let statusPanel = document.getElementById('sidebar-status-panel-v2');
    if (!statusPanel) {
      statusPanel = document.createElement('div');
      statusPanel.id = 'sidebar-status-panel-v2';
      statusPanel.className = 'sidebar-status-panel-v2 font-mono';
      statusPanel.innerHTML = `
        <div class="status-title-v2">SYSTEM MONITOR:</div>
        <div class="sys-row-v2">
          <span>CPU:</span>
          <div class="bar-v2"><div class="fill-v2 bg-cyan" style="width: 67%"></div></div>
          <span>67%</span>
        </div>
        <div class="sys-row-v2">
          <span>RAM:</span>
          <div class="bar-v2"><div class="fill-v2 bg-purple" style="width: 59%"></div></div>
          <span>59%</span>
        </div>
        <div class="sys-row-v2">
          <span>DISK:</span>
          <div class="bar-v2"><div class="fill-v2 bg-blue" style="width: 42%"></div></div>
          <span>42%</span>
        </div>
        <div class="sys-row-v2">
          <span>NET:</span>
          <div class="bar-v2"><div class="fill-v2 bg-green" style="width: 75%"></div></div>
          <span>128M</span>
        </div>
      `;
      const footer = sidebar.querySelector('.sidebar-footer');
      if (footer) {
        sidebar.insertBefore(statusPanel, footer);
      }
    }

    // Add V2 Quick Actions triggers
    let actionsPanel = document.getElementById('sidebar-actions-panel-v2');
    if (!actionsPanel) {
      actionsPanel = document.createElement('div');
      actionsPanel.id = 'sidebar-actions-panel-v2';
      actionsPanel.className = 'sidebar-actions-panel-v2 font-mono';
      
      const title = document.createElement('div');
      title.className = 'actions-title-v2';
      title.innerText = 'QUICK ACTIONS:';
      actionsPanel.appendChild(title);

      const btn1 = document.createElement('button');
      btn1.className = 'act-btn btn-cyan';
      btn1.innerText = 'RUN THREAT SCAN';
      btn1.onclick = () => alert('SOC Threat Scan initiated on target assets...');
      actionsPanel.appendChild(btn1);

      const btn2 = document.createElement('button');
      btn2.className = 'act-btn btn-purple';
      btn2.innerText = 'DEPLOY HONEYPOT';
      btn2.onclick = () => alert('Decoy honeyports configuration updated.');
      actionsPanel.appendChild(btn2);

      const btn3 = document.createElement('button');
      btn3.className = 'act-btn btn-blue';
      btn3.innerText = 'GENERATE REPORT';
      btn3.onclick = () => alert('Compiling telemetry incident logs...');
      actionsPanel.appendChild(btn3);

      const btn4 = document.createElement('button');
      btn4.className = 'act-btn btn-red';
      btn4.innerText = 'EMERGENCY LOCKDOWN';
      btn4.onclick = () => alert('ALERT: Quarantine containment forced globally!');
      actionsPanel.appendChild(btn4);

      const footer = sidebar.querySelector('.sidebar-footer');
      if (footer) {
        sidebar.insertBefore(actionsPanel, footer);
      }
    }

    // Cleanup on dashboard screen unmount
    return () => {
      const sp = document.getElementById('sidebar-status-panel-v2');
      if (sp) sp.remove();
      const ap = document.getElementById('sidebar-actions-panel-v2');
      if (ap) ap.remove();
    };
  }, []);

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const [statsData, metricsData, sensorsData, attacksList] = await Promise.all([
        apiClient.get('/attacks/stats'),
        apiClient.get('/monitoring/current'),
        apiClient.get('/sensors'),
        apiClient.get('/attacks?page_size=6')
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
    // Real-time background data sync polling
    const interval = setInterval(() => fetchData(true), 5000);
    
    // Connect to backend WebSocket threat stream on port 8000
    const wsUrl = `ws://${window.location.hostname || '127.0.0.1'}:8000/api/attacks/ws`;
    const socket = new WebSocket(wsUrl);
    
    socket.onopen = () => {
      console.log('Dashboard WebSocket threat stream connected.');
    };
    
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'new_attack') {
          const attack = payload.data;
          
          // Prepend new attack to feed list (limiting to 6 items to match UI constraints)
          setRecentAttacks(prev => {
            if (prev.some(a => a.id === attack.id)) return prev;
            return [attack, ...prev].slice(0, 6);
          });
          
          // Increment total stats counters live
          setStats(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              total_count: prev.total_count + 1
            };
          });
        }
      } catch (err) {
        console.error('Failed to parse dynamic threat feed WebSocket payload:', err);
      }
    };
    
    return () => {
      clearInterval(interval);
      socket.close();
    };
  }, []);

  if (loading && !stats) {
    return <DashboardSkeleton />;
  }

  if (error && !stats) {
    return <div className="error-state">Error loading SOC metrics: {error}</div>;
  }

  const latestCritical = recentAttacks.find(a => a.severity === 'CRITICAL');

  // Calculate dynamic threat index level based on ingested signals
  const getSystemThreatState = () => {
    if (latestCritical) return 'CRITICAL';
    const highAlert = recentAttacks.some(a => a.severity === 'HIGH');
    if (highAlert) return 'HIGH';
    return 'OPTIMAL';
  };
  const threatLevel = getSystemThreatState();

  return (
    <div className="command-center-scale-wrapper">
      <BackgroundEffects />
      <div className="command-center-scale">
        <div className="command-center-inner">
          <div className="dashboard-root viewport-fixed-height animate-fade-in">
            
            {/* Dynamic Critical Alert Banner */}
            {latestCritical && (
              <div className="critical-alert-banner animate-glow-critical">
                <div className="alert-content font-mono">
                  <ShieldAlert size={15} className="text-red pulse" />
                  <span>
                    <strong className="text-red">CRITICAL THREAT INGESTION:</strong> {latestCritical.attack_type} from IP {latestCritical.source_ip}
                  </span>
                </div>
                <button 
                  className="btn-alert-action font-mono text-xxs"
                  onClick={() => navigate(`/agent?analyze_attack=${latestCritical.id}`)}
                >
                  MITIGATE WITH COPILOT →
                </button>
              </div>
            )}

            {/* 1. Top status ribbon */}
            <StatusRibbon uptimeSecs={metrics?.uptime_seconds} threatLevel={threatLevel} />

            {/* 3. Top KPI cards row */}
            <div className="telemetry-cards">
              <KPICard 
                title="Total Threats" 
                value={stats?.total_count || 24532} 
                change="+18.7% (24h)" 
                changeType="green" 
                icon={ShieldAlert} 
                colorClass="red"
                sparklinePoints="M 0 22 Q 20 8 40 18 T 80 5 T 100 12"
              />
              <KPICard 
                title="Blocked Attacks" 
                value={Math.round((stats?.total_count || 24532) * 0.36) || 8746} 
                change="+21.3% (24h)" 
                changeType="green" 
                icon={Activity} 
                colorClass="cyan"
                sparklinePoints="M 0 15 L 20 15 L 40 5 L 60 25 L 80 15 L 100 15"
              />
              <KPICard 
                title="Sensors Online" 
                value={sensorCount || 12} 
                change="12/12 ACTIVE" 
                changeType="green" 
                icon={Radio} 
                colorClass="green"
                sparklinePoints="M 0 10 H 100"
              />
              <KPICard 
                title="AI Confidence" 
                value={98.4} 
                change="+2.6% (24h)" 
                changeType="purple" 
                icon={Cpu} 
                colorClass="purple"
                sparklinePoints="M 0 20 Q 25 5 50 15 T 100 10"
              />
              <KPICard 
                title="Response Time" 
                value={124} 
                change="+12% (24h)" 
                changeType="orange" 
                icon={Clock} 
                colorClass="orange"
                sparklinePoints="M 0 5 L 30 15 L 60 8 L 100 22"
              />
              <KPICard 
                title="Incidents Today" 
                value={243} 
                change="+15.2% (24h)" 
                changeType="red" 
                icon={AlertTriangle} 
                colorClass="red"
                sparklinePoints="M 0 25 L 25 20 L 50 25 L 75 10 L 100 15"
              />
            </div>

            {/* 4. Main content columns grid */}
            <div className="dashboard-grid-layout command-center-v2">
              
              {/* Left Column: live event feed cards */}
              <AttackFeed attacks={recentAttacks} />

              {/* Center Column: Main globe interactive centerpiece */}
              <div className="radar-visualization-card card-cyber centerpiece-globe-v2">
                <div className="radar-card-header">
                  <Compass className="text-cyan animate-pulse" size={14} />
                  <h3 className="chart-title text-cyan">3D GLOBAL THREAT MAP</h3>
                  <div className="radar-status-badge font-mono text-xxs">MAP_ROTATING</div>
                </div>
                
                <div className="globe-viewport-row flex-1 flex relative">
                  <div className="radar-svg-container flex-1">
                    <HolographicGlobe 
                      attacks={recentAttacks} 
                      onHover={setHoveredGlobeNode} 
                      onClickIp={(ip) => navigate(`/agent?enrich_ip=${ip}`)}
                    />
                  </div>

                  {/* Target HUD hover info panel overlay on the right side of globe */}
                  {hoveredGlobeNode && (
                    <div className="absolute right-3 top-3 glass-hud-target-overlay font-mono text-xxs animate-fade-in">
                      <div className="hud-title text-cyan border-bottom pb-1 mb-1">TARGET DETECTED</div>
                      <div>IP: <span className="text-white">{hoveredGlobeNode.ip}</span></div>
                      <div>LOC: <span className="text-white">{hoveredGlobeNode.country}</span></div>
                      <div>TYPE: <span className="text-white">{hoveredGlobeNode.type}</span></div>
                      <div>SEV: <span className="text-red font-bold">{hoveredGlobeNode.severity}</span></div>
                    </div>
                  )}
                </div>

                <div className="radar-telemetry-metrics font-mono text-xxs text-muted mt-2 border-top pt-2">
                  <div className="metric-row">
                    <span>ROTATION: <span className="text-cyan">AUTO</span></span>
                    <span>COORDINATES: <span className="text-cyan">3D_SPHERICAL</span></span>
                  </div>
                </div>
                
                {/* AI Security Copilot & Recommended Actions rows below globe centerpiece */}
                <CopilotPanel latestAttack={latestCritical || recentAttacks[0]} />
              </div>

              {/* Right Column: lower analytics panels */}
              <AnalyticsPanel stats={stats} totalCount={stats?.total_count || 1248} />

            </div>

            {/* 5. Bottom mission strip */}
            <StatusStrip />

          </div>
        </div>
      </div>
    </div>
  );
}
