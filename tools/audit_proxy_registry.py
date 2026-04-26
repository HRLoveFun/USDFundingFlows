#!/usr/bin/env python3
"""
audit_proxy_registry.py — S2.1 audit (report-only).

Reports the gap between:
  - canonical node ID set:    js/constants.js  `export const NODES = [...]`
                              (v2/constants.js re-exports v1's NODES verbatim
                              via `V1_NODES.map(withNodeProxy)`, so v1 is the
                              source of truth for node IDs.)
  - current proxy registry:   js/v2/proxy_registry.js  `NODE_PROXIES = {...}`

Against spec §Acceptance #2 schema:
  primary: {proxy_id, source, frequency, units}   (or primary: null + reason)
  alternates: [...]
  theory      (≥50 字中文)
  empirical:  {window: "36M_monthly", corr_36m, chart_path}
  last_updated
  script_path

D-001 awareness:
  - Permanent not_found set ({foreign_insurers, corporates_offshore}) must
    have `primary: null + reason` per spec §Acceptance #3.
  - Whitelist-pending nodes (external sources to be implemented in S2.4) are
    expected to keep External-source primaries until S2.4. They are flagged
    informationally as `pending-S2.4`, not as errors.

Exit code:
  0  — no errors (coverage complete + schema complete or only pending-S2.4 gaps)
  1  — errors present (used to gate later Steps; on first run, errors are
       expected and inform D-002).

Usage:
  python3 tools/audit_proxy_registry.py [--json]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
V1_CONSTANTS = REPO_ROOT / "js" / "constants.js"
V2_REGISTRY = REPO_ROOT / "js" / "v2" / "proxy_registry.js"

# Per D-001
PERMANENT_NOT_FOUND = {"foreign_insurers", "corporates_offshore"}

# Required top-level fields per spec §Acceptance #2
REQUIRED_FIELDS = ["primary", "alternates", "theory", "empirical", "last_updated", "script_path"]
REQUIRED_PRIMARY_FIELDS = ["proxy_id", "source", "frequency", "units"]
REQUIRED_EMPIRICAL_FIELDS = ["window", "corr_36m", "chart_path"]


# ──────────────────────────────────────────────────────────────────────
# Parsers (regex-based; project has no build step / no node parser dep)
# Balanced-block primitive lives in tools/_jsparse.py (shared with S2.2).
# ──────────────────────────────────────────────────────────────────────
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _jsparse import extract_balanced_block  # noqa: E402


def parse_v1_node_ids(path: Path) -> list[str]:
    src = path.read_text(encoding="utf-8")
    m = re.search(r"export\s+const\s+NODES\s*=\s*\[", src)
    if not m:
        raise RuntimeError(f"NODES array not found in {path}")
    open_idx = m.end() - 1
    _, block = extract_balanced_block(src, open_idx, "[", "]")
    # collect id: "..." occurrences (skip nested edge defs — but NODES block
    # contains only node objects)
    ids = re.findall(r"\bid:\s*[\"']([a-zA-Z0-9_]+)[\"']", block)
    return ids


def parse_registry_entries(path: Path) -> dict[str, dict]:
    """Return { node_id: {raw_block: str, fields: set[str]} }."""
    src = path.read_text(encoding="utf-8")
    m = re.search(r"export\s+const\s+NODE_PROXIES\s*=\s*\{", src)
    if not m:
        raise RuntimeError(f"NODE_PROXIES object not found in {path}")
    open_idx = m.end() - 1
    _, block = extract_balanced_block(src, open_idx, "{", "}")
    body = block[1:-1]

    entries: dict[str, dict] = {}
    i = 0
    while i < len(body):
        # skip whitespace + line comments
        while i < len(body) and body[i] in " \t\r\n,":
            i += 1
        if i < len(body) and body[i : i + 2] == "//":
            nl = body.find("\n", i)
            i = len(body) if nl == -1 else nl
            continue
        if i < len(body) and body[i : i + 2] == "/*":
            end = body.find("*/", i + 2)
            i = len(body) if end == -1 else end + 2
            continue
        if i >= len(body):
            break
        key_m = re.match(r"([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*\{", body[i:])
        if not key_m:
            # bail if unexpected token; advance one char to avoid infinite loop
            i += 1
            continue
        key = key_m.group(1)
        brace_open = i + key_m.end() - 1  # position of '{' relative to body
        end_excl, raw = extract_balanced_block(body, brace_open, "{", "}")
        fields = set(re.findall(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\s*:", raw[1:-1]))
        # but we want only top-level fields — re-parse top-level
        top_fields = set()
        inner = raw[1:-1]
        j = 0
        depth_b = 0
        depth_p = 0
        in_str: str | None = None
        escape = False
        token_start: int | None = None
        last_token: str | None = None
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
                depth_b += 1
            elif c == "}":
                depth_b -= 1
            elif c == "[":
                depth_p += 1
            elif c == "]":
                depth_p -= 1
            elif depth_b == 0 and depth_p == 0:
                if c.isalpha() or c == "_":
                    if token_start is None:
                        token_start = j
                elif c == ":" and token_start is not None:
                    top_fields.add(inner[token_start:j].strip())
                    token_start = None
                elif c == "," or c == "\n":
                    token_start = None
                else:
                    if not (c.isalnum() or c == "_"):
                        token_start = None
            j += 1
        entries[key] = {"raw": raw, "fields": top_fields}
        i = brace_open + (end_excl - brace_open)
    return entries


# ──────────────────────────────────────────────────────────────────────
# Audit
# ──────────────────────────────────────────────────────────────────────
def audit(node_ids: list[str], entries: dict[str, dict]) -> dict:
    node_id_set = set(node_ids)
    registry_keys = set(entries.keys())

    missing_in_registry = sorted(node_id_set - registry_keys)
    orphan_in_registry = sorted(registry_keys - node_id_set)

    schema_report: list[dict] = []
    for nid in sorted(node_id_set & registry_keys):
        fields = entries[nid]["fields"]
        raw = entries[nid]["raw"]
        missing_top = [f for f in REQUIRED_FIELDS if f not in fields]
        # primary sub-shape (only if `primary:` exists and is an object — quick heuristic)
        primary_subgaps: list[str] = []
        empirical_subgaps: list[str] = []
        primary_is_null = bool(re.search(r"\bprimary\s*:\s*null\b", raw))
        has_primary_obj = bool(re.search(r"\bprimary\s*:\s*\{", raw))
        if has_primary_obj:
            for sf in REQUIRED_PRIMARY_FIELDS:
                if not re.search(rf"\b{sf}\s*:", raw):
                    primary_subgaps.append(sf)
        elif primary_is_null:
            # AC#3: primary:null requires `reason`
            if not re.search(r"\breason\s*:", raw):
                primary_subgaps.append("reason (required when primary:null per AC#3)")
        has_empirical_obj = bool(re.search(r"\bempirical\s*:\s*\{", raw))
        if has_empirical_obj:
            for sf in REQUIRED_EMPIRICAL_FIELDS:
                if not re.search(rf"\b{sf}\s*:", raw):
                    empirical_subgaps.append(sf)

        # D-001 classification
        d001_class: str | None = None
        if nid in PERMANENT_NOT_FOUND:
            d001_class = "permanent-not_found"
        else:
            uses_external = bool(re.search(r"source:\s*[\"']External[\"']", raw)) or bool(
                re.search(r"proxy_status:\s*[\"'](external|partial)[\"']", raw)
            )
            if uses_external:
                d001_class = "pending-S2.4"

        schema_report.append(
            {
                "node_id": nid,
                "missing_top_fields": missing_top,
                "primary_subgaps": primary_subgaps,
                "empirical_subgaps": empirical_subgaps,
                "d001_class": d001_class,
            }
        )

    return {
        "summary": {
            "node_count": len(node_id_set),
            "registry_count": len(registry_keys),
            "missing_in_registry": missing_in_registry,
            "orphan_in_registry": orphan_in_registry,
        },
        "schema": schema_report,
    }


# ──────────────────────────────────────────────────────────────────────
# Reporting
# ──────────────────────────────────────────────────────────────────────
def render_text(report: dict) -> tuple[str, int]:
    lines: list[str] = []
    s = report["summary"]
    lines.append("=" * 72)
    lines.append("S2.1 — Proxy Registry Audit")
    lines.append("=" * 72)
    lines.append(f"  canonical NODES count : {s['node_count']}  (js/constants.js)")
    lines.append(f"  registry keys count   : {s['registry_count']}  (js/v2/proxy_registry.js)")
    lines.append("")

    err = 0
    pending = 0

    # A) Coverage
    lines.append("A) Coverage")
    if s["missing_in_registry"]:
        err += len(s["missing_in_registry"])
        lines.append(f"  ✗ {len(s['missing_in_registry'])} node(s) missing in registry:")
        for n in s["missing_in_registry"]:
            lines.append(f"      - {n}")
    else:
        lines.append("  ✓ every NODES id has a registry entry")
    if s["orphan_in_registry"]:
        err += len(s["orphan_in_registry"])
        lines.append(f"  ✗ {len(s['orphan_in_registry'])} registry key(s) not in NODES (orphans):")
        for n in s["orphan_in_registry"]:
            lines.append(f"      - {n}")
    else:
        lines.append("  ✓ no orphan registry keys")
    lines.append("")

    # B) Schema
    lines.append("B) Schema gaps (per spec §Acceptance #2)")
    schema_err_rows: list[str] = []
    pending_rows: list[str] = []
    not_found_rows: list[str] = []
    for r in report["schema"]:
        gaps = []
        if r["missing_top_fields"]:
            gaps.append(f"missing top-level: {','.join(r['missing_top_fields'])}")
        if r["primary_subgaps"]:
            gaps.append(f"primary missing: {','.join(r['primary_subgaps'])}")
        if r["empirical_subgaps"]:
            gaps.append(f"empirical missing: {','.join(r['empirical_subgaps'])}")
        if not gaps:
            continue
        line = f"      - {r['node_id']:<30s}  {' | '.join(gaps)}"
        if r["d001_class"] == "permanent-not_found":
            not_found_rows.append(line)
            err += 1  # AC#3 still requires primary:null + reason
        elif r["d001_class"] == "pending-S2.4":
            pending_rows.append(line)
            pending += 1
        else:
            schema_err_rows.append(line)
            err += 1

    if schema_err_rows:
        lines.append(f"  ✗ {len(schema_err_rows)} entr(ies) with schema gaps (NOT pending S2.4):")
        lines.extend(schema_err_rows)
    if not_found_rows:
        lines.append(
            f"  ✗ {len(not_found_rows)} permanent-not_found node(s) need `primary: null + reason` per AC#3:"
        )
        lines.extend(not_found_rows)
    if pending_rows:
        lines.append(
            f"  ⓘ {len(pending_rows)} entr(ies) deferred to S2.4 (whitelist-source fetcher work) — informational:"
        )
        lines.extend(pending_rows)
    if not (schema_err_rows or not_found_rows or pending_rows):
        lines.append("  ✓ all entries pass schema check")
    lines.append("")

    # Summary
    lines.append("=" * 72)
    lines.append(f"  ERRORS:   {err}")
    lines.append(f"  PENDING:  {pending}  (expected — resolved in S2.4)")
    lines.append("=" * 72)
    return "\n".join(lines), 0 if err == 0 else 1


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--json", action="store_true", help="emit JSON instead of text")
    args = p.parse_args()

    node_ids = parse_v1_node_ids(V1_CONSTANTS)
    entries = parse_registry_entries(V2_REGISTRY)
    report = audit(node_ids, entries)

    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
        # exit code mirrors text mode
        return 0 if not (report["summary"]["missing_in_registry"] or report["summary"]["orphan_in_registry"] or any(
            (r["missing_top_fields"] or r["primary_subgaps"] or r["empirical_subgaps"])
            and r["d001_class"] != "pending-S2.4"
            for r in report["schema"]
        )) else 1

    text, code = render_text(report)
    print(text)
    return code


if __name__ == "__main__":
    sys.exit(main())
