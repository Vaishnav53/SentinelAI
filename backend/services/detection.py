import re
from typing import Dict, Any, Optional

class DetectionEngine:
    def __init__(self):
        # 1. SQL Injection regexes
        self.sqli_patterns = [
            re.compile(r"'.*or.*'.*=.*'", re.IGNORECASE),
            re.compile(r"union\s+select", re.IGNORECASE),
            re.compile(r"select\s+.*\s+from", re.IGNORECASE),
            re.compile(r"insert\s+into", re.IGNORECASE),
            re.compile(r"update\s+.*\s+set", re.IGNORECASE),
            re.compile(r"delete\s+from", re.IGNORECASE),
            re.compile(r"drop\s+table", re.IGNORECASE),
            re.compile(r"'\s*or\s*1\s*=\s*1", re.IGNORECASE),
            re.compile(r"--", re.IGNORECASE),
            re.compile(r"/\*.*\*/", re.IGNORECASE)
        ]

        # 2. XSS regexes
        self.xss_patterns = [
            re.compile(r"<script.*?>", re.IGNORECASE),
            re.compile(r"<\/script>", re.IGNORECASE),
            re.compile(r"javascript\s*:", re.IGNORECASE),
            re.compile(r"onerror\s*=", re.IGNORECASE),
            re.compile(r"onload\s*=", re.IGNORECASE),
            re.compile(r"alert\s*\(", re.IGNORECASE),
            re.compile(r"document\.cookie", re.IGNORECASE)
        ]

        # 3. Command Injection regexes
        self.cmd_patterns = [
            re.compile(r";\s*(cat|ls|pwd|whoami|id|netstat|ipconfig|ifconfig|ping|wget|curl)\b", re.IGNORECASE),
            re.compile(r"\|\s*(cat|ls|pwd|whoami|id|netstat|ipconfig|ifconfig|ping|wget|curl)\b", re.IGNORECASE),
            re.compile(r"&&\s*(cat|ls|pwd|whoami|id|netstat|ipconfig|ifconfig|ping|wget|curl)\b", re.IGNORECASE),
            re.compile(r"\b(powershell|cmd\.exe|bash|sh|nc)\b", re.IGNORECASE)
        ]

        # 4. Directory Traversal regexes
        self.traversal_patterns = [
            re.compile(r"\.\./", re.IGNORECASE),
            re.compile(r"\.\.\\", re.IGNORECASE),
            re.compile(r"/etc/passwd", re.IGNORECASE),
            re.compile(r"/etc/shadow", re.IGNORECASE),
            re.compile(r"windows/win\.ini", re.IGNORECASE),
            re.compile(r"win\.ini", re.IGNORECASE),
            re.compile(r"boot\.ini", re.IGNORECASE)
        ]

        # 5. File Inclusion regexes
        self.inclusion_patterns = [
            re.compile(r"file://", re.IGNORECASE),
            re.compile(r"php://", re.IGNORECASE),
            re.compile(r"data://", re.IGNORECASE),
            re.compile(r"https?://", re.IGNORECASE)
        ]

        # 6. Admin Panel Discovery targets
        self.admin_paths = [
            "/admin", "/wp-admin", "/administrator", "/login.php", 
            "/phpmyadmin", "/dashboard", "/console", "/controlpanel"
        ]

        # 7. Config File Probing targets
        self.config_paths = [
            ".env", "web.config", "config.php", "config.json", 
            "settings.py", "database.yml", ".git/config"
        ]

        # 8. User-Agent Scanner lookups
        self.scanner_agents = [
            "nmap", "sqlmap", "nikto", "w3af", "acunetix", "nessus", 
            "dirbuster", "gobuster", "zap", "burpsuite", "masscan"
        ]

    def analyze_request(self, method: str, path: str, query_params: str, headers: Dict[str, str], body: str) -> Optional[Dict[str, Any]]:
        """
        Scan all components of an incoming HTTP request and determine if it represents an attack.
        Returns a dictionary with details if an attack is detected, otherwise None.
        """
        # Build composite strings to scan
        full_url_query = f"{path}?{query_params}" if query_params else path
        user_agent = headers.get("user-agent", "").lower()
        payloads = [full_url_query, body]

        # 1. Scanner Check via User Agent
        for scanner in self.scanner_agents:
            if scanner in user_agent:
                return {
                    "attack_type": "User-Agent Scanning",
                    "severity": "MEDIUM",
                    "confidence": 0.95,
                    "mitre_id": "T1595",
                    "recommendation": f"Block user-agent scanner signature '{scanner}' via Web Application Firewall (WAF) rule."
                }

        # 2. Directory Traversal Check
        for pattern in self.traversal_patterns:
            for source in payloads:
                if pattern.search(source):
                    return {
                        "attack_type": "Directory Traversal",
                        "severity": "CRITICAL",
                        "confidence": 0.98,
                        "mitre_id": "T1083",
                        "recommendation": "Restrict local directory permissions and validate path parameters using absolute path resolution."
                    }

        # 3. SQL Injection Check
        for pattern in self.sqli_patterns:
            for source in payloads:
                if pattern.search(source):
                    return {
                        "attack_type": "SQL Injection",
                        "severity": "CRITICAL",
                        "confidence": 0.96,
                        "mitre_id": "T1190",
                        "recommendation": "Implement prepared statements/parameterized queries and sanitize user-provided database input."
                    }

        # 4. XSS Check
        for pattern in self.xss_patterns:
            for source in payloads:
                if pattern.search(source):
                    return {
                        "attack_type": "Cross-Site Scripting (XSS)",
                        "severity": "HIGH",
                        "confidence": 0.92,
                        "mitre_id": "T1189",
                        "recommendation": "Sanitize and html-encode all dynamic context variables and configure a strict Content Security Policy (CSP)."
                    }

        # 5. Command Injection Check
        for pattern in self.cmd_patterns:
            for source in payloads:
                if pattern.search(source):
                    return {
                        "attack_type": "Command Injection",
                        "severity": "CRITICAL",
                        "confidence": 0.97,
                        "mitre_id": "T1203",
                        "recommendation": "Avoid passing user input directly to shell executors; use strict input whitelisting or programmatic APIs."
                    }

        # 6. File Inclusion Check
        for pattern in self.inclusion_patterns:
            # File inclusion parameters typically show up in query parameters (e.g. ?file=http://...)
            if "file=" in full_url_query.lower() or "page=" in full_url_query.lower():
                if pattern.search(full_url_query):
                    return {
                        "attack_type": "File Inclusion",
                        "severity": "HIGH",
                        "confidence": 0.90,
                        "mitre_id": "T1190",
                        "recommendation": "Disable remote file inclusion in PHP configurations (allow_url_include=Off) and whitelist local files."
                    }

        # 7. Config File Probing Check
        for cfg in self.config_paths:
            if cfg in path.lower():
                return {
                    "attack_type": "Config File Probing",
                    "severity": "HIGH",
                    "confidence": 0.95,
                    "mitre_id": "T1082",
                    "recommendation": "Ensure configuration files and Git directories are blocked from public access in HTTP server configurations."
                }

        # 8. Admin Panel Discovery Check
        for admin_path in self.admin_paths:
            if path.lower().startswith(admin_path):
                return {
                    "attack_type": "Admin Panel Discovery",
                    "severity": "MEDIUM",
                    "confidence": 0.85,
                    "mitre_id": "T1083",
                    "recommendation": "Restrict administrative logins to secure corporate IP subnets and implement multi-factor authentication."
                }

        # 9. Suspicious Fuzzing (Extreme input sizes or binary symbols)
        if len(body) > 2048 or len(path) > 512:
            return {
                "attack_type": "Suspicious Fuzzing",
                "severity": "MEDIUM",
                "confidence": 0.80,
                "mitre_id": "T1490",
                "recommendation": "Configure request limit filters in proxy/WAF configuration to reject excessively long headers or body contents."
            }

        return None
