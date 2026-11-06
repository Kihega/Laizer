#!/usr/bin/env python3
"""
Laizer patch V19 (includes V12-V16; safe to run on top of any earlier version of this patch) — run from the project ROOT (the folder containing mobile/ and backend/).

    python3 patch.py            apply
    python3 patch.py --check    only verify, change nothing
 python3 patch.py --no-npm      skip the automatic `npm uninstall expo-print`
    python3 patch.py --force    apply even if a file differs from the version this patch was made for
                                (your copy of that file is backed up first)

Safe: validates everything first, writes nothing if a problem is found, backs up every
file it replaces into .patch_v19_backup/, and can be re-run (already-applied files are skipped).
"""
import base64, hashlib, os, shutil, subprocess, sys, zlib

MARK = b"__LAIZER_PATCH_V1"   # present in every file written by an earlier version of this patch
FILES = [  # (path, list of accepted sha256 of the file before patching, or None if new, compressed new content)
    ('backend/prisma/schema.prisma', ['c0f9360ab09979d88b6b600ff770f443dd9af7832c015879635b235eee335ac5', '937bed2c1f31989663699173cb42a9e3f9819a311f40671285d07db39d16dd56', '8c995c32026f91450af621eeff8ee124b1e611292aed8cb62ae27da1c5dd02a0', 'b09ce2d67cb8eb920e24c8bd8734a65293c5abe03b09dc94466cd8b03abe0589', '059e5972d7d2e560208b3fc2350c7da83c781d909a716877b2a7fb17b0d9f335'],
     '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'),
    ('backend/src/lib/audit.js', ['5054f3ae4f398be336aafb4f8809e7d9cf384b8b48869b3487c292c693144010', 'e7cbcbee6c2b97bdd4264202ccf104d7a2c6cf9540da863ec16c9fa5289eea78', '491a48cf8e127a91c12decaf06f5cc6d1a2f5770931377bfb2bb36c62ae65338', '6cd0dd322482190162227f64d8a8b05742b494949da6429c92763a6c64bc8d8d', '46920f3cd1db250ce008b3ae65242403f816adca350824905259f350d603f3e0'],
     'eNptlt2OokgUx+95inNXaBzsZO/GbCZEy162HehQ2J1Np2MYKbvZYMEWsLbpMdmH2CfcJ9lThWgBeoH4r9/54NSxDtMpsO+MwX//'
     '/AtunaQVZPkbvPOs4NKaTmEZp1kteQmx5JCKiosqzUWcZUcoD/iVH3iijWNtzKXMZQn7uqxA8L+5hCQtZV1UsI9TATvkHcva5gLX'
     '3XnkBT6DX+HTAgiefRpuVsG952/Yej6njH0FAHJDJ5Mev3S91TqkA/6sa/45CB9uBCC39KHBNQK5pWsDVIJ1pJLofEijayQKHqi/'
     'CekypOy3K0k6uibn1I9CupmH1I3o4oKSrm6i68fFTfSsm+iCqto/XXAy1M0ShPTeYxENW+dkoJu0y5h3718TIT3dZKPQ9dmShq1r'
     'MtRNfJD3UO/iK9qpSFfXKIuC+cOgzEA6ukH2q9ySZpUbpR+9JTvRafjkzalqpnsz0a7eQenCi26hjd5BexmQnq5ZP4iUxLABzM4l'
     'hm5yWI/FLU7pJjcofVfXaEgfgzAaol3dqCgLVp3gbUWVbmDuYkG7SRq65taRt/KiP/rbTnp6h+1tPOnpHbZf+J5u9ugj/i3wdoGV'
     '1htAbujIn2aWNR2PLRjDs0wrDrFoT1xRyaMDdcmll+Ape4QfHESdZbDLJWK5OO7zugQ8jEVVOuhhasXlUWxhV4utOszVie/qO7vx'
     'MoFY/5zAnlexOp9PI31GYyT9DdCc4J8g+V8TcByHf1QyhhOyymSmmYxXkBZukuD4KHFFJXVdUaHcN8wJVwhp9HQHNnocnYO0YXaH'
     'BCFccN55nHBZvpCPL/h0h1gmPFF35HV2tjADKrtv6uqURZZWNpmQ0cvdq1PJdG+P4KsO5qQF/Pypkxu1TszcGNLize5EV+tfYgWQ'
     'V2VMyMgps3TL7bsJ/HJ3d3Z00lccoqzKcXrGOEQBjbhMt/A7C3w9anEqhhyHJNgiB3ycdBtXOFKbza3iHxnXG/n96XHUuvMEFDJP'
     '6mb3jnlNEjjorqhyDNFzssEoZePJaT0s0aPID3Dg8Kca1arOOa6nYpdDmQOGjouCxzjKdX4Cn1tlWzqX3W9xm7zo94ZXMtEP5ZS6'
     'YOnuaH9Cv58uuzO51tjsn5Gu3Akw/e072BvsBJiOjTeN8RSrerKsS8s617eI893M2mNtMDv+UeSyUo1woWfW/x1+fYQ='),
    ('backend/src/routes/reports.js', ['a72b5b034c444c747ff9a38849c3423c6a74b10477938ec8d4de3bed7c127983', 'db57e7ae8a3cd9f7c9af6bb2d07913491e1f01a0f77e795a17c50a994c2cf92a', '5b8cd437cb326202fa5522455f9cdd87770440069bb37f302b532566399c4ba2', '8e90042fadcc4f00a5eceabc59f83f2d370ad52042fd9bcf1b754be08314e6f9', '7ffd1dfbbea6c799924753eb9489d4dda4d5f75617514c22af380d6ae36ba64a', '6e890745a5bd247bd3eaf088adc62f2b0bc04d2c3c8af00e7506c91cb46b2794'],
     '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'),
    ('backend/src/routes/workers.js', ['8289640df6b96b68984a9d4c7970962c8704072c8e4dd4cffcd8326028694035', '195cdd54e6f9ca8c2bd110da14522626184e93228b26026053a9449f9bbf34c1'],
     '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'),
    ('mobile/app/(owner)/workers.tsx', ['3a9794160440308fa42a5b9783941afb3710d366e3bee61441662e481e848613', '902fc578cc025b273c38b61f0e284d2b0f56cc8d8d60523682fa7af3c8246264', '3b5286cefbe19e034d8c1f5563773b71fa991a427b8aae8c6eab8ae99900b75c', '5387efb47d37964eddf6e8fe87f138c200d64c9f329a7c69fd480be62e7c0b65'],
     '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'),
    ('mobile/components/BranchReports.tsx', None,
     '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'
     'XhqWtnIbx5bIet39qewxRaIcKtr/AFPst5Y='),
    ('mobile/components/ReportDetail.tsx', None,
     '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'
     '/wEeDyAQ'),
]

def sha(b): return hashlib.sha256(b).hexdigest()

def remove_expo_print():
    """The PDF report was removed, so drop the now-unused expo-print package."""
    try:
        has = "expo-print" in open(os.path.join("mobile", "package.json"), encoding="utf-8").read()
    except OSError:
        has = False
    if not has:
        return
    print("\nRemoving the unused expo-print package ...")
    ok = False
    try:
        ok = subprocess.run(["npm", "uninstall", "expo-print"], cwd="mobile", timeout=600).returncode == 0
    except Exception as e:  # npm missing, timeout, no network ...
        print("  (" + str(e) + ")")
    if ok:
        print("expo-print removed. Commit mobile/package.json AND mobile/package-lock.json.")
    else:
        print("!! Could not remove it automatically. Run this yourself:\n     cd mobile && npm uninstall expo-print")


def main():
    force = "--force" in sys.argv
    check = "--check" in sys.argv
    if not (os.path.isdir("mobile") and os.path.isdir("backend")):
        sys.exit("ERROR: run this from the project root (the folder that contains mobile/ and backend/).")
    plan, problems, skipped = [], [], 0
    for rel, orig, blob in FILES:
        path = rel
        if blob is None:                       # file removed by this patch
            if os.path.exists(path):
                cur = open(path, "rb").read()
                if sha(cur) in orig or MARK in cur or force:
                    plan.append((path, None, cur))
                else:
                    problems.append("differs from the expected version (edited since?): " + path)
            continue
        new = zlib.decompress(base64.b64decode(blob))
        cur = open(path, "rb").read() if os.path.exists(path) else None
        if cur is not None and sha(cur) == sha(new):
            skipped += 1; continue
        if orig is None:
            plan.append((path, new, cur))
        elif cur is None:
            problems.append("missing file: " + path)
        elif sha(cur) not in orig and MARK not in cur and not force:
            problems.append("differs from the expected version (edited since?): " + path)
        else:
            plan.append((path, new, cur))
    if problems:
        print("Nothing was changed. Problems found:")
        for p in problems: print("  -", p)
        print("\nRe-run with --force to overwrite those files (they are backed up first).")
        sys.exit(1)
    if check:
        print("OK: %d file(s) would be written, %d already up to date." % (len(plan), skipped)); return
    bdir = ".patch_v19_backup"
    for path, new, cur in plan:
        if cur is not None:
            b = os.path.join(bdir, path); os.makedirs(os.path.dirname(b), exist_ok=True)
            if not os.path.exists(b): shutil.copy2(path, b)
        if new is None:
            os.remove(path); print("removed " + path); continue
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "wb") as f: f.write(new)
        print(("updated " if cur is not None else "created ") + path)
    print("\nDone: %d written, %d already up to date." % (len(plan), skipped))
    if "--no-npm" not in sys.argv:
        remove_expo_print()
    if plan:
        print("Next:\n  cd backend && npx prisma generate   # picks up the schema additions"
              "\n  (server start runs `prisma db push`, which applies them)"
              "\n  cd ../mobile && npx tsc --noEmit        # optional check"
              "\n  Rebuild the APK:  eas build -p android --profile preview")

if __name__ == "__main__":
    main()
