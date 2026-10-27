import re
from pathlib import Path

def patch(path, subs):
    f = Path(path)
    text = f.read_text()
    orig = text
    for pattern, repl in subs:
        text, n = re.subn(pattern, repl, text)
        print(f"  {n}x  {pattern[:50]}")
    if text != orig:
        f.write_text(text)
        print(f"patched {path}")
    else:
        print(f"NO CHANGE {path}")

# 1. Tab icon color can be null in the new types
for p in ["app/(owner)/_layout.tsx", "app/(worker)/_layout.tsx"]:
    patch(p, [(r"color=\{color\}(?! as string)", "color={color as string}")])

# 2-4. reports.tsx
patch("app/(owner)/reports.tsx", [
    (r"from (['\"])expo-file-system\1", r"from \1expo-file-system/legacy\1"),
    (r"\{row\.byServiceType && Object\.keys\(", "{!!row.byServiceType && Object.keys("),
    (r"StyleSheet\.absoluteFillObject", "StyleSheet.absoluteFill"),
])

# 5. StatusBadge variant type
patch("app/(worker)/equipment.tsx", [
    (r"type=\{item\.condition\}", "type={item.condition as any}"),
])

# 6. Buffer does not exist in React Native; use atob (JWT payload decode)
patch("store/authStore.ts", [
    (r"Buffer\.from\(access\.split\('\.'\)\[1\], 'base64'\)\.toString\('utf-8'\)",
     "((s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/')"
     ".padEnd(Math.ceil(s.length / 4) * 4, '=')))(access.split('.')[1])"),
])
