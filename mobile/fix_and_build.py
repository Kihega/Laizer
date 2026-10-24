import json, os, shutil, struct, subprocess, sys, zlib

if not os.path.exists("app.json"):
    sys.exit("Run from the project root (folder with app.json).")

shutil.copy("app.json", "/tmp/app.json.bak")
with open("app.json") as f:
    root = json.load(f)
expo = root.get("expo", root)

def valid_png(p):
    try:
        with open(p, "rb") as f:
            return f.read(8) == b"\x89PNG\r\n\x1a\n" and os.path.getsize(p) > 100
    except OSError:
        return False

def make_png(path, size=1024, rgb=(14, 116, 144)):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    row = b"\x00" + bytes(rgb + (255,)) * size
    raw = zlib.compress(row * size, 9)
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    data = (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", raw) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(data)

def ensure_image(path, label):
    if valid_png(path):
        print(f"OK  {label}: {path}")
        return
    name = os.path.basename(path)
    for d, _, files in os.walk("assets"):
        for fn in files:
            cand = os.path.join(d, fn)
            if fn == name and valid_png(cand):
                shutil.copy(cand, path)
                print(f"+   {label}: copied {cand}")
                return
    make_png(path)
    print(f"+   {label}: created placeholder at {path} (replace with your real image later)")

# 1. remove properties SDK 57 rejects
if "splash" in expo:
    expo.pop("splash")
    print("-   removed top-level 'splash'")
android = expo.setdefault("android", {})
if "edgeToEdgeEnabled" in android:
    android.pop("edgeToEdgeEnabled")
    print("-   removed android.edgeToEdgeEnabled")

# 2. fix image paths
if "icon" in expo:
    ensure_image(expo["icon"], "icon")
ai = android.get("adaptiveIcon", {})
if "foregroundImage" in ai:
    ensure_image(ai["foregroundImage"], "adaptive foreground")

# 3. make sure package + projectId exist
android.setdefault("package", "com.laizer.app")
expo.setdefault("extra", {}).setdefault("eas", {}).setdefault(
    "projectId", "7c261c77-30d2-4946-b85c-0f7fd6ef6d56")

with open("app.json", "w") as f:
    json.dump(root, f, indent=2); f.write("\n")

# 4. eas.json: silence the version warning
if os.path.exists("eas.json"):
    with open("eas.json") as f:
        cfg = json.load(f)
    cfg.setdefault("cli", {}).setdefault("appVersionSource", "local")
    with open("eas.json", "w") as f:
        json.dump(cfg, f, indent=2); f.write("\n")

# 5. remove stray backups and the generated android folder
for b in ("app.json.bak", "eas.json.bak"):
    if os.path.exists(b):
        os.remove(b)
shutil.rmtree("android", ignore_errors=True)

def run(cmd, env=None):
    print("\n$", " ".join(cmd))
    return subprocess.call(cmd, env=env)

# 6. peer dependencies
run(["npx", "expo", "install", "expo-font", "expo-linking", "react-native-worklets"])
run(["npx", "expo", "install", "--fix"])

# 7. local prebuild check (same step that failed on EAS)
if run(["npx", "expo", "prebuild", "--platform", "android", "--clean", "--no-install"]) != 0:
    sys.exit("\nPrebuild still fails locally. Paste the error here.")
shutil.rmtree("android", ignore_errors=True)

# 8. build
env = dict(os.environ, EAS_NO_VCS="1")
cmd = ["eas"] if shutil.which("eas") else ["npx", "eas-cli"]
sys.exit(run(cmd + ["build", "-p", "android", "--profile", "preview"], env))
