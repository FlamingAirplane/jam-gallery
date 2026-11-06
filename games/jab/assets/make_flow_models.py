#!/usr/bin/env python3
"""Convert Flow Studio OBJ+MTL exports to glTF-ready GLB files."""
import sys
import bpy


def import_obj(path):
    # Remove default cube, camera, light.
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.wm.obj_import(filepath=path)
    # Join all imported meshes into one object.
    imported = [o for o in bpy.context.selected_objects if o.type == 'MESH']
    if not imported:
        raise RuntimeError(f'No mesh imported from {path}')
    bpy.context.view_layer.objects.active = imported[0]
    if len(imported) > 1:
        bpy.ops.object.join()
    obj = bpy.context.active_object
    if obj is None:
        raise RuntimeError(f'No object imported from {path}')
    return obj


def floor_align(obj):
    # Ensure world-space bounding box is up to date.
    bpy.context.view_layer.update()
    z_values = [obj.matrix_world @ v.co for v in obj.data.vertices]
    min_z = min(v.z for v in z_values)
    if min_z != 0:
        obj.location.z -= min_z
        bpy.context.view_layer.update()


def decimate(obj, target_tris):
    bpy.context.view_layer.objects.active = obj
    tri_count = len(obj.data.polygons)
    if tri_count <= target_tris:
        return
    ratio = max(0.01, target_tris / tri_count)
    mod = obj.modifiers.new(name='Decimate', type='DECIMATE')
    mod.ratio = ratio
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.context.view_layer.update()


def export_glb(obj, out_path, max_texture=256):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    # Downsize large textures to keep the shipped GLB small.
    for img in bpy.data.images:
        if img.name == 'Render Result' or img.name == 'Viewer Node':
            continue
        w, h = img.size
        if w > max_texture or h > max_texture:
            img.scale(max_texture, max_texture)
        if img.source == 'FILE' and not img.packed_file:
            try:
                img.pack()
            except Exception:
                pass
    bpy.ops.export_scene.gltf(
        filepath=out_path,
        use_selection=True,
        export_format='GLB',
        export_yup=True,
        export_materials='EXPORT',
        export_image_format='AUTO',
    )


def convert(name, obj_path, glb_path, target_tris=8000, max_texture=256):
    obj = import_obj(obj_path)
    obj.name = name
    obj.data.name = name
    floor_align(obj)
    decimate(obj, target_tris)
    export_glb(obj, glb_path, max_texture)
    print(f'Wrote {glb_path}')


if __name__ == '__main__':
    import argparse
    argv = sys.argv
    if '--' in argv:
        argv = argv[argv.index('--') + 1:]
    parser = argparse.ArgumentParser()
    parser.add_argument('--name', required=True)
    parser.add_argument('--obj', required=True)
    parser.add_argument('--glb', required=True)
    parser.add_argument('--target-tris', type=int, default=8000)
    parser.add_argument('--max-texture', type=int, default=256)
    args = parser.parse_args(argv)
    convert(args.name, args.obj, args.glb, args.target_tris, args.max_texture)
