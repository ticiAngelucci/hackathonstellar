from __future__ import annotations

import base64
import binascii
import hashlib
import json
from collections.abc import Mapping
from typing import Any

_MAX_DECODED_BYTES = 100 * 1024


def encode_payment_header(payload: Mapping[str, Any]) -> str:
    if not isinstance(payload, Mapping):
        raise ValueError("payment payload must be a JSON object")
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    )
    if not raw:
        raise ValueError("payment payload must not be empty")
    if len(raw) > _MAX_DECODED_BYTES:
        raise ValueError("payment payload exceeds 100 KiB")
    return base64.b64encode(raw).decode("ascii")


def payment_payload_hash(payload: Mapping[str, Any]) -> str:
    if not isinstance(payload, Mapping):
        raise ValueError("payment payload must be a JSON object")
    raw = json.dumps(payload, ensure_ascii=False, separators=(",", ":"), sort_keys=True).encode(
        "utf-8"
    )
    return hashlib.sha256(raw).hexdigest()


def decode_payment_header(value: str) -> dict[str, Any]:
    if not value or not value.strip():
        raise ValueError("payment header must not be empty")
    try:
        raw = base64.b64decode(value, validate=True)
    except (binascii.Error, ValueError) as error:
        raise ValueError("payment header is not valid Base64") from error
    if not raw:
        raise ValueError("payment header must not be empty")
    if len(raw) > _MAX_DECODED_BYTES:
        raise ValueError("payment payload exceeds 100 KiB")
    try:
        decoded = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise ValueError("payment header must contain UTF-8 JSON") from error
    if not isinstance(decoded, dict):
        raise ValueError("payment header must contain a JSON object")
    return decoded
