/**
 * WaveBackground.tsx — Full-screen animated ocean wave simulation.
 *
 * Renders a Three.js PlaneGeometry displaced by a 4-octave Perlin noise
 * height field. The plane sits at z-index 0, beneath the main 3D canvas.
 *
 * Interactions:
 *   Mouse move → soft radial glow follows the cursor (fragment shader only,
 *                no geometry distortion).
 *   Click      → single Gaussian ring expands outward from the click point,
 *                displacing the mesh height as it travels. Clicks on the
 *                3D model are ignored via Scene.hitTestModel().
 *
 * GLSL uniforms:
 *   uTime    — GSAP ticker time (seconds). Drives noise animation.
 *   uAmp     — Wave height scale. Default: 3 * 0.055 = 0.165 world units.
 *   uSpeed   — Time multiplier fed to noise. Default: 3 * 0.22 = 0.66.
 *   uTrail   — Cursor world-space position, normalised to [-1, 1] range
 *              (divided by half-plane extents: x/65, y/50).
 *   uTrailS  — Trail strength scalar, GSAP-tweened 1→0 over 1.8 s on mouse move.
 *   uRipple  — Click origin in the same normalised space as uTrail.
 *   uRippleS — Ripple amplitude scalar, 0→1→0 over ~4 s on click.
 *   uRippleT — Ripple age (0→10, power2.out). Drives the ring radius:
 *              ringRadius = uRippleT * 4.5 world units.
 *
 * Controls:
 *   WAVE SPEED  slider → tweens uSpeed (range 1–10, mapped to 0.22–2.2).
 *   WAVE HEIGHT slider → tweens uAmp   (range 1–10, mapped to 0.055–0.55).
 */

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import gsap from 'gsap'
import type Scene from '../scenes/Scene'

// ─── Vertex shader ────────────────────────────────────────────────────────────
// Computes per-vertex height using 4-octave Perlin noise, then derives surface
// normals analytically via finite differences for the lighting pass.
const VERTEX = `
  uniform float uTime;
  uniform float uAmp;
  uniform float uSpeed;
  uniform vec2  uRipple;
  uniform float uRippleS;
  uniform float uRippleT;
  varying vec3  vNorm;
  varying vec3  vPos;

  vec3 mod289(vec3 x){ return x - floor(x*(1.0/289.0))*289.0; }
  vec4 mod289(vec4 x){ return x - floor(x*(1.0/289.0))*289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159-0.85373472095314*r; }
  vec3 fade(vec3 t){ return t*t*t*(t*(t*6.0-15.0)+10.0); }

  float cnoise(vec3 P){
    vec3 Pi0=floor(P), Pi1=Pi0+vec3(1.0);
    Pi0=mod289(Pi0); Pi1=mod289(Pi1);
    vec3 Pf0=fract(P), Pf1=Pf0-vec3(1.0);
    vec4 ix=vec4(Pi0.x,Pi1.x,Pi0.x,Pi1.x);
    vec4 iy=vec4(Pi0.yy,Pi1.yy);
    vec4 iz0=Pi0.zzzz, iz1=Pi1.zzzz;
    vec4 ixy=permute(permute(ix)+iy);
    vec4 ixy0=permute(ixy+iz0), ixy1=permute(ixy+iz1);
    vec4 gx0=ixy0*(1.0/7.0), gy0=fract(floor(gx0)*(1.0/7.0))-0.5;
    gx0=fract(gx0);
    vec4 gz0=vec4(0.5)-abs(gx0)-abs(gy0);
    vec4 sz0=step(gz0,vec4(0.0));
    gx0-=sz0*(step(0.0,gx0)-0.5); gy0-=sz0*(step(0.0,gy0)-0.5);
    vec4 gx1=ixy1*(1.0/7.0), gy1=fract(floor(gx1)*(1.0/7.0))-0.5;
    gx1=fract(gx1);
    vec4 gz1=vec4(0.5)-abs(gx1)-abs(gy1);
    vec4 sz1=step(gz1,vec4(0.0));
    gx1-=sz1*(step(0.0,gx1)-0.5); gy1-=sz1*(step(0.0,gy1)-0.5);
    vec3 g000=vec3(gx0.x,gy0.x,gz0.x), g100=vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010=vec3(gx0.z,gy0.z,gz0.z), g110=vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001=vec3(gx1.x,gy1.x,gz1.x), g101=vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011=vec3(gx1.z,gy1.z,gz1.z), g111=vec3(gx1.w,gy1.w,gz1.w);
    vec4 norm0=taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
    g000*=norm0.x; g010*=norm0.y; g100*=norm0.z; g110*=norm0.w;
    vec4 norm1=taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
    g001*=norm1.x; g011*=norm1.y; g101*=norm1.z; g111*=norm1.w;
    vec3 f=fade(Pf0);
    float n000=dot(g000,Pf0), n100=dot(g100,vec3(Pf1.x,Pf0.yz));
    float n010=dot(g010,vec3(Pf0.x,Pf1.y,Pf0.z)), n110=dot(g110,vec3(Pf1.xy,Pf0.z));
    float n001=dot(g001,vec3(Pf0.xy,Pf1.z)), n101=dot(g101,vec3(Pf1.x,Pf0.y,Pf1.z));
    float n011=dot(g011,vec3(Pf0.x,Pf1.yz)), n111=dot(g111,Pf1);
    float n_x0=mix(mix(n000,n100,f.x),mix(n010,n110,f.x),f.y);
    float n_x1=mix(mix(n001,n101,f.x),mix(n011,n111,f.x),f.y);
    return 2.2*mix(n_x0,n_x1,f.z);
  }

  // 4-octave fBm — base frequency s=0.38, each octave doubles frequency and
  // halves contribution. Time axis drives temporal animation per octave.
  float height(vec2 p, float t){
    float s = 0.38;
    float h  = cnoise(vec3(p*s*1.0,       t*0.40)) * 0.55;
          h += cnoise(vec3(p*s*2.1 + 3.7,  t*0.65)) * 0.28;
          h += cnoise(vec3(p*s*4.5 + 7.3,  t*0.90)) * 0.12;
          h += cnoise(vec3(p*s*9.0 + 13.1, t*1.20)) * 0.05;
    return h;
  }

  void main(){
    vec3 p = position;
    float t = uTime * uSpeed;

    p.z = height(p.xy, t) * uAmp;

    // Click ripple: single Gaussian ring expanding from uRipple.
    // ringR grows with age (uRippleT); atRing peaks where rd == ringR.
    vec2 rPos = uRipple * vec2(65.0, 50.0);
    float rd = length(p.xy - rPos);
    float ringR = uRippleT * 4.5;
    float atRing = exp(-pow(rd - ringR, 2.0) * 0.06) * exp(-uRippleT * 0.22);
    p.z += uRippleS * atRing * 0.07;

    // Surface normals via finite differences — eps=0.25 world units gives
    // smooth normals without losing high-frequency detail.
    float eps = 0.25;
    float hx = height(p.xy + vec2(eps, 0.0), t) * uAmp;
    float hy = height(p.xy + vec2(0.0, eps), t) * uAmp;
    vec3 tangX = normalize(vec3(eps, 0.0, hx - p.z));
    vec3 tangY = normalize(vec3(0.0, eps, hy - p.z));
    vNorm = normalize(cross(tangX, tangY));
    vPos  = p;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`

// ─── Fragment shader ──────────────────────────────────────────────────────────
// Phong shading (diffuse + specular + Fresnel) plus a soft radial glow at the
// cursor position. No textures — all lighting is computed analytically.
const FRAGMENT = `
  uniform vec2  uTrail;
  uniform float uTrailS;
  varying vec3 vNorm;
  varying vec3 vPos;
  void main(){
    vec3 lightDir = normalize(vec3(0.2, 0.4, 1.0));
    vec3 viewDir  = normalize(vec3(0.0, 0.0, 1.0));
    vec3 halfDir  = normalize(lightDir + viewDir);
    float diff = max(dot(vNorm, lightDir), 0.0);
    float spec = pow(max(dot(vNorm, halfDir), 0.0), 80.0);  // shininess = 80
    float fres = pow(1.0 - abs(dot(vNorm, viewDir)), 3.0);  // rim / Fresnel

    // Cursor glow — soft radial falloff centred on uTrail (world space).
    // Decays with exp(-td * 0.09); strength fades via uTrailS over 1.8 s.
    vec2 trailWP = uTrail * vec2(65.0, 50.0);
    float td = length(vPos.xy - trailWP);
    float glow = uTrailS * exp(-td * 0.09) * 0.22;

    float base = 0.09 + diff * 0.22 + spec * 0.32 + fres * 0.08 + glow;
    gl_FragColor = vec4(vec3(clamp(base, 0.0, 1.0)), 1.0);
  }
`

type Props = { scene: Scene | null }

export default function WaveBackground({ scene }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Keep a ref to the latest scene so the click handler (closed over at mount)
  // always calls hitTestModel on the current instance, not a stale one.
  const sceneRef  = useRef(scene)
  useEffect(() => { sceneRef.current = scene }, [scene])

  const [speed, setSpeed] = useState(3)
  const [amp,   setAmp]   = useState(3)

  // Refs to GSAP tween functions wired up inside the effect.
  // Pattern: expose imperative controls from a closed-over effect via refs.
  const tweenSpeed = useRef<((v: number) => void) | undefined>(undefined)
  const tweenAmp   = useRef<((v: number) => void) | undefined>(undefined)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))

    const waveScene = new THREE.Scene()

    // Camera at z=60 looking at the origin; the plane spans 130×100 world units,
    // filling the frustum at this distance with FOV 60°.
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500)
    camera.position.set(0, 0, 60)
    camera.lookAt(0, 0, 0)

    const resize = () => {
      const w = window.innerWidth, h = window.innerHeight
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    // Uniform objects — mutated directly each frame; Three.js reads .value
    const uTime    = { value: 0 }
    const uAmp     = { value: amp   * 0.055 }
    const uSpeed   = { value: speed * 0.22  }
    const uTrail   = { value: new THREE.Vector2(9999, 9999) }  // off-screen default
    const uTrailS  = { value: 0 }
    const uRipple  = { value: new THREE.Vector2(9999, 9999) }
    const uRippleS = { value: 0 }
    const uRippleT = { value: 0 }

    // Expose slider-driven tween functions back to the React render closure
    tweenSpeed.current = (v) => gsap.to(uSpeed, { value: v * 0.22,  duration: 0.4, ease: 'power2.out' })
    tweenAmp.current   = (v) => gsap.to(uAmp,   { value: v * 0.055, duration: 0.4, ease: 'power2.out' })

    // 340×340 segments — enough resolution for smooth Perlin displacement
    const geo = new THREE.PlaneGeometry(130, 100, 340, 340)
    const mat = new THREE.ShaderMaterial({
      uniforms: { uTime, uAmp, uSpeed, uTrail, uTrailS, uRipple, uRippleS, uRippleT },
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT,
      side: THREE.DoubleSide,
    })
    waveScene.add(new THREE.Mesh(geo, mat))

    // Raycaster + z=0 plane for converting screen coords → world coords
    const raycaster  = new THREE.Raycaster()
    const plane0     = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)
    const hit        = new THREE.Vector3()
    const ndcV       = new THREE.Vector2()

    // GSAP proxy objects — tweened each frame, values written to uniforms
    const trailProxy  = { v: 0 }
    const rippleProxy = { v: 0 }
    const rippleAge   = { v: 0 }

    const getHit = (cx: number, cy: number) => {
      ndcV.x =  (cx / window.innerWidth)  * 2 - 1
      ndcV.y = -(cy / window.innerHeight) * 2 + 1
      raycaster.setFromCamera(ndcV, camera)
      raycaster.ray.intersectPlane(plane0, hit)
      return hit
    }

    const updateTrail = (cx: number, cy: number) => {
      const h = getHit(cx, cy)
      if (!h) return
      // Normalise world coords to [-1, 1] range matching the GLSL de-normalisation
      uTrail.value.set(h.x / 65, h.y / 50)
      gsap.killTweensOf(trailProxy)
      gsap.fromTo(trailProxy, { v: 1 }, {
        v: 0, duration: 1.8, ease: 'power2.out',
        onUpdate: () => { uTrailS.value = trailProxy.v },
      })
    }

    const triggerRipple = (cx: number, cy: number) => {
      const h = getHit(cx, cy)
      if (!h) return
      uRipple.value.set(h.x / 65, h.y / 50)
      gsap.killTweensOf(rippleProxy)
      gsap.killTweensOf(rippleAge)
      rippleAge.v    = 0
      uRippleT.value = 0
      // Two-phase strength tween: snap to 1, then ease out over 4 s
      gsap.fromTo(rippleProxy, { v: 0 }, {
        v: 1, duration: 0.05, ease: 'none',
        onUpdate:  () => { uRippleS.value = rippleProxy.v },
        onComplete: () => {
          gsap.to(rippleProxy, {
            v: 0, duration: 4.0, ease: 'power2.out',
            onUpdate: () => { uRippleS.value = rippleProxy.v },
          })
        },
      })
      // Age drives ring radius; power2.out = fast initial expansion, then easing
      gsap.to(rippleAge, {
        v: 10.0, duration: 4.0, ease: 'power2.out',
        onUpdate: () => { uRippleT.value = rippleAge.v },
      })
    }

    const onMouseMove = (e: MouseEvent) => updateTrail(e.clientX, e.clientY)
    const onClick = (e: MouseEvent) => {
      // Suppress ripple when the click landed on the 3D model
      if (sceneRef.current?.hitTestModel(e.clientX, e.clientY)) return
      triggerRipple(e.clientX, e.clientY)
    }
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0]
      if (sceneRef.current?.hitTestModel(t.clientX, t.clientY)) return
      triggerRipple(t.clientX, t.clientY)
    }
    const onTouchMove = (e: TouchEvent) => updateTrail(e.touches[0].clientX, e.touches[0].clientY)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('click',     onClick)
    window.addEventListener('touchend',  onTouchEnd)
    window.addEventListener('touchmove', onTouchMove, { passive: true })

    // Hook into GSAP's ticker instead of a manual RAF so the wave stays in sync
    // with any GSAP animations running elsewhere in the app.
    const tick = (t: number) => {
      uTime.value = t
      renderer.render(waveScene, camera)
    }
    gsap.ticker.add(tick)

    return () => {
      window.removeEventListener('resize',    resize)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('click',     onClick)
      window.removeEventListener('touchend',  onTouchEnd)
      window.removeEventListener('touchmove', onTouchMove)
      gsap.ticker.remove(tick)
      renderer.dispose()
      geo.dispose()
      mat.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ctrlStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '2%',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 25,
    display: 'flex',
    gap: '32px',
    alignItems: 'center',
    fontFamily: "'Modern Era Mono', 'Courier New', monospace",
    fontSize: '9px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
    pointerEvents: 'all',
  }

  const labelStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, opacity: 0.5 }}
      />
      <div style={ctrlStyle}>
        <label style={labelStyle}>
          WAVE SPEED
          <input
            type="range" min={1} max={10} step={1} value={speed}
            style={{ width: '72px', accentColor: 'rgba(255,255,255,0.5)' }}
            onChange={e => {
              const v = Number(e.target.value)
              setSpeed(v)
              tweenSpeed.current?.(v)
            }}
          />
        </label>
        <label style={labelStyle}>
          WAVE HEIGHT
          <input
            type="range" min={1} max={10} step={1} value={amp}
            style={{ width: '72px', accentColor: 'rgba(255,255,255,0.5)' }}
            onChange={e => {
              const v = Number(e.target.value)
              setAmp(v)
              tweenAmp.current?.(v)
            }}
          />
        </label>
      </div>
    </>
  )
}
