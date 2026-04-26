# Earth Web — Codebase Documentation

Interactive flat-earth cosmology experience built with React, TypeScript, Three.js, and GSAP. The experience flows through three sequential phases: an animated text intro, a light-burst transition, then a fully interactive 3D scene.

---

## Project Structure

```
src/
  main.tsx              Entry point — mounts <App /> in StrictMode
  index.css             Global reset: box-sizing, overflow hidden, black background
  App.tsx               Root component and phase state machine
  scenes/
    Scene.ts            Three.js 3D scene — model, camera, lighting, interaction
  components/
    IntroScreen.tsx     Star Wars crawl + matrix scramble title (phase: intro)
    IntroScreen.css
    LightBurst.tsx      CSS radial explosion transition (phase: burst)
    LightBurst.css
    WaveBackground.tsx  GLSL animated ocean wave simulation (phase: sphere)
    SphereScreen.tsx    HUD overlay — callouts, clock, thumbnails (phase: sphere)
    SphereScreen.css
```

---

## File Summaries

### `src/main.tsx`
React entry point. Calls `createRoot` on `#root` and renders `<App />` wrapped in `StrictMode`. No logic.

---

### `src/index.css`
Global stylesheet. Sets `box-sizing: border-box`, removes default margin/padding, locks `html/body/#root` to `100%` height with `overflow: hidden` (no page scroll — all scrolling is custom JS). Background is black, text is white.

---

### `src/App.tsx`
**Root component and phase state machine.**

Manages three phases via `useState<Phase>`:

| Phase | What's visible |
|-------|---------------|
| `intro` | `<IntroScreen>` over the Three.js canvas |
| `burst` | `<LightBurst>` over the Three.js canvas |
| `sphere` | `<WaveBackground>` + `<SphereScreen>` + Three.js canvas |

Key behaviours:
- `Scene` is constructed once on mount, bound to a persistent `<canvas>` element that exists for the full session.
- `enableScroll()` is called on the Scene only when the sphere phase becomes active, keeping the model frozen during the burst animation.
- `handleLightClick(origin)` starts the burst and schedules a `setTimeout` to advance to sphere after 4.2 s.

**Z-index stacking:**
```
z-index 0   WaveBackground canvas (opacity 0.5)
z-index 10  Three.js canvas (Scene)
z-index 20  SphereScreen HUD
z-index 25  Wave speed/height controls
z-index 100 IntroScreen
z-index 200 LightBurst
z-index 300 Callout modal pages
```

---

### `src/scenes/Scene.ts`
**Core Three.js scene — the flat-earth GLB model, camera, lighting, and all pointer/touch interaction.**

**Setup:**
- `WebGLRenderer` with `alpha: true` so the wave background canvas shows through transparent regions.
- `PMREMGenerator` + `RoomEnvironment` provides neutral IBL (image-based lighting) for physically-correct material reflections.
- Camera: `PerspectiveCamera(60°)`, starts at `z = 3`, clamped zoom range `[1.5, 8]`.

**Model loading:**
- GLB loaded from `/models/flat earth model.glb` via `GLTFLoader`.
- Normalised on load: centred at origin, longest axis scaled to 2 world units.
- All embedded animations (cloud/water loops) are played automatically via `AnimationMixer`.
- A fallback blue sphere is shown while the GLB loads.

**Edge points:**
Four midpoints (N, E, S, W faces) are computed in model-local space at load time. `getEdgeScreenPositions()` projects them into screen pixels every frame for `SphereScreen`'s SVG connector lines.

**Interaction (all gated by `scrollEnabled`):**
- **Drag** → rotates model (`targetRotY`, `targetRotX` at 0.008 rad/px).
- **Vertical scroll/wheel** → zooms camera (`targetCamZ` at 0.004 units/px).
- **Horizontal wheel** → rotates model horizontally.
- **Touch** → drag-rotates; uses inverted delta so dragging left rotates clockwise.
- All targets are smoothed with exponential lerp (factor 0.05) each frame.

**Public API:**
| Method | Purpose |
|--------|---------|
| `enableScroll()` | Unlocks all pointer/touch input |
| `setThumbnailCanvas(canvas)` | Registers 2D canvas for live thumbnail blitting |
| `hitTestModel(x, y)` | Raycast hit test — used by WaveBackground to suppress ripples on the model |
| `getRotation()` | Returns `{rotY, rotX}` for SphereScreen parallax |
| `getEdgeScreenPositions()` | Projects 4 edge points to screen pixels |
| `dispose()` | Cancels RAF, removes listeners, frees GPU resources |

---

### `src/components/IntroScreen.tsx`
**Star Wars perspective text crawl with a matrix scramble title.**

**Matrix title:**
- `rAF` loop writes directly to a `<span>` DOM node each frame (no React state, zero re-renders).
- Each character cycles through `SCRAMBLE_CHARS` until `settleAt = index * 60ms + 800ms` elapses.
- Full reveal completes in ~2.6 s. Title fades out (opacity 0, 0.8 s transition) on first scroll.

**Crawl:**
- A `<div>` with CSS `perspective` and `rotateX(25deg)` creates the 3D tilt.
- JS drives `top` and `scale` every rAF frame. Scale shrinks from 1 → 0.08 as scroll progresses, creating the depth-receding illusion.
- Scroll input (wheel, keyboard, touch) is clamped to `[0, maxScroll]` and smoothed with lerp factor 0.07.
- The glowing "light" word is a `<button>` that calls `onLightClick(origin)` with the click pixel position.

---

### `src/components/LightBurst.tsx`
**CSS radial explosion — the visual bridge between intro and sphere.**

A single `.burst-circle` div is centred on the click origin (`left: origin.x, top: origin.y`) and animated with two chained CSS keyframes:

| Keyframe | Timing | Effect |
|----------|--------|--------|
| `burstExpand` | 0 → 0.8 s | `scale(0)` → `scale(70)` — fills entire viewport |
| `burstFade` | 2.8 → 4 s | `opacity 1` → `opacity 0` — reveals 3D scene |

The gradient: white centre → pale yellow → golden → orange edge. Component is unmounted by App at 4.2 s. No JS animation, no state.

---

### `src/components/WaveBackground.tsx`
**Full-screen animated ocean wave simulation using Three.js + custom GLSL shaders.**

**Geometry:** `PlaneGeometry(130, 100, 340×340 segments)` — wide enough to fill the viewport from `z = 60`.

**Vertex shader — height field:**
4-octave Perlin noise (fBm) with base frequency `s = 0.38`. Each octave doubles spatial frequency and halves amplitude. `uTime * uSpeed` drives temporal animation.

| Uniform | Default | Effect |
|---------|---------|--------|
| `uAmp` | `3 × 0.055` | Wave height scale |
| `uSpeed` | `3 × 0.22` | Time multiplier |
| `uRipple` | off-screen | Click origin (normalised: x/65, y/50) |
| `uRippleS` | 0 | Ring amplitude (GSAP tween) |
| `uRippleT` | 0 | Ring age — drives radius: `ringR = uRippleT × 4.5` |

**Click ripple:** Single Gaussian ring `exp(-pow(rd - ringR, 2) × 0.06)` expanding outward. Age animated with `power2.out` (fast initial expansion, decelerating). Fades over 4 s.

**Fragment shader:**
Phong shading (diffuse + specular shininess 80 + Fresnel rim) plus a soft cursor glow: `exp(-td × 0.09) × uTrailS × 0.22`.

| Uniform | Effect |
|---------|--------|
| `uTrail` | Cursor world position (normalised) |
| `uTrailS` | Glow strength — GSAP tween 1→0 over 1.8 s on mouse move |

**Controls:** WAVE SPEED and WAVE HEIGHT sliders (bottom-centre, z-index 25). Values are GSAP-tweened to `uSpeed`/`uAmp` over 0.4 s.

**Hit suppression:** `Scene.hitTestModel()` is called on every click; ripples are skipped if the click landed on the 3D model.

---

### `src/components/SphereScreen.tsx`
**HUD overlay rendered on top of the 3D scene during the sphere phase.**

**Thumbnail (top-left):**
Three frames: "CURRENT VIEW" is a `<canvas>` that Scene blits its render output into each frame via `setThumbnailCanvas()`. "GOD'S VIEW" and "OUR VIEW" are placeholder divs.

**Clock (top-right):**
- UTC time: updated every second via `setInterval`.
- Ethiopian calendar: converted from Gregorian using a custom epoch-based algorithm (epoch: ET 2018 Meskerem 1 = Sep 11 2025). Leap years: `year % 4 === 3`.
- Static "7500 YEARS" counter.

**Callout system:**
Four annotations (`CALLOUTS` array) pinned to the model's N/E/S/W edges:
- SVG `<line>` elements connect model edge screen positions to glowing circle buttons.
- A dedicated `rAF` loop updates line endpoints and a parallax offset directly in the DOM — no React state updates per frame.
- Parallax: spring-damped (lerp 0.08) offset on the callout wrapper, scaled from rotation deltas (±160 px/rad).

**Modal pages:**
Clicking a circle button opens a full-screen modal (`z-index 300`) that zoom-animates from the circle's screen position (`transform-origin` set dynamically). Each modal contains a rotating Three.js sphere (separate renderer, 48×48 sphere geometry, auto-disposed on close).

---

## Key Technical Patterns

**Imperative refs from closed effects:**
`WaveBackground` exposes GSAP tween functions for the sliders by storing them in `useRef` inside the effect. This avoids re-running the heavy Three.js setup when slider values change.

**Direct DOM writes in RAF loops:**
Both `Scene` (thumbnail blit) and `SphereScreen` (SVG line attributes, parallax transform) write to the DOM directly from `requestAnimationFrame` callbacks, bypassing React's reconciler for per-frame updates.

**GSAP proxy objects:**
Uniform values that need smooth animation (ripple strength, trail glow, camera zoom) use plain objects `{ v: 0 }` tweened by GSAP, with `onUpdate` writing to the Three.js uniform. This avoids creating GSAP plugins or custom interpolators.

**Phase-gated input:**
`Scene.scrollEnabled` is false until `App` calls `enableScroll()` at phase transition, preventing accidental model interaction during the burst animation.
