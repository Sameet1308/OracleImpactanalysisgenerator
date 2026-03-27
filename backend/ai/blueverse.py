"""
BlueVerse Agent API Client — calls the published AI_Elite_Ora1 agent
on the BlueVerse Marketplace for LLM-powered impact analysis reasoning.

Endpoint: POST https://blueverse-foundry.ltimindtree.com/chatservice/chat

Token management: JWT tokens expire every ~20 minutes. The token can be
updated at runtime via update_token() without restarting the server.
"""

import os
import base64
import json
import time
import httpx
import logging

logger = logging.getLogger(__name__)

BLUEVERSE_URL = "https://blueverse-foundry.ltimindtree.com/chatservice/chat"
BLUEVERSE_SPACE = "AI_Elite_ora1_45e8873c"
BLUEVERSE_FLOW_ID = "69ba8b9226e0ed36e19c0c05"
BLUEVERSE_TIMEOUT = 30  # seconds

# Mutable token state — can be updated at runtime
_token_state = {
    "token": os.getenv("BLUEVERSE_TOKEN", ""),
    "expires_at": 0,
}


def _decode_jwt_exp(token: str) -> int:
    """Extract expiration timestamp from JWT without verification."""
    try:
        payload = token.split(".")[1]
        # Add padding
        payload += "=" * (4 - len(payload) % 4)
        data = json.loads(base64.b64decode(payload))
        return data.get("exp", 0)
    except Exception:
        return 0


def update_token(token: str) -> dict:
    """Update the BlueVerse token at runtime. Returns token status."""
    _token_state["token"] = token
    exp = _decode_jwt_exp(token)
    _token_state["expires_at"] = exp
    remaining = exp - time.time() if exp else 0
    return {
        "status": "valid" if remaining > 0 else "expired",
        "expires_in_minutes": round(remaining / 60, 1) if remaining > 0 else 0,
        "expires_at": time.ctime(exp) if exp else "unknown",
    }


def get_token_status() -> dict:
    """Check current token status without updating."""
    token = _token_state["token"]
    if not token:
        return {"status": "no_token", "expires_in_minutes": 0}
    exp = _decode_jwt_exp(token) if not _token_state["expires_at"] else _token_state["expires_at"]
    remaining = exp - time.time() if exp else 0
    return {
        "status": "valid" if remaining > 60 else ("expiring_soon" if remaining > 0 else "expired"),
        "expires_in_minutes": round(remaining / 60, 1) if remaining > 0 else 0,
        "expires_at": time.ctime(exp) if exp else "unknown",
    }


# Initialize expiry from env token on load
if _token_state["token"]:
    _token_state["expires_at"] = _decode_jwt_exp(_token_state["token"])


async def call_blueverse(question: str) -> str | None:
    """
    Send a question to the BlueVerse AI_Elite_Ora1 agent.
    Returns the agent's text response, or None on failure.
    """
    token = _token_state["token"]
    if not token:
        logger.warning("No BlueVerse token configured")
        return None

    # Check if token is expired
    status = get_token_status()
    if status["status"] == "expired":
        logger.warning("BlueVerse token expired at %s — falling back", status["expires_at"])
        return None

    payload = {
        "space_name": BLUEVERSE_SPACE,
        "flowId": BLUEVERSE_FLOW_ID,
        "question": question,
    }

    headers = {"Authorization": f"Bearer {token}"}

    try:
        async with httpx.AsyncClient(timeout=BLUEVERSE_TIMEOUT) as client:
            resp = await client.post(BLUEVERSE_URL, json=payload, headers=headers)
            resp.raise_for_status()

            data = resp.json()

            # Extract text — handle both direct string and nested response shapes
            if isinstance(data, str):
                return data
            if isinstance(data, dict):
                for key in ("response", "answer", "text", "message", "result"):
                    if key in data and isinstance(data[key], str):
                        return data[key]
                return str(data)
            return str(data)

    except httpx.TimeoutException:
        logger.warning("BlueVerse API timed out after %ds", BLUEVERSE_TIMEOUT)
        return None
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            logger.warning("BlueVerse token rejected (401) — token may be expired")
        else:
            logger.warning("BlueVerse API HTTP error %s: %s", e.response.status_code, e.response.text[:200])
        return None
    except Exception as e:
        logger.warning("BlueVerse API call failed: %s", str(e))
        return None
