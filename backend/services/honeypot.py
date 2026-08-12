import hashlib
import html
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
from backend.models.models import (
    AttackEvent,
    HoneypotSensor,
    HoneypotPortalUser,
    HoneypotFeedback,
    HoneypotActivityLog
)

def hash_decoy_password(password: str) -> str:
    salt = "aetheris_decoy_salt_v1"
    return hashlib.sha256(f"{salt}:{password}".encode("utf-8")).hexdigest()

def record_honeypot_activity(
    db,
    ip: str,
    action_type: str,
    username_or_email: Optional[str],
    result: str,
    severity: str,
    path: str,
    user_agent: Optional[str],
    attack_event_id: Optional[int] = None
) -> Optional[HoneypotActivityLog]:
    try:
        act = HoneypotActivityLog(
            timestamp=datetime.utcnow(),
            source_ip=ip or "127.0.0.1",
            action_type=action_type,
            username_or_email=username_or_email[:100] if username_or_email else None,
            result=result,
            severity=severity,
            request_path=path[:255] if path else "/",
            user_agent=user_agent[:255] if user_agent else "Unknown",
            attack_event_id=attack_event_id
        )
        db.add(act)
        db.commit()
        return act
    except Exception as e:
        db.rollback()
        logging.getLogger(__name__).error(f"Failed to record honeypot activity log: {e}")
        return None

logger = logging.getLogger(__name__)

# Decoy web application HTML wrapper
def get_lab_html(title: str, content: str, is_logged_in: bool = False, username: str = "", role: str = "") -> str:
    sidebar_links = f"""
    <div class="nav-group-title">WORKSPACE</div>
    <a href="/dashboard" class="nav-item {'active' if title in ['User Dashboard', 'Workspace Overview', 'Dashboard'] else ''}">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
        <span>Overview</span>
    </a>
    <a href="/profile" class="nav-item {'active' if title in ['Profile Settings', 'Account Settings', 'User Profile'] else ''}">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        <span>Profile</span>
    </a>
    <a href="/upload" class="nav-item {'active' if title in ['Resource Center', 'File Upload', 'File Uploaded'] else ''}">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
        <span>Resource Center</span>
    </a>
    <a href="/feedback" class="nav-item {'active' if title in ['Support & Feedback', 'Feedback Feed', 'Feedback Saved'] else ''}">
        <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
        <span>Feedback &amp; Support</span>
    </a>
    """
    if role == 'admin':
        sidebar_links += f"""
        <div class="nav-group-title">MANAGEMENT</div>
        <a href="/admin/dashboard" class="nav-item {'active' if title in ['Admin Panel', 'Control Console', 'Operations Control'] else ''}">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"/></svg>
            <span>Control Console</span>
        </a>
        <a href="/admin/logs" class="nav-item {'active' if title in ['Request Logs', 'Audit Logs', 'Activity Logs'] else ''}">
            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
            <span>Activity Logs</span>
        </a>
        """

    initial_letter = username[0].upper() if username else "A"

    html_content = ""
    if is_logged_in:
        html_content = f"""
        <div class="app-layout">
            <aside class="sidebar">
                <div class="sidebar-header">
                    <div class="logo-icon"></div>
                    <div class="logo-meta">
                        <span class="logo-text">AETHERIS</span>
                        <span class="logo-sub">Enterprise Workspace</span>
                    </div>
                </div>
                <div class="nav-links">
                    {sidebar_links}
                </div>
                <div class="sidebar-footer">
                    <div class="user-mini-card">
                        <div class="user-avatar-sm">{initial_letter}</div>
                        <div class="user-mini-info">
                            <div class="user-mini-name">{username}</div>
                            <div class="user-mini-role">{role.upper()}</div>
                        </div>
                        <a href="/logout" class="logout-btn" title="Sign Out">
                            <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>
                        </a>
                    </div>
                </div>
            </aside>
            <main class="main-viewport">
                <header class="top-header">
                    <div class="header-left">
                        <h2 class="header-title">{title}</h2>
                        <div class="breadcrumb">Aetheris Workspace &nbsp;/&nbsp; <span class="breadcrumb-current">{title}</span></div>
                    </div>
                    <div class="header-right">
                        <div class="status-pill">
                            <span class="status-dot"></span>
                            <span class="status-text">All Systems Operational</span>
                        </div>
                        <div class="header-user-badge">
                            <div class="user-avatar">{initial_letter}</div>
                            <div class="header-user-info">
                                <span class="header-user-name">{username}</span>
                                <span class="badge badge-{role}">{role}</span>
                            </div>
                        </div>
                    </div>
                </header>
                <div class="content-body">
                    {content}
                </div>
                <footer class="app-footer">
                    <span>Aetheris Enterprise Platform &copy; 2026 &bull; Authorized Operational Session</span>
                </footer>
            </main>
        </div>
        """
    else:
        html_content = f"""
        <div class="auth-page-wrapper">
            <div class="auth-split-card">
                <!-- LEFT PANEL: Brand & Capabilities -->
                <div class="auth-brand-side">
                    <div class="auth-brand-header">
                        <div class="logo-icon-lg"></div>
                        <div class="logo-brand-text">AETHERIS</div>
                    </div>
                    <div class="auth-brand-content">
                        <h1 class="brand-hero-title">Enterprise Workspace Platform</h1>
                        <p class="brand-hero-sub">Manage your organizational resources, team services, and operational information from one unified platform.</p>

                        <div class="brand-feature-stack">
                            <div class="brand-feature-item">
                                <div class="feature-bullet-icon">
                                    <svg width="16" height="16" fill="none" stroke="var(--brand-primary)" stroke-width="2" viewBox="0 0 24 24"><path d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"/></svg>
                                </div>
                                <div>
                                    <div class="feature-heading">Workspace Management</div>
                                    <div class="feature-text">Centralized security governance and access management.</div>
                                </div>
                            </div>
                            <div class="brand-feature-item">
                                <div class="feature-bullet-icon">
                                    <svg width="16" height="16" fill="none" stroke="var(--brand-primary)" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                                </div>
                                <div>
                                    <div class="feature-heading">Resource Center</div>
                                    <div class="feature-text">High-performance asset repository and document sharing.</div>
                                </div>
                            </div>
                            <div class="brand-feature-item">
                                <div class="feature-bullet-icon">
                                    <svg width="16" height="16" fill="none" stroke="var(--brand-primary)" stroke-width="2" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                                </div>
                                <div>
                                    <div class="feature-heading">Team Services</div>
                                    <div class="feature-text">Internal communication, support tickets, and activity logs.</div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="auth-brand-footer">
                        <div class="status-pill-subtle">
                            <span class="status-dot"></span>
                            <span>Service Status &bull; Operational</span>
                        </div>
                    </div>
                </div>

                <!-- RIGHT PANEL: Auth Form -->
                <div class="auth-form-side">
                    <div class="auth-form-inner">
                        {content}
                    </div>
                    <div class="auth-form-footer">
                        <span>Aetheris Enterprise Security &bull; Protected Access</span>
                    </div>
                </div>
            </div>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Aetheris Workspace - {title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-base: #050811;
            --bg-surface: #0f172a;
            --bg-elevated: #1e293b;
            --bg-card-elevated: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%);
            --bg-subtle: rgba(30, 41, 59, 0.4);
            --border-subtle: rgba(255, 255, 255, 0.07);
            --border-strong: rgba(255, 255, 255, 0.14);
            --border-focus: #38bdf8;
            --text-main: #f8fafc;
            --text-muted: #94a3b8;
            --text-subtle: #64748b;
            --brand-primary: #38bdf8;
            --brand-hover: #0284c7;
            --brand-glow: rgba(56, 189, 248, 0.15);
            --green-primary: #10b981;
            --green-glow: rgba(16, 185, 129, 0.15);
            --red-primary: #ef4444;
            --red-glow: rgba(239, 68, 68, 0.15);
            --yellow-primary: #f59e0b;
            --yellow-glow: rgba(245, 158, 11, 0.15);
            --indigo-primary: #818cf8;
            --indigo-glow: rgba(129, 140, 248, 0.15);
            --radius-sm: 6px;
            --radius-md: 10px;
            --radius-lg: 16px;
            --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
        }}
        * {{ box-sizing: border-box; }}
        body {{
            background-color: var(--bg-base);
            background-image:
                radial-gradient(circle at 15% 15%, rgba(56, 189, 248, 0.07), transparent 35%),
                radial-gradient(circle at 85% 25%, rgba(129, 140, 248, 0.06), transparent 35%),
                radial-gradient(circle at 50% 85%, rgba(16, 185, 129, 0.04), transparent 45%),
                linear-gradient(rgba(255,255,255,0.009) 1px, transparent 1px),
                linear-gradient(90deg, rgba(255,255,255,0.009) 1px, transparent 1px);
            background-size: 100% 100%, 100% 100%, 100% 100%, 32px 32px, 32px 32px;
            background-attachment: fixed;
            color: var(--text-main);
            font-family: var(--font-sans);
            margin: 0;
            padding: 0;
            font-size: 13px;
            line-height: 1.5;
            height: 100vh;
            overflow: hidden;
            -webkit-font-smoothing: antialiased;
        }}

        /* Custom Scrollbar */
        ::-webkit-scrollbar {{ width: 6px; height: 6px; }}
        ::-webkit-scrollbar-track {{ background: rgba(5, 8, 17, 0.5); }}
        ::-webkit-scrollbar-thumb {{ background: rgba(255, 255, 255, 0.15); border-radius: 3px; }}
        ::-webkit-scrollbar-thumb:hover {{ background: rgba(56, 189, 248, 0.4); }}

        /* SPLIT-SCREEN AUTHENTICATION LAYOUT */
        .auth-page-wrapper {{
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 24px;
            background:
                radial-gradient(circle at 25% 20%, rgba(56, 189, 248, 0.14), transparent 40%),
                radial-gradient(circle at 75% 80%, rgba(129, 140, 248, 0.10), transparent 40%),
                linear-gradient(180deg, #08111f 0%, #050811 50%, #03050a 100%);
            box-sizing: border-box;
            overflow-y: auto;
            position: relative;
        }}
        .auth-split-card {{
            display: grid;
            grid-template-columns: 1.1fr 1fr;
            width: 100%;
            max-width: 980px;
            min-height: 580px;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-strong);
            border-radius: var(--radius-lg);
            box-shadow: 0 30px 60px -15px rgba(0, 0, 0, 0.8), 0 0 40px rgba(56, 189, 248, 0.05);
            overflow: hidden;
            animation: fadeIn 0.35s ease-out;
        }}
        .auth-brand-side {{
            background: linear-gradient(145deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.75) 100%);
            border-right: 1px solid var(--border-subtle);
            padding: 48px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
        }}
        .auth-brand-header {{
            display: flex;
            align-items: center;
            gap: 12px;
        }}
        .logo-icon-lg {{
            width: 30px;
            height: 30px;
            background: linear-gradient(135deg, var(--brand-primary) 0%, #2563eb 100%);
            border-radius: 8px;
            box-shadow: 0 0 20px var(--brand-glow);
        }}
        .logo-brand-text {{
            font-size: 19px;
            font-weight: 700;
            letter-spacing: 0.16em;
            color: #ffffff;
        }}
        .brand-hero-title {{
            font-size: 26px;
            font-weight: 700;
            color: #ffffff;
            margin: 28px 0 12px 0;
            letter-spacing: -0.02em;
            line-height: 1.25;
        }}
        .brand-hero-sub {{
            color: var(--text-muted);
            font-size: 13px;
            line-height: 1.6;
            margin: 0 0 32px 0;
        }}
        .brand-feature-stack {{
            display: flex;
            flex-direction: column;
            gap: 20px;
        }}
        .brand-feature-item {{
            display: flex;
            align-items: flex-start;
            gap: 14px;
        }}
        .feature-bullet-icon {{
            width: 34px;
            height: 34px;
            border-radius: var(--radius-md);
            background: rgba(56, 189, 248, 0.1);
            border: 1px solid rgba(56, 189, 248, 0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            flex-shrink: 0;
        }}
        .feature-heading {{
            font-weight: 600;
            color: #ffffff;
            font-size: 13px;
            margin-bottom: 2px;
        }}
        .feature-text {{
            color: var(--text-muted);
            font-size: 12px;
            line-height: 1.4;
        }}
        .auth-brand-footer {{
            margin-top: 32px;
            padding-top: 20px;
            border-top: 1px solid var(--border-subtle);
        }}
        .status-pill-subtle {{
            display: inline-flex;
            align-items: center;
            gap: 8px;
            font-size: 11px;
            color: var(--text-muted);
            font-weight: 500;
        }}

        .auth-form-side {{
            padding: 48px;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            background: rgba(11, 17, 32, 0.5);
        }}
        .auth-form-inner {{
            width: 100%;
            max-width: 360px;
            margin: 0 auto;
        }}
        .auth-form-footer {{
            text-align: center;
            font-size: 11px;
            color: var(--text-subtle);
            margin-top: 24px;
        }}

        /* APPLICATION SHELL LAYOUT */
        .app-layout {{
            display: flex;
            height: 100vh;
            width: 100vw;
            overflow: hidden;
        }}
        .sidebar {{
            width: 260px;
            background-color: rgba(9, 14, 26, 0.85);
            backdrop-filter: blur(16px);
            border-right: 1px solid var(--border-subtle);
            display: flex;
            flex-direction: column;
            padding: 24px 16px;
            box-sizing: border-box;
            flex-shrink: 0;
        }}
        .sidebar-header {{
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 0 8px 24px 8px;
            border-bottom: 1px solid var(--border-subtle);
            margin-bottom: 16px;
        }}
        .logo-icon {{
            width: 24px;
            height: 24px;
            background: linear-gradient(135deg, var(--brand-primary) 0%, #2563eb 100%);
            border-radius: var(--radius-sm);
            box-shadow: 0 0 12px var(--brand-glow);
        }}
        .logo-meta {{ display: flex; flex-direction: column; }}
        .logo-text {{ font-size: 15px; font-weight: 700; letter-spacing: 0.15em; color: #ffffff; }}
        .logo-sub {{ font-size: 10px; color: var(--text-subtle); text-transform: uppercase; letter-spacing: 0.08em; }}

        .nav-links {{ display: flex; flex-direction: column; gap: 4px; flex-grow: 1; overflow-y: auto; }}
        .nav-group-title {{
            font-size: 10px;
            font-weight: 700;
            color: var(--text-subtle);
            text-transform: uppercase;
            letter-spacing: 0.12em;
            margin: 20px 0 8px 10px;
        }}
        .nav-item {{
            display: flex;
            align-items: center;
            gap: 12px;
            color: var(--text-muted);
            text-decoration: none;
            padding: 9px 12px;
            border-radius: var(--radius-md);
            font-size: 12px;
            font-weight: 500;
            transition: all 0.18s ease;
            border: 1px solid transparent;
        }}
        .nav-item:hover {{
            background: var(--bg-subtle);
            color: #ffffff;
            border-color: var(--border-subtle);
        }}
        .nav-item.active {{
            background: linear-gradient(90deg, rgba(56, 189, 248, 0.15) 0%, rgba(56, 189, 248, 0.03) 100%);
            border-left: 3px solid var(--brand-primary);
            color: var(--brand-primary);
            font-weight: 600;
            border-radius: 0 var(--radius-md) var(--radius-md) 0;
        }}
        .sidebar-footer {{
            padding-top: 16px;
            border-top: 1px solid var(--border-subtle);
            margin-top: auto;
        }}
        .user-mini-card {{
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 12px;
            background: rgba(15, 23, 42, 0.6);
            border-radius: var(--radius-md);
            border: 1px solid var(--border-subtle);
        }}
        .user-avatar-sm {{
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--brand-primary) 0%, #2563eb 100%);
            color: #ffffff;
            font-weight: 700;
            font-size: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 10px var(--brand-glow);
        }}
        .user-mini-info {{ flex-grow: 1; overflow: hidden; }}
        .user-mini-name {{ font-size: 12px; font-weight: 600; color: #ffffff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }}
        .user-mini-role {{ font-size: 9px; font-weight: 700; color: var(--brand-primary); letter-spacing: 0.05em; }}
        .logout-btn {{
            color: var(--text-subtle);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 6px;
            border-radius: var(--radius-sm);
            transition: color 0.18s ease;
        }}
        .logout-btn:hover {{ color: var(--red-primary); }}

        .main-viewport {{
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            height: 100vh;
            overflow-y: auto;
            background: transparent;
        }}
        .top-header {{
            height: 60px;
            border-bottom: 1px solid var(--border-subtle);
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0 32px;
            box-sizing: border-box;
            background: rgba(9, 14, 26, 0.80);
            backdrop-filter: blur(16px);
            position: sticky;
            top: 0;
            z-index: 20;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
        }}
        .header-left {{ display: flex; flex-direction: column; gap: 2px; }}
        .header-title {{ margin: 0; font-size: 15px; font-weight: 600; color: #ffffff; letter-spacing: -0.01em; }}
        .breadcrumb {{ font-size: 11px; color: var(--text-subtle); }}
        .breadcrumb-current {{ color: var(--brand-primary); font-weight: 500; }}

        .header-right {{ display: flex; align-items: center; gap: 20px; }}
        .status-pill {{
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(16, 185, 129, 0.08);
            border: 1px solid rgba(16, 185, 129, 0.25);
            padding: 5px 12px;
            border-radius: 20px;
        }}
        .status-dot {{
            width: 7px;
            height: 7px;
            background: var(--green-primary);
            border-radius: 50%;
            box-shadow: 0 0 8px var(--green-primary);
        }}
        .status-text {{ font-size: 11px; font-weight: 600; color: var(--green-primary); }}

        .header-user-badge {{ display: flex; align-items: center; gap: 10px; }}
        .user-avatar {{
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: linear-gradient(135deg, var(--brand-primary) 0%, #2563eb 100%);
            color: #ffffff;
            font-weight: 700;
            font-size: 13px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 12px var(--brand-glow);
        }}
        .header-user-info {{ display: flex; flex-direction: column; align-items: flex-end; }}
        .header-user-name {{ font-size: 12px; font-weight: 600; color: #ffffff; }}

        .content-body {{
            padding: 32px 32px 64px 32px;
            flex-grow: 1;
            box-sizing: border-box;
            max-width: 1440px;
            width: 100%;
            margin: 0 auto;
        }}
        .app-footer {{
            padding: 16px 32px;
            border-top: 1px solid var(--border-subtle);
            font-size: 11px;
            color: var(--text-subtle);
            text-align: center;
            background: rgba(5, 8, 17, 0.7);
            margin-top: auto;
        }}

        /* COMPONENT STYLES & CARDS (3-LEVEL HIERARCHY) */
        .card {{
            background: var(--bg-surface);
            border: 1px solid var(--border-subtle);
            padding: 24px;
            border-radius: var(--radius-lg);
            margin-bottom: 24px;
            box-shadow: 0 4px 24px -2px rgba(0, 0, 0, 0.5);
            transition: all 0.2s ease;
        }}
        .card-elevated {{
            background: var(--bg-card-elevated);
            border: 1px solid var(--border-strong);
            box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.04);
        }}
        .card-accent-cyan {{ border-top: 3px solid var(--brand-primary); }}
        .card-accent-green {{ border-top: 3px solid var(--green-primary); }}
        .card-accent-indigo {{ border-top: 3px solid var(--indigo-primary); }}

        .form-group {{ margin-bottom: 20px; }}
        .form-group label {{
            display: block;
            margin-bottom: 8px;
            font-weight: 600;
            font-size: 11px;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.06em;
        }}
        input[type=text], input[type=password], input[type=email], textarea {{
            background: #090e1a;
            border: 1px solid var(--border-strong);
            color: #ffffff;
            padding: 12px 14px;
            width: 100%;
            border-radius: var(--radius-md);
            box-sizing: border-box;
            outline: none;
            font-family: inherit;
            font-size: 13px;
            transition: all 0.2s ease;
        }}
        input[type=text]:focus, input[type=password]:focus, input[type=email]:focus, textarea:focus {{
            border-color: var(--brand-primary);
            box-shadow: 0 0 0 3px var(--brand-glow);
            background: #0f172a;
        }}
        input[type=submit], button {{
            background: linear-gradient(135deg, #38bdf8 0%, #2563eb 100%);
            color: #ffffff;
            border: none;
            padding: 12px 24px;
            border-radius: var(--radius-md);
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            font-family: inherit;
            width: 100%;
            transition: all 0.2s ease;
            box-shadow: 0 4px 14px rgba(56, 189, 248, 0.25);
        }}
        input[type=submit]:hover, button:hover {{
            opacity: 0.95;
            box-shadow: 0 6px 22px rgba(56, 189, 248, 0.4);
            transform: translateY(-1px);
        }}

        .alert {{
            padding: 12px 16px;
            border-radius: var(--radius-md);
            font-size: 12px;
            margin-bottom: 20px;
            border-left: 4px solid transparent;
            box-sizing: border-box;
        }}
        .alert-danger {{ background: var(--red-glow); border-color: var(--red-primary); color: #fecdd3; }}
        .alert-success {{ background: var(--green-glow); border-color: var(--green-primary); color: #a7f3d0; }}

        .badge {{
            padding: 3px 8px;
            border-radius: var(--radius-sm);
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: inline-block;
        }}
        .badge-admin, .badge-danger {{ background: var(--red-glow); border: 1px solid rgba(239, 68, 68, 0.3); color: var(--red-primary); }}
        .badge-user, .badge-success {{ background: var(--green-glow); border: 1px solid rgba(16, 185, 129, 0.3); color: var(--green-primary); }}
        .badge-action, .badge-info {{ background: var(--brand-glow); border: 1px solid rgba(56, 189, 248, 0.3); color: var(--brand-primary); }}
        .badge-warning {{ background: var(--yellow-glow); border: 1px solid rgba(245, 158, 11, 0.3); color: var(--yellow-primary); }}
        .badge-indigo {{ background: var(--indigo-glow); border: 1px solid rgba(129, 140, 248, 0.3); color: var(--indigo-primary); }}

        table {{
            width: 100%;
            border-collapse: separate;
            border-spacing: 0;
            margin-top: 8px;
            border: 1px solid var(--border-subtle);
            border-radius: var(--radius-md);
            overflow: hidden;
            background: var(--bg-surface);
        }}
        th, td {{ padding: 12px 16px; text-align: left; border-bottom: 1px solid var(--border-subtle); }}
        tr:last-child td {{ border-bottom: none; }}
        tbody tr {{ transition: background-color 0.15s ease; }}
        tbody tr:hover {{ background-color: var(--bg-elevated); }}
        th {{ background-color: rgba(15, 23, 42, 0.95); color: var(--text-muted); font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; position: sticky; top: 0; z-index: 5; }}
        td {{ font-size: 12px; color: var(--text-main); }}
        code {{
            font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
            background: rgba(0, 0, 0, 0.4);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 11px;
            color: var(--brand-primary);
            border: 1px solid rgba(255, 255, 255, 0.05);
        }}

        .text-danger {{ color: var(--red-primary); }}
        .text-success {{ color: var(--green-primary); }}
        .text-muted {{ color: var(--text-muted); }}

        @keyframes fadeIn {{
            from {{ opacity: 0; transform: translateY(6px); }}
            to {{ opacity: 1; transform: translateY(0); }}
        }}

        /* RESPONSIVE MEDIA QUERIES */
        @media (max-width: 899px) {{
            .auth-split-card {{ grid-template-columns: 1fr; max-width: 460px; min-height: auto; }}
            .auth-brand-side {{ display: none; }}
            .auth-form-side {{ padding: 32px 24px; }}
            .app-layout {{ flex-direction: column; }}
            .sidebar {{ width: 100%; height: auto; border-right: none; border-bottom: 1px solid var(--border-subtle); padding: 16px; }}
            .top-header {{ padding: 0 16px; }}
            .content-body {{ padding: 16px; }}
            .sidebar-footer {{ display: none; }}
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
        "user1": {"username": "user1", "password": "user1@123", "role": "user", "email": "user1@sentinelai.local"},
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
    lab_suspicious_payloads = []
    lab_request_logs = []

    # Rate limit tracker
    rate_limits = {}  # IP -> [timestamps]

    def log_message(self, format, *args):
        # Suppress standard HTTP logs in console
        pass

    def log_attack(self, attack_type: str, severity: str, confidence: float, mitre_id: str, recommendation: str, payload: str):
        # Escape HTML characters in the payload to prevent real XSS in SentinelAI Dashboard
        safe_payload = payload.replace("<", "&lt;").replace(">", "&gt;")

        # Append locally to Aetheris Admin dashboard intrusions log
        self.lab_suspicious_payloads.append({
            "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "ip": self.client_address[0],
            "type": attack_type,
            "severity": severity,
            "payload": safe_payload
        })
        if len(self.lab_suspicious_payloads) > 50:
            self.lab_suspicious_payloads.pop(0)

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

            # Record linked activity log entry
            act_path = getattr(self, 'path', '/')
            record_honeypot_activity(
                db,
                self.client_address[0],
                attack_type,
                None,
                "DETECTED",
                severity,
                act_path,
                self.headers.get('User-Agent', 'Unknown'),
                attack_event_id=attack_event.id
            )

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
        if "../" in path_lower or "..\\" in path_lower or "passwd" in path_lower or "win.ini" in path_lower or "boot.ini" in path_lower:
            self.log_attack(
                "Path Traversal",
                "CRITICAL",
                0.98,
                "T1083",
                "Verify strict server folder permissions and validate parameters to prevent escaping the web directory.",
                f"Path: {self.path}"
            )

            # Formulate realistic mock output content
            mock_content = ""
            if "passwd" in path_lower:
                mock_content = """root:x:0:0:root:/root:/bin/bash
daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin
bin:x:2:2:bin:/bin:/usr/sbin/nologin
sys:x:3:3:sys:/dev:/usr/sbin/nologin
sync:x:4:65534:sync:/bin:/bin/sync
games:x:5:60:games:/usr/games:/usr/sbin/nologin
www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin
nobody:x:65534:65534:nobody:/nonexistent:/usr/sbin/nologin
aetheris-admin:x:1000:1000:Aetheris Admin Portal,,,:/home/aetheris-admin:/bin/bash
sentinel-decoy:x:1001:1001:Sentinel Decoy Sensor,,,:/home/sentinel-decoy:/bin/bash"""
            elif "win.ini" in path_lower or "boot.ini" in path_lower:
                mock_content = """; for 16-bit app support
[fonts]
[extensions]
[mci extensions]
[files]
[Mail]
MAPI=1"""
            else:
                mock_content = """total 24
drwxr-xr-x  3 www-data www-data  4096 Jul  3 12:00 .
drwxr-xr-x 12 www-data www-data  4096 Jul  3 12:00 ..
-rw-r--r--  1 www-data www-data   450 Jul  3 12:00 config.php
-rw-r--r--  1 www-data www-data 12288 Jul  3 12:00 database.db
-rw-r--r--  1 www-data www-data   248 Jul  3 12:00 login.php
drwxr-xr-x  2 www-data www-data  4096 Jul  3 12:00 uploads"""

            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(mock_content)))
            self.end_headers()
            self.wfile.write(mock_content.encode('utf-8'))
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

            db = SessionLocal()
            try:
                record_honeypot_activity(
                    db, self.client_address[0], "LOGOUT",
                    username if is_logged_in else "Guest", "SUCCESS", "LOW",
                    path, self.headers.get('User-Agent', 'Unknown')
                )
            finally:
                db.close()

            self.send_response(302)
            self.send_header("Set-Cookie", "session_id=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT")
            self.send_header("Location", "/login")
            self.end_headers()
            return

        # 2. LOGIN (GET/POST)
        if path == "/" or path == "/login":
            if self.command == "POST":
                params = urllib.parse.parse_qs(body)
                post_user = params.get('username', [''])[0].strip()
                post_pass = params.get('password', [''])[0].strip()

                # SQL Injection vulnerability check
                sqli_pattern = re.compile(r"'.*or.*'.*=.*'|union\s+select|'\s*or\s*1\s*=\s*1|--", re.IGNORECASE)
                user_has_sqli = bool(sqli_pattern.search(post_user))
                pass_has_sqli = bool(sqli_pattern.search(post_pass))

                if user_has_sqli or pass_has_sqli:
                    self.log_attack(
                        "SQL Injection",
                        "CRITICAL",
                        0.96,
                        "T1190",
                        "Utilize parameterized queries or prepared statements in database calls to ensure safe input validation.",
                        f"Login Username: {post_user} | Password: {post_pass}"
                    )

                    if user_has_sqli and pass_has_sqli:
                        # SIMULATE SQL INJECTION BYPASS: Log user in as admin!
                        db = SessionLocal()
                        try:
                            admin_obj = db.query(HoneypotPortalUser).filter(HoneypotPortalUser.role == "admin").first()
                            admin_name = admin_obj.username if admin_obj else "admin"
                            admin_email = admin_obj.email if admin_obj else "admin@sentinelai.local"

                            session_token = f"sess_{random.randint(100000, 999999)}"
                            self.lab_sessions[session_token] = {
                                "username": admin_name,
                                "role": "admin",
                                "email": admin_email
                            }

                            record_honeypot_activity(
                                db, self.client_address[0], "SQLI_ATTEMPT",
                                post_user, "INTERCEPTED", "CRITICAL",
                                path, self.headers.get('User-Agent', 'Unknown')
                            )
                        finally:
                            db.close()

                        self.send_response(302)
                        self.send_header("Set-Cookie", f"session_id={session_token}; Path=/")
                        self.send_header("Location", "/dashboard")
                        self.end_headers()
                        return

                # Normal Credential Check against HoneypotPortalUser table or default lab_users
                db = SessionLocal()
                try:
                    user_obj = db.query(HoneypotPortalUser).filter(
                        (HoneypotPortalUser.username == post_user) | (HoneypotPortalUser.email == post_user)
                    ).first()

                    lab_match = self.lab_users.get(post_user)
                    is_valid_lab = lab_match and lab_match.get("password") == post_pass
                    hashed_input = hash_decoy_password(post_pass)
                    is_valid_db = bool(user_obj and user_obj.password_hash == hashed_input and user_obj.status == "ACTIVE")

                    if is_valid_db or is_valid_lab:
                        succ_username = user_obj.username if user_obj else lab_match["username"]
                        succ_role = user_obj.role if user_obj else lab_match.get("role", "user")
                        succ_email = user_obj.email if user_obj else lab_match.get("email", "")

                        if user_obj:
                            user_obj.last_login_at = datetime.utcnow()
                            user_obj.login_count += 1
                            db.commit()

                        session_token = f"sess_{random.randint(100000, 999999)}"
                        self.lab_sessions[session_token] = {
                            "username": succ_username,
                            "role": succ_role,
                            "email": succ_email
                        }

                        record_honeypot_activity(
                            db, self.client_address[0], "LOGIN_SUCCESS",
                            succ_username, "SUCCESS", "LOW",
                            path, self.headers.get('User-Agent', 'Unknown')
                        )

                        self.send_response(302)
                        self.send_header("Set-Cookie", f"session_id={session_token}; Path=/")
                        self.send_header("Location", "/dashboard")
                        self.end_headers()
                        return
                    else:
                        # Failed attempt tracking
                        if user_obj:
                            user_obj.failed_login_count += 1
                            db.commit()

                        record_honeypot_activity(
                            db, self.client_address[0], "LOGIN_FAILURE",
                            post_user or "Unknown", "FAILED", "MEDIUM",
                            path, self.headers.get('User-Agent', 'Unknown')
                        )

                        self.log_attack(
                            "User Login (Failed)",
                            "MEDIUM",
                            0.70,
                            "T1110",
                            "Monitor credential stuffing attempts and lock accounts temporarily.",
                            f"Failed login attempt for username: {post_user}"
                        )

                        # Detect Brute Force / Credential Stuffing
                        recent_failures = db.query(HoneypotActivityLog).filter(
                            HoneypotActivityLog.source_ip == self.client_address[0],
                            HoneypotActivityLog.action_type == "LOGIN_FAILURE"
                        ).count()

                        if recent_failures >= 5:
                            self.log_attack(
                                "Brute Force",
                                "HIGH",
                                0.94,
                                "T1110",
                                "Enable lockout mechanics after consecutive login failures, and enforce multi-factor authentication (MFA).",
                                f"Failed attempts count: {recent_failures} from IP: {self.client_address[0]}"
                            )

                        content = f"""
                        <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 6px 0;">Welcome back</h2>
                        <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 24px 0;">Sign in to your Aetheris workspace account</p>
                        <div class="alert alert-danger">Invalid credentials. Please verify your username and password.</div>
                        <form action="/login" method="POST">
                            <div class="form-group">
                                <label>Username</label>
                                <input type="text" name="username" placeholder="e.g. employee.username" required>
                            </div>
                            <div class="form-group">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                                    <label style="margin-bottom: 0;">Password</label>
                                    <a href="/forgot-password" style="font-size: 11px; color: var(--brand-primary); text-decoration: none; font-weight: 500;">Forgot password?</a>
                                </div>
                                <input type="password" name="password" placeholder="••••••••" required>
                            </div>
                            <input type="submit" value="Sign In →">
                        </form>
                        <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-subtle); text-align: center; font-size: 12px; color: var(--text-muted);">
                            Don't have an account? <a href="/register" style="color: var(--brand-primary); font-weight: 600; text-decoration: none;">Create an account</a>
                        </div>
                        """
                        self.send_response(200)
                        self.send_header("Content-Type", "text/html")
                        self.end_headers()
                        self.wfile.write(get_lab_html("Login", content).encode('utf-8'))
                        return
                finally:
                    db.close()

            # GET /login
            db = SessionLocal()
            try:
                record_honeypot_activity(
                    db, self.client_address[0], "PAGE_VISIT",
                    user.get('username') if user else "Guest", "SUCCESS", "LOW",
                    path, self.headers.get('User-Agent', 'Unknown')
                )
            finally:
                db.close()

            content = """
            <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 6px 0;">Welcome back</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 24px 0;">Sign in to your Aetheris workspace account</p>
            <form action="/login" method="POST">
                <div class="form-group">
                    <label>Username</label>
                    <input type="text" name="username" placeholder="e.g. employee.username" required>
                </div>
                <div class="form-group">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <label style="margin-bottom: 0;">Password</label>
                        <a href="/forgot-password" style="font-size: 11px; color: var(--brand-primary); text-decoration: none; font-weight: 500;">Forgot password?</a>
                    </div>
                    <input type="password" name="password" placeholder="••••••••" required>
                </div>
                <input type="submit" value="Sign In →">
            </form>
            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-subtle); text-align: center; font-size: 12px; color: var(--text-muted);">
                Don't have an account? <a href="/register" style="color: var(--brand-primary); font-weight: 600; text-decoration: none;">Create an account</a>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Login", content).encode('utf-8'))
            return

        # 3. REGISTER (GET/POST)
        if path == "/register":
            if self.command == "POST":
                params = urllib.parse.parse_qs(body)
                reg_user = params.get('username', [''])[0].strip()
                reg_pass = params.get('password', [''])[0].strip()
                reg_email = params.get('email', [''])[0].strip()

                # Basic validation & maximum length constraints
                if not reg_user or not reg_pass or not reg_email or len(reg_user) < 3 or len(reg_user) > 50 or len(reg_email) > 100 or "@" not in reg_email or len(reg_pass) > 100:
                    db = SessionLocal()
                    try:
                        record_honeypot_activity(
                            db, self.client_address[0], "REGISTER_FAILURE",
                            reg_user or reg_email or "Unknown", "FAILED", "LOW",
                            path, self.headers.get('User-Agent', 'Unknown')
                        )
                    finally:
                        db.close()

                    content = f"""
                    <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 6px 0;">Create your account</h2>
                    <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 24px 0;">Register a new Aetheris workspace account</p>
                    <div class='alert alert-danger'>Error: Invalid registration input parameters. User (3-50 chars), valid Email, and Password required.</div>
                    <form action="/register" method="POST">
                        <div class="form-group">
                            <label>Username</label>
                            <input type="text" name="username" value="{html.escape(reg_user)}" placeholder="e.g. user1" required>
                        </div>
                        <div class="form-group">
                            <label>Email Address</label>
                            <input type="email" name="email" value="{html.escape(reg_email)}" placeholder="user@aetheris.local" required>
                        </div>
                        <div class="form-group">
                            <label>Password</label>
                            <input type="password" name="password" placeholder="••••••••" required>
                        </div>
                        <input type="submit" value="Register Account →">
                    </form>
                    <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-subtle); text-align: center; font-size: 12px; color: var(--text-muted);">
                        Already registered? <a href="/login" style="color: var(--brand-primary); font-weight: 600; text-decoration: none;">Sign in to workspace</a>
                    </div>
                    """
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html")
                    self.end_headers()
                    self.wfile.write(get_lab_html("Register", content).encode('utf-8'))
                    return

                db = SessionLocal()
                try:
                    existing = db.query(HoneypotPortalUser).filter(
                        (HoneypotPortalUser.username == reg_user) | (HoneypotPortalUser.email == reg_email)
                    ).first()

                    if existing:
                        record_honeypot_activity(
                            db, self.client_address[0], "REGISTER_FAILURE",
                            reg_user, "FAILED", "LOW",
                            path, self.headers.get('User-Agent', 'Unknown')
                        )
                        alert_box = f"<div class='alert alert-danger'>Error: Username or email already registered in portal database.</div>"
                    else:
                        new_user = HoneypotPortalUser(
                            username=reg_user,
                            email=reg_email,
                            password_hash=hash_decoy_password(reg_pass),
                            role="user",
                            status="ACTIVE",
                            source_ip=self.client_address[0]
                        )
                        db.add(new_user)
                        db.commit()

                        record_honeypot_activity(
                            db, self.client_address[0], "REGISTER_SUCCESS",
                            reg_user, "SUCCESS", "LOW",
                            path, self.headers.get('User-Agent', 'Unknown')
                        )
                        alert_box = f"<div class='alert alert-success'>Registration successful for user '{html.escape(reg_user)}'! You can now <a href='/login' style='color:inherit; font-weight:600; text-decoration:underline;'>sign in here</a>.</div>"
                except Exception as e:
                    db.rollback()
                    logger.error(f"Registration transaction failure: {e}")
                    alert_box = "<div class='alert alert-danger'>Error: Database transaction failed during registration.</div>"
                finally:
                    db.close()

                content = f"""
                <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 6px 0;">Create your account</h2>
                <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 24px 0;">Register a new Aetheris workspace account</p>
                {alert_box}
                <form action="/register" method="POST">
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
                    <input type="submit" value="Register Account →">
                </form>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-subtle); text-align: center; font-size: 12px; color: var(--text-muted);">
                    Already registered? <a href="/login" style="color: var(--brand-primary); font-weight: 600; text-decoration: none;">Sign in to workspace</a>
                </div>
                """
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(get_lab_html("Register", content).encode('utf-8'))
                return

            # GET /register
            db = SessionLocal()
            try:
                record_honeypot_activity(
                    db, self.client_address[0], "PAGE_VISIT",
                    user.get('username') if user else "Guest", "SUCCESS", "LOW",
                    path, self.headers.get('User-Agent', 'Unknown')
                )
            finally:
                db.close()

            content = """
            <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 6px 0;">Create your account</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 24px 0;">Register a new Aetheris workspace account</p>
            <form action="/register" method="POST">
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
                <input type="submit" value="Register Account →">
            </form>
            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-subtle); text-align: center; font-size: 12px; color: var(--text-muted);">
                Already registered? <a href="/login" style="color: var(--brand-primary); font-weight: 600; text-decoration: none;">Sign in to workspace</a>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Register", content).encode('utf-8'))
            return

        # 4. FORGOT PASSWORD (GET/POST)
        if path == "/forgot-password":
            if self.command == "POST":
                params = urllib.parse.parse_qs(body)
                forgot_user = params.get('username', [''])[0].strip()
                content = f"""
                <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 6px 0;">Recover access</h2>
                <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 24px 0;">Enter your username or email address to request account recovery instructions.</p>
                <div class='alert alert-success'>If user '{html.escape(forgot_user)}' exists, a password reset link has been dispatched to their recorded email address.</div>
                <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-subtle); text-align: center; font-size: 12px; color: var(--text-muted);">
                    <a href="/login" style="color: var(--brand-primary); font-weight: 600; text-decoration: none;">&larr; Return to Sign In</a>
                </div>
                """
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(get_lab_html("Password Reset Requested", content).encode('utf-8'))
                return

            content = """
            <h2 style="font-size: 20px; font-weight: 700; color: #ffffff; margin: 0 0 6px 0;">Recover access</h2>
            <p style="font-size: 13px; color: var(--text-muted); margin: 0 0 24px 0;">Enter your username or email address to request account recovery instructions.</p>
            <form action="/forgot-password" method="POST">
                <div class="form-group">
                    <label>Username or Email Address</label>
                    <input type="text" name="username" placeholder="username or email address" required>
                </div>
                <input type="submit" value="Send Recovery Link →">
            </form>
            <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-subtle); text-align: center; font-size: 12px; color: var(--text-muted);">
                Remembered your password? <a href="/login" style="color: var(--brand-primary); font-weight: 600; text-decoration: none;">Return to Sign In</a>
            </div>
            """
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
            db = SessionLocal()
            try:
                record_honeypot_activity(
                    db, self.client_address[0], "PAGE_VISIT",
                    username, "SUCCESS", "LOW",
                    path, self.headers.get('User-Agent', 'Unknown')
                )
            finally:
                db.close()

            content = f"""
            <!-- Hero Welcome Banner -->
            <div class="card card-elevated" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.8) 100%); border-left: 4px solid var(--brand-primary); margin-bottom: 24px; position: relative; overflow: hidden;">
                <div style="position: absolute; right: -40px; top: -40px; width: 180px; height: 180px; background: radial-gradient(circle, rgba(56, 189, 248, 0.12) 0%, transparent 70%); border-radius: 50%; pointer-events: none;"></div>
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; position: relative; z-index: 2;">
                    <div>
                        <h3 style="margin: 0 0 6px 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.02em;">Welcome back, {html.escape(username)}</h3>
                        <p class="text-muted" style="margin: 0; font-size: 13px;">Aetheris Enterprise Workspace &bull; Operational Overview &amp; Quick Services</p>
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px;">
                        <span class="badge badge-{role}">{role.upper()}</span>
                        <span class="text-muted" style="font-size: 11px;">Active Session &bull; {datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")}</span>
                    </div>
                </div>
            </div>

            <!-- Quick Action Tiles -->
            <h4 style="margin: 0 0 14px 0; color: #ffffff; font-size: 14px; font-weight: 600;">Quick Actions</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 18px; margin-bottom: 28px;">
                <a href="/profile" style="text-decoration: none;" class="card-link">
                    <div class="card card-accent-cyan" style="margin: 0; height: 100%; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--brand-primary)'; this.style.transform='translateY(-3px)';" onmouseout="this.style.borderColor='var(--border-subtle)'; this.style.transform='none';">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.25); display: flex; align-items: center; justify-content: center;">
                                <svg width="18" height="18" fill="none" stroke="var(--brand-primary)" stroke-width="2" viewBox="0 0 24 24"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                            </div>
                            <h4 style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 600;">Profile Settings</h4>
                        </div>
                        <p class="text-muted" style="margin: 0; font-size: 12px; line-height: 1.5;">Manage your account details, contact information, and security preferences.</p>
                    </div>
                </a>
                <a href="/upload" style="text-decoration: none;" class="card-link">
                    <div class="card card-accent-green" style="margin: 0; height: 100%; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--green-primary)'; this.style.transform='translateY(-3px)';" onmouseout="this.style.borderColor='var(--border-subtle)'; this.style.transform='none';">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.25); display: flex; align-items: center; justify-content: center;">
                                <svg width="18" height="18" fill="none" stroke="var(--green-primary)" stroke-width="2" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                            </div>
                            <h4 style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 600;">Resource Center</h4>
                        </div>
                        <p class="text-muted" style="margin: 0; font-size: 12px; line-height: 1.5;">Upload workspace assets, documents, and corporate repository files.</p>
                    </div>
                </a>
                <a href="/feedback" style="text-decoration: none;" class="card-link">
                    <div class="card card-accent-indigo" style="margin: 0; height: 100%; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--indigo-primary)'; this.style.transform='translateY(-3px)';" onmouseout="this.style.borderColor='var(--border-subtle)'; this.style.transform='none';">
                        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px;">
                            <div style="width: 38px; height: 38px; border-radius: 10px; background: rgba(129, 140, 248, 0.12); border: 1px solid rgba(129, 140, 248, 0.25); display: flex; align-items: center; justify-content: center;">
                                <svg width="18" height="18" fill="none" stroke="var(--indigo-primary)" stroke-width="2" viewBox="0 0 24 24"><path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/></svg>
                            </div>
                            <h4 style="margin: 0; color: #ffffff; font-size: 14px; font-weight: 600;">Feedback &amp; Support</h4>
                        </div>
                        <p class="text-muted" style="margin: 0; font-size: 12px; line-height: 1.5;">Submit support tickets, feedback, or technical assistance requests.</p>
                    </div>
                </a>
            </div>

            <!-- Workspace Overview Cards Grid -->
            <h4 style="margin: 0 0 14px 0; color: #ffffff; font-size: 14px; font-weight: 600;">Workspace Status</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; margin-bottom: 28px;">
                <div class="card" style="margin: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
                        <span style="width: 8px; height: 8px; background: var(--brand-primary); border-radius: 50%; display: inline-block;"></span>
                        <h4 style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Account Status</h4>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; border-bottom: 1px solid var(--border-subtle);"><span class="text-muted">Primary Principal</span><span style="color: #ffffff; font-weight: 500;">{html.escape(username)}</span></div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; border-bottom: 1px solid var(--border-subtle);"><span class="text-muted">Access Group</span><span class="badge badge-action">{html.escape(role)}</span></div>
                        <div style="display: flex; justify-content: space-between; align-items: center;"><span class="text-muted">Security Clearance</span><span class="badge badge-user">Verified</span></div>
                    </div>
                </div>
                <div class="card" style="margin: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
                        <span style="width: 8px; height: 8px; background: var(--green-primary); border-radius: 50%; display: inline-block;"></span>
                        <h4 style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Resource Access</h4>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; border-bottom: 1px solid var(--border-subtle);"><span class="text-muted">Resource Service</span><span class="badge badge-action">● Online</span></div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; border-bottom: 1px solid var(--border-subtle);"><span class="text-muted">Repository Sync</span><span class="badge badge-indigo">● Synchronized</span></div>
                        <div style="display: flex; justify-content: space-between; align-items: center;"><span class="text-muted">API Gateway</span><span class="badge badge-user">● Healthy</span></div>
                    </div>
                </div>
                <div class="card" style="margin: 0;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
                        <span style="width: 8px; height: 8px; background: var(--indigo-primary); border-radius: 50%; display: inline-block;"></span>
                        <h4 style="margin: 0; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Workspace Protection</h4>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; border-bottom: 1px solid var(--border-subtle);"><span class="text-muted">Data Encryption</span><span style="color: #ffffff; font-weight: 500;">AES-256</span></div>
                        <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 6px; border-bottom: 1px solid var(--border-subtle);"><span class="text-muted">Active Defense</span><span class="badge badge-user">● Enabled</span></div>
                        <div style="display: flex; justify-content: space-between; align-items: center;"><span class="text-muted">Background Services</span><span class="badge badge-action">● Operational</span></div>
                    </div>
                </div>
            </div>

            <!-- Operational Notice -->
            <div class="card card-elevated" style="margin: 0;">
                <h4 style="margin: 0 0 10px 0; color: #ffffff; font-size: 14px; font-weight: 600;">Workspace Information</h4>
                <p class="text-muted" style="margin: 0; line-height: 1.6; font-size: 12px;">Welcome to the Aetheris Enterprise Platform. Access your team services, corporate document repository, and technical feedback systems directly from this workspace portal. All activities within this operational session are securely verified and maintained under enterprise workspace policies.</p>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Workspace Overview", content, True, html.escape(username), html.escape(role)).encode('utf-8'))
            return

        # 6. PROFILE (GET/POST)
        if path == "/profile":
            if self.command == "POST":
                params = urllib.parse.parse_qs(body)
                new_email = params.get('email', [''])[0].strip()

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

                db = SessionLocal()
                try:
                    u_obj = db.query(HoneypotPortalUser).filter(HoneypotPortalUser.username == username).first()
                    if u_obj:
                        u_obj.email = new_email
                        db.commit()

                    record_honeypot_activity(
                        db, self.client_address[0], "PROFILE_UPDATE",
                        username, "SUCCESS", "LOW",
                        path, self.headers.get('User-Agent', 'Unknown')
                    )
                finally:
                    db.close()

                content = f"""
                <div class='alert alert-success'>Profile details updated successfully! Contact email saved as <strong>{html.escape(new_email)}</strong>.</div>
                <div class="card" style="max-width: 600px;">
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border-subtle);">
                        <div class="user-avatar" style="width: 48px; height: 48px; font-size: 20px;">{username[0].upper() if username else 'U'}</div>
                        <div>
                            <h3 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">{html.escape(username)}</h3>
                            <div class="text-muted" style="font-size: 12px; margin-top: 2px;">{html.escape(role.upper())} &bull; Aetheris Workspace Principal</div>
                        </div>
                    </div>
                    <form action="/profile" method="POST">
                        <div class="form-group">
                            <label>System Username</label>
                            <input type="text" value="{html.escape(username)}" disabled style="opacity: 0.6; cursor: not-allowed;">
                        </div>
                        <div class="form-group">
                            <label>Access Role / Group</label>
                            <input type="text" value="{html.escape(role)}" disabled style="opacity: 0.6; cursor: not-allowed;">
                        </div>
                        <div class="form-group">
                            <label>Contact Email Address</label>
                            <input type="email" name="email" value="{html.escape(new_email)}" required>
                        </div>
                        <input type="submit" value="Update Profile Details →">
                    </form>
                </div>
                """
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(get_lab_html("Account Settings", content, True, html.escape(username), html.escape(role)).encode('utf-8'))
                return

            # GET /profile
            db = SessionLocal()
            curr_email = ""
            try:
                u_obj = db.query(HoneypotPortalUser).filter(HoneypotPortalUser.username == username).first()
                if u_obj:
                    curr_email = u_obj.email
            finally:
                db.close()

            content = f"""
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; max-width: 900px;">
                <div class="card">
                    <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid var(--border-subtle);">
                        <div class="user-avatar" style="width: 48px; height: 48px; font-size: 20px;">{username[0].upper() if username else 'U'}</div>
                        <div>
                            <h3 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 700;">{html.escape(username)}</h3>
                            <div class="text-muted" style="font-size: 12px; margin-top: 2px;">{html.escape(role.upper())} &bull; Aetheris Workspace Principal</div>
                        </div>
                    </div>
                    <h4 style="margin: 0 0 16px 0; color: #ffffff; font-size: 14px; font-weight: 600;">Personal Information</h4>
                    <form action="/profile" method="POST">
                        <div class="form-group">
                            <label>System Username</label>
                            <input type="text" value="{html.escape(username)}" disabled style="opacity: 0.6; cursor: not-allowed;">
                        </div>
                        <div class="form-group">
                            <label>Access Role / Group</label>
                            <input type="text" value="{html.escape(role)}" disabled style="opacity: 0.6; cursor: not-allowed;">
                        </div>
                        <div class="form-group">
                            <label>Contact Email Address</label>
                            <input type="email" name="email" value="{html.escape(curr_email)}" required>
                        </div>
                        <input type="submit" value="Update Profile Details →">
                    </form>
                </div>

                <div class="card">
                    <h4 style="margin: 0 0 16px 0; color: #ffffff; font-size: 14px; font-weight: 600;">Account Security &amp; Access Clearance</h4>
                    <div style="display: flex; flex-direction: column; gap: 14px; font-size: 12px;">
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle);">
                            <span class="text-muted">Account Status</span>
                            <span class="text-success" style="font-weight: 600;">ACTIVE</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle);">
                            <span class="text-muted">Authentication Mode</span>
                            <span style="color: #ffffff; font-weight: 500;">Password / Session Token</span>
                        </div>
                        <div style="display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid var(--border-subtle);">
                            <span class="text-muted">Workspace Environment</span>
                            <span style="color: #ffffff; font-weight: 500;">Enterprise Production</span>
                        </div>
                        <div style="display: flex; justify-content: space-between;">
                            <span class="text-muted">Session ID</span>
                            <code>{self.headers.get('Cookie', 'Active Session')[:24]}...</code>
                        </div>
                    </div>
                </div>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Account Settings", content, True, html.escape(username), html.escape(role)).encode('utf-8'))
            return

        # 7. FILE UPLOAD (GET/POST)
        if path == "/upload":
            if self.command == "POST":
                uploaded_filename = "avatar.png"
                fn_match = re.search(r'filename="([^"]+)"', body)
                if fn_match:
                    uploaded_filename = fn_match.group(1)

                file_content = body.encode('utf-8')
                header_boundary = re.search(rb'\r\n\r\n', file_content)
                if header_boundary:
                    start_idx = header_boundary.end()
                    end_match = re.search(rb'\r\n---', file_content[start_idx:])
                    if end_match:
                        file_content = file_content[start_idx : start_idx + end_match.start()]
                    else:
                        file_content = file_content[start_idx:]
                else:
                    file_content = body.encode('utf-8')

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

                from backend.services.decoy_sandbox import DecoySandboxService
                import asyncio

                db = SessionLocal()
                try:
                    sandbox_service = DecoySandboxService(db)
                    loop = asyncio.new_event_loop()
                    loop.run_until_complete(
                        sandbox_service.save_and_scan_file(
                            uploaded_filename,
                            file_content,
                            self.client_address[0]
                        )
                    )
                    loop.close()

                    record_honeypot_activity(
                        db, self.client_address[0], "FILE_UPLOAD",
                        username, "SUCCESS", "LOW",
                        path, self.headers.get('User-Agent', 'Unknown')
                    )
                except Exception as ex:
                    logger.error(f"Sandbox scan failed: {ex}")
                finally:
                    db.close()

                if extension not in ["php", "jsp", "asp", "aspx", "sh", "exe", "py", "pl", "js"]:
                    self.log_attack(
                        "File Upload",
                        "LOW",
                        0.50,
                        "T1190",
                        "Restrict uploaded file extensions and execute scans inside sandbox directories.",
                        f"File '{uploaded_filename}' ({round(len(file_content) / 1024, 1)} KB) uploaded by user '{username}'."
                    )

                content = f"""
                <div class='alert alert-success'>Resource <strong>'{html.escape(uploaded_filename)}'</strong> uploaded successfully to the workspace repository!</div>
                <div class="card" style="max-width: 640px; text-align: center;">
                    <svg width="40" height="40" fill="none" stroke="var(--green-primary)" stroke-width="2" viewBox="0 0 24 24" style="margin-bottom: 12px;"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                    <h3 style="margin: 0 0 8px 0; color: #ffffff; font-size: 16px;">Upload Verified</h3>
                    <p class="text-muted" style="margin: 0 0 20px 0; font-size: 12px;">Your asset has been saved and registered under workspace ID #{random.randint(1000, 9999)}.</p>
                    <a href="/upload" style="color: var(--brand-primary); font-size: 12px; font-weight: 600; text-decoration: none;">&larr; Upload another resource</a>
                </div>
                """
                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(get_lab_html("File Uploaded", content, True, html.escape(username), html.escape(role)).encode('utf-8'))
                return

            # GET /upload
            content = """
            <div style="max-width: 640px; margin: 0 auto;">
                <div class="card" style="text-align: center; padding: 36px;">
                    <h4 style="margin: 0 0 6px 0; color: #ffffff; font-size: 16px; font-weight: 600; text-align: left;">Resource Center Repository</h4>
                    <p class="text-muted" style="margin-bottom: 24px; text-align: left; line-height: 1.5; font-size: 12px;">Upload workspace attachments, corporate assets, or internal documents to the secure Aetheris repository.</p>

                    <form action="/upload" method="POST" enctype="multipart/form-data">
                        <div style="border: 2px dashed var(--border-strong); padding: 40px 24px; border-radius: var(--radius-lg); margin-bottom: 20px; background: rgba(11, 17, 32, 0.6); cursor: pointer; transition: all 0.2s ease;" onmouseover="this.style.borderColor='var(--brand-primary)'; this.style.background='rgba(30, 41, 59, 0.6)';" onmouseout="this.style.borderColor='var(--border-strong)'; this.style.background='rgba(11, 17, 32, 0.6)';">
                            <svg width="32" height="32" fill="none" stroke="var(--brand-primary)" stroke-width="2" viewBox="0 0 24 24" style="margin-bottom: 12px;"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                            <div style="font-size: 14px; color: #ffffff; font-weight: 600; margin-bottom: 4px;">Select a resource file from your device</div>
                            <div class="text-muted" style="font-size: 11px; margin-bottom: 16px;">Supports PNG, JPG, PDF, DOCX, ZIP (Max 25MB)</div>
                            <input type="file" name="file" required id="file-uploader" style="display: none;" onchange="document.getElementById('file-name-display').textContent = this.files[0] ? this.files[0].name : '';">
                            <button type="button" onclick="document.getElementById('file-uploader').click()" style="width: auto; padding: 8px 20px; font-size: 12px;">Choose File</button>
                            <div id="file-name-display" style="margin-top: 10px; font-size: 12px; color: var(--brand-primary); font-weight: 500;"></div>
                        </div>
                        <input type="submit" value="Upload Resource →">
                    </form>
                </div>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Resource Center", content, True, html.escape(username), html.escape(role)).encode('utf-8'))
            return

        # 8. FEEDBACK (GET/POST)
        if path == "/feedback":
            if self.command == "POST":
                params = urllib.parse.parse_qs(body)
                feedback_text = params.get('comment', [''])[0].strip()

                if not feedback_text or len(feedback_text) > 1000:
                    content = "<div class='alert alert-danger'>Error: Feedback comment required (max 1000 characters).</div>"
                    self.send_response(200)
                    self.send_header("Content-Type", "text/html")
                    self.end_headers()
                    self.wfile.write(get_lab_html("Support & Feedback", content, True, html.escape(username), html.escape(role)).encode('utf-8'))
                    return

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

                db = SessionLocal()
                try:
                    fb_user = username if is_logged_in else "Guest"
                    fb_email = user.get('email') if is_logged_in else None
                    if is_logged_in:
                        u_obj = db.query(HoneypotPortalUser).filter(HoneypotPortalUser.username == username).first()
                        if u_obj:
                            fb_email = u_obj.email

                    fb = HoneypotFeedback(
                        username=fb_user,
                        email=fb_email,
                        message=feedback_text,
                        source_ip=self.client_address[0],
                        status="NEW"
                    )
                    db.add(fb)
                    db.commit()

                    record_honeypot_activity(
                        db, self.client_address[0], "FEEDBACK_SUBMISSION",
                        fb_user, "SUCCESS", "LOW",
                        path, self.headers.get('User-Agent', 'Unknown')
                    )

                    content = "<div class='alert alert-success'>Feedback recorded! Thank you for your inquiry.</div><a href='/feedback' style='color:var(--brand-primary); font-size:12px; font-weight:500; text-decoration:none;'>&larr; Back to Support Feed</a>"
                except Exception as e:
                    db.rollback()
                    logger.error(f"Feedback submission failed: {e}")
                    content = "<div class='alert alert-danger'>Error saving feedback ticket.</div>"
                finally:
                    db.close()

                self.send_response(200)
                self.send_header("Content-Type", "text/html")
                self.end_headers()
                self.wfile.write(get_lab_html("Feedback Saved", content, True, html.escape(username), html.escape(role)).encode('utf-8'))
                return

            # GET /feedback
            db = SessionLocal()
            rows = ""
            try:
                feedbacks = db.query(HoneypotFeedback).order_by(HoneypotFeedback.created_at.desc()).limit(50).all()
                for item in feedbacks:
                    safe_user = html.escape(item.username or "Guest")
                    safe_msg = html.escape(item.message or "")
                    safe_time = item.created_at.strftime("%Y-%m-%d %H:%M") if item.created_at else ""
                    rows += f"""
                    <tr>
                        <td style="font-weight: 600; color: #ffffff;">{safe_user}</td>
                        <td style="color: var(--text-main);">{safe_msg}</td>
                        <td class="text-muted">{safe_time}</td>
                    </tr>
                    """
            finally:
                db.close()

            content = f"""
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; margin-bottom: 24px;">
                <div class="card" style="margin: 0;">
                    <h4 style="margin: 0 0 6px 0; color: #ffffff; font-size: 15px; font-weight: 600;">Help us improve Aetheris</h4>
                    <p class="text-muted" style="margin: 0 0 20px 0; font-size: 12px;">Submit feedback, suggest new features, or request technical workspace support.</p>
                    <form action="/feedback" method="POST">
                        <div class="form-group">
                            <label>Feedback Message / Inquiry</label>
                            <textarea name="comment" rows="4" placeholder="Describe your inquiry, request, or issue in detail..." required></textarea>
                        </div>
                        <input type="submit" value="Submit Feedback →">
                    </form>
                </div>
                <div class="card" style="margin: 0;">
                    <h4 style="margin: 0 0 12px 0; color: #ffffff; font-size: 14px; font-weight: 600;">Support Expectations</h4>
                    <div style="display: flex; flex-direction: column; gap: 12px; font-size: 12px;" class="text-muted">
                        <div>&bull; <strong>24/7 Enterprise Response</strong>: Technical support inquiries are processed continuously by background operations.</div>
                        <div>&bull; <strong>Response SLAs</strong>: Critical workspace reports receive priority resolution within 2 hours.</div>
                        <div>&bull; <strong>Privacy Notice</strong>: Feedback logs are securely archived and accessible to workspace administrators.</div>
                    </div>
                </div>
            </div>

            <div class="card">
                <h4 style="margin: 0 0 14px 0; color: #ffffff; font-size: 15px; font-weight: 600;">Recent Feedback Submissions</h4>
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 160px;">Submitted By</th>
                                <th>Message</th>
                                <th style="width: 150px;">Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows if rows else '<tr><td colspan="3" class="text-muted" style="text-align: center;">No feedback submissions yet.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Support & Feedback", content, True, html.escape(username), html.escape(role)).encode('utf-8'))
            return

        # 9. ADMIN DASHBOARD & DYNAMIC JSON API
        if path == "/admin/dashboard" or path == "/admin/api/data":
            db = SessionLocal()
            try:
                total_users = db.query(HoneypotPortalUser).count()
                total_feedback = db.query(HoneypotFeedback).count()
                failed_logins_count = db.query(HoneypotActivityLog).filter(HoneypotActivityLog.action_type == "LOGIN_FAILURE").count()
                success_logins_count = db.query(HoneypotActivityLog).filter(HoneypotActivityLog.action_type == "LOGIN_SUCCESS").count()
                detected_attacks_count = db.query(AttackEvent).count()
                recent_activity_count = db.query(HoneypotActivityLog).count()

                activities = db.query(HoneypotActivityLog).order_by(HoneypotActivityLog.timestamp.desc()).limit(50).all()
                users = db.query(HoneypotPortalUser).order_by(HoneypotPortalUser.created_at.desc()).limit(50).all()
                feedbacks = db.query(HoneypotFeedback).order_by(HoneypotFeedback.created_at.desc()).limit(50).all()
                attacks = db.query(AttackEvent).order_by(AttackEvent.created_at.desc()).limit(50).all()

                if query == "json=1" or path == "/admin/api/data" or "application/json" in self.headers.get("Accept", ""):
                    data = {
                        "counters": {
                            "total_users": total_users,
                            "total_feedback": total_feedback,
                            "failed_logins": failed_logins_count,
                            "success_logins": success_logins_count,
                            "detected_attacks": detected_attacks_count,
                            "recent_activity": recent_activity_count
                        },
                        "activities": [
                            {
                                "id": a.id,
                                "timestamp": a.timestamp.strftime("%Y-%m-%d %H:%M:%S") if a.timestamp else "",
                                "source_ip": a.source_ip,
                                "action_type": a.action_type,
                                "username_or_email": a.username_or_email or "N/A",
                                "result": a.result,
                                "severity": a.severity,
                                "request_path": a.request_path,
                                "user_agent": a.user_agent or "N/A",
                                "attack_event_id": a.attack_event_id
                            } for a in activities
                        ],
                        "users": [
                            {
                                "id": u.id,
                                "username": u.username,
                                "email": u.email,
                                "role": u.role,
                                "status": u.status,
                                "source_ip": u.source_ip or "127.0.0.1",
                                "login_count": u.login_count,
                                "failed_login_count": u.failed_login_count,
                                "created_at": u.created_at.strftime("%Y-%m-%d %H:%M:%S") if u.created_at else ""
                            } for u in users
                        ],
                        "feedbacks": [
                            {
                                "id": f.id,
                                "username": f.username or "Guest",
                                "email": f.email or "N/A",
                                "message": f.message,
                                "source_ip": f.source_ip or "127.0.0.1",
                                "status": f.status,
                                "created_at": f.created_at.strftime("%Y-%m-%d %H:%M:%S") if f.created_at else ""
                            } for f in feedbacks
                        ],
                        "attacks": [
                            {
                                "id": at.id,
                                "time": at.created_at.strftime("%Y-%m-%d %H:%M:%S") if at.created_at else "",
                                "ip": at.source_ip,
                                "type": at.attack_type,
                                "severity": at.severity,
                                "payload": at.payload or "N/A"
                            } for at in attacks
                        ]
                    }
                    resp_bytes = json.dumps(data).encode("utf-8")
                    self.send_response(200)
                    self.send_header("Content-Type", "application/json")
                    self.send_header("Content-Length", str(len(resp_bytes)))
                    self.end_headers()
                    self.wfile.write(resp_bytes)
                    return

                # Render HTML Dashboard
                activity_rows = ""
                for a in activities:
                    sev_color = "var(--red-primary)" if a.severity in ["CRITICAL", "HIGH"] else ("var(--yellow-primary)" if a.severity == "MEDIUM" else "var(--green-primary)")
                    act_type = (a.action_type or "").upper()
                    if "SUCCESS" in act_type:
                        b_cls = "badge-user"
                    elif any(k in act_type for k in ["TRAVERSAL", "BROKEN", "XSS", "CROSS", "SQL", "ATTACK", "INTRUSION", "BYPASS"]):
                        b_cls = "badge-admin"
                    elif any(k in act_type for k in ["FAIL", "BRUTE", "WARN", "DENIED"]):
                        b_cls = "badge-warning"
                    elif any(k in act_type for k in ["PROFILE", "UPLOAD", "FEEDBACK", "REGISTER"]):
                        b_cls = "badge-indigo"
                    else:
                        b_cls = "badge-action"

                    activity_rows += f"""
                    <tr>
                        <td class="text-muted" style="white-space: nowrap;">{a.timestamp.strftime("%Y-%m-%d %H:%M:%S") if a.timestamp else ""}</td>
                        <td style="color:#ffffff; font-weight:600;">{html.escape(a.source_ip or "")}</td>
                        <td style="font-weight:600;"><span class="badge {b_cls}">{html.escape(a.action_type or "")}</span></td>
                        <td>{html.escape(a.username_or_email or "N/A")}</td>
                        <td><span style="color:{sev_color}; font-weight:600;">{html.escape(a.result or "")}</span></td>
                        <td><code>{html.escape(a.request_path or "")}</code></td>
                        <td class="text-muted" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="{html.escape(a.user_agent or 'N/A')}">{html.escape(a.user_agent or "N/A")}</td>
                    </tr>
                    """

                user_rows = ""
                for u in users:
                    user_rows += f"""
                    <tr>
                        <td style="font-weight:600; color:#ffffff;">{html.escape(u.username)}</td>
                        <td>{html.escape(u.email)}</td>
                        <td><span class="badge badge-{u.role}">{html.escape(u.role)}</span></td>
                        <td>{html.escape(u.source_ip or "127.0.0.1")}</td>
                        <td>{u.login_count} / {u.failed_login_count}</td>
                        <td class="text-muted">{u.created_at.strftime("%Y-%m-%d %H:%M") if u.created_at else ""}</td>
                    </tr>
                    """

                feedback_rows = ""
                for f in feedbacks:
                    feedback_rows += f"""
                    <tr>
                        <td style="font-weight:600; color:#ffffff; width: 130px;">{html.escape(f.username or "Guest")}</td>
                        <td style="color: var(--text-main);">{html.escape(f.message or "")}</td>
                        <td style="width: 110px;"><span class="badge badge-user">{html.escape(f.status)}</span></td>
                        <td class="text-muted" style="width: 140px;">{f.created_at.strftime("%Y-%m-%d %H:%M") if f.created_at else ""}</td>
                    </tr>
                    """

                attack_rows = ""
                for s in attacks:
                    sev_color = "var(--red-primary)" if s.severity in ["CRITICAL", "HIGH"] else ("var(--yellow-primary)" if s.severity == "MEDIUM" else "var(--brand-primary)")
                    attack_rows += f"""
                    <tr>
                        <td class="text-muted">{s.created_at.strftime("%Y-%m-%d %H:%M:%S") if s.created_at else ""}</td>
                        <td style="color:#ffffff; font-weight:500;">{html.escape(s.source_ip or "")}</td>
                        <td style="font-weight:600;">{html.escape(s.attack_type or "")}</td>
                        <td><span style="color: {sev_color}; font-weight:600;">{html.escape(s.severity or "")}</span></td>
                        <td class="text-muted" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{html.escape(s.payload or "")}</td>
                    </tr>
                    """
            finally:
                db.close()

            content = f"""
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px;">
                <div>
                    <h3 style="margin: 0; color: #ffffff; font-size: 18px; font-weight: 600;">Aetheris Operations Control Console</h3>
                    <div class="text-muted" style="font-size: 12px; margin-top: 4px;">Real-time active workspace telemetry, user management, and security activity stream</div>
                </div>
                <div style="display: flex; align-items: center; gap: 14px;">
                    <div style="display: flex; align-items: center; gap: 8px; background: rgba(30, 41, 59, 0.6); padding: 6px 14px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
                        <span style="width: 8px; height: 8px; background: var(--green-primary); border-radius: 50%; display: inline-block; box-shadow: 0 0 8px var(--green-primary);"></span>
                        <span id="poll-status" class="text-muted" style="font-size: 11px; font-weight: 500;">Polling active (5s)</span>
                    </div>
                    <button type="button" onclick="refreshAdminData()" style="padding: 8px 16px; font-size: 12px; width: auto; background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-hover) 100%); color: #07090e; font-weight: 600; border-radius: var(--radius-md); border: none; cursor: pointer; transition: all 0.2s ease;">Refresh Data</button>
                </div>
            </div>

            <!-- KPI Metric Cards Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin-bottom: 24px;">
                <div class="card card-elevated card-accent-cyan" style="margin:0; text-align: center; padding: 20px 14px;">
                    <span class="text-muted" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Registered Users</span>
                    <h2 id="cnt-users" style="color: var(--brand-primary); margin: 8px 0 0 0; font-size: 26px; font-weight: 700;">{total_users}</h2>
                </div>
                <div class="card card-elevated card-accent-cyan" style="margin:0; text-align: center; padding: 20px 14px;">
                    <span class="text-muted" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Feedback Tickets</span>
                    <h2 id="cnt-feedback" style="color: var(--brand-primary); margin: 8px 0 0 0; font-size: 26px; font-weight: 700;">{total_feedback}</h2>
                </div>
                <div class="card card-elevated card-accent-green" style="margin:0; text-align: center; padding: 20px 14px;">
                    <span class="text-muted" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Successful Logins</span>
                    <h2 id="cnt-success" style="color: var(--green-primary); margin: 8px 0 0 0; font-size: 26px; font-weight: 700;">{success_logins_count}</h2>
                </div>
                <div class="card card-elevated" style="margin:0; text-align: center; padding: 20px 14px; border-top: 3px solid var(--red-primary);">
                    <span class="text-muted" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Failed Logins</span>
                    <h2 id="cnt-failed" style="color: var(--red-primary); margin: 8px 0 0 0; font-size: 26px; font-weight: 700;">{failed_logins_count}</h2>
                </div>
                <div class="card card-elevated" style="margin:0; text-align: center; padding: 20px 14px; border-top: 3px solid var(--yellow-primary);">
                    <span class="text-muted" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Attacks Intercepted</span>
                    <h2 id="cnt-attacks" style="color: var(--yellow-primary); margin: 8px 0 0 0; font-size: 26px; font-weight: 700;">{detected_attacks_count}</h2>
                </div>
                <div class="card card-elevated card-accent-indigo" style="margin:0; text-align: center; padding: 20px 14px;">
                    <span class="text-muted" style="font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">Recent Activity</span>
                    <h2 id="cnt-activity" style="color: var(--indigo-primary); margin: 8px 0 0 0; font-size: 26px; font-weight: 700;">{recent_activity_count}</h2>
                </div>
            </div>

            <!-- Activity Stream Audit Table -->
            <div class="card" style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 14px 0; color: #ffffff; font-size: 15px; font-weight: 600;">Workspace Activity Stream Audit Log (Recent 50)</h4>
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 140px;">Timestamp</th>
                                <th>Source IP</th>
                                <th>Action Type</th>
                                <th>Principal / Subject</th>
                                <th>Result</th>
                                <th>Path</th>
                                <th>User-Agent</th>
                            </tr>
                        </thead>
                        <tbody id="tbl-activities">
                            {activity_rows if activity_rows else '<tr><td colspan="7" class="text-muted" style="text-align: center;">No activity recorded yet.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Users Registration Table -->
            <div class="card" style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 14px 0; color: #ffffff; font-size: 15px; font-weight: 600;">Workspace Account Registrations</h4>
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr><th>Username</th><th>Email</th><th>Role</th><th>Source IP</th><th>Logins (Ok/Fail)</th><th>Created</th></tr>
                        </thead>
                        <tbody id="tbl-users">
                            {user_rows if user_rows else '<tr><td colspan="6" class="text-muted" style="text-align: center;">No decoy registrations logged.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Feedback Tickets Table -->
            <div class="card" style="margin-bottom: 24px;">
                <h4 style="margin: 0 0 14px 0; color: #ffffff; font-size: 15px; font-weight: 600;">Support Feedback Feed</h4>
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr><th>Operator</th><th>Message</th><th>Status</th><th>Timestamp</th></tr>
                        </thead>
                        <tbody id="tbl-feedback">
                            {feedback_rows if feedback_rows else '<tr><td colspan="4" class="text-muted" style="text-align: center;">No feedback submissions yet.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Attack Detections Table -->
            <div class="card">
                <h4 style="margin: 0 0 14px 0; color: #ffffff; font-size: 15px; font-weight: 600;">Security Threat Detections (AttackEvents)</h4>
                <div style="overflow-x: auto;">
                    <table>
                        <thead>
                            <tr><th>Timestamp</th><th>Source IP</th><th>Attack Type</th><th>Severity</th><th>Payload Details</th></tr>
                        </thead>
                        <tbody id="tbl-attacks">
                            {attack_rows if attack_rows else '<tr><td colspan="5" class="text-muted" style="text-align: center;">No security intrusion probes logged.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>

            <script>
            let isFetchingAdminData = false;
            function escapeHtml(str) {{
                if (!str) return '';
                return String(str)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#039;');
            }}

            async function refreshAdminData() {{
                if (isFetchingAdminData) return;
                isFetchingAdminData = true;
                const statusEl = document.getElementById('poll-status');
                if (statusEl) statusEl.textContent = 'Updating...';

                try {{
                    const res = await fetch('/admin/dashboard?json=1');
                    if (!res.ok) throw new Error('HTTP ' + res.status);
                    const data = await res.json();

                    document.getElementById('cnt-users').textContent = data.counters.total_users;
                    document.getElementById('cnt-feedback').textContent = data.counters.total_feedback;
                    document.getElementById('cnt-success').textContent = data.counters.success_logins;
                    document.getElementById('cnt-failed').textContent = data.counters.failed_logins;
                    document.getElementById('cnt-attacks').textContent = data.counters.detected_attacks;
                    document.getElementById('cnt-activity').textContent = data.counters.recent_activity;

                    const actTbody = document.getElementById('tbl-activities');
                    if (data.activities.length === 0) {{
                        actTbody.innerHTML = '<tr><td colspan="7" class="text-muted" style="text-align: center;">No activity recorded yet.</td></tr>';
                    }} else {{
                        actTbody.innerHTML = data.activities.map(a => {{
                            const sevColor = (a.severity === 'CRITICAL' || a.severity === 'HIGH') ? 'var(--red-primary)' : (a.severity === 'MEDIUM' ? 'var(--yellow-primary)' : 'var(--green-primary)');
                            let badgeCls = 'badge-action';
                            const act = (a.action_type || '').toUpperCase();
                            if (act.includes('SUCCESS')) badgeCls = 'badge-user';
                            else if (act.includes('TRAVERSAL') || act.includes('BROKEN') || act.includes('XSS') || act.includes('CROSS') || act.includes('SQL') || act.includes('ATTACK') || act.includes('INTRUSION') || act.includes('BYPASS')) badgeCls = 'badge-admin';
                            else if (act.includes('FAIL') || act.includes('BRUTE') || act.includes('WARN') || act.includes('DENIED')) badgeCls = 'badge-warning';
                            else if (act.includes('PROFILE') || act.includes('UPLOAD') || act.includes('FEEDBACK') || act.includes('REGISTER')) badgeCls = 'badge-indigo';

                            return `<tr>
                                <td class="text-muted" style="white-space: nowrap;">${{escapeHtml(a.timestamp)}}</td>
                                <td style="color:#ffffff; font-weight:600;">${{escapeHtml(a.source_ip)}}</td>
                                <td style="font-weight:600;"><span class="badge ${{badgeCls}}">${{escapeHtml(a.action_type)}}</span></td>
                                <td>${{escapeHtml(a.username_or_email)}}</td>
                                <td><span style="color:${{sevColor}}; font-weight:600;">${{escapeHtml(a.result)}}</span></td>
                                <td><code>${{escapeHtml(a.request_path)}}</code></td>
                                <td class="text-muted" style="max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${{escapeHtml(a.user_agent)}}">${{escapeHtml(a.user_agent)}}</td>
                            </tr>`;
                        }}).join('');
                    }}

                    const usrTbody = document.getElementById('tbl-users');
                    if (data.users.length === 0) {{
                        usrTbody.innerHTML = '<tr><td colspan="6" class="text-muted" style="text-align: center;">No decoy registrations logged.</td></tr>';
                    }} else {{
                        usrTbody.innerHTML = data.users.map(u => `
                            <tr>
                                <td style="font-weight:600; color:#ffffff;">${{escapeHtml(u.username)}}</td>
                                <td>${{escapeHtml(u.email)}}</td>
                                <td><span class="badge badge-${{escapeHtml(u.role)}}">${{escapeHtml(u.role)}}</span></td>
                                <td>${{escapeHtml(u.source_ip)}}</td>
                                <td>${{u.login_count}} / ${{u.failed_login_count}}</td>
                                <td class="text-muted">${{escapeHtml(u.created_at)}}</td>
                            </tr>
                        `).join('');
                    }}

                    const fbTbody = document.getElementById('tbl-feedback');
                    if (data.feedbacks.length === 0) {{
                        fbTbody.innerHTML = '<tr><td colspan="4" class="text-muted" style="text-align: center;">No feedback submissions yet.</td></tr>';
                    }} else {{
                        fbTbody.innerHTML = data.feedbacks.map(f => `
                            <tr>
                                <td style="font-weight:600; color:#ffffff; width: 130px;">${{escapeHtml(f.username)}}</td>
                                <td style="color: var(--text-main);">${{escapeHtml(f.message)}}</td>
                                <td style="width: 110px;"><span class="badge badge-user">${{escapeHtml(f.status)}}</span></td>
                                <td class="text-muted" style="width: 140px;">${{escapeHtml(f.created_at)}}</td>
                            </tr>
                        `).join('');
                    }}

                    const atkTbody = document.getElementById('tbl-attacks');
                    if (data.attacks.length === 0) {{
                        atkTbody.innerHTML = '<tr><td colspan="5" class="text-muted" style="text-align: center;">No security intrusion probes logged.</td></tr>';
                    }} else {{
                        atkTbody.innerHTML = data.attacks.map(s => {{
                            const sevColor = (s.severity === 'CRITICAL' || s.severity === 'HIGH') ? 'var(--red-primary)' : (s.severity === 'MEDIUM' ? 'var(--yellow-primary)' : 'var(--brand-primary)');
                            return `<tr>
                                <td class="text-muted">${{escapeHtml(s.time)}}</td>
                                <td style="color:#ffffff; font-weight:500;">${{escapeHtml(s.ip)}}</td>
                                <td style="font-weight:600;">${{escapeHtml(s.type)}}</td>
                                <td><span style="color:${{sevColor}}; font-weight:600;">${{escapeHtml(s.severity)}}</span></td>
                                <td class="text-muted" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${{escapeHtml(s.payload)}}</td>
                            </tr>`;
                        }}).join('');
                    }}

                    if (statusEl) statusEl.textContent = 'Polling active (5s)';
                }} catch (err) {{
                    if (statusEl) statusEl.textContent = 'Sync error';
                }} finally {{
                    isFetchingAdminData = false;
                }}
            }}

            setInterval(refreshAdminData, 5000);
            </script>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Control Console", content, True, html.escape(username), html.escape(role)).encode('utf-8'))
            return

        # 10. ADMIN LOGS
        if path == "/admin/logs":
            db = SessionLocal()
            rows = ""
            try:
                logs = db.query(HoneypotActivityLog).order_by(HoneypotActivityLog.timestamp.desc()).limit(50).all()
                for log in logs:
                    act_type = (log.action_type or "").upper()
                    if "SUCCESS" in act_type:
                        badge_cls = "badge-user"
                    elif any(k in act_type for k in ["TRAVERSAL", "BROKEN", "XSS", "CROSS", "SQL", "ATTACK", "INTRUSION", "BYPASS"]):
                        badge_cls = "badge-admin"
                    elif any(k in act_type for k in ["FAIL", "BRUTE", "WARN", "DENIED"]):
                        badge_cls = "badge-warning"
                    elif any(k in act_type for k in ["PROFILE", "UPLOAD", "FEEDBACK", "REGISTER"]):
                        badge_cls = "badge-indigo"
                    else:
                        badge_cls = "badge-action"

                    rows += f"""
                    <tr>
                        <td class="text-muted" style="white-space: nowrap;">{log.timestamp.strftime("%Y-%m-%d %H:%M:%S") if log.timestamp else ""}</td>
                        <td style="color: #ffffff; font-weight: 600;">{html.escape(log.source_ip or "")}</td>
                        <td><span class="badge {badge_cls}">{html.escape(log.action_type or "")}</span></td>
                        <td><code>{html.escape(log.request_path or "")}</code></td>
                        <td>{html.escape(log.username_or_email or "N/A")}</td>
                        <td class="text-muted" style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="{html.escape(log.user_agent or 'N/A')}">{html.escape(log.user_agent or "N/A")}</td>
                    </tr>
                    """
            finally:
                db.close()

            content = f"""
            <div class="card card-elevated">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; flex-wrap: wrap; gap: 16px;">
                    <div>
                        <h4 style="margin: 0 0 4px 0; color: #ffffff; font-size: 18px; font-weight: 700;">Activity Logs &amp; Audit Trail</h4>
                        <p class="text-muted" style="margin: 0; line-height: 1.5; font-size: 12px;">Review authentication, workspace, and administrative activity.</p>
                    </div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div style="display: flex; align-items: center; gap: 6px; background: rgba(30, 41, 59, 0.6); padding: 6px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); font-size: 11px;">
                            <span style="width: 6px; height: 6px; background: var(--brand-primary); border-radius: 50%;"></span>
                            <span class="text-muted">Events Stream:</span> <strong style="color: #ffffff;">Audit Trail</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; background: rgba(30, 41, 59, 0.6); padding: 6px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); font-size: 11px;">
                            <span style="width: 6px; height: 6px; background: var(--green-primary); border-radius: 50%;"></span>
                            <span class="text-muted">Authentication:</span> <strong style="color: #ffffff;">Logged</strong>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; background: rgba(30, 41, 59, 0.6); padding: 6px 12px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); font-size: 11px;">
                            <span style="width: 6px; height: 6px; background: var(--indigo-primary); border-radius: 50%;"></span>
                            <span class="text-muted">Admin Operations:</span> <strong style="color: #ffffff;">Active</strong>
                        </div>
                    </div>
                </div>

                <div style="overflow-x: auto; max-height: 680px; overflow-y: auto;">
                    <table>
                        <thead>
                            <tr>
                                <th style="width: 160px;">Timestamp</th>
                                <th style="width: 130px;">Source IP</th>
                                <th style="width: 160px;">Action Type</th>
                                <th>URI Path</th>
                                <th style="width: 160px;">Principal / Subject</th>
                                <th>User-Agent</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows if rows else '<tr><td colspan="6" class="text-muted" style="text-align: center;">No network logs recorded yet.</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
            """
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.end_headers()
            self.wfile.write(get_lab_html("Activity Logs", content, True, html.escape(username), html.escape(role)).encode('utf-8'))
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
        self.is_ready = False
        self.lan_mode = False
        self.bind_host = "127.0.0.1"
        self.display_host = "127.0.0.1"
        self.port = 8088
        self.last_error: Optional[str] = None

    def get_local_lan_ip(self) -> str:
        """Resolve primary LAN IPv4 address non-blocking without external network hangs or virtual adapter selection."""
        import socket

        def is_valid_lan_ip(ip: str) -> bool:
            if not ip or not isinstance(ip, str):
                return False
            if ip.startswith("127.") or ip.startswith("169.254.") or ip.startswith("192.168.56."):
                return False
            parts = ip.split('.')
            if len(parts) != 4:
                return False
            try:
                if parts[0] == "172" and 17 <= int(parts[1]) <= 31:
                    return False
            except ValueError:
                return False
            return True

        # Strategy 1: UDP routing socket test to standard gateway/internet targets (short 0.2s timeout)
        for target in [("8.8.8.8", 80), ("1.1.1.1", 80), ("10.255.255.255", 1)]:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.settimeout(0.2)
                s.connect(target)
                ip = s.getsockname()[0]
                s.close()
                if is_valid_lan_ip(ip):
                    return ip
            except Exception:
                pass

        # Strategy 2: Inspect host by name IP list
        try:
            hostname = socket.gethostname()
            host_ips = socket.gethostbyname_ex(hostname)[2]
            for ip in host_ips:
                if is_valid_lan_ip(ip):
                    return ip
        except Exception:
            pass

        return "127.0.0.1"

    def start(self, lan_mode: bool = False) -> str:
        """Startup honeypot listener thread on port 8088."""
        if self.is_running:
            if self.lan_mode == lan_mode:
                return "ONLINE"
            self.stop()

        self.last_error = None
        self.lan_mode = lan_mode
        self.bind_host = "0.0.0.0" if lan_mode else "127.0.0.1"
        self.display_host = self.get_local_lan_ip() if lan_mode else "127.0.0.1"

        try:
            self.server = http.server.HTTPServer(
                (self.bind_host, self.port),
                HoneypotRequestHandler
            )
            self.server.allow_reuse_address = True

            def run_server():
                logger.info(f"Honeypot listening on http://{self.bind_host}:{self.port} starting...")
                try:
                    self.server.serve_forever()
                except Exception as ex:
                    logger.error(f"Honeypot server loop error: {ex}")
                logger.info("Honeypot server thread stopped.")

            self.thread = threading.Thread(target=run_server, daemon=True)
            self.thread.start()
            self.is_running = True
            self.is_ready = False

            # Verify socket readiness quickly (<2.0s bounded polling)
            import socket, time
            start_check = time.time()
            check_host = "127.0.0.1" if self.bind_host == "0.0.0.0" else self.bind_host
            while time.time() - start_check < 2.0:
                try:
                    test_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                    test_sock.settimeout(0.2)
                    res = test_sock.connect_ex((check_host, self.port))
                    test_sock.close()
                    if res == 0:
                        self.is_ready = True
                        break
                except Exception:
                    pass
                time.sleep(0.05)

            if not self.is_ready:
                # Still mark as running if server thread is alive
                self.is_ready = self.thread.is_alive()

            # Sync ONLINE state and resolved decoy IP/host in database
            self._update_sensor_db_state("ONLINE", self.display_host)
            logger.info(f"Honeypot service started successfully. Mode: {'LAN' if lan_mode else 'LOCAL'}, Display IP: {self.display_host}")
            return "ONLINE"
        except OSError as oe:
            err_msg = f"Port {self.port} is already in use or unavailable: {oe}"
            logger.error(f"Failed to start honeypot service: {err_msg}")
            self.last_error = f"Port {self.port} is already in use by another process."
            self.is_running = False
            self.is_ready = False
            self._update_sensor_db_state("OFFLINE")
            return "ERROR"
        except Exception as e:
            logger.error(f"Failed to start honeypot service: {e}", exc_info=True)
            self.last_error = f"Failed to start listener: {e}"
            self.is_running = False
            self.is_ready = False
            self._update_sensor_db_state("OFFLINE")
            return "ERROR"

    def stop(self) -> str:
        """Shutdown honeypot server thread cleanly."""
        if not self.is_running and not self.server:
            self.is_running = False
            self.is_ready = False
            return "OFFLINE"

        try:
            if self.server:
                self.server.shutdown()
                self.server.server_close()
            if self.thread:
                self.thread.join(timeout=1.5)

            self.server = None
            self.thread = None
            self.is_running = False
            self.is_ready = False

            # Sync OFFLINE state in database
            self._update_sensor_db_state("OFFLINE")
            logger.info("Honeypot service stopped successfully.")
            return "OFFLINE"
        except Exception as e:
            logger.error(f"Failed to stop honeypot server: {e}", exc_info=True)
            self.is_running = False
            self.is_ready = False
            return "OFFLINE"

    def get_status(self) -> str:
        """Check server state."""
        if self.is_running and (self.thread is None or not self.thread.is_alive()):
            self.is_running = False
            self.is_ready = False
            self._update_sensor_db_state("OFFLINE")
        return "ONLINE" if (self.is_running and self.is_ready) else ("STARTING" if self.is_running else "OFFLINE")

    def get_full_status(self) -> Dict[str, Any]:
        """Check detailed server state."""
        if self.is_running and (self.thread is None or not self.thread.is_alive()):
            self.is_running = False
            self.is_ready = False
            self._update_sensor_db_state("OFFLINE")

        if self.last_error and not self.is_running:
            status_str = "ERROR"
        elif self.is_running and self.is_ready:
            status_str = "ONLINE"
        elif self.is_running:
            status_str = "STARTING"
        else:
            status_str = "OFFLINE"

        current_lan_ip = self.get_local_lan_ip()
        active_display_host = current_lan_ip if self.lan_mode else "127.0.0.1"

        return {
            "status": status_str,
            "ready": self.is_running and self.is_ready,
            "lan_mode": self.lan_mode,
            "bind_host": self.bind_host,
            "host": active_display_host,
            "port": self.port,
            "url": f"http://{active_display_host}:{self.port}",
            "local_url": f"http://127.0.0.1:{self.port}",
            "lan_ip": current_lan_ip,
            "error": self.last_error
        }

    def set_mode(self, lan_mode: bool) -> Dict[str, Any]:
        """Switch binding mode between Local Only and LAN Lab."""
        if self.is_running:
            self.stop()
            self.start(lan_mode=lan_mode)
        else:
            self.lan_mode = lan_mode
            self.bind_host = "0.0.0.0" if lan_mode else "127.0.0.1"
            self.display_host = self.get_local_lan_ip() if lan_mode else "127.0.0.1"
            self._update_sensor_db_state("OFFLINE", self.display_host)

        return self.get_full_status()

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
