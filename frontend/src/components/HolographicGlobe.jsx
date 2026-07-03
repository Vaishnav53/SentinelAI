import React, { useRef, useEffect, useState } from 'react';
import { Shield, Globe, Cpu } from 'lucide-react';

const countryCoords = {
  'United States': { lat: 37.0902, lon: -95.7129, code: 'US' },
  'China': { lat: 35.8617, lon: 104.1954, code: 'CN' },
  'Germany': { lat: 51.1657, lon: 10.4515, code: 'DE' },
  'India': { lat: 20.5937, lon: 78.9629, code: 'IN' },
  'Russia': { lat: 61.5240, lon: 105.3188, code: 'RU' },
  'Netherlands': { lat: 52.1326, lon: 5.2913, code: 'NL' },
  'Singapore': { lat: 1.3521, lon: 103.8198, code: 'SG' },
  'Brazil': { lat: -14.2350, lon: -51.9253, code: 'BR' },
  'Canada': { lat: 56.1304, lon: -106.3468, code: 'CA' },
  'Australia': { lat: -25.2744, lon: 133.7751, code: 'AU' },
  'United Kingdom': { lat: 55.3781, lon: -3.4360, code: 'GB' },
  'France': { lat: 46.2276, lon: 2.2137, code: 'FR' },
  'Japan': { lat: 36.2048, lon: 138.2529, code: 'JP' },
  'South Africa': { lat: -30.5595, lon: 22.9375, code: 'ZA' }
};

const getCountryCoords = (countryName) => {
  if (!countryName) return { lat: 0, lon: 0, code: 'UN' };
  if (countryCoords[countryName]) return countryCoords[countryName];
  // Check for ISO codes or partial matches
  for (const [key, val] of Object.entries(countryCoords)) {
    if (key.toLowerCase() === countryName.toLowerCase() || val.code === countryName.toUpperCase()) {
      return val;
    }
  }
  // Deterministic hash fallback
  let hash = 0;
  for (let i = 0; i < countryName.length; i++) {
    hash = countryName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const lat = (hash % 60); // -60 to 60
  const lon = (hash % 120); // -120 to 120
  return { lat, lon, code: countryName.substring(0, 2).toUpperCase() };
};

const latLonToVector3 = (lat, lon, radius) => {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta)
  };
};

const rotateY = (point, angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.z * sin,
    y: point.y,
    z: point.x * sin + point.z * cos
  };
};

const rotateX = (point, angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x,
    y: point.y * cos - point.z * sin,
    z: point.y * sin + point.z * cos
  };
};

const project = (point, width, height, scaleFactor = 1.0) => {
  const distance = 280;
  const scale = (distance / (distance + point.z)) * scaleFactor;
  return {
    x: width / 2 + point.x * scale,
    y: height / 2 + point.y * scale,
    z: point.z,
    scale
  };
};

const getSeverityColor = (severity) => {
  switch (severity) {
    case 'CRITICAL': return '#ff3366';
    case 'HIGH': return '#ff9f43';
    case 'MEDIUM': return '#ffd32a';
    case 'LOW': default: return '#00ff88';
  }
};

export default function HolographicGlobe({ attacks = [], onHover, onClickIp }) {
  const canvasRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const mouseRef = useRef({ x: -1000, y: -1000, lastX: 0, lastY: 0 });
  const rotationRef = useRef({ x: 0.3, y: 0.5, vx: 0.005, vy: 0.005 });
  const zoomScaleRef = useRef(1.0);
  const hoveredNodeRef = useRef(null);
  const radarSweepAngle = useRef(0);
  
  // Track animated keys to prevent processing duplicates
  const processedAttackIds = useRef(new Set());
  
  // High performance visual elements state container (Avoids React re-renders)
  const animStateRef = useRef({
    arcs: [],       // { id, p1, pControl, p2, color, progress, speed, duration, createdAt, severity }
    packets: [],    // { p1, pControl, p2, color, progress, speed, trail: [] }
    markers: [],    // { x, y, z, color, progress, maxRadius, severity, details }
    highlights: []  // { lat, lon, color, opacity, maxOpacity, decay }
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener('resize', resize);

    const latLines = 7;
    const lonLines = 12;
    const radius = 90;

    // Generate wireframe sphere coordinates
    const spherePoints = [];
    for (let i = 1; i < latLines; i++) {
      const lat = (Math.PI * i) / latLines;
      const ring = [];
      for (let j = 0; j < lonLines; j++) {
        const lon = (2 * Math.PI * j) / lonLines;
        ring.push({
          x: radius * Math.sin(lat) * Math.cos(lon),
          y: radius * Math.cos(lat),
          z: radius * Math.sin(lat) * Math.sin(lon)
        });
      }
      spherePoints.push(ring);
    }

    // Generate orbiting ring points
    const orbitPoints = [];
    const orbitPoints2 = [];
    const orbitPoints3 = [];
    const starPoints = [];
    const orbitRadius = 120;
    const orbitCount = 60;
    for (let i = 0; i < orbitCount; i++) {
      const angle = (2 * Math.PI * i) / orbitCount;
      const px = orbitRadius * Math.cos(angle);
      const pz = orbitRadius * Math.sin(angle);
      const tiltZ = 20 * Math.PI / 180;
      const tiltX = 15 * Math.PI / 180;
      
      let x = px * Math.cos(tiltZ);
      let y = px * Math.sin(tiltZ);
      let z = pz;
      
      const cosX = Math.cos(tiltX);
      const sinX = Math.sin(tiltX);
      orbitPoints.push({
        x: x,
        y: y * cosX - z * sinX,
        z: y * sinX + z * cosX
      });

      const tiltZ2 = -30 * Math.PI / 180;
      const tiltX2 = -25 * Math.PI / 180;
      let x2 = px * Math.cos(tiltZ2);
      let y2 = px * Math.sin(tiltZ2);
      let z2 = pz;
      orbitPoints2.push({
        x: x2,
        y: y2 * Math.cos(tiltX2) - z2 * Math.sin(tiltX2),
        z: y2 * Math.sin(tiltX2) + z2 * Math.cos(tiltX2)
      });

      const tiltZ3 = 45 * Math.PI / 180;
      const tiltX3 = -40 * Math.PI / 180;
      let x3 = px * Math.cos(tiltZ3);
      let y3 = px * Math.sin(tiltZ3);
      let z3 = pz;
      orbitPoints3.push({
        x: x3,
        y: y3 * Math.cos(tiltX3) - z3 * Math.sin(tiltX3),
        z: y3 * Math.sin(tiltX3) + z3 * Math.cos(tiltX3)
      });
    }

    // Generate floating star points
    for (let i = 0; i < 25; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const dist = radius * 1.05 + Math.random() * 20;
      starPoints.push({
        x: dist * Math.sin(phi) * Math.cos(theta),
        y: dist * Math.cos(phi),
        z: dist * Math.sin(phi) * Math.sin(theta),
        size: 0.5 + Math.random() * 1.0,
        color: Math.random() > 0.4 ? 'rgba(0, 229, 255, 0.45)' : 'rgba(155, 92, 255, 0.45)'
      });
    }

    // Process new incoming attacks into animation objects dynamically
    const instantiateAttackVisuals = (attack) => {
      const srcStr = attack.country || 'United States';
      
      // Determine destination target coordinates based on sensor_id
      let destStr = 'Netherlands';
      if (attack.sensor_id && attack.sensor_id.includes('SSH')) {
        destStr = 'United States';
      } else if (attack.sensor_id && attack.sensor_id.includes('HTTP')) {
        destStr = 'Germany';
      } else if (attack.sensor_id && attack.sensor_id.includes('FTP')) {
        destStr = 'Singapore';
      }
      
      let srcGeo = getCountryCoords(srcStr);
      if (attack.raw_metadata) {
        try {
          const meta = typeof attack.raw_metadata === 'string' ? JSON.parse(attack.raw_metadata) : attack.raw_metadata;
          if (meta && typeof meta.latitude === 'number' && typeof meta.longitude === 'number' && (meta.latitude !== 0 || meta.longitude !== 0)) {
            srcGeo = { lat: meta.latitude, lon: meta.longitude, code: srcGeo.code };
          }
        } catch (e) {
          // Silent fallback
        }
      }

      const destGeo = getCountryCoords(destStr);
      
      const p1 = latLonToVector3(srcGeo.lat, srcGeo.lon, radius);
      const p2 = latLonToVector3(destGeo.lat, destGeo.lon, radius);
      
      // Compute radially extended Bezier control point to lift arc off the sphere
      const mid = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2,
        z: (p1.z + p2.z) / 2
      };
      const len = Math.sqrt(mid.x * mid.x + mid.y * mid.y + mid.z * mid.z);
      let pControl = { x: 0, y: 0, z: 0 };
      if (len > 0) {
        const factor = (radius * 1.4) / len;
        pControl = {
          x: mid.x * factor,
          y: mid.y * factor,
          z: mid.z * factor
        };
      }
      
      const color = getSeverityColor(attack.severity);
      
      // Push Arc Animation
      animStateRef.current.arcs.push({
        id: attack.id,
        p1,
        pControl,
        p2,
        color,
        createdAt: Date.now(),
        duration: 5000,
        severity: attack.severity
      });
      
      // Push Packet Animation
      animStateRef.current.packets.push({
        p1,
        pControl,
        p2,
        color,
        progress: 0,
        speed: 0.015 + Math.random() * 0.01,
        trail: [],
        severity: attack.severity,
        targetGeo: destGeo,
        details: {
          id: attack.id,
          ip: attack.source_ip,
          country: srcStr,
          city: attack.city || 'Telemetry Node',
          type: attack.attack_type,
          threat_score: attack.threat_score || 5.0,
          severity: attack.severity,
          confidence: attack.confidence || 0.90,
          timestamp: new Date().toLocaleTimeString()
        }
      });
    };

    // Listen to incoming attacks list updates
    attacks.forEach(attack => {
      if (!processedAttackIds.current.has(attack.id)) {
        processedAttackIds.current.add(attack.id);
        instantiateAttackVisuals(attack);
      }
    });

    // Render loop
    const render = () => {
      const w = canvas.width / window.devicePixelRatio;
      const h = canvas.height / window.devicePixelRatio;
      ctx.clearRect(0, 0, w, h);

      // Manual inertia application
      if (!isDragging) {
        rotationRef.current.y += rotationRef.current.vy;
        rotationRef.current.x += rotationRef.current.vx;
        rotationRef.current.vx *= 0.98;
        rotationRef.current.vy *= 0.98;
        if (Math.abs(rotationRef.current.vy) < 0.002) rotationRef.current.vy = 0.002;
        if (Math.abs(rotationRef.current.vx) < 0.001) rotationRef.current.vx = 0.001;
      } else {
        rotationRef.current.vy *= 0.95;
        rotationRef.current.vx *= 0.95;
      }

      const rx = rotationRef.current.x;
      const ry = rotationRef.current.y;
      const zs = zoomScaleRef.current;

      // Glow indicators & Radial Gradients
      const grad = ctx.createRadialGradient(w / 2, h / 2, 5, w / 2, h / 2, radius * 1.45 * zs);
      grad.addColorStop(0, 'rgba(155, 92, 255, 0.08)');
      grad.addColorStop(0.5, 'rgba(0, 229, 255, 0.04)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, radius * 1.45 * zs, 0, 2 * Math.PI);
      ctx.fill();

      // Concentric circles
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, radius * 1.15 * zs, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, radius * 0.95 * zs, 0, 2 * Math.PI);
      ctx.stroke();

      // Outer Ticks Compass Rim
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, radius * 1.35 * zs, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
      for (let i = 0; i < 360; i += 30) {
        const radAngle = (i * Math.PI) / 180;
        const outerR = radius * 1.35 * zs;
        const innerR = radius * (i % 90 === 0 ? 1.28 : 1.32) * zs;
        ctx.beginPath();
        ctx.moveTo(w / 2 + innerR * Math.cos(radAngle), h / 2 + innerR * Math.sin(radAngle));
        ctx.lineTo(w / 2 + outerR * Math.cos(radAngle), h / 2 + outerR * Math.sin(radAngle));
        ctx.stroke();
      }

      // Compass text markers
      ctx.fillStyle = 'rgba(0, 229, 255, 0.4)';
      ctx.font = `${6 * Math.max(0.8, zs)}px var(--font-mono)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('N', w / 2, h / 2 - radius * 1.42 * zs);
      ctx.fillText('S', w / 2, h / 2 + radius * 1.42 * zs);
      ctx.fillText('W', w / 2 - radius * 1.42 * zs, h / 2);
      ctx.fillText('E', w / 2 + radius * 1.42 * zs, h / 2);

      // Orbit Ring 1
      ctx.beginPath();
      orbitPoints.forEach((pt, idx) => {
        const rotated = rotateX(rotateY(pt, ry), rx);
        const proj = project(rotated, w, h, zs);
        if (idx === 0) ctx.moveTo(proj.x, proj.y);
        else ctx.lineTo(proj.x, proj.y);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.16)';
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Latitude Rings
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
      ctx.lineWidth = 0.5;
      spherePoints.forEach(ring => {
        ctx.beginPath();
        ring.forEach((pt, idx) => {
          const rotated = rotateX(rotateY(pt, ry), rx);
          const proj = project(rotated, w, h, zs);
          if (rotated.z < 25) {
            if (idx === 0) ctx.moveTo(proj.x, proj.y);
            else ctx.lineTo(proj.x, proj.y);
          }
        });
        ctx.closePath();
        ctx.stroke();
      });

      // Longitude Rings
      const ringSize = spherePoints[0].length;
      for (let j = 0; j < ringSize; j++) {
        ctx.beginPath();
        for (let i = 0; i < spherePoints.length; i++) {
          const pt = spherePoints[i][j];
          const rotated = rotateX(rotateY(pt, ry), rx);
          const proj = project(rotated, w, h, zs);
          if (rotated.z < 25) {
            if (i === 0) ctx.moveTo(proj.x, proj.y);
            else ctx.lineTo(proj.x, proj.y);
          }
        }
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.04)';
        ctx.stroke();
      }

      // Space stars background
      starPoints.forEach(pt => {
        const rotated = rotateX(rotateY(pt, ry), rx);
        const proj = project(rotated, w, h, zs);
        if (proj.scale > 0.4) {
          ctx.fillStyle = pt.color;
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, pt.size * proj.scale, 0, 2 * Math.PI);
          ctx.fill();
        }
      });

      // Radar sweep
      radarSweepAngle.current = (radarSweepAngle.current + 0.005) % (2 * Math.PI);
      const sweepOuterR = radius * 1.35 * zs;
      const sweepRad = radarSweepAngle.current;
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(w / 2, h / 2);
      ctx.lineTo(w / 2 + sweepOuterR * Math.cos(sweepRad), h / 2 + sweepOuterR * Math.sin(sweepRad));
      ctx.stroke();

      // --- ANIMATION: Arcs ---
      const now = Date.now();
      animStateRef.current.arcs = animStateRef.current.arcs.filter(arc => {
        const age = now - arc.createdAt;
        const progress = age / arc.duration;
        if (progress >= 1.0) return false; // Expired, remove
        
        const r1 = rotateX(rotateY(arc.p1, ry), rx);
        const rControl = rotateX(rotateY(arc.pControl, ry), rx);
        const r2 = rotateX(rotateY(arc.p2, ry), rx);
        
        const p1 = project(r1, w, h, zs);
        const pControl = project(rControl, w, h, zs);
        const p2 = project(r2, w, h, zs);
        
        // Draw the quadratic arc
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.quadraticCurveTo(pControl.x, pControl.y, p2.x, p2.y);
        
        // Fade out arc as it ages
        const alpha = Math.max(0, 1 - progress);
        ctx.strokeStyle = arc.color + Math.round(alpha * 255).toString(16).padStart(2, '0');
        ctx.lineWidth = 1.2;
        ctx.stroke();
        
        return true;
      });

      // --- ANIMATION: Packets ---
      animStateRef.current.packets = animStateRef.current.packets.filter(pkt => {
        pkt.progress += pkt.speed;
        if (pkt.progress >= 1.0) {
          // Packet reached destination target! Spawn pulsing marker & country illumination highlight
          animStateRef.current.markers.push({
            x: pkt.p2.x,
            y: pkt.p2.y,
            z: pkt.p2.z,
            color: pkt.color,
            progress: 0,
            maxRadius: 28,
            severity: pkt.severity,
            details: pkt.details
          });
          
          animStateRef.current.highlights.push({
            lat: pkt.targetGeo.lat,
            lon: pkt.targetGeo.lon,
            color: pkt.color,
            opacity: 1.0,
            decay: 0.02
          });
          return false;
        }

        const r1 = rotateX(rotateY(pkt.p1, ry), rx);
        const rControl = rotateX(rotateY(pkt.pControl, ry), rx);
        const r2 = rotateX(rotateY(pkt.p2, ry), rx);
        
        const p1 = project(r1, w, h, zs);
        const pControl = project(rControl, w, h, zs);
        const p2 = project(r2, w, h, zs);
        
        // Quadratic Bezier interpolation formula
        const u = 1 - pkt.progress;
        const t = pkt.progress;
        const tx = u * u * p1.x + 2 * u * t * pControl.x + t * t * p2.x;
        const ty = u * u * p1.y + 2 * u * t * pControl.y + t * t * p2.y;
        
        // Push trail position history
        pkt.trail.push({ x: tx, y: ty });
        if (pkt.trail.length > 8) pkt.trail.shift();
        
        // Draw trailing dots
        pkt.trail.forEach((pos, idx) => {
          const trailAlpha = (idx + 1) / pkt.trail.length * 0.7;
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, 1.2, 0, 2 * Math.PI);
          ctx.fillStyle = pkt.color + Math.round(trailAlpha * 255).toString(16).padStart(2, '0');
          ctx.fill();
        });
        
        // Draw main packet head
        ctx.beginPath();
        ctx.arc(tx, ty, 3.0, 0, 2 * Math.PI);
        ctx.fillStyle = pkt.color;
        ctx.shadowColor = pkt.color;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        return true;
      });

      // --- ANIMATION: Highlights ---
      animStateRef.current.highlights = animStateRef.current.highlights.filter(hl => {
        hl.opacity -= hl.decay;
        if (hl.opacity <= 0) return false;
        
        const vec = latLonToVector3(hl.lat, hl.lon, radius);
        const rotated = rotateX(rotateY(vec, ry), rx);
        const proj = project(rotated, w, h, zs);
        
        if (rotated.z < 25) {
          ctx.fillStyle = hl.color + Math.round(hl.opacity * 60).toString(16).padStart(2, '0');
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, 25 * proj.scale, 0, 2 * Math.PI);
          ctx.fill();
        }
        return true;
      });

      // --- RENDER & HOVER: Threat Markers / Clusters ---
      let hoveredNode = null;
      const mouseX = mouseRef.current.x;
      const mouseY = mouseRef.current.y;

      // Group/Cluster threat markers by target destination if Zoom is low
      const isClustered = zs < 1.3;
      const markersToDraw = [];

      if (isClustered) {
        // Group markers that target nearby locations
        const clusters = {};
        animStateRef.current.markers.forEach(m => {
          // Identify node key from target vectors
          const key = `${m.x.toFixed(1)}_${m.y.toFixed(1)}_${m.z.toFixed(1)}`;
          if (!clusters[key]) {
            clusters[key] = {
              x: m.x,
              y: m.y,
              z: m.z,
              color: m.color,
              count: 0,
              highestSeverity: 'LOW',
              maxProgress: 0,
              items: []
            };
          }
          clusters[key].count += 1;
          clusters[key].maxProgress = Math.max(clusters[key].maxProgress, m.progress);
          clusters[key].items.push(m);
          
          const severitiesRank = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
          if (severitiesRank[m.severity] > severitiesRank[clusters[key].highestSeverity]) {
            clusters[key].highestSeverity = m.severity;
            clusters[key].color = m.color;
          }
        });

        Object.values(clusters).forEach(c => {
          markersToDraw.push({
            x: c.x,
            y: c.y,
            z: c.z,
            color: c.color,
            progress: c.maxProgress,
            maxRadius: 28,
            isCluster: true,
            count: c.count,
            highestSeverity: c.highestSeverity,
            items: c.items,
            details: c.items[c.items.length - 1].details // Use latest details for hover info
          });
        });
      } else {
        // Render individually when zoomed in
        animStateRef.current.markers.forEach((m, idx) => {
          // Add small longitude coordinate jitter offset to separate overlapping nodes
          const jitter = (idx * 1.5) % 8 - 4;
          const rotatedVec = rotateX(rotateY({ x: m.x, y: m.y, z: m.z }, ry), rx);
          markersToDraw.push({
            x: m.x,
            y: m.y + jitter,
            z: m.z,
            color: m.color,
            progress: m.progress,
            maxRadius: 28,
            isCluster: false,
            details: m.details,
            originalIndex: idx
          });
        });
      }

      // Age markers progress
      animStateRef.current.markers.forEach(m => {
        m.progress += 0.008;
      });
      // Remove expired markers
      animStateRef.current.markers = animStateRef.current.markers.filter(m => m.progress < 1.0);

      // Render actual projected markers/clusters
      markersToDraw.forEach(m => {
        const rotated = rotateX(rotateY({ x: m.x, y: m.y, z: m.z }, ry), rx);
        const proj = project(rotated, w, h, zs);
        
        if (rotated.z < 25) {
          const scale = proj.scale;
          const pulse = (m.progress * 2) % 1.0;
          
          // Hover logic
          const dist = Math.hypot(mouseX - proj.x, mouseY - proj.y);
          const isHovered = dist < 12;
          if (isHovered) {
            hoveredNode = m;
          }

          // Draw pulsing outer ring
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, (4 + pulse * m.maxRadius) * scale, 0, 2 * Math.PI);
          ctx.strokeStyle = m.color + Math.round((1 - pulse) * 255).toString(16).padStart(2, '0');
          ctx.lineWidth = 1.2;
          ctx.stroke();

          // Draw solid core
          ctx.beginPath();
          ctx.arc(proj.x, proj.y, 4.5 * scale, 0, 2 * Math.PI);
          ctx.fillStyle = m.color;
          ctx.fill();

          // Cluster badge count
          if (m.isCluster && m.count > 1) {
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${8 * Math.max(0.7, scale)}px var(--font-mono)`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(m.count, proj.x, proj.y);
          }
          
          // Direct label indicator
          ctx.fillStyle = m.color;
          ctx.font = `${6.5 * Math.max(0.8, scale)}px var(--font-mono)`;
          ctx.textAlign = 'left';
          
          const labelText = m.isCluster 
            ? `CLUSTER:${m.count}_ATTACKS` 
            : `THREAT:${m.details.ip}`;
            
          ctx.fillText(labelText, proj.x + 8, proj.y - 3);
        }
      });

      // Show canvas floating HUD tooltip for hovered nodes
      if (hoveredNode) {
        const rotated = rotateX(rotateY({ x: hoveredNode.x, y: hoveredNode.y, z: hoveredNode.z }, ry), rx);
        const proj = project(rotated, w, h, zs);
        
        const details = hoveredNode.details;
        const cardColor = hoveredNode.color;

        ctx.fillStyle = 'rgba(4, 9, 20, 0.95)';
        ctx.strokeStyle = cardColor;
        ctx.lineWidth = 1;
        
        const boxW = 125;
        const boxH = 92;
        
        // Draw card bounds ensuring no viewport cutoff
        const boxX = proj.x + 12 + boxW > w ? proj.x - boxW - 12 : proj.x + 12;
        const boxY = proj.y - 45;
        
        ctx.fillRect(boxX, boxY, boxW, boxH);
        ctx.strokeRect(boxX, boxY, boxW, boxH);

        // Tooltip detail metrics
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 7px var(--font-mono)';
        ctx.textAlign = 'left';
        
        if (hoveredNode.isCluster) {
          ctx.fillText(`CLUSTER: ${hoveredNode.count} EVENTS`, boxX + 6, boxY + 10);
          ctx.fillText(`MAX SEV: ${hoveredNode.highestSeverity}`, boxX + 6, boxY + 20);
        }
        
        ctx.fillText(`IP: ${details.ip}`, boxX + 6, boxY + 30);
        ctx.fillText(`LOC: ${details.country} (${details.city})`, boxX + 6, boxY + 40);
        ctx.fillText(`TYPE: ${details.type}`, boxX + 6, boxY + 50);
        ctx.fillText(`SCORE: ${details.threat_score}`, boxX + 6, boxY + 60);
        ctx.fillText(`SEV: ${details.severity}`, boxX + 6, boxY + 70);
        ctx.fillText(`CONF: ${(details.confidence * 100).toFixed(0)}%`, boxX + 6, boxY + 80);
        ctx.fillText(`TIME: ${details.timestamp}`, boxX + 6, boxY + 88);
      }

      // Bubble up hovered state changes
      if (onHover && hoveredNodeRef.current?.id !== hoveredNode?.details?.id) {
        hoveredNodeRef.current = hoveredNode ? hoveredNode.details : null;
        onHover(hoveredNodeRef.current);
      }

      // Map dynamic metrics in the overlay
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [attacks, isDragging, onHover]);

  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    mouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      lastX: e.clientX - rect.left,
      lastY: e.clientY - rect.top
    };
    setIsDragging(true);
  };

  const handleMouseMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    mouseRef.current.x = x;
    mouseRef.current.y = y;

    if (!isDragging) return;

    const dx = x - mouseRef.current.lastX;
    const dy = y - mouseRef.current.lastY;

    rotationRef.current.y += dx * 0.005;
    rotationRef.current.x += dy * 0.005;

    mouseRef.current.lastX = x;
    mouseRef.current.lastY = y;
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    mouseRef.current.x = -1000;
    mouseRef.current.y = -1000;
  };

  // Canvas zoom interaction scroll wheel hook
  const handleWheel = (e) => {
    zoomScaleRef.current = Math.min(Math.max(zoomScaleRef.current - e.deltaY * 0.001, 0.5), 2.5);
  };

  // Canvas double-click callback handler to reset orientation and zoom
  const handleDoubleClick = () => {
    rotationRef.current = { x: 0.3, y: 0.5, vx: 0.005, vy: 0.005 };
    zoomScaleRef.current = 1.0;
  };

  // Click on threat marker to invoke Threat Intelligence panel
  const handleCanvasClick = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Find closest projected threat marker
    const w = canvasRef.current.width / window.devicePixelRatio;
    const h = canvasRef.current.height / window.devicePixelRatio;
    const rx = rotationRef.current.x;
    const ry = rotationRef.current.y;
    const zs = zoomScaleRef.current;
    
    let clickedNode = null;
    let minDistance = 14; // Must click within 14px of marker
    
    animStateRef.current.markers.forEach(m => {
      const rotated = rotateX(rotateY({ x: m.x, y: m.y, z: m.z }, ry), rx);
      const proj = project(rotated, w, h, zs);
      
      if (rotated.z < 25) {
        const dist = Math.hypot(clickX - proj.x, clickY - proj.y);
        if (dist < minDistance) {
          minDistance = dist;
          clickedNode = m;
        }
      }
    });
    
    if (clickedNode && clickedNode.details && onClickIp) {
      onClickIp(clickedNode.details.ip);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', cursor: isDragging ? 'grabbing' : 'grab' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        onClick={handleCanvasClick}
      />
    </div>
  );
}
