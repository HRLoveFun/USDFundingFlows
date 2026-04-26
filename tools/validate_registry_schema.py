#!/usr/bin/env python3
"""
validate_registry_schema.py — S2.3 strict D-002 validator.

Goes beyond `audit_proxy_registry.py` by enforcing:

  - source     ∈ closed enum (D-002 Part B)
  - frequency  ∈ closed enum
  - units      ∈ closed enum
  - empirical.window === "36M_monthly"
  - empirical.chart_path file exists on disk
  - last_updated parses as YYYY-MM-DD
  - alternates[] uses the same enums as primary
  - permanent-not_found set (foreign_insurers, corporates_offshore) has
    primary === null and reason starts with "permanent-not_found"

Exit code:
  0  — clean
  1  — at least one violation

Usage:
  python3 tools/validate_registry_schema.py [--json]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
V2_REGISTRY = REPO_ROOT / "js" / "v2" / "proxy_registry.js"

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _jsparse import extract_balanced_block  # noqa: E402

SOURCES = {"FRED", "NYFed", "Treasury", "OFR", "BIS", "SIFMA", "ICI", "FHLB-OF", "FHFA", "CFTC", "Derived"}
FREQS = {"D", "W", "M", "Q", "irregular"}
UNITS = {"Mil. USD", "Bil. USD", "Percent", "bps", "Count", "Index", "Ratio"}

PERMANENT_NOT_FOUND = {"foreign_insurers", "corporates_offshore"}

# ──────────────────────────────────────────────────────────────────────
# Top-level entry parser (re-uses _jsparse balanced block; pulls every
# `<key>: { ... }` block under NODE_PROXIES)
# ──────────────────────────────────────────────────────────────────────
def parse_entries(path: Path) -> dict[str, str]:
    src = path.read_text(encoding="utf-8")
    m = re.search(r"export\s+const\s+NODE_PROXIES\s*=\s*\{", src)
    if not m:
        raise RuntimeError("NODE_PROXIES not found")
    open_idx = m.end() - 1
    _, block = extract_balanced_block(src, open_idx, "{", "}")
    body = block[1:-1]
    out: dict[str, str] = {}
    i = 0
    while i < len(body):
        while i < len(body) and body[i] in " \t\r\n,":
            i += 1
        if i >= len(body):
            break
        if body[i : i + 2] == "//":
            nl = body.find("\n", i)
            i = len(body) if nl == -1 else nl
            continue
        if body[i : i + 2] == "/*":
            end = body.find("*/", i + 2)
            i = len(body) if end == -1 else end + 2
            continue
        km = re.match(r"([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\{", body[i:])
        if not km:
            i += 1
            continue
        brace_open = i + km.end() - 1
        end_excl, raw = extract_balanced_block(body, brace_open, "{", "}")
        out[km.group(1)] = raw
        i = brace_open + (end_excl - brace_open)
    return out


# ──────────────────────────────────────────────────────────────────────
# Sub-block helpers
# ──────────────────────────────────────────────────────────────────────
def find_block(raw: str, key: str) -> str | None:
    """Return the literal `{...}` substring for `<key>: {...}` at top level, or None.

    Iterates with explicit depth tracking against string literals so
    nested braces inside strings or sub-objects are safe.
    """
    pat = re.compile(rf"\b{re.escape(key)}\s*:\s*")
    for m in pat.finditer(raw):
        # check we're at top level w.r.t. raw (which is itself the entry block)
        # raw[0] == '{' so we strip and walk
        if not _is_top_level(raw, m.start()):
            continue
        rest = raw[m.end():]
        if not rest.startswith("{"):
            return None
        # find balanced
        depth = 0
        in_str: str | None = None
        escape = False
        for j, c in enumerate(rest):
            if in_str:
                if escape:
                    escape = False
                elif c == "\\":
                    escape = True
                elif c == in_str:
                    in_str = None
                continue
            if c in ('"', "'", "`"):
                in_str = c
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    return rest[: j + 1]
        return None
    return None


def _is_top_level(raw: str, idx: int) -> bool:
    depth_b = 0
    depth_p = 0
    in_str: str | None = None
    escape = False
    for c in raw[1:idx]:  # skip the leading '{'
        if in_str:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == in_str:
                in_str = None
            continue
        if c in ('"', "'", "`"):
            in_str = c
            continue
        if c == "{":
            depth_b += 1
        elif c == "}":
            depth_b -= 1
        elif c == "[":
            depth_p += 1
        elif c == "]":
            depth_p -= 1
    return depth_b == 0 and depth_p == 0


def get_string_field(raw: str, key: str) -> str | None:
    """Return the literal value of `<key>: "..."` at top level, or None."""
    pat = re.compile(rf"\b{re.escape(key)}\s*:\s*[\"']([^\"']*)[\"']")
    for m in pat.finditer(raw):
        if _is_top_level(raw, m.start()):
            return m.group(1)
    return None


def has_null_field(raw: str, key: str) -> bool:
    pat = re.compile(rf"\b{re.escape(key)}\s*:\s*null\b")
    for m in pat.finditer(raw):
        if _is_top_level(raw, m.start()):
            return True
    return False


def find_top_array(raw: str, key: str) -> str | None:
    pat = re.compile(rf"\b{re.escape(key)}\s*:\s*")
    for m in pat.finditer(raw):
        if not _is_top_level(raw, m.start()):
            continue
        rest = raw[m.end():]
        if not rest.startswith("["):
            return None
        depth = 0
        in_str: str | None = None
        escape = False
        for j, c in enumerate(rest):
            if in_str:
                if escape:
                    escape = False
                elif c == "\\":
                    escape = True
                elif c == in_str:
                    in_str = None
                continue
            if c in ('"', "'", "`"):
                in_str = c
                continue
            if c == "[":
                depth += 1
            elif c == "]":
                depth -= 1
                if depth == 0:
                    return rest[: j + 1]
        return None
    return None


def split_array_objects(arr_block: str) -> list[str]:
    """Split a `[ {...}, {...} ]` block into element strings (objects only)."""
    inner = arr_block[1:-1]
    out: list[str] = []
    i = 0
    while i < len(inner):
        while i < len(inner) and inner[i] in " \t\r\n,":
            i += 1
        if i >= len(inner):
            break
        if inner[i] != "{":
            i += 1
            continue
        depth = 0
        in_str: str | None = None
        escape = False
        j = i
        while j < len(inner):
            c = inner[j]
            if in_str:
                if escape:
                    escape = False
                elif c == "\\":
                    escape = True
                elif c == in_str:
                    in_str = None
                j += 1
                continue
            if c in ('"', "'", "`"):
                in_str = c
                j += 1
                continue
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
                if depth == 0:
                    out.append(inner[i : j + 1])
                    i = j + 1
                    break
            j += 1
        else:
            break
    return out


# ──────────────────────────────────────────────────────────────────────
# Validators
# ──────────────────────────────────────────────────────────────────────
def validate_proxy_obj(obj: str, label: str, errors: list[str]) -> None:
    proxy_id = get_string_field(obj, "proxy_id")
    source = get_string_field(obj, "source")
    frequency = get_string_field(obj, "frequency")
    units = get_string_field(obj, "units")
    if not proxy_id:
        errors.append(f"{label}: proxy_id missing or non-string")
    if source is None:
        errors.append(f"{label}: source missing")
    elif source not in SOURCES:
        errors.append(f"{label}: source '{source}' not in enum {sorted(SOURCES)}")
    if frequency is None:
        errors.append(f"{label}: frequency missing")
    elif frequency not in FREQS:
        errors.append(f"{label}: frequency '{frequency}' not in enum {sorted(FREQS)}")
    if units is None:
        errors.append(f"{label}: units missing")
    elif units not in UNITS:
        errors.append(f"{label}: units '{units}' not in enum {sorted(UNITS)}")


def validate_entry(node_id: str, raw: str, errors: list[str]) -> None:
    primary_block = find_block(raw, "primary")
    primary_null = has_null_field(raw, "primary")

    if primary_block:
        validate_proxy_obj(primary_block, f"{node_id}.primary", errors)
    elif primary_null:
        reason = get_string_field(raw, "reason")
        if not reason:
            errors.append(f"{node_id}: primary:null requires `reason` (AC#3)")
        if node_id in PERMANENT_NOT_FOUND:
            if not reason or not reason.startswith("permanent-not_found"):
                errors.append(
                    f"{node_id}: D-001 permanent-not_found set requires reason starting with 'permanent-not_found'"
                )
    else:
        errors.append(f"{node_id}: primary missing (must be object or null)")

    # alternates: must be an array (possibly empty)
    alts = find_top_array(raw, "alternates")
    if alts is None:
        errors.append(f"{node_id}: alternates missing or not an array")
    else:
        for k, alt in enumerate(split_array_objects(alts)):
            validate_proxy_obj(alt, f"{node_id}.alternates[{k}]", errors)

    # theory ≥50 中文字
    theory = get_string_field(raw, "theory")
    if theory is None:
        errors.append(f"{node_id}: theory missing")
    else:
        cn = sum(1 for c in theory if "\u4e00" <= c <= "\u9fff")
        if cn < 50:
            errors.append(f"{node_id}: theory has only {cn} 中文字符 (<50)")

    # empirical
    emp = find_block(raw, "empirical")
    if emp is None:
        errors.append(f"{node_id}: empirical missing")
    else:
        win = get_string_field(emp, "window")
        if win != "36M_monthly":
            errors.append(f"{node_id}: empirical.window must be '36M_monthly' (got '{win}')")
        chart = get_string_field(emp, "chart_path")
        if not chart:
            errors.append(f"{node_id}: empirical.chart_path missing")
        else:
            if not (REPO_ROOT / chart).exists():
                errors.append(f"{node_id}: empirical.chart_path -> {chart} not found on disk")
        # corr_36m: number or null — accept either form (regex)
        if not re.search(r"\bcorr_36m\s*:\s*(?:null|-?\d)", emp):
            errors.append(f"{node_id}: empirical.corr_36m must be a number or null")

    # last_updated YYYY-MM-DD
    lu = get_string_field(raw, "last_updated")
    if not lu:
        errors.append(f"{node_id}: last_updated missing")
    else:
        try:
            date.fromisoformat(lu)
        except ValueError:
            errors.append(f"{node_id}: last_updated '{lu}' not a valid ISO date")

    # script_path: string or null
    sp_str = get_string_field(raw, "script_path")
    sp_null = has_null_field(raw, "script_path")
    if sp_str is None and not sp_null:
        errors.append(f"{node_id}: script_path missing (must be string or null)")


# ──────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    entries = parse_entries(V2_REGISTRY)
    errors: list[str] = []
    for nid, raw in sorted(entries.items()):
        validate_entry(nid, raw, errors)

    if args.json:
        print(json.dumps({"entries": len(entries), "errors": errors}, indent=2))
    else:
        print("=" * 64)
        print("S2.3 — Strict D-002 schema validation")
        print("=" * 64)
        print(f"  registry entries : {len(entries)}")
        if errors:
            print(f"  errors           : {len(errors)}")
            for e in errors:
                print(f"   ✗ {e}")
        else:
            print("  ✓ all entries valid (enums + chart_path + theory length)")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
