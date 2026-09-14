import React, { useState, useEffect } from 'react';
import { ArrowRight } from 'lucide-react';

// Animated Number Increment Helper
const AnimatedNumber = ({ value, suffix = "" }) => {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (typeof value === 'string' && isNaN(Number(value))) {
      setCurrent(value);
      return;
    }
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
    const duration = 400;
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

  if (typeof current === 'number') {
    if (!Number.isInteger(current)) {
      return <span>{current.toFixed(1).toLocaleString()}{suffix}</span>;
    }
    return <span>{current.toLocaleString()}{suffix}</span>;
  }
  return <span>{current}{suffix}</span>;
};

export default function KPICard({ 
  title, 
  value, 
  suffix = "", 
  change, 
  changeType = "cyan", 
  icon: Icon, 
  colorClass = "cyan", 
  sparklinePoints, 
  isAlert = false,
  subtitle = "",
  onClick
}) {
  const colorMap = {
    red: '#ff3366',
    blue: '#2f8cff',
    cyan: '#00e5ff',
    green: '#00ff88',
    purple: '#9b5cff',
    orange: '#ff9f43'
  };

  const accentColor = colorMap[colorClass] || colorMap.cyan;

  return (
    <div 
      className={`kpi-card-cyber ${colorClass} ${isAlert ? 'kpi-card-alert' : ''}`}
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
    >
      <div className="kpi-card-inner">
        <div className="kpi-icon-box" style={{ backgroundColor: `${accentColor}16`, borderColor: `${accentColor}35` }}>
          <Icon size={18} style={{ color: accentColor }} />
        </div>

        <div className="kpi-content-stack">
          <div className="kpi-title font-mono">{title}</div>
          <div className="kpi-value-row">
            <span className={`kpi-main-val ${isAlert ? 'val-alert' : ''}`} style={isAlert ? { color: accentColor } : {}}>
              <AnimatedNumber value={value} suffix={suffix} />
            </span>
          </div>
          {isAlert ? (
            <div className="kpi-subtitle-text">{subtitle}</div>
          ) : (
            change && (
              <div className="kpi-trend-row font-mono">
                <span className="kpi-trend-val" style={{ color: colorMap[changeType] || accentColor }}>
                  {change}
                </span>
              </div>
            )
          )}
        </div>

        {sparklinePoints && !isAlert && (
          <div className="kpi-sparkline-box ms-auto">
            <svg viewBox="0 0 80 28" width="68" height="24">
              <defs>
                <linearGradient id={`grad-${colorClass}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={accentColor} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={accentColor} stopOpacity="1" />
                </linearGradient>
              </defs>
              <path 
                d={sparklinePoints} 
                fill="none" 
                stroke={`url(#grad-${colorClass})`} 
                strokeWidth="2" 
                strokeLinecap="round" 
              />
            </svg>
          </div>
        )}

        {isAlert && (
          <div className="kpi-alert-arrow ms-auto">
            <ArrowRight size={16} style={{ color: accentColor }} />
          </div>
        )}
      </div>
    </div>
  );
}
