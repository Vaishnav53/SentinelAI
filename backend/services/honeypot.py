import threading
import logging
import http.server
import urllib.parse
from datetime import datetime
from typing import Dict, Any, Optional
from backend.database.session import SessionLocal
from backend.models.models import AttackEvent, HoneypotSensor
from backend.services.detection import DetectionEngine

logger = logging.getLogger(__name__)

class HoneypotRequestHandler(http.server.BaseHTTPRequestHandler):
    # Reference to the DetectionEngine and database seeder context
    detection_engine = DetectionEngine()

    def log_message(self, format, *args):
        # Override to suppress standard HTTP request logs in console
        pass

    def handle_request(self):
        # Parse query params
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path
        query_params = parsed_url.query

        # Read POST body/payload if present
        content_length = int(self.headers.get('Content-Length', 0))
        body = ""
        if content_length > 0:
            try:
                body = self.rfile.read(content_length).decode('utf-8', errors='ignore')
            except Exception as e:
                logger.error(f"Error reading request body: {e}")

        # Convert headers object to dictionary
        headers_dict = {key.lower(): value for key, value in self.headers.items()}
        user_agent = headers_dict.get('user-agent', 'Unknown')
        source_ip = self.client_address[0]
        source_port = self.client_address[1]

        # Analyze request via DetectionEngine
        detection = self.detection_engine.analyze_request(
            method=self.command,
            path=path,
            query_params=query_params,
            headers=headers_dict,
            body=body
        )

        # Default fallback values for general probes/normal queries
        if detection is None:
            detection = {
                "attack_type": "Reconnaissance Probe",
                "severity": "LOW",
                "confidence": 0.85,
                "mitre_id": "T1595",
                "recommendation": "Normal traffic detected on decoy port. Monitor for recurring scanner probes."
            }

        # Store captured event in SQLite Database
        db = SessionLocal()
        try:
            attack_event = AttackEvent(
                external_id=f"HON-{int(datetime.utcnow().timestamp())}",
                attack_type=detection["attack_type"],
                severity=detection["severity"],
                status="NEW",
                source_ip=source_ip,
                source_port=source_port,
                destination_port=8088,
                protocol="HTTP",
                target_service="HTTP Honeypot",
                country="Local",
                city="Loopback",
                payload=f"Method: {self.command}\nPath: {path}\nQuery: {query_params}\nBody: {body}\nHeaders: {str(headers_dict)}",
                user_agent=user_agent,
                sensor_id="HTTP Honeypot",
                threat_score=9.0 if detection["severity"] == "CRITICAL" else (7.0 if detection["severity"] == "HIGH" else (4.0 if detection["severity"] == "MEDIUM" else 1.5)),
                confidence=detection["confidence"],
                raw_metadata=__import__("json").dumps({
                    "mitre_id": detection["mitre_id"],
                    "recommendation": detection["recommendation"]
                }),
                created_at=datetime.utcnow()
            )
            db.add(attack_event)
            
            # Also update "HTTP Honeypot" sensor heartbeat
            sensor = db.query(HoneypotSensor).filter(HoneypotSensor.name == "HTTP Honeypot").first()
            if sensor:
                sensor.last_heartbeat = datetime.utcnow()
                sensor.state = "ONLINE"
                
            db.commit()
            logger.info(f"Captured {detection['attack_type']} attack from {source_ip} on port 8088.")
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to record honeypot event to database: {e}", exc_info=True)
        finally:
            db.close()

        # Send simulated/bait web response
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Server", "Apache/2.4.41 (Unix) OpenSSL/1.1.1d")
        self.end_headers()
        
        fake_router_html = """<!DOCTYPE html>
<html>
<head>
    <title>Broadband Router - Administration Login</title>
    <style>
        body { background-color: #0d1117; color: #c9d1d9; font-family: Arial, sans-serif; padding: 50px; text-align: center; }
        .container { border: 1px solid #30363d; background-color: #161b22; padding: 30px; display: inline-block; text-align: left; border-radius: 6px; box-shadow: 0 4px 10px rgba(0,0,0,0.5); }
        h2 { color: #58a6ff; margin-bottom: 20px; font-weight: normal; }
        input[type=text], input[type=password] { width: 100%; padding: 8px; margin: 8px 0; box-sizing: border-box; background-color: #0d1117; border: 1px solid #30363d; color: white; border-radius: 4px; }
        input[type=submit] { background-color: #238636; color: white; border: none; padding: 10px 20px; cursor: pointer; border-radius: 4px; font-weight: bold; width: 100%; margin-top: 10px; }
        input[type=submit]:hover { background-color: #2ea043; }
        .footer { font-size: 11px; color: #8b949e; text-align: center; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h2>Broadband Router Console</h2>
        <form action="/login" method="POST">
            <label>Operator Username</label><input type="text" name="username" placeholder="admin">
            <label>Security Password</label><input type="password" name="password">
            <input type="submit" value="Sign In">
        </form>
        <div class="footer">Firmware Build: v4.12.80-generic</div>
    </div>
</body>
</html>
"""
        self.wfile.write(fake_router_html.encode('utf-8'))

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

    def start(self) -> str:
        """Startup honeypot listener thread on port 8088."""
        if self.is_running:
            return "ONLINE"

        try:
            self.server = http.server.HTTPServer(
                (self.host, self.port),
                HoneypotRequestHandler
            )
            # Create runner target
            def run_server():
                logger.info(f"Honeypot listening on http://{self.host}:{self.port} starting...")
                self.server.serve_forever()
                logger.info("Honeypot server thread stopped.")

            self.thread = threading.Thread(target=run_server, daemon=True)
            self.thread.start()
            self.is_running = True
            
            # Sync ONLINE state in database for Honeypot Lab lists
            self._update_sensor_db_state("ONLINE")
            logger.info("Honeypot service started successfully.")
            return "ONLINE"
        except Exception as e:
            logger.error(f"Failed to start honeypot service: {e}", exc_info=True)
            return "ERROR"

    def stop(self) -> str:
        """Shutdown honeypot server thread cleanly."""
        if not self.is_running or not self.server:
            return "OFFLINE"

        try:
            # Trigger server shutdown
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
        # If thread crashed/died, sync status
        if self.is_running and (self.thread is None or not self.thread.is_alive()):
            self.is_running = False
            self._update_sensor_db_state("OFFLINE")
            
        return "ONLINE" if self.is_running else "OFFLINE"

    def _update_sensor_db_state(self, state: str):
        db = SessionLocal()
        try:
            sensor = db.query(HoneypotSensor).filter(HoneypotSensor.name == "HTTP Honeypot").first()
            if sensor:
                sensor.state = state
                if state == "ONLINE":
                    sensor.last_heartbeat = datetime.utcnow()
                db.commit()
        except Exception as e:
            db.rollback()
            logger.error(f"Failed to update sensor state in database: {e}")
        finally:
            db.close()
