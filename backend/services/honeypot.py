import threading
import logging
import http.server
import urllib.parse
import re
import random
import json
import asyncio
from datetime import datetime
from typing import Dict, Any, Optional
from backend.database.session import SessionLocal
from backend.models.models import AttackEvent, HoneypotSensor

logger = logging.getLogger(__name__)

# Decoy web application HTML wrapper
def get_lab_html(title: str, content: str, is_logged_in: bool = False, username: str = "", role: str = "") -> str:
    sidebar_links = ""
    if is_logged_in:
        sidebar_links += f"""
        <a href="/dashboard" class="nav-item {'active' if title == 'User Dashboard' else ''}">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
            <span>Console Overview</span>
        </a>
        <a href="/profile" class="nav-item {'active' if title == 'Profile Settings' else ''}">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
            <span>User Profile</span>
        </a>
        <a href="/upload" class="nav-item {'active' if title == 'File Upload' or title == 'File Uploaded' else ''}">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
            <span>Asset Repository</span>
        </a>
        <a href="/feedback" class="nav-item {'active' if title == 'Feedback Feed' or title == 'Feedback Saved' else ''}">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
            <span>System Feedback</span>
        </a>
        """
        if role == 'admin':
            sidebar_links += f"""
            <div class="nav-group-title">Administration</div>
            <a href="/admin/dashboard" class="nav-item {'active' if title == 'Admin Panel' else ''}">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
                <span>Control Console</span>
            </a>
            <a href="/admin/logs" class="nav-item {'active' if title == 'Request Logs' else ''}">
                <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
                <span>Audit Logs</span>
            </a>
            """
        sidebar_links += """
        <div style="flex-grow: 1;"></div>
        <a href="/logout" class="nav-item logout-link" style="margin-top: auto; color: #ff3366;">
            <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
            <span>Logout Portal</span>
        </a>
        """

    disclaimer = '<div class="disclaimer">SECURITY WARNING: This is an authorized private corporate network system. All activity is logged and monitored. Authorized lab environment only.</div>'

    html_content = ""
    if is_logged_in:
        html_content = f"""
        <div class="dashboard-layout">
            <aside class="sidebar">
                <div class="logo-area">
                    <div class="logo-icon"></div>
                    <span class="logo-text">AETHERIS</span>
                </div>
                <div class="nav-links">
                    {sidebar_links}
                </div>
            </aside>
            <main class="main-content">
                <header class="top-header">
                    <div class="page-title">{title}</div>
                    <div class="user-meta">
                        <span class="badge badge-{role}">{role}</span>
                        <span class="user-name">{username}</span>
                    </div>
                </header>
                <div class="content-body">
                    {content}
                </div>
                {disclaimer}
            </main>
        </div>
        """
    else:
        html_content = f"""
        <div class="login-layout">
            <div class="login-card">
                <div class="logo-area" style="justify-content: center; margin-bottom: 25px;">
                    <div class="logo-icon"></div>
                    <span class="logo-text">AETHERIS</span>
                </div>
                <div class="form-title" style="text-align: center; margin-bottom: 25px; color: #ffffff; font-size: 16px; font-weight: 500;">
                    Operations &amp; Infrastructure Portal
                </div>
                <div class="form-body">
                    {content}
                </div>
                <div style="margin-top: 25px; border-top: 1px solid #21262d; padding-top: 15px; text-align: center; display: flex; justify-content: center; gap: 20px;">
                    <a href="/login" style="color: #58a6ff; font-size: 11px; text-decoration: none;">Login</a>
                    <a href="/register" style="color: #58a6ff; font-size: 11px; text-decoration: none;">Register</a>
                    <a href="/forgot-password" style="color: #58a6ff; font-size: 11px; text-decoration: none;">Forgot Password</a>
                </div>
                {disclaimer}
            </div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Aetheris Portal - {title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-primary: #080b11;
            --surface-primary: #11151d;
            --surface-secondary: #161b24;
            --border-primary: #21262d;
            --border-hover: #30363d;
            --text-primary: #c9d1d9;
            --text-secondary: #8b949e;
            --blue-primary: #58a6ff;
            --blue-glow: rgba(88, 166, 255, 0.15);
            --green-primary: #00ff88;
            --red-primary: #ff3366;
            --yellow-primary: #ffd32a;
        }}
        body {{
            background-color: var(--bg-primary);
            color: var(--text-primary);
            font-family: 'Inter', system-ui, -apple-system, sans-serif;
            margin: 0;
            padding: 0;
            font-size: 13px;
            line-height: 1.6;
            height: 100vh;
            overflow: hidden;
        }}
        /* Layout structures */
        .login-layout {{
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            background: radial-gradient(circle at center, #111827 0%, #080b11 70%);
        }}
        .login-card {{
            background: rgba(22, 27, 36, 0.65);
            border: 1px solid var(--border-primary);
            box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border-radius: 12px;
            width: 100%;
            max-width: 420px;
            padding: 40px;
            box-sizing: border-box;
            animation: fadeIn 0.4s ease-out;
        }}
        .dashboard-layout {{
            display: flex;
            height: 100vh;
        }}
        .sidebar {{
            width: 240px;
            background-color: var(--surface-primary);
            border-right: 1px solid var(--border-primary);
            display: flex;
            flex-direction: column;
            padding: 24px;
            box-sizing: border-box;
        }}
        .main-content {{
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow-y: auto;
            background: #0c0f17;
        }}
        .top-header {{
            height: 65px;
            border-bottom: 1px solid var(--border-primary);
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 30px;
            box-sizing: border-box;
            background-color: rgba(17, 21, 29, 0.5);
            backdrop-filter: blur(8px);
        }}
        .content-body {{
            padding: 30px;
            flex-grow: 1;
            box-sizing: border-box;
        }}
        
        /* Typography & Logo */
        .logo-area {{
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 30px;
        }}
        .logo-icon {{
            width: 18px;
            height: 18px;
            background: linear-gradient(135deg, var(--blue-primary) 0%, #a855f7 100%);
            border-radius: 4px;
            box-shadow: 0 0 10px var(--blue-glow);
        }}
        .logo-text {{
            font-size: 15px;
            font-weight: 700;
            letter-spacing: 0.15em;
            color: #ffffff;
        }}
        .page-title {{
            font-size: 16px;
            font-weight: 600;
            color: #ffffff;
        }}
        
        /* Navigation items */
        .nav-links {{
            display: flex;
            flex-direction: column;
            gap: 5px;
            flex-grow: 1;
        }}
        .nav-group-title {{
            font-size: 9px;
            font-weight: 700;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.1em;
            margin-top: 15px;
            margin-bottom: 5px;
            padding-left: 10px;
        }}
        .nav-item {{
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--text-secondary);
            text-decoration: none;
            padding: 10px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 500;
            transition: all 0.2s ease;
        }}
        .nav-item:hover {{
            background-color: var(--surface-secondary);
            color: #ffffff;
        }}
        .nav-item.active {{
            background-color: var(--blue-glow);
            border: 1px solid rgba(88, 166, 255, 0.3);
            color: var(--blue-primary);
        }}
        
        /* Forms & Inputs */
        .form-group {{
            margin-bottom: 20px;
        }}
        .form-group label {{
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 11px;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        input[type=text], input[type=password], input[type=email], textarea {{
            background: var(--surface-secondary);
            border: 1px solid var(--border-primary);
            color: #ffffff;
            padding: 12px;
            width: 100%;
            border-radius: 6px;
            box-sizing: border-box;
            outline: none;
            font-family: inherit;
            font-size: 12px;
            transition: all 0.2s ease;
        }}
        input[type=text]:focus, input[type=password]:focus, input[type=email]:focus, textarea:focus {{
            border-color: var(--blue-primary);
            box-shadow: 0 0 8px var(--blue-glow);
        }}
        input[type=submit], button {{
            background: var(--blue-primary);
            color: #000000;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 12px;
            font-family: inherit;
            width: 100%;
            transition: all 0.2s ease;
        }}
        input[type=submit]:hover, button:hover {{
            opacity: 0.9;
            box-shadow: 0 0 15px rgba(88, 166, 255, 0.35);
        }}
        
        /* Badges & Tables */
        .badge {{
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        .badge-admin {{
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            color: #ef4444;
        }}
        .badge-user {{
            background: rgba(16, 185, 129, 0.1);
            border: 1px solid rgba(16, 185, 129, 0.2);
            color: #10b981;
        }}
        table {{
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-top: 15px;
            border: 1px solid var(--border-primary);
            border-radius: 8px;
            overflow: hidden;
            background: var(--surface-primary);
        }}
        th, td {{
            padding: 12px 16px;
            text-align: left;
            border-bottom: 1px solid var(--border-primary);
        }}
        tr:last-child td {{
            border-bottom: none;
        }}
        th {{
            background-color: var(--surface-secondary);
            color: #ffffff;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }}
        td {{
            font-size: 12px;
        }}
        
        /* UI Components & Cards */
        .card {{
            background: var(--surface-primary);
            border: 1px solid var(--border-primary);
            padding: 24px;
            border-radius: 8px;
            margin-bottom: 20px;
        }}
        .user-meta {{
            display: flex;
            align-items: center;
            gap: 10px;
        }}
        .user-name {{
            font-weight: 500;
            color: #ffffff;
        }}
        .text-danger {{ color: var(--red-primary); }}
        .text-success {{ color: var(--green-primary); }}
        .text-muted {{ color: var(--text-secondary); }}
        
        /* Subtle Access Disclaimer Warning */
        .disclaimer {{
            padding: 20px 30px;
            font-size: 10px;
            color: var(--text-secondary);
            border-top: 1px solid var(--border-primary);
            text-align: center;
            background-color: rgba(17, 21, 29, 0.2);
            margin-top: auto;
        }}
        
        @keyframes fadeIn {{
            from {{ opacity: 0; transform: translateY(10px); }}
            to {{ opacity: 1; transform: translateY(0); }}
        }}
    </style>
</head>
<body>
    {html_content}
</body>
</html>"""

class HoneypotRequestHandler(http.server.BaseHTTPRequestHandler):
    # Shared in-memory data store for the lab environment
    lab_users = {
        "admin": {"username": "admin", "password": "admin@123", "role": "admin", "email": "admin@sentinelai.local"},
        "user1": {"username": "user1", "password": "user@123", "role": "user", "email": "user1@sentinelai.local"},
        "user2": {"username": "user2", "password": "user2@123", "role": "user", "email": "user2@sentinelai.local"}
    }
    lab_sessions = {}  # token -> user
    lab_feedback = [
        {"id": 1, "username": "user1", "text": "The SOC network is highly stable. Excellent decoy interfaces!", "created_at": "2026-07-02 12:00"},
        {"id": 2, "username": "user2", "text": "Vulnerable test environment is running smoothly.", "created_at": "2026-07-02 12:15"}
    ]
    lab_uploads = [
        {"id": 1, "username": "user1", "filename": "avatar.png", "size": "45 KB", "created_at": "2026-07-02 12:05"}
    ]
    lab_login_attempts = []
    lab_request_logs = []
    
    # Rate limit tracker
    rate_limits = {}  # IP -> [timestamps]

    def log_message(self, format, *args):
        # Suppress standard HTTP logs in console
        pass

    def log_attack(self, attack_type: str, severity: str, confidence: float, mitre_id: str, recommendation: str, payload: str):
        # Escape HTML characters in the payload to prevent real XSS in SentinelAI Dashboard
        safe_payload = payload.replace("<", "&lt;").replace(">", "&gt;")
        
        db = SessionLocal()
        try:
            from backend.services.threat_intel import ThreatIntelService
            intel = ThreatIntelService(db).enrich_ip(self.client_address[0])

            attack_event = AttackEvent(
                external_id=f"HON-{int(datetime.utcnow().timestamp())}",
                attack_type=attack_type,
                severity=severity,
                status="NEW",
                source_ip=self.client_address[0],
                source_port=self.client_address[1],
                destination_port=8088,
                protocol="HTTP",
                target_service="HTTP Honeypot",
                country=intel["country"],
                city=intel["city"],
                payload=safe_payload,
                user_agent=self.headers.get('User-Agent', 'Unknown'),
                sensor_id="HTTP Honeypot",
                threat_score=intel["threat_score"],
                confidence=intel["confidence"],
                raw_metadata=json.dumps({
                    "mitre_id": mitre_id,
                    "recommendation": recommendation,
                    "latitude": intel.get("latitude", 0.0),
                    "longitude": intel.get("longitude", 0.0)
                }),
                created_at=datetime.utcnow()
            )
            db.add(attack_event)
            db.commit()
            
            # Broadcast the event to any active WebSocket listeners live
            from backend.api.attacks import manager
            event_data = {
                "id": attack_event.id,
                "external_id": attack_event.external_id,
                "attack_type": attack_event.attack_type,
                "severity": attack_event.severity,
                "status": attack_event.status,
                "source_ip": attack_event.source_ip,
                "source_port": attack_event.source_port,
                "destination_port": attack_event.destination_port,
                "protocol": attack_event.protocol,
                "target_service": attack_event.target_service,
                "country": attack_event.country,
                "city": attack_event.city,
                "payload": attack_event.payload,
                "threat_score": attack_event.threat_score,
                "confidence": attack_event.confidence,
                "raw_metadata": attack_event.raw_metadata,
                "created_at": attack_event.created_at.isoformat()
            }
            
            try:
                from backend.services.notification import NotificationService
                NotificationService(db).trigger_notifications(event_data)
            except Exception as e:
                logger.warning(f"Failed to trigger honeypot alerts: {e}")

            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    loop.create_task(manager.broadcast({
                        "type": "new_attack",
                        "data": event_data
                    }))
            except Exception:
                pass
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to save lab event: {e}")
        finally:
            db.close()

    def check_rate_limit(self) -> bool:
        ip = self.client_address[0]
        now = datetime.utcnow().timestamp()
        
        if ip not in self.rate_limits:
            self.rate_limits[ip] = []
        
        # Keep only timestamps in the last 10 seconds
        self.rate_limits[ip] = [t for t in self.rate_limits[ip] if now - t < 10]
        
        if len(self.rate_limits[ip]) > 60:  # Limit to 60 requests/10s
            return False
            
        self.rate_limits[ip].append(now)
        return True

    def get_session_user(self) -> Optional[dict]:
        cookie = self.headers.get('Cookie', '')
        if 'session_id=' in cookie:
            match = re.search(r'session_id=([a-zA-Z0-9_]+)', cookie)
            if match:
                token = match.group(1)
                return self.lab_sessions.get(token)
        return None

    def analyze_general_attacks(self, body: str = "") -> bool:
        """Helper to scan general request path and headers for traversals or scanner agents."""
        # 1. User agent check
        ua = self.headers.get('User-Agent', '')
        for scanner in ["sqlmap", "nikto", "nmap", "dirbuster", "gobuster", "acunetix"]:
            if scanner in ua.lower():
                self.log_attack(
                    "Suspicious User-Agent", 
                    "MEDIUM", 
                    0.90, 
                    "T1595.002", 
                    "Implement a web application firewall rule to inspect and block scanner User-Agent signatures.",
                    f"User-Agent: {ua}"
                )
                return True

        # 2. Directory / Path traversal check
        path_lower = urllib.parse.unquote(self.path).lower()
        if "../" in path_lower or "..\\" in path_lower or "/etc/passwd" in path_lower or "win.ini" in path_lower:
            self.log_attack(
                "Path Traversal", 
                "CRITICAL", 
                0.98, 
                "T1083", 
                "Verify strict server folder permissions and validate parameters to prevent escaping the web directory.",
                f"Path: {self.path}"
            )
            self.send_response(403)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("403 Forbidden", "<p class='text-danger'>Error 403: Forbidden Path Traversal Violation. Access denied.</p>").encode('utf-8'))
            return True

        # 3. Broken Access Control check on admin routes
        if path_lower.startswith("/admin"):
            user = self.get_session_user()
            if not user or user.get('role') != 'admin':
                self.log_attack(
                    "Broken Access Control", 
                    "HIGH", 
                    0.95, 
                    "T1548", 
                    "Enforce strict role-based access checking on all admin routes and reject invalid session keys.",
                    f"Path: {self.path} | Attempted by: {user.get('username') if user else 'Guest'}"
                )
                self.send_response(403)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(get_lab_html("403 Access Denied", "<p class='text-danger'>Error 403: Forbidden access. Administrator privilege required.</p>").encode('utf-8'))
                return True
        return False

    def handle_request(self):
        if not self.check_rate_limit():
            self.send_response(429)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(b"Error 429: Too many requests. Rate limit exceeded.")
            return

        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query = parsed_url.query

        # Read POST body
        content_length = int(self.headers.get('Content-Length', 0))
        body = ""
        if content_length > 0:
            try:
                body = self.rfile.read(content_length).decode('utf-8', errors='ignore')
            except Exception as e:
                logger.error(f"Error reading body: {e}")

        # Check Active Defense Engine rules and interception signatures
        db = SessionLocal()
        try:
            from backend.services.active_defense import ActiveDefenseEngine
            engine = ActiveDefenseEngine(db)
            headers_dict = {k: v for k, v in self.headers.items()}
            is_blocked, action, reason = engine.evaluate_request(
                self.client_address[0], 
                path, 
                self.command, 
                headers_dict, 
                body
            )
            if is_blocked:
                # Log attack event so SentinelAI console tracks the incident
                self.log_attack(
                    f"WAF Intercept: {action}",
                    "CRITICAL" if action == "BLOCK" else "HIGH",
                    0.99,
                    "T1190",
                    f"Active defense block active for source IP. Maintain blocking rule.",
                    f"Request: {self.command} {path} | Trigger: {reason}"
                )
                
                block_html = engine.get_block_html(self.client_address[0], action, reason)
                self.send_response(403)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(block_html.encode('utf-8'))
                return
        except Exception as e:
            logger.error(f"Active defense evaluation failure: {e}", exc_info=True)
        finally:
            db.close()

        # Logging request locally for the admin console
        user = self.get_session_user()
        request_log_entry = {
            "time": datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S"),
            "ip": self.client_address[0],
            "method": self.command,
            "path": path,
            "user": user.get('username') if user else "Guest",
            "agent": self.headers.get('User-Agent', 'Unknown')
        }
        self.lab_request_logs.append(request_log_entry)
        if len(self.lab_request_logs) > 50:
            self.lab_request_logs.pop(0)

        # Run general scanners and traversal checks
        if self.analyze_general_attacks(body):
            return

        # Simple session user context
        is_logged_in = user is not None
        username = user.get('username', '') if is_logged_in else ''
        role = user.get('role', '') if is_logged_in else ''

        # --- ROUTING HANDLERS ---
        
        # 1. LOGOUT
        if path == "/logout":
            cookie_header = self.headers.get('Cookie', '')
            if 'session_id=' in cookie_header:
                match = re.search(r'session_id=([a-zA-Z0-9_]+)', cookie_header)
                if match:
                    token = match.group(1)
                    self.lab_sessions.pop(token, None)
            
            self.send_response(302)
            self.send_header("Set-Cookie", "session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT")
            self.send_header("Location", "/login")
            self.end_headers()
            return

        # 2. LOGIN (GET/POST)
        if path == "/" or path == "/login":
            if self.command == "POST":
                params = urllib.parse.parse_qs(body)
                post_user = params.get('username', [''])[0]
                post_pass = params.get('password', [''])[0]

                # SQL Injection vulnerability check
                sqli_pattern = re.compile(r"'.*or.*'.*=.*'|union\s+select|'\s*or\s*1\s*=\s*1|--", re.IGNORECASE)
                if sqli_pattern.search(post_user) or sqli_pattern.search(post_pass):
                    self.log_attack(
                        "SQL Injection", 
                        "CRITICAL", 
                        0.96, 
                        "T1190", 
                        "Utilize parameterized queries or prepared statements in database calls to ensure safe input validation.",
                        f"Login Username: {post_user} | Password: {post_pass}"
                    )
                    
                    # SIMULATE SQL INJECTION BYPASS: Log user in as admin!
                    session_token = f"sess_{random.randint(100000, 999999)}"
                    self.lab_sessions[session_token] = self.lab_users["admin"]
                    self.send_response(302)
                    self.send_header("Set-Cookie", f"session_id={session_token}; Path=/")
                    self.send_header("Location", "/dashboard")
                    self.end_headers()
                    return

                # Normal Credential Check
                matched_user = self.lab_users.get(post_user)
                if matched_user and matched_user["password"] == post_pass:
                    # Successful login
                    session_token = f"sess_{random.randint(100000, 999999)}"
                    self.lab_sessions[session_token] = matched_user
                    
                    # Log successful attempt
                    self.lab_login_attempts.append({"username": post_user, "ip": self.client_address[0], "status": "SUCCESS", "time": datetime.now().strftime("%H:%M:%S")})
                    
                    self.send_response(302)
                    self.send_header("Set-Cookie", f"session_id={session_token}; Path=/")
                    self.send_header("Location", "/dashboard")
                    self.end_headers()
                    return
                else:
                    # Failed attempt tracking
                    self.lab_login_attempts.append({"username": post_user, "ip": self.client_address[0], "status": "FAILED", "time": datetime.now().strftime("%H:%M:%S")})
                    
                    # Detect Brute Force / Credential Stuffing
                    recent_failures = [a for a in self.lab_login_attempts if a["status"] == "FAILED" and a["ip"] == self.client_address[0]]
                    if len(recent_failures) >= 5:
                        self.log_attack(
                            "Brute Force", 
                            "HIGH", 
                            0.94, 
                            "T1110", 
                            "Enable lockout mechanics after consecutive login failures, and enforce multi-factor authentication (MFA).",
                            f"Failed attempts count: {len(recent_failures)} from IP: {self.client_address[0]}"
                        )
                        # Clear old history to prevent duplicate loops
                        self.lab_login_attempts = []
                        
                    content = f"""<p class="text-danger">Invalid credentials.</p>
                    <form action="/login" method="POST">
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" name="username" placeholder="e.g. employee.username" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" name="password" placeholder="••••••••" required>
                        </div>
                        <input type="submit" value="Authenticate Session">
                    </form>"""
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html")
                    self.end_headers()
                    self.wfile.write(get_lab_html("Login", content).encode('utf-8'))
                    return
            
            # GET /login
            content = """<form action="/login" method="POST">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" name="username" placeholder="e.g. employee.username" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" name="password" placeholder="••••••••" required>
                </div>
                <input type="submit" value="Authenticate Session">
            </form>"""
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Login", content).encode('utf-8'))
            return

        # 3. REGISTER (GET/POST)
        if path == "/register":
            if self.command == "POST":
                params = urllib.parse.parse_qs(body)
                reg_user = params.get('username', [''])[0]
                reg_pass = params.get('password', [''])[0]
                reg_email = params.get('email', [''])[0]

                if reg_user and reg_pass:
                    self.lab_users[reg_user] = {
                        "username": reg_user,
                        "password": reg_pass,
                        "role": "user",
                        "email": reg_email
                    }
                    content = f"<p class='text-success'>Registration successful for user '{reg_user}'! You can now <a href='/login'>login here</a>.</p>"
                else:
                    content = "<p class='text-danger'>Error: All registration fields are required.</p>"
                
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(get_lab_html("Register", content).encode('utf-8'))
                return
            
            # GET /register
            content = """<form action="/register" method="POST">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" name="username" placeholder="e.g. user1" required>
                </div>
                <div class="form-group">
                    <label>Email Address</label>
                    <input type="email" name="email" placeholder="user@aetheris.local" required>
                </div>
                <div class="form-group">
                    <label>Password</label>
                    <input type="password" name="password" placeholder="••••••••" required>
                </div>
                <input type="submit" value="Register Account">
            </form>"""
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Register", content).encode('utf-8'))
            return

        # 4. FORGOT PASSWORD (GET/POST)
        if path == "/forgot-password":
            if self.command == "POST":
                params = urllib.parse.parse_qs(body)
                forgot_user = params.get('username', [''])[0]
                content = f"<p class='text-success'>If user '{forgot_user}' exists, a password reset link has been dispatched to their recorded email address.</p>"
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(get_lab_html("Password Reset Requested", content).encode('utf-8'))
                return
            
            content = """<form action="/forgot-password" method="POST">
                <div class="form-group">
                    <label>Username or Email Address</label>
                    <input type="text" name="username" placeholder="username or email" required>
                </div>
                <input type="submit" value="Request Password Reset">
            </form>"""
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Forgot Password", content).encode('utf-8'))
            return

        # Check authenticated session validation
        if not is_logged_in:
            self.send_response(302)
            self.send_header("Location", "/login")
            self.end_headers()
            return

        # 5. USER DASHBOARD
        if path == "/dashboard":
            content = f"""
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                <div class="card" style="margin: 0;">
                    <h4 style="margin: 0 0 10px 0; color: #ffffff;">Console Status</h4>
                    <p class="text-muted" style="margin: 0;">Account Clearance: <span class="badge badge-user">{role}</span></p>
                    <p class="text-muted" style="margin: 5px 0 0 0;">Last Login Trace: {datetime.now().strftime("%Y-%m-%d %H:%M")}</p>
                </div>
                <div class="card" style="margin: 0;">
                    <h4 style="margin: 0 0 10px 0; color: #ffffff;">Intranet Assets</h4>
                    <p class="text-muted" style="margin: 0;">Decoy asset database sync state: <span class="text-success">Optimal</span></p>
                    <p class="text-muted" style="margin: 5px 0 0 0;">Threat filter status: <span class="text-success">Active</span></p>
                </div>
            </div>
            <div class="card">
                <h4 style="margin: 0 0 15px 0; color: #ffffff;">System Notifications</h4>
                <p class="text-muted" style="margin: 0;">Welcome back to the Aetheris console. Standard automated telemetry scanners are operating normally in the background. Use the side navigation panel to edit your profile details, upload attachments to the secure repository, or submit support tickets via feedback forms.</p>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("User Dashboard", content, True, username, role).encode('utf-8'))
            return

        # 6. PROFILE (GET/POST)
        if path == "/profile":
            if self.command == "POST":
                params = urllib.parse.parse_qs(body)
                new_email = params.get('email', [''])[0]
                
                # XSS vulnerability check
                xss_pattern = re.compile(r"<script.*?>|<\/script>|javascript:|onerror\s*=|onload\s*=", re.IGNORECASE)
                if xss_pattern.search(new_email):
                    self.log_attack(
                        "Cross-Site Scripting (XSS)", 
                        "HIGH", 
                        0.92, 
                        "T1189", 
                        "Implement HTML encoding on dynamic user outputs and establish a strict Content Security Policy (CSP).",
                        f"Profile Email Update: {new_email}"
                    )
                
                # Update user info
                self.lab_users[username]["email"] = new_email
                content = f"<p class='text-success'>Profile updated successfully!</p><p>Email: {new_email}</p>"
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(get_lab_html("Profile Settings", content, True, username, role).encode('utf-8'))
                return

            # GET /profile
            content = f"""
            <div class="card" style="max-width: 500px; margin: 0 auto;">
                <h4 style="margin: 0 0 20px 0; color: #ffffff;">Profile Configuration</h4>
                <form action="/profile" method="POST">
                    <div class="form-group">
                        <label>System Username</label>
                        <input type="text" value="{username}" disabled style="opacity: 0.6;">
                    </div>
                    <div class="form-group">
                        <label>Security Clearance Group</label>
                        <input type="text" value="{role}" disabled style="opacity: 0.6;">
                    </div>
                    <div class="form-group">
                        <label>Profile Contact Email</label>
                        <input type="text" name="email" value="{self.lab_users[username].get('email', '')}">
                    </div>
                    <input type="submit" value="Update Profile Details">
                </form>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Profile Settings", content, True, username, role).encode('utf-8'))
            return

        # 7. FILE UPLOAD (GET/POST)
        if path == "/upload":
            if self.command == "POST":
                # Detect uploaded filename from the post payload boundary
                uploaded_filename = "avatar.png"
                fn_match = re.search(r'filename="([^"]+)"', body)
                if fn_match:
                    uploaded_filename = fn_match.group(1)
                
                # Check for malicious script files
                extension = uploaded_filename.split(".")[-1].lower() if "." in uploaded_filename else ""
                if extension in ["php", "jsp", "asp", "aspx", "sh", "exe", "py", "pl", "js"]:
                    self.log_attack(
                        "File Upload Abuse", 
                        "HIGH", 
                        0.94, 
                        "T1190", 
                        "Enforce strict server-side file extension whitelisting, write files outside the web directory, and block file executions.",
                        f"Attempted upload of executable extension script: {uploaded_filename}"
                    )
                
                # Mock record save
                self.lab_uploads.append({
                    "id": len(self.lab_uploads) + 1,
                    "username": username,
                    "filename": uploaded_filename,
                    "size": f"{round(len(body) / 1024, 1)} KB",
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M")
                })
                
                content = f"<p class='text-success'>File '{uploaded_filename}' uploaded successfully (Simulated sandbox storage)!</p>"
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(get_lab_html("File Uploaded", content, True, username, role).encode('utf-8'))
                return

            # GET /upload
            content = """
            <div class="card" style="max-width: 500px; margin: 0 auto; text-align: center;">
                <h4 style="margin: 0 0 15px 0; color: #ffffff; text-align: left;">Upload Secure Assets</h4>
                <p class="text-muted" style="margin-bottom: 25px; text-align: left;">Submit corporate attachments, avatar images, or diagnostic logs to the sandbox storage partition.</p>
                <form action="/upload" method="POST" enctype="multipart/form-data">
                    <div style="border: 2px dashed var(--border-primary); padding: 40px 20px; border-radius: 8px; margin-bottom: 20px; background-color: var(--surface-secondary); cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--blue-primary)'" onmouseout="this.style.borderColor='var(--border-primary)'">
                        <svg width="24" height="24" fill="none" stroke="var(--text-secondary)" stroke-width="2" viewBox="0 0 24 24" style="margin-bottom: 10px;"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
                        <div style="font-size: 12px; color: #ffffff; font-weight: 500; margin-bottom: 5px;">Drag file here or click to browse</div>
                        <div class="text-muted">Supports PNG, JPG, CSV, PDF (Max 10MB)</div>
                        <input type="file" name="avatar" required style="display: none;" id="file-uploader" onchange="document.getElementById('upload-btn').click()">
                    </div>
                    <button type="button" onclick="document.getElementById('file-uploader').click()">Choose File</button>
                    <input type="submit" id="upload-btn" value="Upload Asset" style="display: none;">
                </form>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("File Upload", content, True, username, role).encode('utf-8'))
            return

        # 8. FEEDBACK (GET/POST)
        if path == "/feedback":
            if self.command == "POST":
                params = urllib.parse.parse_qs(body)
                feedback_text = params.get('comment', [''])[0]

                # XSS vulnerability check
                xss_pattern = re.compile(r"<script.*?>|<\/script>|javascript:|onerror\s*=|onload\s*=", re.IGNORECASE)
                if xss_pattern.search(feedback_text):
                    self.log_attack(
                        "Cross-Site Scripting (XSS)", 
                        "HIGH", 
                        0.92, 
                        "T1189", 
                        "HTML-escape all dynamically loaded database variables before rendering them in client views.",
                        f"Submitted feedback payload: {feedback_text}"
                    )
                
                self.lab_feedback.append({
                    "id": len(self.lab_feedback) + 1,
                    "username": username,
                    "text": feedback_text,
                    "created_at": datetime.now().strftime("%Y-%m-%d %H:%M")
                })
                
                content = "<p class='text-success'>Feedback recorded! Thank you.</p><a href='/feedback'>Back to Feed</a>"
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(get_lab_html("Feedback Saved", content, True, username, role).encode('utf-8'))
                return

            # GET /feedback
            rows = ""
            for item in self.lab_feedback:
                rows += f"""
                <tr style="border-bottom: 1px solid var(--border-primary);">
                    <td style="font-weight: 600; color: #ffffff;">{item['username']}</td>
                    <td style="color: var(--text-primary);">{item['text']}</td>
                    <td class="text-muted">{item['created_at']}</td>
                </tr>
                """

            content = f"""
            <div class="card" style="margin-bottom: 25px;">
                <h4 style="margin: 0 0 15px 0; color: #ffffff;">Submit System Feedback</h4>
                <form action="/feedback" method="POST">
                    <div class="form-group">
                        <label>Site Incident Comments / Suggestions</label>
                        <textarea name="comment" rows="4" placeholder="Enter comments or diagnostic reports..." required></textarea>
                    </div>
                    <input type="submit" value="Register Feedback ticket">
                </form>
            </div>
            
            <div class="card">
                <h4 style="margin: 0 0 15px 0; color: #ffffff;">Operator Incident logs</h4>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 150px;">Operator</th>
                            <th>Comment Details</th>
                            <th style="width: 150px;">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows}
                    </tbody>
                </table>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Feedback Feed", content, True, username, role).encode('utf-8'))
            return

        # 9. ADMIN DASHBOARD
        if path == "/admin/dashboard":
            # Count details for visual charts
            total_users = len(self.lab_users)
            feedback_count = len(self.lab_feedback)
            files_count = len(self.lab_uploads)
            
            attempts_rows = ""
            for a in self.lab_login_attempts:
                status_color = "var(--green-primary)" if a['status'] == 'SUCCESS' else "var(--red-primary)"
                attempts_rows += f"""
                <tr style="border-bottom: 1px solid var(--border-primary);">
                    <td style="font-weight:600; color:#ffffff;">{a['username']}</td>
                    <td>{a['ip']}</td>
                    <td><span style="color: {status_color}; font-weight:600;">{a['status']}</span></td>
                    <td class="text-muted">{a['time']}</td>
                </tr>
                """
                
            feedback_rows = ""
            for f in self.lab_feedback:
                feedback_rows += f"""
                <tr style="border-bottom: 1px solid var(--border-primary);">
                    <td style="font-weight:600; color:#ffffff; width: 150px;">{f['username']}</td>
                    <td>{f['text']}</td>
                </tr>
                """

            content = f"""
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                <div class="card" style="margin:0; text-align: center;">
                    <span class="text-muted" style="font-size: 10px; font-weight: 700; text-transform: uppercase;">Total Users</span>
                    <h2 style="color: var(--blue-primary); margin: 10px 0 0 0; font-size: 24px;">{total_users}</h2>
                </div>
                <div class="card" style="margin:0; text-align: center;">
                    <span class="text-muted" style="font-size: 10px; font-weight: 700; text-transform: uppercase;">Feedback Logs</span>
                    <h2 style="color: var(--yellow-primary); margin: 10px 0 0 0; font-size: 24px;">{feedback_count}</h2>
                </div>
                <div class="card" style="margin:0; text-align: center;">
                    <span class="text-muted" style="font-size: 10px; font-weight: 700; text-transform: uppercase;">Uploaded Assets</span>
                    <h2 style="color: var(--green-primary); margin: 10px 0 0 0; font-size: 24px;">{files_count}</h2>
                </div>
            </div>
            
            <div class="card" style="margin-bottom: 25px;">
                <h4 style="margin: 0 0 15px 0; color: #ffffff;">Portal Authentication Audit Log</h4>
                <table>
                    <thead>
                        <tr><th>Account ID</th><th>Source Address</th><th>Resolution Status</th><th>Time</th></tr>
                    </thead>
                    <tbody>
                        {attempts_rows if attempts_rows else '<tr><td colspan="4" class="text-muted" style="text-align: center;">No authentication records logged.</td></tr>'}
                    </tbody>
                </table>
            </div>

            <div class="card">
                <h4 style="margin: 0 0 15px 0; color: #ffffff;">System Tickets Feed</h4>
                <table>
                    <thead>
                        <tr><th>User ID</th><th>Incident Details</th></tr>
                    </thead>
                    <tbody>
                        {feedback_rows}
                    </tbody>
                </table>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Admin Panel", content, True, username, role).encode('utf-8'))
            return

        # 10. ADMIN LOGS
        if path == "/admin/logs":
            rows = ""
            for log in self.lab_request_logs[::-1]:
                rows += f"""
                <tr style="border-bottom: 1px solid var(--border-primary);">
                    <td style="white-space: nowrap;">{log['time']}</td>
                    <td style="color: #ffffff; font-weight: 600;">{log['ip']}</td>
                    <td><span style="color: var(--blue-primary); font-weight: 600;">{log['method']}</span></td>
                    <td><code>{log['path']}</code></td>
                    <td>{log['user']}</td>
                    <td class="text-muted" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{log['agent']}</td>
                </tr>
                """

            content = f"""
            <div class="card">
                <h4 style="margin: 0 0 15px 0; color: #ffffff;">Sandbox Traffic Audit Log</h4>
                <p class="text-muted" style="margin-bottom: 20px;">Dynamic in-memory server access records for vulnerability assessment logs:</p>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 150px;">Time</th>
                            <th>Source IP</th>
                            <th>Method</th>
                            <th>URI Path</th>
                            <th>Principal</th>
                            <th>User-Agent</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows if rows else '<tr><td colspan="6" class="text-muted" style="text-align: center;">No network logs recorded yet.</td></tr>'}
                    </tbody>
                </table>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Request Logs", content, True, username, role).encode('utf-8'))
            return

        # Fallback 404
        self.send_response(404)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(get_lab_html("404 Not Found", "<p class='text-danger'>Error 404: The specified sandbox page route is not defined.</p>").encode('utf-8'))

    def do_GET(self):
        self.handle_request()

    def do_POST(self):
        self.handle_request()

    def do_PUT(self):
        self.handle_request()

    def do_DELETE(self):
        self.handle_request()

class HoneypotManager:
    def __init__(self):
        self.server: Optional[http.server.HTTPServer] = None
        self.thread: Optional[threading.Thread] = None
        self.is_running = False
        self.host = "127.0.0.1"
        self.port = 8088

    def start(self, lan_mode: bool = False) -> str:
        """Startup honeypot listener thread on port 8088."""
        if self.is_running:
            return "ONLINE"

        try:
            # Enforce localhost only by default, allow 0.0.0.0 binding in LAN Lab mode
            bind_host = "0.0.0.0" if lan_mode else "127.0.0.1"
            
            # Resolve dynamic local network LAN IP
            import socket
            def get_local_lan_ip():
                try:
                    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                    # Use Google DNS resolver to find routing address
                    s.connect(("8.8.8.8", 80))
                    ip = s.getsockname()[0]
                    s.close()
                    return ip
                except Exception:
                    return "127.0.0.1"
            
            display_host = get_local_lan_ip() if lan_mode else "127.0.0.1"

            self.server = http.server.HTTPServer(
                (bind_host, self.port),
                HoneypotRequestHandler
            )
            def run_server():
                logger.info(f"Honeypot listening on http://{bind_host}:{self.port} starting...")
                self.server.serve_forever()
                logger.info("Honeypot server thread stopped.")

            self.thread = threading.Thread(target=run_server, daemon=True)
            self.thread.start()
            self.is_running = True
            
            # Sync ONLINE state and resolved decoy IP/host in database
            self._update_sensor_db_state("ONLINE", display_host)
            logger.info(f"Honeypot service started successfully. Mode: {'LAN' if lan_mode else 'LOCAL'}, Display IP: {display_host}")
            return "ONLINE"
        except Exception as e:
            logger.error(f"Failed to start honeypot service: {e}", exc_info=True)
            return "ERROR"

    def stop(self) -> str:
        """Shutdown honeypot server thread cleanly."""
        if not self.is_running or not self.server:
            return "OFFLINE"

        try:
            self.server.shutdown()
            self.server.server_close()
            if self.thread:
                self.thread.join(timeout=2.0)
                
            self.server = None
            self.thread = None
            self.is_running = False
            
            # Sync OFFLINE state in database
            self._update_sensor_db_state("OFFLINE")
            logger.info("Honeypot service stopped successfully.")
            return "OFFLINE"
        except Exception as e:
            logger.error(f"Failed to stop honeypot server: {e}", exc_info=True)
            return "ERROR"

    def get_status(self) -> str:
        """Check server state."""
        if self.is_running and (self.thread is None or not self.thread.is_alive()):
            self.is_running = False
            self._update_sensor_db_state("OFFLINE")
        return "ONLINE" if self.is_running else "OFFLINE"

    def _update_sensor_db_state(self, state: str, host_ip: str = "127.0.0.1"):
        db = SessionLocal()
        try:
            sensor = db.query(HoneypotSensor).filter(HoneypotSensor.name == "HTTP Honeypot").first()
            if sensor:
                sensor.state = state
                sensor.host = host_ip
                if state == "ONLINE":
                    sensor.last_heartbeat = datetime.utcnow()
                db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update sensor state in database: {e}")
        finally:
            db.close()
