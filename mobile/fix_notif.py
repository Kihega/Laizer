import json, os, shutil, struct, subprocess, sys, zlib

with open("app.json") as f:
    root = json.load(f)
expo = root.get("expo", root)

def valid_png(p):
    try:
        with open(p, "rb") as f:
            return f.read(8) == b"\x89PNG\r\n\x1a\n" and os.path.getsize(p) > 100
    except OSError:
        return False

def make_icon(path, size=96):
    # white circle on transparent background (Android notification style)
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    c, r = size / 2, size * 0.4
    rows = b""
    for y in range(size):
        rows += b"\x00"
        for x in range(size):
            inside = (x - c) ** 2 + (y - c) ** 2 <= r * r
            rows += b"\xff\xff\xff\xff" if inside else b"\x00\x00\x00\x00"
    def chunk(t, d):
        return (struct.pack(">I", len(d)) + t + d
                + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff))
    png = (b"\x89PNG\r\n\x1a\n"
           + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
           + chunk(b"IDAT", zlib.compress(rows, 9)) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)

found = False
for i, p in enumerate(expo.get("plugins", [])):
    if isinstance(p, list) and p and p[0] == "expo-notifications":
        found = True
        cfg = p[1] if len(p) > 1 and isinstance(p[1], dict) else {}
        icon = cfg.get("icon")
        print("expo-notifications config:", cfg)
        if icon and not valid_png(icon):
            make_icon(icon)
            print(f"+ created valid notification icon at {icon}")
        elif not icon:
            print("OK no icon set")
        else:
            print(f"icon {icon} is already a valid PNG")
            # try a regenerated one anyway in case it is the wrong format
            make_icon(icon)
            print("+ regenerated it to be safe")
        p[1:] = [cfg]
print("" if found else "! expo-notifications not in plugins array (may be in app.config.js)")

# also validate the other images again
for key, path in [("icon", expo.get("icon")),
                  ("adaptive", expo.get("android", {}).get("adaptiveIcon", {}).get("foregroundImage"))]:
    if path:
        print(key, path, "OK" if valid_png(path) else "INVALID")

with open("app.json", "w") as f:
    json.dump(root, f, indent=2); f.write("\n")

shutil.rmtree("android", ignore_errors=True)
r = subprocess.call(["npx", "expo", "prebuild", "--platform", "android", "--clean", "--no-install"])
shutil.rmtree("android", ignore_errors=True)
if r != 0:
    sys.exit("\nPrebuild still failing. Paste the output here.")

env = dict(os.environ, EAS_NO_VCS="1")
cmd = ["eas"] if shutil.which("eas") else ["npx", "eas-cli"]
sys.exit(subprocess.call(cmd + ["build", "-p", "android", "--profile", "preview"], env=env))
