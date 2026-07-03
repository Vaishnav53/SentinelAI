import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export default function StatusRibbon({ uptimeSecs = 0, threatLevel = 'OPTIMAL' }) {
  const [liveTime, setLiveTime] = useState('');
  const [liveDate, setLiveDate] = useState('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setLiveTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      
      const options = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
      setLiveDate(now.toLocaleDateString('en-US', options));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatUptime = (sec) => {
    if (!sec) return '14h 22m'; // fallback default from blueprint
    const hrs = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    return `${hrs}h ${mins}m`;
  };

  const getThreatColor = () => {
    if (threatLevel === 'CRITICAL') return 'var(--critical-red)';
    if (threatLevel === 'HIGH' || threatLevel === 'ELEVATED') return 'var(--orange)';
    return 'var(--green)';
  };

  return (
    <div className="top-status-ribbon font-mono text-xxs">
      <div className="ribbon-block">
        <span className="status-led led-green animate-pulse"></span>
        <span>CORE SYSTEM: <span className="text-green">ONLINE</span></span>
      </div>
      <div className="ribbon-block">
        <span className="status-led led-purple animate-pulse"></span>
        <span>AI ENGINE: <span className="text-purple">ACTIVE</span></span>
      </div>
      <div className="ribbon-block">
        <span className="status-led led-green animate-pulse"></span>
        <span>SENSORS ONLINE: <span className="text-green">ACTIVE</span></span>
      </div>
      <div className="ribbon-block">
        <span className="status-led led-green animate-pulse"></span>
        <span>DECOY NETWORK: <span className="text-green">ACTIVE</span></span>
      </div>
      <div className="ribbon-block">
        <span>UPTIME: <span className="text-cyan">{formatUptime(uptimeSecs)}</span></span>
      </div>
      <div className="ribbon-block threat-indicator-block" style={{ borderColor: getThreatColor() }}>
        <span>THREAT LEVEL: <span style={{ color: getThreatColor() }}>{threatLevel}</span></span>
      </div>
      <div className="ribbon-block ms-auto timer-clock">
        <Clock size={11} className="text-cyan" />
        <span>{liveTime} <span className="divider-val">|</span> {liveDate}</span>
      </div>
    </div>
  );
}
