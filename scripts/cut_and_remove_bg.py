import os, time
os.environ["OMP_NUM_THREADS"] = "8"
from rembg import remove, new_session
from PIL import Image

# Paths
# 合图仅作流水线输入，不放 assets/ui（避免进小游戏包体）；微信工程已 ignore tools/
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHEET_PATH = os.path.join(BASE_DIR, "tools", "asset_sources", "resource_icons_sheet.png")
OUTPUT_DIR = os.path.join(BASE_DIR, "assets/ui")

# Output icon paths (left=灵石, center=体力, right=觉醒石)
ICONS = [
    ("icon_soul_stone.png", "灵石"),
    ("icon_stamina.png", "体力"),
    ("icon_awaken_stone.png", "觉醒石"),
]

MODEL = "birefnet-general"

# Step 1: Load and cut the sheet into 3 parts
print("=" * 50, flush=True)
print("Step 1: Cutting resource_icons_sheet.png into 3 icons", flush=True)
print("=" * 50, flush=True)

sheet = Image.open(SHEET_PATH)
w, h = sheet.size
print(f"Sheet size: {w}x{h}", flush=True)

# Split into 3 equal parts horizontally
third = w // 3
cuts = []
for i, (fname, label) in enumerate(ICONS):
    left = i * third
    right = (i + 1) * third if i < 2 else w  # Last piece gets any remainder
    icon = sheet.crop((left, 0, right, h))
    cuts.append(icon)
    print(f"  [{i+1}/3] {label} ({fname}): crop({left}, 0, {right}, {h}) -> {icon.size}", flush=True)

# Step 2: Remove backgrounds using birefnet-general
print(flush=True)
print("=" * 50, flush=True)
print(f"Step 2: Removing backgrounds with {MODEL}", flush=True)
print("=" * 50, flush=True)

providers = ['CPUExecutionProvider']
print(f"Loading {MODEL}...", flush=True)
t0 = time.time()
session = new_session(MODEL, providers=providers)
t1 = time.time()
print(f"Model loaded in {t1-t0:.1f}s", flush=True)

results = []
for i, (icon_img, (fname, label)) in enumerate(zip(cuts, ICONS)):
    print(f"  [{i+1}/3] Processing {label}...", flush=True, end=" ")
    t = time.time()
    result = remove(icon_img, session=session)
    elapsed = time.time() - t
    print(f"{elapsed:.1f}s", flush=True)
    results.append(result)

# Step 3: Save and replace original icons
print(flush=True)
print("=" * 50, flush=True)
print("Step 3: Saving icons (replacing originals)", flush=True)
print("=" * 50, flush=True)

for i, (result_img, (fname, label)) in enumerate(zip(results, ICONS)):
    out_path = os.path.join(OUTPUT_DIR, fname)
    # Get old size for comparison
    old_size = os.path.getsize(out_path) if os.path.exists(out_path) else 0
    result_img.save(out_path)
    new_size = os.path.getsize(out_path)
    print(f"  [{i+1}/3] {label}: {out_path}", flush=True)
    print(f"         Old: {old_size/1024:.1f} KB -> New: {new_size/1024:.1f} KB", flush=True)

print(flush=True)
print("All done!", flush=True)
