from pathlib import Path
import re

for f in Path(".").rglob("*.tsx"):
    text = f.read_text(encoding="utf-8", errors="ignore")

    new = re.sub(
        r'^\s*//\s*@ts-expect-error.*notice.*\n',
        '',
        text,
        flags=re.MULTILINE,
    )

    if new != text:
        f.write_text(new, encoding="utf-8")
        print("Patched:", f)
