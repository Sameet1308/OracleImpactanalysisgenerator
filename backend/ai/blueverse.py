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


# ═══ TOKEN USAGE TRACKING ═══
_usage_stats = {
    "total_calls": 0,
    "total_prompt_chars": 0,
    "total_response_chars": 0,
    "total_latency_ms": 0,
    "failed_calls": 0,
    "hallucination_flags": 0,
}

# Known valid ORA error codes (subset for hallucination check)
VALID_ORA_CODES = {
    "ORA-00001", "ORA-00904", "ORA-00942", "ORA-01400", "ORA-01422",
    "ORA-01438", "ORA-01722", "ORA-02291", "ORA-02292", "ORA-04021",
    "ORA-04063", "ORA-06502", "ORA-06508", "ORA-06512", "ORA-12154",
    "ORA-12541", "ORA-20000", "ORA-00054", "ORA-01555", "ORA-12899",
    "ORA-00060", "ORA-01403", "ORA-06550", "ORA-00936", "ORA-00933",
}

# ═══ PROMPT SIZE GUARDRAIL ═══
MAX_PROMPT_CHARS = 12000  # ~3000 tokens at 4 chars/token

def estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English text."""
    return len(text) // 4

def check_hallucination(response: str) -> list:
    """Check AI response for potentially hallucinated ORA codes."""
    import re
    flags = []
    ora_codes = re.findall(r"ORA-\d{5}", response)
    for code in ora_codes:
        if code not in VALID_ORA_CODES:
            flags.append(f"Unverified ORA code: {code}")
    return flags

def get_usage_stats() -> dict:
    """Return token usage and quality metrics."""
    avg_latency = (_usage_stats["total_latency_ms"] / max(_usage_stats["total_calls"], 1))
    return {
        **_usage_stats,
        "avg_latency_ms": round(avg_latency),
        "est_prompt_tokens": _usage_stats["total_prompt_chars"] // 4,
        "est_response_tokens": _usage_stats["total_response_chars"] // 4,
    }


async def call_blueverse(question: str) -> str | None:
    """
    Send a question to the BlueVerse AI_Elite_Ora1 agent.
    Returns the agent's text response, or None on failure.

    Includes:
    - Token expiry pre-check (avoids wasted timeout)
    - Prompt size guardrail (truncates if too long)
    - Token usage tracking (chars, latency, call count)
    - Hallucination flagging (validates ORA codes in response)
    """
    token = _token_state["token"]
    if not token:
        logger.warning("No BlueVerse token configured")
        return None

    # GUARDRAIL: Check if token is expired BEFORE making the call
    status = get_token_status()
    if status["status"] == "expired":
        logger.warning("BlueVerse token expired at %s — skipping API call", status["expires_at"])
        return None

    # GUARDRAIL: Truncate prompt if too long (token optimization)
    prompt = question
    if len(prompt) > MAX_PROMPT_CHARS:
        logger.warning("Prompt too long (%d chars, ~%d tokens) — truncating to %d chars",
                        len(prompt), estimate_tokens(prompt), MAX_PROMPT_CHARS)
        prompt = prompt[:MAX_PROMPT_CHARS] + "\n\n[Truncated for token optimization]"

    payload = {
        "space_name": BLUEVERSE_SPACE,
        "flowId": BLUEVERSE_FLOW_ID,
        "question": prompt,
    }

    headers = {"Authorization": f"Bearer {token}"}

    _usage_stats["total_calls"] += 1
    _usage_stats["total_prompt_chars"] += len(prompt)

    try:
        start_ms = time.time() * 1000
        async with httpx.AsyncClient(timeout=BLUEVERSE_TIMEOUT) as client:
            resp = await client.post(BLUEVERSE_URL, json=payload, headers=headers)
            resp.raise_for_status()

            latency_ms = (time.time() * 1000) - start_ms
            _usage_stats["total_latency_ms"] += latency_ms

            data = resp.json()

            # Extract text — handle both direct string and nested response shapes
            response_text = None
            if isinstance(data, str):
                response_text = data
            elif isinstance(data, dict):
                for key in ("response", "answer", "text", "message", "result"):
                    if key in data and isinstance(data[key], str):
                        response_text = data[key]
                        break
                if response_text is None:
                    response_text = str(data)
            else:
                response_text = str(data)

            _usage_stats["total_response_chars"] += len(response_text)

            # GUARDRAIL: Check for hallucinated ORA codes
            hallucination_flags = check_hallucination(response_text)
            if hallucination_flags:
                _usage_stats["hallucination_flags"] += len(hallucination_flags)
                logger.warning("Hallucination flags in AI response: %s", hallucination_flags)

            logger.info("BlueVerse call: prompt=%d chars (~%d tokens), response=%d chars, latency=%dms, hallucination_flags=%d",
                        len(prompt), estimate_tokens(prompt), len(response_text), int(latency_ms), len(hallucination_flags))

            return response_text

    except httpx.TimeoutException:
        _usage_stats["failed_calls"] += 1
        logger.warning("BlueVerse API timed out after %ds", BLUEVERSE_TIMEOUT)
        return None
    except httpx.HTTPStatusError as e:
        _usage_stats["failed_calls"] += 1
        if e.response.status_code == 401:
            logger.warning("BlueVerse token rejected (401) — token may be expired")
        else:
            logger.warning("BlueVerse API HTTP error %s: %s", e.response.status_code, e.response.text[:200])
        return None
    except Exception as e:
        _usage_stats["failed_calls"] += 1
        logger.warning("BlueVerse API call failed: %s", str(e))
        return None
