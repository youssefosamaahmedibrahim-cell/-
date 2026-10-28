"""
SECRET SHOP — procedural Blender build (tested with Blender 4.2 / bpy 4.2.23).

Run:
    SHOP_ROOT=/path/to/repo blender --background --python tools/blender/build_shop.py
or, without a Blender install, with the official `bpy` Python module:
    SHOP_ROOT=/path/to/repo python tools/blender/build_shop.py

It writes:
    public/models/secret-shop.blend   (self contained: packed font + materials)
    public/models/secret-shop.glb     (game-engine friendly copy)
    /tmp/shop-preview/*.png           (turntable preview renders, optional)

Design coordinates: X = width, Y = depth, Z = up, entrance towards -Y.
The two roof tiers never intersect: the lower roof is a skirt around the
upper storey, the top roof starts above its inner edge.
"""

import bpy
import bmesh
from bpy_extras.object_utils import world_to_camera_view
import math
import os
import random
from math import radians, sin, cos, pi
from mathutils import Vector, Matrix

ROOT = os.environ.get("SHOP_ROOT", os.getcwd())
BLEND_PATH = os.path.join(ROOT, "public", "models", "secret-shop.blend")
GLB_PATH = os.path.join(ROOT, "public", "models", "secret-shop.glb")
FONT_PATH = os.path.join(ROOT, "public", "models", "permanent-marker.ttf")
PREVIEW_DIR = os.environ.get("SHOP_PREVIEW_DIR", "/tmp/shop-preview")
RENDER_PREVIEWS = os.environ.get("SHOP_RENDER", "1") == "1"

random.seed(20261028)

# ----------------------------------------------------------------------------
# scene reset
# ----------------------------------------------------------------------------
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"
scene.render.fps = 30


def make_collection(name, parent=None):
    coll = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(coll)
    return coll


COL = {
    "base": make_collection("00_Platform"),
    "structure": make_collection("01_Timber_Structure"),
    "roofs": make_collection("02_Pagoda_Roofs"),
    "facade": make_collection("03_Facade_Windows"),
    "signage": make_collection("04_Signage_Banners"),
    "lanterns": make_collection("05_Lanterns_Chains"),
    "interior": make_collection("06_Interior"),
    "props": make_collection("07_Props_Crystals"),
    "lights": make_collection("08_Lighting"),
    "cameras": make_collection("09_Cameras"),
}


def link(obj, coll):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


def parent_to(child, parent):
    """Parent an authored-in-local-space part; keeps it relative to the anchor."""
    child.parent = parent
    child.matrix_parent_inverse.identity()
    return child


def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), coll=None):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.5
    obj.location = loc
    obj.rotation_euler = rot
    coll.objects.link(obj)
    return obj


# ----------------------------------------------------------------------------
# colours & materials
# ----------------------------------------------------------------------------
def srgb(hex_string, alpha=1.0):
    """hex sRGB -> linear RGBA tuple for Blender inputs."""
    hex_string = hex_string.lstrip("#")
    values = [int(hex_string[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    linear = [v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in values]
    return (linear[0], linear[1], linear[2], alpha)


def base_material(name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    return mat, nt, bsdf


def simple_material(name, color, roughness=0.5, metallic=0.0, emission=None, emission_strength=0.0,
                    transmission=0.0, ior=1.45, coat=0.0, sheen=0.0):
    mat, nt, bsdf = base_material(name)
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["IOR"].default_value = ior
    bsdf.inputs["Coat Weight"].default_value = coat
    if "Sheen Weight" in bsdf.inputs:
        bsdf.inputs["Sheen Weight"].default_value = sheen
    if "Transmission Weight" in bsdf.inputs:
        bsdf.inputs["Transmission Weight"].default_value = transmission
    if emission is not None:
        bsdf.inputs["Emission Color"].default_value = emission
        bsdf.inputs["Emission Strength"].default_value = emission_strength
    return mat


def emission_material(name, color, strength=5.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = color
    emit.inputs["Strength"].default_value = strength
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
    return mat


def procedural_material(name, base_color, accent_color, roughness, metallic=0.0,
                        noise_scale=12.0, bump=0.15, wave=False):
    mat, nt, bsdf = base_material(name)
    tex = nt.nodes.new("ShaderNodeTexNoise")
    tex.inputs["Scale"].default_value = noise_scale
    tex.inputs["Detail"].default_value = 8.0
    tex.inputs["Roughness"].default_value = 0.6
    if wave:
        wave_node = nt.nodes.new("ShaderNodeTexWave")
        wave_node.inputs["Scale"].default_value = noise_scale * 2.4
        wave_node.inputs["Distortion"].default_value = 6.0
        wave_node.inputs["Detail"].default_value = 3.0
        mix = nt.nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs["Fac"].default_value = 0.55
        nt.links.new(tex.outputs["Fac"], mix.inputs["Color1"])
        nt.links.new(wave_node.outputs["Fac"], mix.inputs["Color2"])
        fac = mix.outputs["Color"]
    else:
        fac = tex.outputs["Fac"]
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.elements[0].position = 0.25
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[0].color = base_color
    ramp.color_ramp.elements[1].color = accent_color
    nt.links.new(fac, ramp.inputs["Fac"])
    nt.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    bump_node = nt.nodes.new("ShaderNodeBump")
    bump_node.inputs["Strength"].default_value = bump
    bump_node.inputs["Distance"].default_value = 0.03
    nt.links.new(tex.outputs["Fac"], bump_node.inputs["Height"])
    nt.links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


M = {}
M["wood_dark"] = procedural_material("Wood | Dark Lacquer", srgb("#0e0807"), srgb("#29130e"), 0.55, 0.0, 9, 0.35, True)
M["wood_mid"] = procedural_material("Wood | Warm Timber", srgb("#2c150f"), srgb("#5b2a1a"), 0.5, 0.0, 7, 0.35, True)
M["wood_red"] = procedural_material("Wood | Red Varnish", srgb("#4a120f"), srgb("#8c2418"), 0.42, 0.0, 11, 0.25, True)
M["wood_beam"] = procedural_material("Wood | Structural Beam", srgb("#1a100d"), srgb("#40201a"), 0.55, 0.0, 14, 0.3, True)
M["stone"] = procedural_material("Stone | Basalt", srgb("#1b1a1c"), srgb("#43403f"), 0.72, 0.0, 6, 0.5)
M["stone_dark"] = procedural_material("Stone | Dark Basalt", srgb("#101012"), srgb("#2c2a2b"), 0.78, 0.0, 8, 0.45)
M["roof"] = procedural_material("Roof | Slate Tiles", srgb("#15161c"), srgb("#3b3d4a"), 0.36, 0.15, 22, 0.4, True)
M["gold"] = simple_material("Gold | Ornate Trim", srgb("#dda24c"), 0.34, 0.95, coat=0.25)
M["gold_dark"] = simple_material("Gold | Aged Brass", srgb("#9a6a28"), 0.52, 0.85)
M["iron"] = simple_material("Iron | Chains", srgb("#241f1e"), 0.42, 1.0)
M["fabric"] = simple_material("Fabric | Crimson Banner", srgb("#6d0410"), 0.78, 0.0, sheen=0.35)
M["fabric_dark"] = simple_material("Fabric | Deep Velvet", srgb("#4a0710"), 0.8, 0.0, sheen=0.4)
M["rug"] = procedural_material("Fabric | Palace Rug", srgb("#3d0810"), srgb("#7d1420"), 0.85, 0.0, 18, 0.05)
M["glass_warm"] = emission_material("Glow | Lantern Window", srgb("#ff9a48"), 2.8)
M["neon_red"] = emission_material("Glow | Neon Red", srgb("#ff2a12"), 6.0)
M["neon_pink"] = emission_material("Glow | Neon Pink", srgb("#ff4466"), 2.6)
M["lamp"] = emission_material("Glow | Lantern Paper", srgb("#ff5a24"), 2.3)
M["candle"] = emission_material("Glow | Candle", srgb("#ffd08a"), 6.0)
M["water"] = emission_material("Glow | Crimson Water", srgb("#ff1c2c"), 2.2)
M["crystal_red"] = simple_material("Crystal | Ruby", srgb("#ff2b3c"), 0.06, 0.0, emission=srgb("#ff2b3c"), emission_strength=1.4, transmission=1.0, ior=1.7)
M["crystal_purple"] = simple_material("Crystal | Amethyst", srgb("#a04bff"), 0.06, 0.0, emission=srgb("#a04bff"), emission_strength=1.2, transmission=1.0, ior=1.7)
M["crystal_blue"] = simple_material("Crystal | Sapphire", srgb("#3d7dff"), 0.06, 0.0, emission=srgb("#3d7dff"), emission_strength=1.1, transmission=1.0, ior=1.7)
M["leaf"] = simple_material("Plant | Jade Leaf", srgb("#14483a"), 0.45, 0.0, sheen=0.2)
M["brass"] = simple_material("Metal | Brass Fittings", srgb("#c68d3f"), 0.3, 1.0)
M["roof_under"] = procedural_material("Roof | Underside Timber", srgb("#120c0b"), srgb("#2a1512"), 0.62, 0.0, 7, 0.2)


# ----------------------------------------------------------------------------
# primitive helpers
# ----------------------------------------------------------------------------
def _finish(obj, mat, coll, bevel=0.0, segments=2, smooth=False, name=None):
    if name:
        obj.name = name
    link(obj, coll)
    if mat:
        obj.data.materials.append(mat)
    if smooth:
        for poly in obj.data.polygons:
            poly.use_smooth = True
    if bevel > 0:
        mod = obj.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.angle_limit = radians(45)
    return obj


def box(name, size, loc, mat, coll, rot=(0, 0, 0), bevel=0.02, segments=2):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, mat, coll, bevel, segments, name=name)


def cylinder(name, radius, depth, loc, mat, coll, rot=(0, 0, 0), verts=20, bevel=0.01, smooth=True, radius_top=None):
    if radius_top is None:
        bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, vertices=verts, location=loc, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(radius1=radius, radius2=radius_top, depth=depth, vertices=verts,
                                        location=loc, rotation=rot)
    return _finish(bpy.context.object, mat, coll, bevel, 2, smooth, name)


def cone(name, r1, r2, depth, loc, mat, coll, rot=(0, 0, 0), verts=16, bevel=0.0, smooth=True):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, vertices=verts, location=loc, rotation=rot)
    return _finish(bpy.context.object, mat, coll, bevel, 2, smooth, name)


def sphere(name, radius, loc, mat, coll, scale=(1, 1, 1), rot=(0, 0, 0), segments=24, ring=12, smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, segments=segments, ring_count=ring, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(obj, mat, coll, 0.0, 2, smooth, name)


def torus(name, major, minor, loc, mat, coll, rot=(0, 0, 0), major_seg=12, minor_seg=6):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=major_seg,
                                     minor_segments=minor_seg, location=loc, rotation=rot)
    return _finish(bpy.context.object, mat, coll, 0.0, 2, True, name)


def mesh_object(name, verts, faces, mat, coll, smooth=False, bevel=0.0, loc=(0, 0, 0), rot=(0, 0, 0)):
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.validate()
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = loc
    obj.rotation_euler = rot
    return _finish(obj, mat, coll, bevel, 2, smooth, name)


def curve_tube(name, points, radius, mat, coll, cyclic=False, res=2, resolution=8, sharp=False):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = resolution
    cu.fill_mode = "FULL"
    spline = cu.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, p in zip(spline.bezier_points, points):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = "VECTOR" if sharp else "AUTO"
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, cu)
    coll.objects.link(obj)
    if mat:
        cu.materials.append(mat)
    return obj


def join(objects, name, material=None):
    objects = [o for o in objects if o is not None]
    if not objects:
        return None
    bpy.ops.object.select_all(action="DESELECT")
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.join()
    joined = bpy.context.object
    joined.name = name
    if material is not None:
        joined.data.materials.clear()
        joined.data.materials.append(material)
    return joined


# ----------------------------------------------------------------------------
# pagoda roof generator (concave slopes, upswept corners, no tier intersection)
# ----------------------------------------------------------------------------
def rect_ring_point(theta, hx, hy):
    c, s = cos(theta), sin(theta)
    scale = 1.0 / max(abs(c), abs(s), 1e-6)
    return Vector((c * scale * hx, s * scale * hy, 0.0))


def roof_object(name, outer, inner, z_eave, z_top, lift, sag, thickness,
                mat, coll, seg_u=84, seg_v=10):
    """Annulus-shaped pagoda roof: outer eave rectangle -> inner rectangle/ridge."""
    hx_o, hy_o = outer
    hx_i, hy_i = inner
    verts = []
    for j in range(seg_v + 1):
        t = j / seg_v
        hx = hx_i + (hx_o - hx_i) * t
        hy = hy_i + (hy_o - hy_i) * t
        for i in range(seg_u):
            theta = 2 * pi * i / seg_u
            p = rect_ring_point(theta, hx, hy)
            corner = abs(sin(2.0 * theta)) ** 3
            z = z_top - (z_top - z_eave) * (t ** 1.45)
            z += lift * (t ** 5.0) * corner
            z -= sag * (t ** 3.0) * (1.0 - corner)
            verts.append((p.x, p.y, z))
    faces = []
    for j in range(seg_v):
        for i in range(seg_u):
            a = j * seg_u + i
            b = j * seg_u + (i + 1) % seg_u
            c = (j + 1) * seg_u + i
            d = (j + 1) * seg_u + (i + 1) % seg_u
            faces.append((a, c, d, b))
    obj = mesh_object(name, verts, faces, mat, coll, smooth=True)
    obj.data.materials.append(M["roof_under"])       # slot 1 = underside
    solid = obj.modifiers.new("Thickness", "SOLIDIFY")
    solid.thickness = thickness
    solid.offset = -1.0
    solid.material_offset = 1
    solid.use_rim = True
    bevel = obj.modifiers.new("Bevel", "BEVEL")
    bevel.width = 0.02
    bevel.segments = 2
    bevel.limit_method = "ANGLE"

    # tile ridges following the slope
    ridges = []
    count = 56
    for k in range(count):
        theta = 2 * pi * (k + 0.5) / count
        pts = []
        for j in range(0, seg_v + 1):
            t = j / seg_v
            hx = hx_i + (hx_o - hx_i) * t
            hy = hy_i + (hy_o - hy_i) * t
            p = rect_ring_point(theta, hx, hy)
            corner = abs(sin(2.0 * theta)) ** 3
            z = z_top - (z_top - z_eave) * (t ** 1.45)
            z += lift * (t ** 5.0) * corner
            z -= sag * (t ** 3.0) * (1.0 - corner)
            pts.append((p.x, p.y, z + 0.045))
        ridges.append(curve_tube(f"TileRidge.{k:02d}", pts, 0.022, mat, coll, resolution=3, res=1))
    if ridges:
        bpy.ops.object.select_all(action="DESELECT")
        for r in ridges:
            r.select_set(True)
        bpy.context.view_layer.objects.active = ridges[0]
        bpy.ops.object.convert(target="MESH")
        bpy.ops.object.join()
        joined = bpy.context.object
        joined.name = f"{name} | Tile Ridges"

    # golden eave trim + red glow strip, following the curved eave
    trim_pts, glow_pts, under_pts = [], [], []
    for i in range(seg_u):
        theta = 2 * pi * i / seg_u
        p = rect_ring_point(theta, hx_o, hy_o)
        corner = abs(sin(2.0 * theta)) ** 3
        z = z_eave + lift * corner - sag * (1.0 - corner)
        trim_pts.append((p.x, p.y, z + 0.03))
        glow_pts.append((p.x * 1.005, p.y * 1.005, z - 0.10))
        under_pts.append((p.x * 0.995, p.y * 0.995, z - thickness - 0.02))
    curve_tube(f"{name} | Eave Trim", trim_pts, 0.055, M["gold"], coll, cyclic=True)
    curve_tube(f"{name} | Eave Neon", glow_pts, 0.026, M["neon_red"], coll, cyclic=True)
    curve_tube(f"{name} | Under Beam", under_pts, 0.075, M["wood_beam"], coll, cyclic=True)

    corners = []
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        z = z_eave + lift
        corner = Vector((sx * hx_o, sy * hy_o, z))
        corners.append(corner)
    return obj, corners


def roof_finial(loc, scale, coll):
    parts = []
    parts.append(cone("Roof Finial Spike", 0.075 * scale, 0.012 * scale, 0.55 * scale,
                      (loc.x, loc.y, loc.z + 0.3 * scale), M["gold"], coll, verts=10))
    parts.append(sphere("Roof Finial Ball", 0.075 * scale, (loc.x, loc.y, loc.z + 0.03 * scale),
                        M["gold"], coll, segments=14, ring=8))
    parts.append(sphere("Roof Finial Gem", 0.05 * scale, (loc.x, loc.y, loc.z + 0.62 * scale),
                        M["neon_red"], coll, segments=12, ring=8))
    return parts


# ----------------------------------------------------------------------------
# platform + stairs
# ----------------------------------------------------------------------------
DIM = dict(
    base_w=15.0, base_d=12.0, base_h=1.15,
    wall_x=6.2, wall_y=4.6,
    gf_bottom=1.15, gf_top=6.35,
    uf_x=5.5, uf_y=4.2, uf_top=9.35,
    eave_a_z=6.35, roof_b_z=9.42,
)


def build_platform():
    coll = COL["base"]
    box("Foundation | Lower Slab", (16.8, 13.4, 0.3), (0, 0.1, 0.15), M["stone_dark"], coll, bevel=0.04)
    box("Foundation | Plinth", (15.0, 12.1, 0.85), (0, 0.1, 0.72), M["stone"], coll, bevel=0.06)
    box("Foundation | Deck Rim", (15.4, 12.4, 0.16), (0, 0.1, 1.22), M["stone_dark"], coll, bevel=0.02)
    box("Foundation | Deck", (14.4, 11.4, 0.1), (0, 0.1, 1.31), M["wood_mid"], coll, bevel=0.01)

    # stone blocks around the plinth
    for i, x in enumerate([-6.4, -3.6, -0.8, 2.0, 4.8]):
        box(f"Plinth Block F{i}", (2.5, 0.12, 0.6), (x, -5.92, 0.75), M["stone_dark"], coll, bevel=0.015)
    for sx in (-1, 1):
        for i, y in enumerate([-4.4, -1.4, 1.6, 4.6]):
            box(f"Plinth Block S{sx}{i}", (0.12, 2.6, 0.6), (sx * 7.35, y, 0.75), M["stone_dark"], coll, bevel=0.015)

    # stairs: six stone steps with a red glow line on every nosing
    steps, glow = [], []
    top_z = DIM["base_h"]
    for i in range(6):
        depth = 0.78
        height = top_z - 0.18 * (i + 1)
        y = -6.05 - i * depth
        box(f"Stair {i}", (8.2, depth + 0.02, max(height, 0.18)), (0, y, max(height, 0.18) / 2),
            M["stone"] if i % 2 else M["stone_dark"], coll, bevel=0.02)
        glow.append(box(f"Stair Glow {i}", (6.8, 0.05, 0.035), (0, y - depth / 2 + 0.02, height + 0.01),
                        M["neon_red"], coll, bevel=0.0))
        steps.append(box(f"Stair Nosing {i}", (8.2, 0.09, 0.05), (0, y - depth / 2 + 0.03, height + 0.02),
                         M["gold_dark"], coll, bevel=0.01))
    join(glow, "Stairs | Neon Nosings")

    # side cheeks with lantern posts
    for sx in (-1, 1):
        box(f"Stair Cheek {sx}", (0.55, 4.9, 0.5), (sx * 4.35, -8.0, 0.55), M["stone_dark"], coll, bevel=0.03)
        box(f"Stair Rail {sx}", (0.32, 4.7, 0.16), (sx * 4.35, -8.0, 1.28), M["gold_dark"], coll, bevel=0.02)
        for j, y in enumerate((-6.3, -7.4, -8.5, -9.6)):
            box(f"Stair Post {sx}{j}", (0.42, 0.42, 0.85), (sx * 4.35, y, 0.72), M["stone"], coll, bevel=0.02)
            sphere(f"Stair Post Cap {sx}{j}", 0.16, (sx * 4.35, y, 1.2), M["gold"], coll, segments=14, ring=8)

    # rock outcrops holding the platform
    rock_spots = [(-7.6, -4.9, 0.55, 1.1), (-8.1, 1.2, 0.5, 1.3), (-7.4, 4.6, 0.45, 0.9),
                  (7.7, -4.2, 0.5, 1.0), (8.0, 2.4, 0.55, 1.2), (6.9, 5.1, 0.4, 0.8),
                  (-3.2, 6.4, 0.45, 0.9), (3.4, 6.5, 0.5, 1.0)]
    for i, (x, y, z, r) in enumerate(rock_spots):
        z = max(z, r * 0.62)
        sphere(f"Rock {i}", r, (x, y, z), M["stone_dark"], COL["base"],
               scale=(1.25, 1.0, 0.72), rot=(0, 0, random.uniform(0, 3)), segments=12, ring=8)
        sphere(f"Rock Moss {i}", r * 0.55, (x, y, z + r * 0.5), M["stone"], COL["base"],
               scale=(1.3, 1.1, 0.3), segments=10, ring=6)

    # deck edge trim
    box("Deck Trim Front", (14.6, 0.12, 0.12), (0, -5.62, 1.33), M["gold_dark"], coll, bevel=0.02)
    for sx in (-1, 1):
        box(f"Deck Trim Side {sx}", (0.12, 11.0, 0.12), (sx * 7.3, 0.1, 1.33), M["gold_dark"], coll, bevel=0.02)


# ----------------------------------------------------------------------------
# timber structure
# ----------------------------------------------------------------------------
def glowing_window(name, loc, size, coll, rot=(0, 0, 0), frame_mat=None, bars=3):
    """Warm paper window: backlit panel + wooden lattice + gold outer frame."""
    parent = empty(name, loc, rot, coll)
    w, h = size
    panel = box(name + " | Paper", (w, h, 0.04), (0, 0, 0), M["glass_warm"], coll)
    frame_mat = frame_mat or M["wood_beam"]
    parts = [panel]
    for sx in (-1, 1):
        parts.append(box(name + " | Jamb", (0.11, h + 0.24, 0.16), (sx * (w / 2 + 0.04), 0, 0.05), frame_mat, coll, bevel=0.015))
        parts.append(box(name + " | Gold Edge", (0.045, h + 0.16, 0.08), (sx * (w / 2 - 0.03), 0, 0.1), M["gold_dark"], coll))
    for sy in (-1, 1):
        parts.append(box(name + " | Lintel", (w + 0.26, 0.11, 0.16), (0, sy * (h / 2 + 0.05), 0.05), frame_mat, coll, bevel=0.015))
    for i in range(1, bars + 1):
        x = -w / 2 + w * i / (bars + 1)
        parts.append(box(name + f" | Muntin {i}", (0.05, h, 0.07), (x, 0, 0.06), frame_mat, coll))
    parts.append(box(name + " | Mid Rail", (w, 0.05, 0.07), (0, 0, 0.065), frame_mat, coll))
    for p in parts:
        parent_to(p, parent)
    return parent


def build_structure():
    coll = COL["structure"]
    X, Y = DIM["wall_x"], DIM["wall_y"]
    z0, z1 = DIM["gf_bottom"], DIM["gf_top"]
    h = z1 - z0
    t = 0.42

    # floor
    box("Ground Floor | Floor", (2 * X + 0.2, 2 * Y + 0.2, 0.2), (0, 0, z0 + 0.1), M["wood_mid"], coll, bevel=0.02)

    # back + side walls
    box("Wall | Back", (2 * X, h, t), (0, Y - t / 2, z0 + h / 2), M["wood_dark"], coll, bevel=0.02)
    for sx in (-1, 1):
        box(f"Wall | Side {sx}", (t, 2 * Y, h), (sx * (X - t / 2), 0, z0 + h / 2), M["wood_dark"], coll, bevel=0.02)

    # front wall with a wide doorway
    door_w = 4.4
    panel_w = X - door_w / 2
    for sx in (-1, 1):
        box(f"Wall | Front {sx}", (panel_w, h, t), (sx * (door_w / 2 + panel_w / 2), -Y + t / 2, z0 + h / 2),
            M["wood_dark"], coll, bevel=0.02)
        # upper strip above the portal
    box("Wall | Portal Header", (door_w + 0.4, 1.05, t), (0, -Y + t / 2, z1 - 0.52), M["wood_dark"], coll, bevel=0.02)

    # corner and door posts (visible structure)
    post_positions = [(-X + 0.05, -Y + 0.05), (X - 0.05, -Y + 0.05), (-X + 0.05, Y - 0.05), (X - 0.05, Y - 0.05),
                      (-door_w / 2 - 0.15, -Y + 0.02), (door_w / 2 + 0.15, -Y + 0.02)]
    for i, (px, py) in enumerate(post_positions):
        box(f"Post GF {i}", (0.52, 0.52, h + 0.25), (px, py, z0 + (h + 0.25) / 2 - 0.05), M["wood_beam"], coll, bevel=0.02)
        for zz in (z0 + 0.35, z0 + h * 0.5, z1 - 0.1):
            box(f"Post Band {i}.{zz:.1f}", (0.6, 0.6, 0.1), (px, py, zz), M["gold_dark"], coll, bevel=0.012)

    # belt beams + gold string courses
    for zz, name in ((z0 + 0.05, "Base"), (z0 + h * 0.62, "Mid"), (z1 - 0.03, "Eave")):
        box(f"Beam | {name} Front", (2 * X + 0.3, 0.3, 0.24), (0, -Y - 0.04, zz), M["wood_beam"], coll, bevel=0.02)
        for sx in (-1, 1):
            box(f"Beam | {name} Side {sx}", (0.34, 2 * Y + 0.1, 0.3), (sx * (X + 0.04), 0, zz), M["wood_beam"], coll, bevel=0.02)
        box(f"Beam | {name} Gold", (2 * X + 0.42, 0.09, 0.06), (0, -Y - 0.22, zz + 0.14), M["gold_dark"], coll)
        for sx in (-1, 1):
            box(f"Beam | {name} Gold Side {sx}", (0.09, 2 * Y + 0.2, 0.06), (sx * (X + 0.21), 0, zz + 0.14), M["gold_dark"], coll)

    # vertical battens on the timber facade
    for sx in (-1, 1):
        for i in range(4):
            x = sx * (door_w / 2 + 0.55 + i * 0.95)
            if abs(x) < X - 0.3:
                box(f"Batten F{sx}{i}", (0.09, 0.08, h - 0.5), (x, -Y - 0.23, z0 + h / 2), M["wood_red"], coll, bevel=0.008)
    for sx in (-1, 1):
        for i in range(4):
            y = -Y + 1.1 + i * 2.1
            box(f"Batten S{sx}{i}", (0.08, 0.09, h - 0.5), (sx * (X + 0.23), y, z0 + h / 2), M["wood_red"], coll, bevel=0.008)

    # ---------- upper storey ----------
    UX, UY = DIM["uf_x"], DIM["uf_y"]
    uz0, uz1 = DIM["eave_a_z"], DIM["uf_top"]
    uh = uz1 - uz0
    box("Upper Floor | Floor", (2 * UX + 0.3, 2 * UY + 0.3, 0.24), (0, 0, uz0 + 0.06), M["wood_mid"], coll, bevel=0.02)
    box("Upper Wall | Back", (2 * UX, uh, 0.36), (0, UY - 0.18, uz0 + uh / 2), M["wood_dark"], coll, bevel=0.02)
    for sx in (-1, 1):
        box(f"Upper Wall | Side {sx}", (0.36, 2 * UY, uh), (sx * (UX - 0.18), 0, uz0 + uh / 2), M["wood_dark"], coll, bevel=0.02)
        box(f"Upper Wall | Front {sx}", (UX - 1.0, uh, 0.36), (sx * (UX / 2 + 0.5), -UY + 0.18, uz0 + uh / 2),
            M["wood_dark"], coll, bevel=0.02)
    box("Upper Wall | Front Center", (2.0, uh, 0.36), (0, -UY + 0.18, uz0 + uh / 2), M["wood_dark"], coll, bevel=0.02)

    # short posts sitting on the lower eave, carrying the top roof
    for sx in (-1, 1):
        for sy in (-1, 1):
            box(f"Eave Post {sx}{sy}", (0.4, 0.4, 0.5), (sx * (UX - 0.1), sy * (UY - 0.1), DIM["roof_b_z"] - 0.28),
                M["wood_beam"], coll, bevel=0.02)
            box(f"Eave Post Cap {sx}{sy}", (0.5, 0.5, 0.1), (sx * (UX - 0.1), sy * (UY - 0.1), DIM["roof_b_z"] - 0.05),
                M["gold_dark"], coll, bevel=0.012)
    for i in range(4):
        x = -3.9 + i * 2.6
        box(f"Eave Post F{i}", (0.26, 0.26, 0.42), (x, -UY - 0.05, DIM["roof_b_z"] - 0.24), M["wood_beam"], coll, bevel=0.012)
    for zz in (uz0 + 0.18, uz1 - 0.06):
        box(f"UF Beam Front {zz:.1f}", (2 * UX + 0.5, 0.3, 0.26), (0, -UY - 0.1, zz), M["wood_beam"], coll, bevel=0.02)
        box(f"UF Beam Gold {zz:.1f}", (2 * UX + 0.6, 0.07, 0.05), (0, -UY - 0.26, zz + 0.12), M["gold_dark"], coll)

    # ---------- facade windows ----------
    for sx in (-1, 1):
        glowing_window(f"GF Window {sx}", (sx * 4.3, -Y - 0.22, z0 + 2.1), (2.3, 2.05), COL["facade"], bars=3)
        box(f"GF Window Sill {sx}", (2.4, 0.22, 0.12), (sx * 4.25, -Y - 0.3, z0 + 1.05), M["wood_beam"], COL["facade"], bevel=0.02)
        glowing_window(f"UF Window {sx}", (sx * 3.45, -UY - 0.2, uz0 + 1.95), (1.9, 1.5), COL["facade"], bars=2)
        glowing_window(f"UF Window Side {sx}", (sx * (UX + 0.2), -1.4, uz0 + 1.9), (1.5, 1.25),
                       COL["facade"], rot=(0, 0, radians(90 * sx)), bars=2)
        for i, y in enumerate((-2.6, 0.4, 3.0)):
            glowing_window(f"GF Side Window {sx}{i}", (sx * (X + 0.22), y, z0 + 2.1), (1.5, 1.7),
                           COL["facade"], rot=(0, 0, radians(90 * sx)), bars=2)
    glowing_window("UF Window Center", (0, -UY - 0.2, uz0 + 2.05), (1.5, 1.2), COL["facade"], bars=2)

    # door frame: heavy timber + gold arch
    dw, dh = 4.9, 3.15
    for sx in (-1, 1):
        box(f"Door Jamb {sx}", (0.3, 0.55, dh + 0.3), (sx * (dw / 2 + 0.16), -Y - 0.12, z0 + (dh + 0.3) / 2),
            M["wood_beam"], coll, bevel=0.02)
        box(f"Door Jamb Gold {sx}", (0.07, 0.63, dh + 0.1), (sx * (dw / 2 + 0.02), -Y - 0.3, z0 + (dh + 0.1) / 2),
            M["gold"], coll, bevel=0.01)
    arch_pts = []
    for i in range(19):
        a = pi * i / 18
        arch_pts.append((cos(a) * (dw / 2 + 0.1), -Y - 0.22, z0 + dh + sin(a) * 0.95))
    curve_tube("Door Arch Gold", arch_pts, 0.09, M["gold"], coll)
    curve_tube("Door Arch Neon", [(x * 1.02, y + 0.02, z + 0.02) for x, y, z in arch_pts], 0.03, M["neon_red"], coll)
    inner_arch = [(x * 0.93, y + 0.18, z - 0.06) for x, y, z in arch_pts]
    curve_tube("Door Arch Timber", inner_arch, 0.16, M["wood_beam"], coll)
    box("Door Threshold", (dw + 0.7, 0.55, 0.14), (0, -Y - 0.2, z0 + 0.07), M["gold_dark"], coll, bevel=0.02)
    portal = bpy.data.lights.new("Portal Spill", "AREA")
    portal.energy = 700
    portal.size = 3.4
    portal.color = (1.0, 0.5, 0.22)
    portal_obj = bpy.data.objects.new("Portal Spill", portal)
    portal_obj.location = (0, -Y + 0.6, z0 + 2.0)
    portal_obj.rotation_euler = (radians(-90), 0, 0)
    COL["lights"].objects.link(portal_obj)
    box("Door Threshold Glow", (dw, 0.08, 0.03), (0, -Y - 0.42, z0 + 0.15), M["neon_red"], coll)

    # lantern brackets beside the portal
    for sx in (-1, 1):
        box(f"Lantern Bracket {sx}", (0.12, 0.7, 0.12), (sx * (dw / 2 + 0.9), -Y - 0.55, z0 + 3.15), M["gold_dark"], coll)
        curve_tube(f"Lantern Bracket Scroll {sx}",
                   [(sx * (dw / 2 + 0.9), -Y - 0.55, z0 + 3.15),
                    (sx * (dw / 2 + 1.35), -Y - 0.75, z0 + 3.05),
                    (sx * (dw / 2 + 1.5), -Y - 0.75, z0 + 2.75)], 0.04, M["gold_dark"], coll)


# ----------------------------------------------------------------------------
# facade details: banners, lanterns, chains
# ----------------------------------------------------------------------------
def chain_between(name, p1, p2, links=6, link_radius=0.055, coll=None, sag=0.0):
    coll = coll or COL["lanterns"]
    p1, p2 = Vector(p1), Vector(p2)
    direction = p2 - p1
    length = direction.length
    axis = direction.normalized()
    base_quat = axis.to_track_quat("Z", "Y")
    objs = []
    for i in range(links):
        f = (i + 0.5) / links
        pos = p1 + direction * f
        if sag:
            pos.z -= sag * sin(pi * f)
        quat = base_quat.copy()
        if i % 2:
            quat = quat @ Vector((0, 0, 1)).rotation_difference(Vector((0, 0, 1)))
            rot = (quat.to_euler().x + pi / 2, quat.to_euler().y, quat.to_euler().z)
        else:
            rot = (quat.to_euler().x + pi / 2, quat.to_euler().y, quat.to_euler().z + pi / 2)
        objs.append(torus(f"{name} Link {i}", link_radius * 1.25, link_radius * 0.34,
                          tuple(pos), M["iron"], coll, rot=rot, major_seg=10, minor_seg=5))
    joined = join(objs, name, M["iron"])
    if joined:
        joined["part"] = "chain"
    return [joined] if joined else []


def banner(name, loc, rot_z, width, height, coll=None, scale=1.0):
    coll = coll or COL["signage"]
    root = empty(name, loc, (0, 0, rot_z), coll)
    parts = []
    # gold rod + end caps
    parts.append(cylinder(name + " | Rod", 0.045, width + 0.42, (0, 0, 0.02), M["gold"], coll,
                          rot=(0, radians(90), 0), verts=12))
    for sx in (-1, 1):
        parts.append(sphere(name + f" | Rod Cap {sx}", 0.075, (sx * (width / 2 + 0.21), 0, 0.02), M["gold"], coll,
                            segments=12, ring=8))

    # cloth: tapered, gently waving
    cols, rows = 10, 18
    verts, faces = [], []
    for j in range(rows + 1):
        v = j / rows
        w = width * (1 - 0.55 * v ** 1.6)
        z = -v * height
        for i in range(cols + 1):
            u = i / cols
            x = (u - 0.5) * w
            y = 0.06 * sin(u * 5.4 + 0.7) * (0.25 + v) + 0.03 * sin(v * 3.0 + u * 2.0)
            verts.append((x, y, z))
    for j in range(rows):
        for i in range(cols):
            a = j * (cols + 1) + i
            faces.append((a, a + 1, a + cols + 2, a + cols + 1))
    cloth = mesh_object(name + " | Cloth", verts, faces, M["fabric"], coll, smooth=True)
    solid = cloth.modifiers.new("Cloth Thickness", "SOLIDIFY")
    solid.thickness = 0.022
    parts.append(cloth)

    # bottom point + gold hem
    tip_z = -height - 0.55 * scale
    tip = cone(name + " | Tip", 0.22 * scale, 0.0, 0.5 * scale,
               (0, 0.02, tip_z + 0.2 * scale), M["fabric"], coll, verts=4, rot=(radians(180), 0, radians(45)))
    parts.append(tip)
    hem = curve_tube(name + " | Hem", [(-width * 0.225, 0.05, -height + 0.02),
                                       (0, 0.06, -height - 0.05),
                                       (width * 0.225, 0.05, -height + 0.02)],
                     0.022, M["gold"], coll, resolution=3)
    parts.append(hem)

    # embroidered crown
    crown_parts = crown(name + " | Crown", (0, -0.045, -height * 0.45), 0.34 * scale, coll, facing=-1)
    parts.extend(crown_parts)
    for p in parts:
        parent_to(p, root)
    return root


def crown(name, loc, scale, coll, facing=-1):
    parts = []
    base = box(name + " | Band", (0.62 * scale, 0.05, 0.14 * scale), (loc[0], loc[1], loc[2]), M["gold"], coll, bevel=0.01)
    parts.append(base)
    for i, dx in enumerate((-0.24, 0.0, 0.24)):
        parts.append(cone(name + f" | Point {i}", 0.1 * scale, 0.0, 0.3 * scale,
                          (loc[0] + dx * scale, loc[1], loc[2] + 0.21 * scale), M["gold"], coll, verts=4,
                          rot=(0, 0, radians(45))))
    for dx in (-0.12, 0.12):
        parts.append(sphere(name + f" | Stud {dx}", 0.035 * scale, (loc[0] + dx * scale, loc[1] - 0.03, loc[2]),
                            M["gold"], coll, segments=8, ring=6))
    return parts


def lantern(name, loc, coll=None, scale=1.0, chain_to=None, glow=True):
    coll = coll or COL["lanterns"]
    root = empty(name, loc, (0, 0, 0), coll)
    parts = []
    body = sphere(name + " | Paper", 0.38 * scale, (0, 0, 0), M["lamp"], coll,
                  scale=(1.0, 1.0, 1.15), segments=20, ring=12)
    parts.append(body)
    for sz in (-1, 1):
        parts.append(cylinder(name + f" | Cap {sz}", 0.16 * scale, 0.1 * scale, (0, 0, sz * 0.4 * scale),
                              M["gold_dark"], coll, verts=12, bevel=0.01))
    parts.append(cylinder(name + " | Top Stem", 0.03 * scale, 0.2 * scale, (0, 0, 0.5 * scale), M["gold"], coll, verts=8))
    parts.append(torus(name + " | Ring", 0.09 * scale, 0.025 * scale, (0, 0, 0.62 * scale), M["gold"], coll,
                       rot=(radians(90), 0, 0)))
    for i in range(5):
        a = 2 * pi * i / 5
        parts.append(box(name + f" | Rib {i}", (0.03 * scale, 0.03 * scale, 0.78 * scale),
                         (cos(a) * 0.35 * scale, sin(a) * 0.35 * scale, 0), M["gold_dark"], coll, bevel=0.005))
    parts.append(cone(name + " | Tassel", 0.09 * scale, 0.0, 0.34 * scale, (0, 0, -0.6 * scale),
                      M["fabric"], coll, verts=8, rot=(radians(180), 0, 0)))
    for p in parts:
        parent_to(p, root)
    if glow:
        light = bpy.data.lights.new(name + " | Light", "POINT")
        light.energy = 45 * scale
        light.color = (1.0, 0.28, 0.12)
        light.shadow_soft_size = 0.35 * scale
        light_obj = bpy.data.objects.new(name + " | Light", light)
        light_obj.location = loc
        COL["lights"].objects.link(light_obj)
    if chain_to is not None:
        chain_between(name + " | Chain", tuple(Vector(loc) + Vector((0, 0, 0.55 * scale))), chain_to,
                      links=5, link_radius=0.045 * scale)
    return root


def build_facade_details():
    # ---------- banners hanging from visible gold rods ----------
    Y = DIM["wall_y"]
    spec = [
        ("Banner L1", (-6.35, -Y - 1.75, 5.95), 0.0, 1.15, 2.5, (0, 0, 6.4)),
        ("Banner R1", (6.35, -Y - 1.75, 5.95), 0.0, 1.15, 2.5, (0, 0, 6.4)),
                ("Banner Side L", (-DIM["wall_x"] - 1.25, -0.6, 5.9), radians(90), 1.0, 2.4, (0, 0, 6.4)),
        ("Banner Side R", (DIM["wall_x"] + 1.25, -0.6, 5.9), radians(-90), 1.0, 2.4, (0, 0, 6.4)),
        ("Banner Upper L", (-4.15, -DIM["uf_y"] - 1.05, 8.95), 0.0, 0.8, 1.8, (0, 0, 9.35)),
        ("Banner Upper R", (4.15, -DIM["uf_y"] - 1.05, 8.95), 0.0, 0.8, 1.8, (0, 0, 9.35)),
    ]
    for name, loc, rot, w, h, anchor in spec:
        banner(name, loc, rot, w, h, scale=1.0)
        # two chains from the rod ends up to the eave beam: the banner never floats
        for sx in (-1, 1):
            off = sx * (w / 2 + 0.12)
            start = Vector((loc[0] + cos(rot) * off, loc[1] + sin(rot) * off, loc[2] + 0.06))
            end = Vector((start.x + sx * 0.04, start.y - 0.06, anchor[2]))
            chain_between(f"{name} | Hanger {sx}", start, end, links=4, link_radius=0.038)

    # ---------- lanterns ----------
    lantern_spec = [
        ("Lantern Door L", (-3.5, -Y - 1.45, 3.7), 0.95),
        ("Lantern Door R", (3.5, -Y - 1.45, 3.7), 0.95),
        ("Lantern Eave L", (-6.9, -Y - 1.55, 5.4), 0.95),
        ("Lantern Eave R", (6.9, -Y - 1.55, 5.4), 0.95),
        ("Lantern Mid L", (-1.8, -Y - 1.6, 5.25), 0.8),
        ("Lantern Mid R", (1.8, -Y - 1.6, 5.25), 0.8),
        ("Lantern Side L", (-DIM["wall_x"] - 1.35, 2.6, 5.3), 0.8),
        ("Lantern Side R", (DIM["wall_x"] + 1.35, 2.6, 5.3), 0.8),
        ("Lantern Upper L", (-4.6, -DIM["uf_y"] - 1.15, 8.35), 0.7),
        ("Lantern Upper R", (4.6, -DIM["uf_y"] - 1.15, 8.35), 0.7),
    ]
    for name, loc, scale in lantern_spec:
        lantern(name, loc, scale=scale, chain_to=(loc[0], loc[1], loc[2] + 0.95 + 0.5 * scale))

    # ---------- catenary chains with small lanterns between the base posts ----------
    for sx in (-1, 1):
        p1 = (sx * (DIM["wall_x"] + 0.9), -DIM["wall_y"] - 0.7, 4.9)
        p2 = (sx * (DIM["wall_x"] + 0.9), -0.6, 4.9)
        chain_between(f"Eave Chain {sx}", p1, p2, links=14, link_radius=0.05, sag=0.35)
        for i in range(3):
            f = 0.25 + 0.25 * i
            y = p1[1] + (p2[1] - p1[1]) * f
            z = 4.9 - 0.35 * sin(pi * f) - 0.45
            lantern(f"Chain Lantern {sx}{i}", (p1[0], y, z), scale=0.42, chain_to=(p1[0], y, z + 0.6))

    # ---------- hanging shop sign ----------
    build_sign()


def build_sign():
    coll = COL["signage"]
    Y = DIM["wall_y"]
    center = Vector((0, -Y - 2.1, 6.72))
    root = empty("Shop Sign", center, (radians(90), 0, 0), coll)
    parts = []

    # shield plaque: wide shoulders, pointed bottom
    w, h = 3.05, 1.52
    outline = []
    for i in range(48):
        a = 2 * pi * i / 48
        x = cos(a) * w
        z = sin(a) * h
        if z < 0:
            z *= 1.25
            x *= 1.0 - 0.35 * (-z / (h * 1.25)) ** 1.6          # taper to a point
        outline.append((x, z))
    verts = [(x, y, -0.12) for x, y in outline] + [(x, y, 0.12) for x, y in outline]
    faces = [tuple(range(len(outline) - 1, -1, -1)), tuple(range(len(outline), 2 * len(outline)))]
    for i in range(len(outline)):
        a, b = i, (i + 1) % len(outline)
        faces.append((a, b, b + len(outline), a + len(outline)))
    plaque_mat = simple_material("Sign | Crimson Lacquer", srgb("#37000a"), 0.4, 0.0, coat=0.4)
    panel = mesh_object("Shop Sign | Plaque", verts, faces, plaque_mat, coll, bevel=0.025)
    parts.append(panel)

    # gold rim + inner pinstripe + top crown
    rim = curve_tube("Shop Sign | Gold Rim", [(x * 1.03, y * 1.03, 0.07) for x, y in outline],
                     0.1, M["gold"], coll, cyclic=True, sharp=True)
    parts.append(rim)
    inner_rim = curve_tube("Shop Sign | Inner Rim", [(x * 0.87, y * 0.87, 0.15) for x, y in outline],
                           0.032, M["gold_dark"], coll, cyclic=True, sharp=True)
    parts.append(inner_rim)
    parts.extend(crown("Shop Sign | Crown", (0, h * 0.52, 0.16), 0.62, coll))

    # lettering: large, saturated, sitting inside the shield
    if os.path.exists(FONT_PATH):
        font = bpy.data.fonts.load(FONT_PATH)
    else:
        font = None
    red_paint = simple_material("Neon | Sign Red", srgb("#ff2013"), 0.35, 0.0,
                               emission=srgb("#ff2013"), emission_strength=4.5)
    gold_paint = simple_material("Paint | Sign Gold", srgb("#ffcd7a"), 0.3, 0.3,
                                 emission=srgb("#ffb45a"), emission_strength=1.4)
    def text_obj(name, body, size, z, mat, extrude=0.05):
        cu = bpy.data.curves.new(name, "FONT")
        cu.body = body
        cu.size = size
        cu.align_x = "CENTER"
        cu.align_y = "CENTER"
        cu.extrude = extrude
        cu.bevel_depth = 0.014
        cu.bevel_resolution = 3
        cu.offset = -0.012
        if font:
            cu.font = font
        obj = bpy.data.objects.new(name, cu)
        obj.location = (0, z, 0.26)
        coll.objects.link(obj)
        cu.materials.append(mat)
        return obj

    parts.append(text_obj("Shop Sign | Secret", "SECRET", 1.16, 0.34, red_paint))
    parts.append(text_obj("Shop Sign | Shop", "SHOP", 1.22, -0.56, gold_paint))

    # bottom diamond ornament
    parts.append(sphere("Shop Sign | Diamond", 0.16, (0, -h * 1.18, 0.12), M["gold"], coll,
                        scale=(1, 1, 1.5), segments=4, ring=2, smooth=False))
    for p in parts:
        parent_to(p, root)

    # two chains from the rod ends up to the top eave: the sign is really hanging
    for sx in (-1, 1):
        start = center + Vector((sx * w * 0.86, -0.03, h * 0.92))
        end = Vector((sx * 2.15, -DIM["uf_y"] - 1.15, DIM["roof_b_z"] - 0.05))
        chain_between(f"Sign Chain {sx}", start, end, links=8, link_radius=0.055)
        box(f"Sign Bracket {sx}", (0.22, 0.24, 0.2), tuple(end), M["gold_dark"], coll, bevel=0.02)
        torus(f"Sign Eye {sx}", 0.1, 0.032, tuple(start), M["gold_dark"], coll, rot=(0, radians(90), 0))

    # side boards
    for sx, lines in ((-1, ["RARE ITEMS", "EXCLUSIVE", "LIMITED"]), (1, ["BETTER ITEMS", "BIGGER POWER"])):
        bx = sx * (DIM["wall_x"] + 2.1)
        by = -DIM["wall_y"] - 1.6
        board = box(f"Signboard {sx} | Panel", (1.75, 0.16, 1.6), (bx, by, 2.35), M["wood_dark"], coll, bevel=0.03)
        box(f"Signboard {sx} | Frame", (1.92, 0.09, 1.77), (bx, by - 0.08, 2.35), M["gold_dark"], coll, bevel=0.02)
        box(f"Signboard {sx} | Back", (1.76, 0.08, 1.61), (bx, by - 0.115, 2.35), M["wood_red"], coll)
        board_paint = simple_material("Paint | Board Gold", srgb("#ffcf8a"), 0.32, 0.2,
                                      emission=srgb("#ffb463"), emission_strength=2.2)
        for i, line in enumerate(lines):
            cu = bpy.data.curves.new(f"Signboard {sx} Text {i}", "FONT")
            cu.body = line
            cu.size = 0.2
            cu.align_x = "CENTER"
            cu.align_y = "CENTER"
            cu.extrude = 0.012
            if font:
                cu.font = font
            obj = bpy.data.objects.new(f"Signboard {sx} Text {i}", cu)
            obj.location = (bx, by - 0.14, 2.74 - i * 0.34)
            obj.rotation_euler = (radians(90), 0, 0)
            coll.objects.link(obj)
            cu.materials.append(board_paint)
        for sx2 in (-1, 1):
            box(f"Signboard {sx} Post {sx2}", (0.12, 0.12, 1.3), (bx + sx2 * 0.75, by, 1.75), M["wood_beam"], coll)
        box(f"Signboard {sx} Base", (1.9, 0.55, 0.2), (bx, by + 0.05, 1.22), M["stone_dark"], coll, bevel=0.02)


def build_roofs():
    coll = COL["roofs"]
    # lower tier: skirt roof wrapped around the upper storey
    roof_a, corners_a = roof_object(
        "Roof A | Lower Eaves", outer=(7.95, 6.45), inner=(4.9, 3.7),
        z_eave=6.35, z_top=7.65, lift=0.72, sag=0.35, thickness=0.3,
        mat=M["roof"], coll=coll)
    for c in corners_a:
        roof_finial(c, 1.25, coll)
        # hanging chains + bells at the eave corners
        chain_between(f"Roof A Corner Chain {c.x:.0f}{c.y:.0f}", tuple(c + Vector((0, 0, -0.02))),
                      tuple(c + Vector((0, 0, -1.15))), links=6, link_radius=0.045)
        cone(f"Roof A Bell {c.x:.0f}{c.y:.0f}", 0.12, 0.05, 0.28, tuple(c + Vector((0, 0, -1.3))),
             M["gold"], COL["lanterns"], verts=10)

    # upper tier: hipped roof with a ridge, clearly above the lower tier
    roof_b, corners_b = roof_object(
        "Roof B | Main Roof", outer=(7.05, 5.55), inner=(2.45, 0.04),
        z_eave=9.42, z_top=12.55, lift=0.78, sag=0.4, thickness=0.34,
        mat=M["roof"], coll=coll)
    for c in corners_b:
        roof_finial(c, 1.4, coll)
    # ridge cap
    curve_tube("Roof B | Ridge", [(-2.45, 0, 12.55), (0, 0, 12.62), (2.45, 0, 12.55)], 0.12, M["gold"], coll)
    for sx in (-1, 1):
        cone(f"Roof B Ridge End {sx}", 0.2, 0.0, 0.65, (sx * 2.65, 0, 12.9), M["gold"], coll,
             verts=8, rot=(0, radians(sx * 38), 0))
        sphere(f"Roof B Ridge Gem {sx}", 0.1, (sx * 2.5, 0, 12.62), M["neon_red"], coll, segments=10, ring=6)

    # under-eave rafters (both tiers)
    for name, outer, z_eave, count, z_off in (("A", (7.95, 6.45), 6.35, 26, -0.18),
                                              ("B", (7.05, 5.55), 9.42, 22, -0.2)):
        for i in range(count):
            theta = 2 * pi * (i + 0.5) / count
            p = rect_ring_point(theta, outer[0] * 0.96, outer[1] * 0.96)
            corner = abs(sin(2.0 * theta)) ** 3
            z = z_eave + (0.72 if name == "A" else 0.78) * corner - (0.35 if name == "A" else 0.4) * (1 - corner)
            box(f"Rafter {name}{i}", (0.11, 0.11, 0.55), (p.x, p.y, z + z_off), M["wood_beam"], coll,
                rot=(radians(18) * (1 if p.y > 0 else -1), 0, 0), bevel=0.01)
        # red glow under the eave
        pts = []
        for i in range(48):
            theta = 2 * pi * i / 48
            p = rect_ring_point(theta, outer[0] * 0.93, outer[1] * 0.93)
            corner = abs(sin(2.0 * theta)) ** 3
            z = z_eave + (0.72 if name == "A" else 0.78) * corner - (0.35 if name == "A" else 0.4) * (1 - corner)
            pts.append((p.x, p.y, z - 0.05))
        curve_tube(f"Under Eave Neon {name}", pts, 0.022, M["neon_red"], coll, cyclic=True)

    # warm strip lights under the top eave: the upper storey reads clearly
    for i, x in enumerate((-4.2, -1.4, 1.4, 4.2)):
        up = bpy.data.lights.new(f"Upper Eave Light {i}", "POINT")
        up.energy = 160
        up.color = (1.0, 0.5, 0.24)
        up.shadow_soft_size = 0.5
        obj = bpy.data.objects.new(f"Upper Eave Light {i}", up)
        obj.location = (x, -DIM["uf_y"] - 0.7, DIM["roof_b_z"] - 0.45)
        COL["lights"].objects.link(obj)

    # warm uplight washing the tiles from the eave line
    for sx in (-1, 1):
        up = bpy.data.lights.new(f"Roof Uplight {sx}", "POINT")
        up.energy = 260
        up.color = (1.0, 0.35, 0.2)
        up.shadow_soft_size = 0.6
        obj = bpy.data.objects.new(f"Roof Uplight {sx}", up)
        obj.location = (sx * 4.5, -3.2, 10.6)
        COL["lights"].objects.link(obj)
    ridge = bpy.data.lights.new("Ridge Glow", "POINT")
    ridge.energy = 220
    ridge.color = (1.0, 0.25, 0.18)
    ridge.shadow_soft_size = 1.2
    obj = bpy.data.objects.new("Ridge Glow", ridge)
    obj.location = (0, 0.0, 13.3)
    COL["lights"].objects.link(obj)

    # crest above the sign
    build_crest()


def build_crest():
    """Dragon-head crest bolted to the front gable, above the shop sign."""
    coll = COL["signage"]
    anchor = Vector((0, -DIM["uf_y"] - 2.05, 10.15))
    root = empty("Dragon Crest", tuple(anchor), (radians(-12), 0, 0), coll)
    root.scale = (1.15, 1.15, 1.15)
    obsidian = simple_material("Obsidian | Crest", srgb("#120a10"), 0.25, 0.5, coat=0.6)
    ember = simple_material("Obsidian | Crest Ember", srgb("#42101a"), 0.32, 0.35, coat=0.4)
    eye_mat = simple_material("Glow | Dragon Eye", srgb("#ff3a18"), 0.3, 0.0,
                              emission=srgb("#ff3a18"), emission_strength=18.0)
    parts = []

    def plate(name, pts, front_y, depth, mat, bevel=0.015):
        """Plate whose visible face sits at front_y (towards -Y) and extends back."""
        n = len(pts)
        verts = [(x, front_y, z) for x, z in pts] + [(x, front_y + depth, z) for x, z in pts]
        faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        for i in range(n):
            a, b = i, (i + 1) % n
            faces.append((a, b, b + n, a + n))
        return mesh_object(name, verts, faces, mat, coll, bevel=bevel)

    # slim iron bracket that bolts the crest to the roof, instead of a flat board
    for sx in (-1, 1):
        bracket = curve_tube(f"Crest Bracket {sx}",
                             [(sx * 0.95, -0.05, -0.75), (sx * 1.05, 0.45, -1.15), (sx * 1.15, 0.95, -1.35)],
                             0.075, M["iron"], coll, sharp=True)
        parts.append(bracket)
        parts.append(sphere(f"Crest Bolt {sx}", 0.11, (sx * 1.15, 0.95, -1.35), M["gold_dark"], coll,
                            segments=10, ring=6))

    # layered dragon head, ordered front-to-back: face, gold rim, dark silhouette
    silhouette = [
        (0.0, 2.62), (0.34, 1.82), (0.98, 2.34), (0.86, 1.5),
        (1.42, 0.72), (1.3, -0.05), (0.72, -0.62), (0.36, -1.25),
        (0.0, -0.92), (-0.36, -1.25), (-0.72, -0.62), (-1.3, -0.05),
        (-1.42, 0.72), (-0.86, 1.5), (-0.98, 2.34), (-0.34, 1.82),
    ]
    parts.append(plate("Crest Gold Silhouette", silhouette, -2.5, 0.16, M["gold"], 0.02))
    inner = [(x * 0.88, z * 0.86 + 0.06) for x, z in silhouette]
    parts.append(plate("Crest Face", inner, -2.58, 0.14, obsidian, 0.02))

    # brow plates that meet in a V above the eyes
    for sx in (-1, 1):
        brow = [(0, 1.12), (sx * 1.12, 0.86), (sx * 0.95, 0.5), (sx * 0.12, 0.66)]
        parts.append(plate(f"Crest Brow {sx}", brow, -2.66, 0.1, ember))
        horn = [(sx * 0.4, 1.1), (sx * 0.8, 2.34), (sx * 0.52, 1.0)]
        parts.append(plate(f"Crest Horn {sx}", horn, -2.68, 0.09, ember))
        cheek = [(sx * 0.62, 0.34), (sx * 1.3, 0.6), (sx * 1.12, -0.18), (sx * 0.58, -0.5)]
        parts.append(plate(f"Crest Cheek {sx}", cheek, -2.64, 0.1, M["gold_dark"]))
        eye = [(sx * 0.24, 0.6), (sx * 0.92, 0.76), (sx * 0.82, 0.36), (sx * 0.28, 0.34)]
        parts.append(plate(f"Crest Eye {sx}", eye, -2.72, 0.06, eye_mat, 0.008))

    # snout ram and jaw
    parts.append(plate("Crest Snout", [(0, 0.62), (0.3, -0.28), (0, -0.72), (-0.3, -0.28)], -2.7, 0.1, obsidian))
    parts.append(plate("Crest Nose Ridge", [(0, 1.42), (0.12, 0.4), (0, -0.12), (-0.12, 0.4)], -2.74, 0.05,
                       M["gold_dark"]))
    for sx in (-1, 1):
        parts.append(plate(f"Crest Fang {sx}", [(sx * 0.13, -0.16), (sx * 0.27, -0.16), (sx * 0.2, -0.6)],
                           -2.74, 0.05, M["gold"], 0.005))
    parts.append(plate("Crest Jaw", [(-0.46, -0.52), (0.46, -0.52), (0.3, -0.98), (-0.3, -0.98)],
                       -2.62, 0.1, ember))

    gem = sphere("Crest Gem", 0.15, (0, -2.8, 0.3), M["neon_red"], coll, segments=12, ring=8,
                 scale=(1, 1, 1.5))
    parts.append(gem)

    # chains tie the crest to the ridge and to the sign
    crest_glow = bpy.data.lights.new("Crest Glow", "POINT")
    crest_glow.energy = 120
    crest_glow.color = (1.0, 0.16, 0.1)
    crest_glow.shadow_soft_size = 0.8
    crest_obj = bpy.data.objects.new("Crest Glow", crest_glow)
    crest_obj.location = tuple(anchor + Vector((0, -0.6, 0.3)))
    COL["lights"].objects.link(crest_obj)
    for sx in (-1, 1):
        chain_between(f"Crest Ridge Chain {sx}", tuple(anchor + Vector((sx * 1.25, -0.3, 0.55))),
                      (sx * 2.3, -1.2, DIM["roof_b_z"] + 0.95), links=9, link_radius=0.05)
        chain_between(f"Crest Sign Chain {sx}", tuple(anchor + Vector((sx * 1.25, -0.3, -0.9))),
                      (sx * 2.55, -DIM["wall_y"] - 2.05, 8.4), links=10, link_radius=0.045)
    for part in parts:
        parent_to(part, root)
    return root


# ----------------------------------------------------------------------------
# interior
# ----------------------------------------------------------------------------
def build_interior():
    coll = COL["interior"]
    z0 = DIM["gf_bottom"] + 0.2
    # warm floor + rug
    box("Interior | Floor", (11.6, 8.4, 0.1), (0, 0.2, z0), M["wood_mid"], coll)
    box("Interior | Rug", (5.2, 4.6, 0.05), (0, -1.7, z0 + 0.07), M["rug"], coll, bevel=0.01)
    for zz in (0, 1):
        curve_tube(f"Interior | Rug Border {zz}", [(-2.5, -3.9, z0 + 0.1), (2.5, -3.9, z0 + 0.1),
                                                  (2.5, 0.5, z0 + 0.1), (-2.5, 0.5, z0 + 0.1)],
                   0.035, M["gold"], coll, cyclic=True)
        break

    # back counter + shelves
    box("Interior | Counter", (6.4, 1.3, 1.1), (0, 2.9, z0 + 0.55), M["wood_red"], coll, bevel=0.03)
    box("Interior | Counter Top", (6.7, 1.5, 0.12), (0, 2.9, z0 + 1.13), M["gold_dark"], coll, bevel=0.02)
    for sx in (-1, 1):
        box(f"Interior | Shelf Frame {sx}", (0.16, 0.75, 3.0), (sx * 3.4, 3.7, z0 + 1.5), M["wood_beam"], coll)
    for i, zz in enumerate((z0 + 1.35, z0 + 2.15, z0 + 2.95)):
        box(f"Interior | Shelf {i}", (6.9, 0.8, 0.1), (0, 3.7, zz), M["wood_beam"], coll, bevel=0.01)
        for j in range(9):
            x = -3.0 + j * 0.75
            color = random.choice([M["crystal_red"], M["crystal_purple"], M["crystal_blue"], M["glass_warm"]])
            h = random.uniform(0.22, 0.46)
            bottle = cylinder(f"Interior Bottle {i}{j}", 0.075, h, (x, 3.7, zz + h / 2 + 0.05), color, coll,
                              verts=8, bevel=0.005)
            cylinder(f"Interior Bottle Cap {i}{j}", 0.045, 0.07, (x, 3.7, zz + h + 0.09), M["gold"], coll, verts=8)

    # big treasure chest on the counter
    build_chest("Interior Chest", (0, 2.7, z0 + 1.2), 0.8, coll)
    # hanging interior lamp
    lantern("Interior Lantern", (0, 0.6, z0 + 3.6), coll=coll, scale=0.9,
            chain_to=(0, 0.6, z0 + 4.45))
    # beams
    for i, y in enumerate((-2.2, 0.4, 2.6)):
        box(f"Interior Beam {i}", (11.8, 0.22, 0.28), (0, y, z0 + 3.95), M["wood_beam"], coll, bevel=0.02)
    # warm glow just inside the doorway
    for i, (x, y, e) in enumerate(((-2.2, -2.6, 90), (2.2, -2.6, 90), (0.0, 1.4, 140))):
        lamp = bpy.data.lights.new(f"Interior Warm {i}", "POINT")
        lamp.energy = e
        lamp.color = (1.0, 0.5, 0.24)
        lamp.shadow_soft_size = 0.5
        obj = bpy.data.objects.new(f"Interior Warm {i}", lamp)
        obj.location = (x, y, z0 + 2.4)
        COL["lights"].objects.link(obj)

    # warm light inside
    light = bpy.data.lights.new("Interior Fill", "AREA")
    light.energy = 1400
    light.size = 3.0
    light.color = (1.0, 0.55, 0.25)
    obj = bpy.data.objects.new("Interior Fill", light)
    obj.location = (0, -1.0, z0 + 3.2)
    obj.rotation_euler = (radians(-70), 0, 0)
    COL["lights"].objects.link(obj)


# ----------------------------------------------------------------------------
# props
# ----------------------------------------------------------------------------
def build_chest(name, loc, scale, coll):
    parts = []
    parts.append(box(name + " | Body", (1.15 * scale, 0.8 * scale, 0.62 * scale),
                     (loc[0], loc[1], loc[2] + 0.31 * scale), M["wood_red"], coll, bevel=0.03))
    lid = cylinder(name + " | Lid", 0.42 * scale, 1.16 * scale, (loc[0], loc[1], loc[2] + 0.62 * scale),
                   M["wood_red"], coll, rot=(0, radians(90), 0), verts=18, bevel=0.01, smooth=True)
    lid.scale = (1, 1, 0.8)
    bpy.context.view_layer.objects.active = lid
    parts.append(lid)
    for sx in (-1, 1):
        parts.append(box(name + f" | Strap {sx}", (0.1 * scale, 0.84 * scale, 0.8 * scale),
                         (loc[0] + sx * 0.38 * scale, loc[1], loc[2] + 0.42 * scale), M["gold_dark"], coll, bevel=0.01))
    parts.append(box(name + " | Lock", (0.18 * scale, 0.1 * scale, 0.22 * scale),
                     (loc[0], loc[1] - 0.44 * scale, loc[2] + 0.5 * scale), M["gold"], coll, bevel=0.015))
    for i in range(7):
        parts.append(sphere(name + f" | Coin {i}", 0.07 * scale,
                            (loc[0] + random.uniform(-0.4, 0.4) * scale, loc[1] - 0.46 * scale,
                             loc[2] + 0.66 * scale + random.uniform(0, 0.05)),
                            M["gold"], coll, scale=(1, 0.25, 1), segments=10, ring=6))
    return parts


def build_crate(name, loc, scale, rot_z, coll):
    parts = [box(name, (0.8 * scale, 0.8 * scale, 0.8 * scale), loc, M["wood_mid"], coll,
                 rot=(0, 0, rot_z), bevel=0.02)]
    for sx in (-1, 1):
        parts.append(box(name + f" | Band {sx}", (0.86 * scale, 0.86 * scale, 0.1 * scale),
                         (loc[0], loc[1], loc[2] + sx * 0.28 * scale), M["gold_dark"], coll,
                         rot=(0, 0, rot_z), bevel=0.01))
    return parts


def build_crystals(name, loc, scale, coll, colors=None):
    colors = colors or [M["crystal_red"], M["crystal_purple"], M["crystal_blue"]]
    parts = [cylinder(name + " | Pot", 0.34 * scale, 0.4 * scale, (loc[0], loc[1], loc[2] + 0.2 * scale),
                      M["wood_beam"], coll, verts=10, bevel=0.02)]
    for i in range(6):
        a = 2 * pi * i / 6 + random.uniform(-0.3, 0.3)
        r = random.uniform(0.0, 0.18) * scale
        h = random.uniform(0.5, 1.0) * scale
        mat = colors[i % len(colors)]
        tip = cone(name + f" | Shard {i}", 0.09 * scale, 0.0, h,
                   (loc[0] + cos(a) * r, loc[1] + sin(a) * r, loc[2] + 0.35 * scale + h / 2), mat, coll,
                   verts=6, rot=(radians(random.uniform(-12, 12)), radians(random.uniform(-12, 12)), a))
        parts.append(tip)
    return parts


def build_plant(name, loc, scale, coll):
    parts = [cylinder(name + " | Pot", 0.3 * scale, 0.42 * scale, (loc[0], loc[1], loc[2] + 0.21 * scale),
                      M["wood_red"], coll, verts=10, bevel=0.02)]
    for i in range(9):
        a = 2 * pi * i / 9
        lean = radians(random.uniform(20, 40))
        parts.append(cone(name + f" | Leaf {i}", 0.075 * scale, 0.0, 0.85 * scale,
                          (loc[0] + cos(a) * 0.16 * scale, loc[1] + sin(a) * 0.16 * scale,
                           loc[2] + 0.62 * scale + random.uniform(0, 0.12)),
                          M["leaf"], coll, verts=6,
                          rot=(lean * sin(a), lean * cos(a), a)))
    return parts


def build_props():
    coll = COL["props"]
    Y = DIM["wall_y"]
    # entrance props
    build_chest("Chest Left", (-4.6, -Y - 1.9, 1.32), 1.05, coll)
    build_chest("Chest Right", (4.7, -Y - 2.0, 1.32), 0.95, coll)
    for i, (x, y, s, r) in enumerate([(-6.6, -Y - 2.6, 1.15, 0.3), (-5.7, -Y - 3.35, 0.85, -0.2),
                                     (6.5, -Y - 2.7, 1.05, 0.15), (5.6, -Y - 3.5, 0.8, 0.5)]):
        build_crate(f"Crate {i}", (x, y, 1.32 + 0.4 * s), s, r, coll)
    for i, (x, y, s) in enumerate([(-7.0, -Y - 4.3, 1.15), (-2.4, -Y - 4.2, 0.95),
                                   (2.5, -Y - 4.25, 0.95), (7.0, -Y - 4.35, 1.1),
                                   (-3.9, -Y - 4.6, 0.8), (4.1, -Y - 4.6, 0.8)]):
        build_plant(f"Plant {i}", (x, y, 1.32), s, coll)
    for i, (x, y, s) in enumerate([(-6.2, -Y - 3.9, 1.0), (6.1, -Y - 3.95, 0.95), (0.0, -Y - 4.85, 0.9)]):
        build_crystals(f"Crystals {i}", (x, y, 1.32), s, coll)
    # barrels
    for i, (x, y) in enumerate([(-7.7, -Y - 1.2), (7.8, -Y - 1.3)]):
        cylinder(f"Barrel {i}", 0.38, 0.95, (x, y, 1.32 + 0.48), M["wood_mid"], coll, verts=14, bevel=0.02)
        for zz in (0.25, 0.72):
            torus(f"Barrel Hoop {i}{zz}", 0.39, 0.035, (x, y, 1.32 + zz), M["gold_dark"], coll,
                  rot=(0, 0, 0), major_seg=16, minor_seg=5)
    # gold coin piles on the deck
    for i in range(3):
        x = random.uniform(-2.2, 2.2)
        y = -Y - 3.9
        for j in range(8):
            sphere(f"Coin {i}{j}", 0.075, (x + random.uniform(-0.25, 0.25), y + random.uniform(-0.2, 0.2), 1.37),
                   M["gold"], coll, scale=(1, 0.22, 1), segments=8, ring=6)


def build_waterfall():
    coll = COL["props"]
    x = -8.6
    y = -3.0
    # rocks
    for i in range(9):
        sphere(f"Waterfall Rock {i}", random.uniform(0.5, 0.95),
               (x + random.uniform(-0.5, 0.5), y + random.uniform(-0.9, 0.9), random.uniform(0.35, 1.6)),
               M["stone_dark"], coll, scale=(1.1, 0.9, 0.8), segments=10, ring=6)
    # falling water sheets
    for i in range(3):
        ox = -0.35 + i * 0.35
        pts = [(x + ox, y + 0.15 * i, 5.4), (x + ox + 0.12, y - 0.1, 4.2),
               (x + ox - 0.1, y + 0.05, 2.9), (x + ox + 0.08, y, 1.55)]
        curve_tube(f"Waterfall Stream {i}", pts, 0.12 - i * 0.02, M["water"], coll, resolution=6)
    # pool
    cylinder("Waterfall Pool", 1.05, 0.12, (x, y, 1.36), M["water"], coll, verts=18, bevel=0.02)
    light = bpy.data.lights.new("Waterfall Glow", "POINT")
    light.energy = 90
    light.color = (1.0, 0.1, 0.15)
    light.shadow_soft_size = 1.0
    obj = bpy.data.objects.new("Waterfall Glow", light)
    obj.location = (x, y, 2.4)
    COL["lights"].objects.link(obj)


# ----------------------------------------------------------------------------
# lighting, world, cameras
# ----------------------------------------------------------------------------
def add_area(name, loc, rot, energy, color, size, coll=None):
    light = bpy.data.lights.new(name, "AREA")
    light.energy = energy
    light.color = color
    light.size = size
    obj = bpy.data.objects.new(name, light)
    obj.location = loc
    obj.rotation_euler = rot
    (coll or COL["lights"]).objects.link(obj)
    return obj


def look_at(obj, target):
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_lighting():
    scene.world = bpy.data.worlds.new("Secret Shop | Night")
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = srgb("#0a0810")
    bg.inputs["Strength"].default_value = 0.8

    key = add_area("Key | Warm", (-11.0, -16.0, 13.5), (0, 0, 0), 4600, (1.0, 0.76, 0.56), 11.0)
    look_at(key, (0, -1.5, 6.0))
    fill = add_area("Fill | Cool", (14.0, -9.0, 8.0), (0, 0, 0), 900, (0.5, 0.62, 1.0), 7.0)
    look_at(fill, (2.0, 0, 5.0))
    rim = add_area("Rim | Crimson", (6.0, 13.0, 12.5), (0, 0, 0), 3600, (1.0, 0.25, 0.18), 8.0)
    look_at(rim, (0, 1.0, 7.0))
    front = add_area("Front | Facade Wash", (0.0, -14.5, 4.2), (0, 0, 0), 650, (1.0, 0.6, 0.4), 7.0)
    look_at(front, (0, -2.0, 4.0))
    top = add_area("Top | Moon", (0.0, -3.0, 19.0), (0, 0, 0), 1200, (0.55, 0.65, 1.0), 7.0)
    look_at(top, (0, 0, 8.0))

    # sign spotlight to make the lettering pop
    spot = bpy.data.lights.new("Sign | Spot", "SPOT")
    spot.energy = 260
    spot.color = (1.0, 0.25, 0.2)
    spot.spot_size = radians(55)
    spot.spot_blend = 0.6
    obj = bpy.data.objects.new("Sign | Spot", spot)
    obj.location = (0, -9.0, 8.2)
    look_at(obj, (0, -6.9, 6.6))
    COL["lights"].objects.link(obj)


def scene_bounds():
    """World space bounds of every visible mesh (evaluated, modifiers included)."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for obj in scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        ev = obj.evaluated_get(depsgraph)
        for corner in ev.bound_box:
            p = ev.matrix_world @ Vector(corner)
            for i in range(3):
                lo[i] = min(lo[i], p[i])
                hi[i] = max(hi[i], p[i])
    return lo, hi


def build_cameras():
    bpy.context.view_layer.update()
    lo, hi = scene_bounds()
    center = (lo + hi) / 2
    target = empty("Look Target", tuple(center), coll=COL["cameras"])
    corners = [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]

    specs = {  # name: (unit direction, lens, margin, aim point)
        "Camera | Hero": (Vector((0.8, -1.0, 0.42)), 58, 0.99, center),
        "Camera | Front": (Vector((0.0, -1.0, 0.2)), 58, 1.04, center),
        "Camera | Side": (Vector((-1.0, -0.3, 0.24)), 55, 1.06, center),
        "Camera | Close": (Vector((0.45, -1.0, 0.03)), 70, 1.1,
                           Vector((center.x, center.y - 1.0, center.z * 0.42 + 2.4))),
        "Camera | Top": (Vector((0.4, -0.62, 1.0)), 55, 1.02, center),
    }
    cams = {}
    for name, (direction, lens, margin, aim) in specs.items():
        cam_data = bpy.data.cameras.new(name)
        cam_data.lens = lens
        cam_data.sensor_width = 36
        cam_obj = bpy.data.objects.new(name, cam_data)
        COL["cameras"].objects.link(cam_obj)
        direction = direction.normalized()
        distance = (hi - lo).length * 2.2
        for _ in range(6):
            cam_obj.location = aim + direction * distance
            look_at(cam_obj, aim)
            bpy.context.view_layer.update()
            worst = 0.0
            for corner in corners:
                co = world_to_camera_view(scene, cam_obj, corner)
                worst = max(worst, abs(co.x - 0.5) * 2, abs(co.y - 0.5) * 2)
            factor = worst / (0.99 / margin)
            if abs(factor - 1.0) < 0.01:
                break
            distance *= max(0.4, min(2.5, factor))
        cam_obj["look_at"] = "Look Target"
        cam_obj["fits_frame"] = True
        cams[name] = cam_obj
    scene.camera = cams["Camera | Hero"]
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1200
    scene.render.film_transparent = False
    return cams


def collapse_groups():
    """Merge every empty-anchored group (banners, lanterns, sign, windows) into one
    mesh while keeping the anchor transform, so the file stays light and tidy.
    Text objects are kept editable."""
    anchors = [o for o in list(scene.objects) if o.type == "EMPTY" and o.children]
    for anchor in anchors:
        kids = [c for c in anchor.children if c.type in {"MESH", "CURVE"} and c.data and c.type != "FONT"]
        if not kids:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for k in kids:
            k.select_set(True)
        bpy.context.view_layer.objects.active = kids[0]
        bpy.ops.object.convert(target="MESH")
        kids = [o for o in bpy.context.selected_objects if o.type == "MESH"]
        if not kids:
            continue
        bpy.context.view_layer.objects.active = kids[0]
        if len(kids) > 1:
            bpy.ops.object.join()
        merged = bpy.context.object
        merged.name = anchor.name
        merged.data.name = anchor.name
        mw = merged.matrix_world.copy()
        merged.parent = None
        merged.matrix_world = mw
        for child in list(anchor.children):
            keep = child.matrix_world.copy()
            child.parent = None
            child.matrix_world = keep
        bpy.data.objects.remove(anchor, do_unlink=True)
    # merge the remaining per-part meshes inside each group prefix (rafters, stairs...)
    groups = {}
    for obj in list(scene.objects):
        if obj.type != "MESH" or obj.parent:
            continue
        key = obj.name.split(" ")[0]
        groups.setdefault(key, []).append(obj)
    for key, objs in groups.items():
        if key in {"Roof", "Camera", "Look"} or len(objs) < 6:
            continue
        target = objs[0]
        bpy.ops.object.select_all(action="DESELECT")
        for o in objs:
            o.select_set(True)
        bpy.context.view_layer.objects.active = target
        bpy.ops.object.join()
        target.name = key
        target.data.name = key


# ----------------------------------------------------------------------------
# render settings
# ----------------------------------------------------------------------------
def setup_render():
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 128
    scene.cycles.use_adaptive_sampling = True
    scene.cycles.adaptive_threshold = 0.02
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 4
    scene.cycles.glossy_bounces = 4
    scene.cycles.transmission_bounces = 6
    scene.view_settings.view_transform = "AgX"
    scene.view_settings.look = "AgX - Punchy"
    scene.view_settings.exposure = 0.58
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"


# ----------------------------------------------------------------------------
# build
# ----------------------------------------------------------------------------
def add_readme_text():
    text = bpy.data.texts.new("README — SECRET SHOP")
    text.write(
        "SECRET SHOP — Blender 4.2\n"
        "========================\n\n"
        "المشهد مبني بالكامل من مجسمات قابلة للتعديل (بدون صور مسطحة):\n"
        "- 00_Platform: القاعدة الحجرية والسلالم المتوهجة.\n"
        "- 01_Timber_Structure: الأعمدة والجدران والطابق الثاني والشرفة.\n"
        "- 02_Pagoda_Roofs: السقفان. السقف السفلي إطار حول الطابق العلوي والسقف الأعلى\n"
        "  يبدأ فوقه، لذلك لا يوجد أي تداخل بين السقفين.\n"
        "- 03_Facade_Windows: النوافذ المضيئة والشبك الخشبي والمدخل المقوس.\n"
        "- 04_Signage_Banners: اللافتة والتنين والرايات المعلقة بسلاسل ذهبية مرئية.\n"
        "- 05_Lanterns_Chains: الفوانيس والسلاسل.\n"
        "- 06_Interior: الرفوف والقوارير والصندوق داخل المتجر.\n"
        "- 07_Props_Crystals: الصناديق والنباتات والكريستالات والشلال.\n"
        "- 08_Lighting: الإضاءة الليلية الحمراء/الذهبية.\n"
        "- 09_Cameras: أربع كاميرات جاهزة (Hero / Front / Side / Top).\n\n"
        "الكاميرا النشطة: Camera | Hero.  الريندر: Cycles.\n"
        "الخط Secret Shop مجمّع داخل الملف (Packed) لذلك يعمل على أي جهاز.\n"
        "لإعادة توليد المشهد: tools/blender/build_shop.py\n"
    )


build_platform()
build_structure()
build_facade_details()
build_roofs()
build_interior()
build_props()
build_waterfall()
build_lighting()
setup_render()
add_readme_text()
collapse_groups()
build_cameras()
bpy.context.view_layer.update()

os.makedirs(os.path.dirname(BLEND_PATH), exist_ok=True)
bpy.ops.file.pack_all()
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=BLEND_PATH)

# object count summary
meshes = [o for o in scene.objects if o.type == "MESH"]
print(f"[secret-shop] saved {BLEND_PATH}")
print(f"[secret-shop] objects={len(scene.objects)} meshes={len(meshes)} "
      f"materials={len(bpy.data.materials)} lights={len([o for o in scene.objects if o.type=='LIGHT'])}")

# optional GLB copy for engines (opt-in: SHOP_GLB=1)
if os.environ.get("SHOP_GLB", "0") == "1":
    try:
        bpy.ops.export_scene.gltf(filepath=GLB_PATH, export_format="GLB",
                                  use_selection=False, export_apply=True,
                                  export_cameras=True, export_lights=True)
        print(f"[secret-shop] exported {GLB_PATH}")
    except Exception as exc:  # pragma: no cover
        print("[secret-shop] GLB export skipped:", exc)

if RENDER_PREVIEWS:
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    scene.cycles.samples = int(os.environ.get("SHOP_SAMPLES", "48"))
    scene.render.resolution_x = int(os.environ.get("SHOP_RES_X", "900"))
    scene.render.resolution_y = int(os.environ.get("SHOP_RES_Y", "750"))
    for name, cam in (("hero", "Camera | Hero"), ("front", "Camera | Front"),
                      ("side", "Camera | Side"), ("close", "Camera | Close"),
                      ("top", "Camera | Top")):
        scene.camera = bpy.data.objects[cam]
        scene.render.filepath = os.path.join(PREVIEW_DIR, f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print("[secret-shop] preview", scene.render.filepath)
