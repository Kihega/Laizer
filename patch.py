#!/usr/bin/env python3
"""
SMSS — Patch Script 3: Remove duplicate Jest config from package.json
======================================================================
Run from the ROOT of your repository:

    python remove_jest_from_package_json.py

The problem
-----------
Jest found two config sources:
  1. backend/jest.config.js          (created by patch script 2)
  2. backend/package.json `jest` key (pre-existing)

Jest refuses to run with both present. This script removes the `jest`
key from package.json so jest.config.js is the single source of truth.

Safe to run multiple times — idempotent.
"""

import json
import sys
from pathlib import Path

TARGET = Path("backend/package.json")


def main():
    if not TARGET.exists():
        print(f"❌  {TARGET} not found. Run from repo root.")
        sys.exit(1)

    raw  = TARGET.read_text(encoding="utf-8")
    data = json.loads(raw)

    if "jest" not in data:
        print(f"✅  No `jest` key in {TARGET} — nothing to do.")
        return

    removed = data.pop("jest")
    TARGET.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")

    print(f"✅  Removed `jest` key from {TARGET}")
    print(f"    (was: {json.dumps(removed)})")
    print()
    print("Now run:  cd backend && npm test")


if __name__ == "__main__":
    main()
