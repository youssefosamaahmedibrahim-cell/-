"""Render preview stills from the saved .blend without rebuilding it.

    SHOP_CAMS=hero,front,close SHOP_SAMPLES=24 SHOP_RES_X=760 python tools/blender/preview.py
"""
import bpy
import os

ROOT = os.environ.get("SHOP_ROOT", os.getcwd())
BLEND = os.path.join(ROOT, "public", "models", "secret-shop.blend")
OUT = os.environ.get("SHOP_PREVIEW_DIR", "/tmp/shop-preview")
CAMS = os.environ.get("SHOP_CAMS", "hero,front,side,close,top").split(",")
SAMPLES = int(os.environ.get("SHOP_SAMPLES", "24"))
RES_X = int(os.environ.get("SHOP_RES_X", "760"))
RES_Y = int(os.environ.get("SHOP_RES_Y", "620"))
ASPECT = RES_X / RES_Y
INDEX = {"hero": "Camera | Hero", "front": "Camera | Front", "side": "Camera | Side",
         "close": "Camera | Close", "top": "Camera | Top"}

bpy.ops.wm.open_mainfile(filepath=BLEND)
scene = bpy.context.scene
scene.cycles.samples = SAMPLES
scene.render.resolution_x = RES_X
scene.render.resolution_y = RES_Y
scene.render.resolution_percentage = 100
# keep the framing the .blend was fitted for, whatever the preview resolution
for cam in [o for o in bpy.data.objects if o.type == "CAMERA"]:
    cam.data.sensor_fit = "AUTO"
    cam.data.sensor_width = 36
os.makedirs(OUT, exist_ok=True)
for key in CAMS:
    key = key.strip()
    if not key:
        continue
    name = INDEX.get(key, key)
    scene.camera = bpy.data.objects[name]
    scene.render.filepath = os.path.join(OUT, f"{key}.png")
    bpy.ops.render.render(write_still=True)
    print("[preview]", scene.render.filepath)
