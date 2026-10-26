import ipaddress
import logging
import urllib.request
import urllib.parse
import json
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# RFC 6598 Carrier-Grade NAT (Shared Address Space)
RFC6598_CGNAT_NET = ipaddress.ip_network("100.64.0.0/10")

class ThreatIntelService:
    def __init__(self, db_session=None, settings_service=None):
        self.db = db_session
        self.settings_service = settings_service

    def _query_free_geoip(self, ip: str) -> Optional[Dict[str, Any]]:
        """Query free GeoIP lookup to fetch country, city, ISP, and coordinates."""
        # Using ip-api.com JSON endpoint (free, no API key required for low volume)
        url = f"http://ip-api.com/json/{ip}"
        try:
            req = urllib.request.Request(
                url,
                headers={"User-Agent": "SentinelAI/1.0"},
                method="GET"
            )
            with urllib.request.urlopen(req, timeout=3.0) as response:
                if response.status == 200:
                    res_body = response.read().decode('utf-8')
                    parsed = json.loads(res_body)
                    if parsed.get("status") == "success":
                        return parsed
        except Exception as e:
            logger.warning(f"Free GeoIP API query failed for {ip}: {e}")
        return None

    def _query_abuseipdb(self, ip: str, api_key: str) -> Optional[Dict[str, Any]]:
        """Query AbuseIPDB Check endpoint to fetch threat metrics."""
        url = "https://api.abuseipdb.com/api/v2/check"
        params = {
            "ipAddress": ip,
            "maxAgeInDays": "90"
        }
        query_string = urllib.parse.urlencode(params)
        full_url = f"{url}?{query_string}"
        try:
            req = urllib.request.Request(
                full_url,
                headers={
                    "Key": api_key,
                    "Accept": "application/json"
                },
                method="GET"
            )
            with urllib.request.urlopen(req, timeout=3.0) as response:
                if response.status == 200:
                    res_body = response.read().decode('utf-8')
                    parsed = json.loads(res_body)
                    return parsed.get("data")
        except Exception as e:
            logger.warning(f"AbuseIPDB API query failed for {ip}: {e}")
        return None

    def enrich_ip(self, ip: str) -> Dict[str, Any]:
        """
        Enrich IP address with GeoIP, ASN, threat scores, and reputation data.
        Modular architecture supports swapping in AbuseIPDB, VT, Shodan.
        """
        if not self.settings_service:
            from backend.core.registry import get_settings_service
            self.settings_service = get_settings_service()

        abuse_key = None
        if self.db and self.settings_service:
            try:
                abuse_key = self.settings_service.get_setting(self.db, "abuseipdb_api_key", None)
            except Exception as e:
                logger.warning(f"Failed to fetch setting keys: {e}")

        # Comprehensive classification of non-globally-routable & special-purpose addresses
        # Prevents sending internal/special IP traffic to external GeoIP lookups and avoids fabricated locations
        try:
            ip_obj = ipaddress.ip_address(ip)
        except (ValueError, TypeError):
            return {
                "ip": ip,
                "country": "Unknown",
                "country_code": "UN",
                "city": "Unknown",
                "asn": "Unknown",
                "isp": "Unknown",
                "threat_score": 0,
                "risk_level": "LOW",
                "confidence": 0.0,
                "reputation_summary": "Invalid or unparseable IP address format.",
                "provider_statuses": {
                    "AbuseIPDB": "N/A",
                    "VirusTotal": "N/A",
                    "Shodan": "N/A",
                    "AlienVault_OTX": "N/A"
                },
                "latitude": 0.0,
                "longitude": 0.0
            }

        if ip_obj.is_loopback:
            return {
                "ip": ip,
                "country": "Loopback / Private Network",
                "country_code": "LAN",
                "city": "Loopback / Private Network",
                "asn": "Loopback / Private Network",
                "isp": "Loopback / Private Network",
                "threat_score": 0,
                "risk_level": "LOW",
                "confidence": 1.0,
                "reputation_summary": "This IP address belongs to the local loopback interface. It is restricted to internal host communications and contains no external public routing footprint.",
                "provider_statuses": {
                    "AbuseIPDB": "N/A",
                    "VirusTotal": "N/A",
                    "Shodan": "N/A",
                    "AlienVault_OTX": "N/A"
                },
                "latitude": 0.0,
                "longitude": 0.0
            }

        if ip_obj.is_private:
            return {
                "ip": ip,
                "country": "Loopback / Private Network",
                "country_code": "LAN",
                "city": "Loopback / Private Network",
                "asn": "Loopback / Private Network",
                "isp": "Loopback / Private Network",
                "threat_score": 0,
                "risk_level": "LOW",
                "confidence": 1.0,
                "reputation_summary": "This IP address belongs to a private network address space (RFC 1918). It is restricted to internal communications and contains no external public routing footprint.",
                "provider_statuses": {
                    "AbuseIPDB": "N/A",
                    "VirusTotal": "N/A",
                    "Shodan": "N/A",
                    "AlienVault_OTX": "N/A"
                },
                "latitude": 0.0,
                "longitude": 0.0
            }

        # RFC 6598 Shared Address Space (Carrier-Grade NAT / CGNAT, 100.64.0.0/10)
        if ip_obj in RFC6598_CGNAT_NET:
            return {
                "ip": ip,
                "country": "Unknown",
                "country_code": "UN",
                "city": "Unknown",
                "asn": "RFC 6598",
                "isp": "Shared Address Space (CGNAT)",
                "threat_score": 0,
                "risk_level": "LOW",
                "confidence": 1.0,
                "reputation_summary": "This IP address belongs to RFC 6598 Shared Address Space (Carrier-Grade NAT, 100.64.0.0/10). It is non-globally-routable and carries no public geolocation footprint.",
                "provider_statuses": {
                    "AbuseIPDB": "N/A",
                    "VirusTotal": "N/A",
                    "Shodan": "N/A",
                    "AlienVault_OTX": "N/A"
                },
                "latitude": 0.0,
                "longitude": 0.0
            }

        # Link-local, multicast, reserved, unspecified, or non-global addresses
        if not ip_obj.is_global or ip_obj.is_link_local or ip_obj.is_multicast or ip_obj.is_reserved or ip_obj.is_unspecified:
            return {
                "ip": ip,
                "country": "Unknown",
                "country_code": "UN",
                "city": "Unknown",
                "asn": "Special-Purpose",
                "isp": "Special-Purpose Address",
                "threat_score": 0,
                "risk_level": "LOW",
                "confidence": 1.0,
                "reputation_summary": "This IP address belongs to a special-purpose or reserved address block. It is non-globally-routable and carries no public geolocation footprint.",
                "provider_statuses": {
                    "AbuseIPDB": "N/A",
                    "VirusTotal": "N/A",
                    "Shodan": "N/A",
                    "AlienVault_OTX": "N/A"
                },
                "latitude": 0.0,
                "longitude": 0.0
            }

        # Resolve live GeoIP coordinates & provider statuses for public routable addresses
        geoip = self._query_free_geoip(ip)
        abuse_data = None
        if abuse_key:
            abuse_data = self._query_abuseipdb(ip, abuse_key)

        provider_statuses = {
            "AbuseIPDB": "MOCKED" if not abuse_key else ("LIVE" if abuse_data else "OFFLINE"),
            "VirusTotal": "MOCKED",
            "Shodan": "MOCKED",
            "AlienVault_OTX": "MOCKED"
        }

        # Accurate GeoIP resolution with strict unknown fallbacks (never arbitrary hashing)
        if geoip and geoip.get("status") == "success":
            country = geoip.get("country") or "Unknown"
            country_code = geoip.get("countryCode") or "UN"
            city = geoip.get("city") or "Unknown"
            asn = geoip.get("as", "AS00000").split(" ")[0] if geoip.get("as") else "Unknown"
            isp = geoip.get("isp") or "Unknown ISP"
            latitude = float(geoip.get("lat", 0.0))
            longitude = float(geoip.get("lon", 0.0))
        else:
            country = "Unknown"
            country_code = "UN"
            city = "Unknown"
            asn = "Unknown"
            isp = "Unknown"
            latitude = 0.0
            longitude = 0.0

        # Resolve threat scores and risk classifications
        if abuse_data:
            threat_score = int(abuse_data.get("abuseConfidenceScore", 0))
            confidence = 0.99
            reputation_summary = (
                f"AbuseIPDB reports {abuse_data.get('totalReports', 0)} incident logs for this host. "
                f"Abuse score is {threat_score}%. Domain: {abuse_data.get('domain', 'Unknown')}."
            )
        else:
            threat_score = 0
            confidence = 0.5
            reputation_summary = "Public IP address evaluated without external reputation provider enrichment."

        if threat_score < 25:
            risk_level = "LOW"
        elif threat_score < 55:
            risk_level = "MEDIUM"
        elif threat_score < 80:
            risk_level = "HIGH"
        else:
            risk_level = "CRITICAL"

        return {
            "ip": ip,
            "country": country,
            "country_code": country_code,
            "city": city,
            "asn": asn,
            "isp": isp,
            "threat_score": threat_score,
            "risk_level": risk_level,
            "confidence": confidence,
            "reputation_summary": reputation_summary,
            "provider_statuses": provider_statuses,
            "latitude": latitude,
            "longitude": longitude
        }
