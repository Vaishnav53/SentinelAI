import logging
import urllib.request
import json
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

class NotificationService:
    def __init__(self, db_session=None, settings_service=None):
        self.db = db_session
        self.settings_service = settings_service

    def get_setting(self, key: str, default: Any = None) -> Any:
        if self.db and self.settings_service:
            try:
                return self.settings_service.get_setting(self.db, key, default)
            except Exception as e:
                logger.warning(f"Failed to load setting {key}: {e}")
        return default

    def trigger_notifications(self, attack: Dict[str, Any]):
        """
        Evaluate alert rules and fire active notifications (Slack, Discord, Email).
        Graceful fallbacks are implemented if integrations are not configured.
        """
        # 1. Read configuration settings
        severity_threshold = self.get_setting("alert_severity_threshold", "HIGH")
        score_threshold = float(self.get_setting("alert_score_threshold", 70.0))
        
        slack_webhook = self.get_setting("slack_webhook_url", "")
        discord_webhook = self.get_setting("discord_webhook_url", "")
        smtp_recipient = self.get_setting("alert_email_recipient", "")

        # Severity hierarchy checks
        severities = ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
        try:
            thresh_idx = severities.index(severity_threshold.upper())
            attack_idx = severities.index(attack.get("severity", "LOW").upper())
        except ValueError:
            thresh_idx = 2  # Default to HIGH
            attack_idx = 0

        # Evaluate rules and thresholds
        matches_severity = attack_idx >= thresh_idx
        matches_score = float(attack.get("threat_score", 0)) >= score_threshold

        if not (matches_severity or matches_score):
            # Does not meet alert criteria thresholds
            return

        message = (
            f"⚠️ *SentinelAI SOC Alert* ⚠️\n"
            f"*Incident ID:* {attack.get('external_id')}\n"
            f"*Attack Type:* {attack.get('attack_type')}\n"
            f"*Severity:* {attack.get('severity')} | *Threat Score:* {attack.get('threat_score')}/10\n"
            f"*Source IP:* {attack.get('source_ip')} ({attack.get('country')})\n"
            f"*Target Port:* {attack.get('destination_port')} | *Service:* {attack.get('target_service')}"
        )

        # Dispatch 1: Slack
        if slack_webhook:
            self._dispatch_webhook("Slack", slack_webhook, {"text": message})
        else:
            logger.info("Slack notifications not configured. Skipping.")

        # Dispatch 2: Discord
        if discord_webhook:
            # Discord format supports slack text payloads or custom embeds
            self._dispatch_webhook("Discord", discord_webhook, {"content": message})
        else:
            logger.info("Discord notifications not configured. Skipping.")

        # Dispatch 3: Email
        if smtp_recipient:
            logger.info(f"[SMTP DISPATCH MOCK] Sending SOC alert alert-incident details to SMTP mailserver target: {smtp_recipient}")
            logger.info(f"[SMTP BODY] Subject: SentinelAI Incident Alert - {attack.get('attack_type')}\n\n{message}")
        else:
            logger.info("Email notifications not configured. Skipping.")

    def _dispatch_webhook(self, provider: str, url: str, payload: dict):
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={"Content-Type": "application/json", "User-Agent": "SentinelAI/1.0"},
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=3.0) as response:
                if response.status in (200, 204):
                    logger.info(f"Notification triggered successfully via {provider}.")
                else:
                    logger.warning(f"Notification failed via {provider}. Status: {response.status}")
        except Exception as e:
            logger.warning(f"Failed to post alert payload to {provider} hook: {e}")
