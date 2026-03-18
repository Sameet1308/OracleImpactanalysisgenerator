"""
BlueVerse Agent API Client — calls the published AI_Elite_Ora1 agent
on the BlueVerse Marketplace for LLM-powered impact analysis reasoning.

Endpoint: POST https://blueverse-foundry.ltimindtree.com/chatservice/chat
"""

import os

import httpx
import logging

logger = logging.getLogger(__name__)

BLUEVERSE_URL = "https://blueverse-foundry.ltimindtree.com/chatservice/chat"
BLUEVERSE_SPACE = "AI_Elite_ora1_45e8873c"
BLUEVERSE_FLOW_ID = "69ba8b9226e0ed36e19c0c05"
BLUEVERSE_TOKEN = os.getenv("BLUEVERSE_TOKEN", "")
BLUEVERSE_TIMEOUT = 30  # seconds


async def call_blueverse(question: str) -> str | None:
    """
    Send a question to the BlueVerse AI_Elite_Ora1 agent.

    Returns the agent's text response, or None on failure.
    """
    payload = {
        "space_name": BLUEVERSE_SPACE,
        "flowId": BLUEVERSE_FLOW_ID,
        "question": question,
    }

    headers = {}
    if BLUEVERSE_TOKEN:
        headers["Authorization"] = f"Bearer {BLUEVERSE_TOKEN}"

    try:
        async with httpx.AsyncClient(timeout=BLUEVERSE_TIMEOUT) as client:
            resp = await client.post(BLUEVERSE_URL, json=payload, headers=headers)
            resp.raise_for_status()

            data = resp.json()

            # Extract text — handle both direct string and nested response shapes
            if isinstance(data, str):
                return data
            if isinstance(data, dict):
                # Try common response keys
                for key in ("response", "answer", "text", "message", "result"):
                    if key in data and isinstance(data[key], str):
                        return data[key]
                # If dict but no known key, return the whole thing as string
                return str(data)
            return str(data)

    except httpx.TimeoutException:
        logger.warning("BlueVerse API timed out after %ds", BLUEVERSE_TIMEOUT)
        return None
    except httpx.HTTPStatusError as e:
        logger.warning("BlueVerse API HTTP error %s: %s", e.response.status_code, e.response.text[:200])
        return None
    except Exception as e:
        logger.warning("BlueVerse API call failed: %s", str(e))
        return None
