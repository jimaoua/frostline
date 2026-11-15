# Rendering direction: moving Frostline to real 3D

## Decision

**Real-time stylized 3D with Three.js (WebGL2), a fixed orthographic isometric
camera, glTF/GLB assets, and the existing React HUD on top.** The simulation
(`src/game/systems`, `progression`, `world`) stays exactly as it is. Only
`src/game/render` is replaced by a Three.js renderer that reads the same
`World` each frame.

## Why not the alternatives

| Option | Verdict |
| --- | --- |
| Keep improving canvas 2D vector art | Rejected. This is the ceiling we have hit: no real volume, materials or lighting. |
| Pre-rendered 3D sprites (2.5D) | Viable look, but every character needs 8+ directions × ~12 animations × frames. That means huge texture atlases (iPhone memory), no smooth turning (we facing-lerp continuously), no dynamic fire/night lighting on models, and a re-render pipeline for every new outfit or prop. |
| **True 3D (chosen)** | Continuous rotation, real skinned animation blending, real lights and soft shadows, one asset per object, and the same pipeline from prototype to launch. |

## Mobile performance budget (60 fps on iPhone 12+)

- Orthographic camera, fixed pitch ~35–40°, framing ~6 tiles; renderer at DPR ≤ 2 (consider 1.5 dynamic).
- Characters 3–8k tris, 1 skinned mesh, 1 material, ≤ 30 bones; buildings 2–10k tris.
- Trees, posts, rocks: `InstancedMesh` (one draw call per kind). Target < 150 draw calls.
- One directional shadow map (1024–2048) fitted to the camera frustum, updated every frame only around the player; static AO baked into textures.
- Textures: KTX2/Basis (ETC1S for color, UASTC for hero assets), 512–1024 px atlases.
- Meshes: meshopt or Draco compression; total initial download < 15 MB.
- Night: a few point lights (fire, lanterns) with distance falloff, plus emissive windows, fog and a color-graded tonemap. No real-time GI.
- Snow, footprints, flyers and popups: instanced sprites / screen-space 2D, reusing today's logic.

## What it really takes: assets

Code cannot produce the reference quality. Authored models, textures and animations can. Options:

1. **CC0 stylized packs** (e.g. KayKit, Quaternius; check each pack's license).
   They come rigged and animated, in a consistent style, and ready today. They are ideal for the
   proof of concept and as a base layer, but not unique to Frostline.
2. **Commissioned 3D art** for the player, survivors, key buildings and the
   campfire. This is what gives an App Store-level original identity.
3. **AI-generated 3D + cleanup.** It's fast for props, but topology, rigging and style consistency need
   manual work.

Recommended: prove the pipeline and performance with a CC0 pack, then commission
hero assets once the look and frame-rate are approved.

## Migration plan

1. `render3d/` module: scene, ortho camera rig (same lead/follow as today),
   lights, an asset loader with a manifest and a loading screen.
2. A `ViewModel` adapter: maps `World` entities → scene objects (create/update/
   dispose by id), and animation state → clips (idle, walk, run, chop, mine, fish,
   carry-idle, carry-walk, cheer, shiver, hit, ko).
3. Proof of concept (Step B): player + campfire + trees + snow ground + one
   building, side by side with the canvas renderer behind a `?renderer=3d` flag.
4. Port pads/badges (keep the 2D billboard badges as HTML/canvas overlay), FX and
   lighting; then the remaining buildings; then delete the canvas renderer.

## What blocked doing it here

This build environment has package installs and asset downloads disabled
(npm, GitHub and CDNs are unreachable) and no 3D modelling tools. Enabling network
access (or uploading the chosen GLB/texture files) is the prerequisite for
Step B.
