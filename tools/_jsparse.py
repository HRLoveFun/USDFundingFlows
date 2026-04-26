"""
_jsparse.py — minimal JS-aware balanced-block parser used by IEF tooling.

Extracted from `tools/audit_proxy_registry.py` (S2.1) so S2.2's harness
(`data/proxy_validation.py`) can reuse the same primitive without
duplicating regex-comment-aware bracket counting.

Public API:
  extract_balanced_block(src, open_idx, open_ch, close_ch) -> (end_excl, substr)
      walks `src` from `open_idx` (which must point at `open_ch`) and returns
      the index just past the matching `close_ch` plus the substring including
      both brackets. Honors '/' '"' '`' string literals and // /* */ comments.

  parse_object_keys(src, header_regex) -> dict[str, str]
      finds the named export object (e.g. NODE_PROXIES), returns
      { top_level_key: raw_value_block_string } for every top-level entry.
"""
from __future__ import annotations

import re


def extract_balanced_block(src: str, open_idx: int, open_ch: str, close_ch: str) -> tuple[int, str]:
    depth = 0
    in_str: str | None = None
    escape = False
    i = open_idx
    while i < len(src):
        c = src[i]
        if in_str:
            if escape:
                escape = False
            elif c == "\\":
                escape = True
            elif c == in_str:
                in_str = None
        else:
            if c in ('"', "'", "`"):
                in_str = c
            elif c == "/" and i + 1 < len(src) and src[i + 1] == "/":
                nl = src.find("\n", i)
                i = len(src) if nl == -1 else nl
                continue
            elif c == "/" and i + 1 < len(src) and src[i + 1] == "*":
                end = src.find("*/", i + 2)
                i = len(src) if end == -1 else end + 2
                continue
            elif c == open_ch:
                depth += 1
            elif c == close_ch:
                depth -= 1
                if depth == 0:
                    return i + 1, src[open_idx : i + 1]
        i += 1
    raise ValueError("unbalanced block")


def parse_object_keys(src: str, header_regex: str) -> dict[str, str]:
    """Find an `export const X = { ... }` style block; return {key: raw_value_block}.

    `header_regex` should match up through and including the opening `{`,
    e.g. r"export\\s+const\\s+NODE_PROXIES\\s*=\\s*\\{".
    Each value block is the raw substring including its braces (so the caller
    can re-parse with their own regex), or a primitive's literal text.
    """
    m = re.search(header_regex, src)
    if not m:
        raise RuntimeError(f"header not found: {header_regex!r}")
    open_idx = m.end() - 1
    _, block = extract_balanced_block(src, open_idx, "{", "}")
    body = block[1:-1]

    out: dict[str, str] = {}
    i = 0
    while i < len(body):
        # skip whitespace + comments + commas
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
        key_m = re.match(r"([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*", body[i:])
        if not key_m:
            i += 1
            continue
        key = key_m.group(1)
        val_start = i + key_m.end()
        if val_start >= len(body):
            break
        c = body[val_start]
        if c == "{":
            end_excl, raw = extract_balanced_block(body, val_start, "{", "}")
            out[key] = raw
            i = end_excl
        elif c == "[":
            end_excl, raw = extract_balanced_block(body, val_start, "[", "]")
            out[key] = raw
            i = end_excl
        else:
            # primitive — read until top-level comma or newline at depth 0
            j = val_start
            in_str: str | None = None
            escape = False
            while j < len(body):
                cc = body[j]
                if in_str:
                    if escape:
                        escape = False
                    elif cc == "\\":
                        escape = True
                    elif cc == in_str:
                        in_str = None
                elif cc in ('"', "'", "`"):
                    in_str = cc
                elif cc == "," or cc == "\n":
                    break
                j += 1
            out[key] = body[val_start:j].strip()
            i = j
    return out
