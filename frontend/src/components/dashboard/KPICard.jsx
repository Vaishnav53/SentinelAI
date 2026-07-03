import React, { useState, useEffect } from 'react';

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

export default function KPICard({ title, value, change, changeType, icon: Icon, colorClass, sparklinePoints }) {
  const getChangeColor = () => {
    if (changeType === 'green') return 'var(--green)';
    if (changeType === 'purple') return 'var(--purple)';
    if (changeType === 'orange') return 'var(--orange)';
    if (changeType === 'red') return 'var(--critical-red)';
    return 'var(--text-muted)';
  };

  const getLedColor = () => {
    if (colorClass === 'red') return 'var(--critical-red)';
    if (colorClass === 'green') return 'var(--green)';
    if (colorClass === 'purple') return 'var(--purple)';
    if (colorClass === 'orange') return 'var(--orange)';
    return 'var(--cyan-primary)';
  };

  return (
    <div className={`telemetry-card glow-border kpi-v2 ${colorClass || ''}`}>
      <div className="card-top-glow"></div>
      <div className="glass-reflection"></div>
      <div className={`card-header-icon bg-${colorClass || 'cyan'}-dim`}>
        <Icon size={18} />
      </div>
      <div className="card-details">
        <span className="card-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className="card-status-led animate-pulse" style={{ backgroundColor: getLedColor(), boxShadow: `0 0 5px ${getLedColor()}` }}></span>
          {title}
        </span>
        <span className="card-value">
          <AnimatedNumber value={value} />
        </span>
        {change && (
          <span className="card-change font-mono" style={{ color: getChangeColor() }}>
            {change}
          </span>
        )}
      </div>
      {sparklinePoints && (
        <div className="kpi-sparkline ms-auto">
          <svg viewBox="0 0 100 30" width="70" height="20">
            <path d={sparklinePoints} fill="none" stroke={`var(--${colorClass || 'cyan-primary'})`} strokeWidth="1.5" />
          </svg>
        </div>
      )}
    </div>
  );
}
