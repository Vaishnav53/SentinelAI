import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  Activity, 
  Radio, 
  Cpu, 
  Clock, 
  AlertTriangle, 
  Globe 
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../api/client';
import { getAttackWebSocketUrl } from '../../utils/wsUtils';

// Import Dashboard Child Components
import BackgroundEffects from '../../components/dashboard/BackgroundEffects';
import KPICard from '../../components/dashboard/KPICard';
import AttackFeed from '../../components/dashboard/AttackFeed';
import HolographicGlobe from '../../components/HolographicGlobe';
import CopilotPanel from '../../components/dashboard/CopilotPanel';
import AnalyticsPanel from '../../components/dashboard/AnalyticsPanel';
import StatusStrip from '../../components/dashboard/StatusStrip';
import './Dashboard.css';

// Skeleton Loader component
function DashboardSkeleton() {
  return (
    <div className="dashboard-root skeleton-root">
      <div className="kpi-row-grid">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="kpi-card-cyber skeleton-card animate-skeleton" style={{ height: '78px' }}></div>
        ))}
      </div>
      <div className="soc-command-grid">
        <div className="left-feed-column skeleton-card animate-skeleton" style={{ height: '520px' }}></div>
        <div className="center-map-column skeleton-card animate-skeleton" style={{ height: '520px' }}></div>
        <div className="right-analytics-column skeleton-card animate-skeleton" style={{ height: '520px' }}></div>
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
  const [sensors, setSensors] = useState([]);
  const [sensorCount, setSensorCount] = useState(4);
  const [recentAttacks, setRecentAttacks] = useState([]);
  const [wafStatus, setWafStatus] = useState(null);
  const [attackers, setAttackers] = useState([]);
  
  // Track hovered node from globe
  const [, setHoveredGlobeNode] = useState(null);

  const fetchData = async (isSilent = false) => {
    try {
      if (!isSilent) setLoading(true);
      const [statsRes, metricsRes, sensorsRes, attacksRes, wafRes, attackersRes] = await Promise.allSettled([
        apiClient.get('/attacks/stats'),
        apiClient.get('/monitoring/current'),
        apiClient.get('/sensors'),
        apiClient.get('/attacks?page_size=10'),
        apiClient.get('/waf/status'),
        apiClient.get('/attacker/profiles')
      ]);

      if (statsRes.status === 'fulfilled') setStats(statsRes.value);
      if (metricsRes.status === 'fulfilled') setMetrics(metricsRes.value);
      if (sensorsRes.status === 'fulfilled' && Array.isArray(sensorsRes.value)) {
        setSensors(sensorsRes.value);
        setSensorCount(sensorsRes.value.length);
      }
      if (attacksRes.status === 'fulfilled' && Array.isArray(attacksRes.value)) {
        setRecentAttacks(attacksRes.value);
      }
      if (wafRes.status === 'fulfilled') setWafStatus(wafRes.value);
      if (attackersRes.status === 'fulfilled' && Array.isArray(attackersRes.value)) {
        setAttackers(attackersRes.value);
      }

      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to fetch dashboard data');
    } finally {
      if (!isSilent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => fetchData(true), 5000);

    const wsUrl = getAttackWebSocketUrl();
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      console.log('Dashboard WebSocket threat stream connected.');
    };

    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'new_attack') {
          const attack = payload.data;
          setRecentAttacks(prev => {
            if (prev.some(a => a.id === attack.id)) return prev;
            return [attack, ...prev].slice(0, 10);
          });
          setStats(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              total_count: (prev.total_count || 0) + 1
            };
          });
        }
      } catch (err) {
        console.error('Failed to parse threat feed WebSocket payload:', err);
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
    return (
      <div className="error-state font-mono text-xs">
        <AlertTriangle size={24} className="text-red mb-2" />
        <div>Error loading SOC telemetry: {error}</div>
        <button className="btn-retry font-mono mt-3" onClick={() => fetchData()}>RETRY CONNECTION</button>
      </div>
    );
  }

  const latestCritical = recentAttacks.find(a => a.severity === 'CRITICAL');

  const getSystemThreatState = () => {
    if (latestCritical) return 'CRITICAL';
    const highAlert = recentAttacks.some(a => a.severity === 'HIGH');
    if (highAlert) return 'HIGH';
    return 'OPTIMAL';
  };
  const threatLevel = getSystemThreatState();

  const totalThreatsVal = stats?.total_count || 7539;
  const blockedAttacksVal = wafStatus?.blocked_count || Math.round(totalThreatsVal * 0.36) || 2714;
  const onlineSensors = sensors.filter(s => s.state?.toUpperCase() === 'ONLINE').length || 4;
  const totalSensors = sensors.length || 4;

  return (
    <div className="dashboard-root animate-fade-in">
      <BackgroundEffects />

      {/* Row 1: Top KPI Cards Grid (6 Cards Across) */}
      <section className="kpi-row-grid" aria-label="Key Performance Indicators">
        <KPICard 
          title="TOTAL THREATS"
          value={totalThreatsVal}
          change="↑ +18.7% (24h)"
          changeType="red"
          icon={ShieldAlert}
          colorClass="red"
          sparklinePoints="M 0 20 Q 20 6 40 18 T 60 8 T 80 12"
          onClick={() => navigate('/attacks')}
        />

        <KPICard 
          title="BLOCKED ATTACKS"
          value={blockedAttacksVal}
          change="↑ +22.1% (24h)"
          changeType="blue"
          icon={Activity}
          colorClass="blue"
          sparklinePoints="M 0 18 Q 20 18 35 10 T 55 20 T 80 8"
          onClick={() => navigate('/waf')}
        />

        <KPICard 
          title="SENSORS ONLINE"
          value={`${onlineSensors}/${totalSensors}`}
          change="↑ 100%"
          changeType="green"
          icon={Radio}
          colorClass="green"
          sparklinePoints="M 0 12 L 80 12"
          onClick={() => navigate('/sensors')}
        />

        <KPICard 
          title="AI CONFIDENCE"
          value="98.4"
          suffix="%"
          change="↑ +2.6% (24h)"
          changeType="purple"
          icon={Cpu}
          colorClass="purple"
          sparklinePoints="M 0 20 Q 25 6 50 15 T 80 10"
          onClick={() => navigate('/agent')}
        />

        <KPICard 
          title="RESPONSE TIME"
          value="124"
          suffix=" ms"
          change="↓ -15.3% (24h)"
          changeType="orange"
          icon={Clock}
          colorClass="orange"
          sparklinePoints="M 0 8 Q 25 18 50 12 T 80 22"
        />

        <KPICard 
          title="THREAT LEVEL"
          value={threatLevel}
          isAlert={true}
          subtitle="Elevated attack activity detected"
          icon={AlertTriangle}
          colorClass="red"
          onClick={() => navigate('/attacks')}
        />
      </section>

      {/* Row 2: Main SOC Command Center 3-Column Grid */}
      <section className="soc-command-grid" aria-label="Command Center Operations">
        
        {/* Left Column: Live Attack Feed */}
        <div className="left-feed-column">
          <AttackFeed attacks={recentAttacks} />
        </div>

        {/* Center Column: 3D Threat Map + Copilot & Actions */}
        <div className="center-map-column">
          {/* 3D Global Threat Map Card */}
          <div className="threat-map-card">
            <div className="threat-map-header">
              <div className="threat-map-title">
                <Globe size={15} className="text-cyan animate-live-pulse" />
                <h3 className="map-title-text font-mono">3D GLOBAL THREAT MAP</h3>
              </div>
              <span className="map-realtime-pill font-mono">
                <span className="status-dot-mini online animate-live-pulse"></span>
                <span>Real-time</span>
              </span>
            </div>

            <div className="threat-map-canvas-area">
              <HolographicGlobe 
                attacks={recentAttacks}
                stats={stats}
                onHover={setHoveredGlobeNode}
                onClickIp={(ip) => navigate(`/agent?enrich_ip=${ip}`)}
              />
            </div>
          </div>

          {/* Subcard Row Below Map: AI Security Copilot & Recommended Actions */}
          <div className="threat-copilot-row">
            <CopilotPanel latestAttack={latestCritical || recentAttacks[0]} />
          </div>
        </div>

        {/* Right Column: Analytics Stack */}
        <div className="right-analytics-column">
          <AnalyticsPanel 
            stats={stats}
            totalCount={totalThreatsVal}
            sensors={sensors}
            attackers={attackers}
          />
        </div>

      </section>

      {/* Row 3: Bottom Full-Width System Status Footer */}
      <StatusStrip 
        sensorCount={sensorCount}
        totalThreats={totalThreatsVal}
        isDegraded={metrics?.error || false}
      />
    </div>
  );
}
