import React from 'react';

export default function StatusStrip() {
  const modules = [
    { name: 'FIREWALL', status: 'ONLINE', ledClass: 'led-green' },
    { name: 'HONEYPORTS', status: 'DEPLOYED', ledClass: 'led-green' },
    { name: 'DOCKER RUNTIME', status: 'ONLINE', ledClass: 'led-green' },
    { name: 'AI COGNITION', status: 'CONNECTED', ledClass: 'led-purple' },
    { name: 'SQLITE REGISTRY', status: 'OPTIMAL', ledClass: 'led-green' },
    { name: 'WEBSOCKET STREAM', status: 'LISTENING', ledClass: 'led-green' },
    { name: 'TELEMETRY AGENT', status: 'ACTIVE', ledClass: 'led-green' }
  ];

  return (
    <div className="bottom-command-strip font-mono text-xxs mt-2">
      <div className="strip-header text-muted">PLATFORM STATUS READOUT:</div>
      <div className="strip-modules">
        {modules.map((m, idx) => (
          <div key={idx} className="strip-item">
            <span className={`status-led ${m.ledClass} animate-pulse`}></span>
            <span>{m.name}: <span className={m.ledClass.includes('green') ? 'text-green' : 'text-purple'}>{m.status}</span></span>
          </div>
        ))}
      </div>
    </div>
  );
}
