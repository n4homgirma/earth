import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type Scene from '../scenes/Scene'
import './SphereScreen.css'

// Each callout is assigned to one edge index: 0=N 1=E 2=S 3=W
// getConnector returns the pixel point on the text panel that the line terminates at
const CALLOUTS = [
  {
    id: '01',
    edgeIndex: 0,
    title: 'The Firmament',
    description: 'And God said, "Let there be a vault between the waters to separate water from water." So God made the vault and separated the water under the vault from the water above it. And it was so.',
    textStyle: { left: '60.5%', top: '22%', maxWidth: '22%' } as React.CSSProperties,
    textRight: false,
    // bottom-left corner: -10px = half-circle (9px) + 1px border
    circleStyle: { bottom: '-10px', left: '-10px' } as React.CSSProperties,
  },
  {
    id: '02',
    edgeIndex: 1,
    title: 'The Waters Above',
    description: 'The waters above the firmament are held in place by the dome of heaven — a crystalline expanse stretching across the face of the deep, dividing the celestial from the terrestrial.',
    textStyle: { right: '0.5%', top: '47%', maxWidth: '22%' } as React.CSSProperties,
    textRight: true,
    // left-centre: transform centres vertically on the left border edge
    circleStyle: { top: '50%', left: '-10px', transform: 'translateY(-50%)' } as React.CSSProperties,
  },
  {
    id: '03',
    edgeIndex: 3,
    title: 'The Foundation',
    description: "He set the earth on its foundations; it can never be moved. The world is established, firm and secure — pillars of the earth are the LORD's, and he has set the world upon them.",
    textStyle: { left: '0.5%', top: '36%', maxWidth: '19%' } as React.CSSProperties,
    textRight: false,
    // bottom-right corner
    circleStyle: { bottom: '-10px', right: '-10px' } as React.CSSProperties,
  },
  {
    id: '04',
    edgeIndex: 2,
    title: 'The Deep',
    description: 'In the beginning the earth was formless and empty, darkness was over the surface of the deep, and the Spirit of God was hovering over the waters — the great abyss beneath all things.',
    textStyle: { left: '7%', top: '80%', maxWidth: '22%' } as React.CSSProperties,
    textRight: false,
    // top-right corner
    circleStyle: { top: '-10px', right: '-10px' } as React.CSSProperties,
  },
]

// Epoch: ET 2018 Meskerem 1 = Gregorian September 11, 2025.
// ET leap year rule: ETYear % 4 === 3 → 366 days (Pagumē has 6 days), else 365.
const EPOCH_GR = new Date(2025, 8, 11) // Sep 11 2025
const EPOCH_ET = 2018

function toEthiopian(date: Date) {
  let d = Math.floor((date.getTime() - EPOCH_GR.getTime()) / 86_400_000)
  let y = EPOCH_ET
  if (d < 0) {
    while (d < 0) { y--; d += y % 4 === 3 ? 366 : 365 }
  } else {
    for (let len = y % 4 === 3 ? 366 : 365; d >= len; len = y % 4 === 3 ? 366 : 365) {
      d -= len; y++
    }
  }
  return { year: y, month: Math.floor(d / 30) + 1, day: (d % 30) + 1 }
}

function pad(n: number) { return String(n).padStart(2, '0') }

type Props = { scene: Scene | null }

export default function SphereScreen({ scene }: Props) {
  const [clock, setClock] = useState({ utc: '', et: '' })
  const [openPage, setOpenPage] = useState<number | null>(null)
  const [pageOrigin, setPageOrigin] = useState('50% 50%')

  const handleCircleClick = (i: number, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setPageOrigin(`${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px`)
    setOpenPage(i)
  }

  const thumbRef = useRef<HTMLCanvasElement>(null)
  const pageCanvasRef = useRef<HTMLCanvasElement>(null)
  const calloutWrapRef = useRef<HTMLDivElement>(null)
  const circleBtnRefs = useRef<(HTMLButtonElement | null)[]>([null, null, null, null])
  const lineRefs = useRef<(SVGLineElement | null)[]>([null, null, null, null])
  const circleRefs = useRef<(SVGCircleElement | null)[]>([null, null, null, null])

  // Register thumbnail canvas with the scene so it gets copied each frame
  useEffect(() => {
    if (!scene || !thumbRef.current) return
    scene.setThumbnailCanvas(thumbRef.current)
    return () => scene.setThumbnailCanvas(null)
  }, [scene])

  // Live clock — ticks every second, derives both UTC and ET from the same Date
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const h = String(now.getUTCHours()).padStart(2, '0')
      const m = String(now.getUTCMinutes()).padStart(2, '0')
      const s = String(now.getUTCSeconds()).padStart(2, '0')
      const et = toEthiopian(now)
      setClock({
        utc: `${h}:${m}:${s} UTC`,
        et: `${et.year} E.C. ${pad(et.month)}.${pad(et.day)}`,
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Rotating sphere inside the expanded page
  useEffect(() => {
    if (openPage === null || !pageCanvasRef.current) return
    const canvas = pageCanvasRef.current
    const w = canvas.clientWidth || 280
    const h = canvas.clientHeight || 400

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    renderer.outputColorSpace = THREE.SRGBColorSpace

    const pagescene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(55, w / h, 0.1, 100)
    cam.position.z = 2.6

    const geo = new THREE.SphereGeometry(1, 48, 48)
    const mat = new THREE.MeshStandardMaterial({ color: 0x99aabb, roughness: 0.45, metalness: 0.3 })
    const sphere = new THREE.Mesh(geo, mat)
    pagescene.add(sphere)
    pagescene.add(new THREE.AmbientLight(0xffffff, 0.5))
    const dir = new THREE.DirectionalLight(0xffffff, 2)
    dir.position.set(3, 2, 4)
    pagescene.add(dir)

    let rafId: number
    const tick = () => {
      rafId = requestAnimationFrame(tick)
      sphere.rotation.y += 0.006
      renderer.render(pagescene, cam)
    }
    tick()

    return () => {
      cancelAnimationFrame(rafId)
      renderer.dispose()
      geo.dispose()
      mat.dispose()
    }
  }, [openPage])

  // RAF loop — updates SVG attributes and callout parallax directly, no React re-render per frame
  useEffect(() => {
    if (!scene) return
    let rafId: number

    let prevRotY = 0
    let prevRotX = 0
    let offsetX = 0
    let offsetY = 0

    const loop = () => {
      const edges = scene.getEdgeScreenPositions()
      const rot = scene.getRotation()

      // Per-frame rotation delta → subtle parallax offset on callout container
      const dRotY = rot.rotY - prevRotY
      const dRotX = rot.rotX - prevRotX
      prevRotY = rot.rotY
      prevRotX = rot.rotX

      offsetX += (dRotY * 160 - offsetX) * 0.08
      offsetY += (dRotX * 160 - offsetY) * 0.08

      if (calloutWrapRef.current) {
        calloutWrapRef.current.style.transform =
          `translate(${offsetX.toFixed(2)}px, ${offsetY.toFixed(2)}px)`
      }

      CALLOUTS.forEach((cfg, i) => {
        const edge = edges[cfg.edgeIndex]
        const btn = circleBtnRefs.current[i]?.getBoundingClientRect()
        const line = lineRefs.current[i]
        const circle = circleRefs.current[i]
        if (!edge || !btn || !line || !circle) return

        const connX = btn.left + btn.width / 2
        const connY = btn.top + btn.height / 2
        line.setAttribute('x1', String(Math.round(edge.x)))
        line.setAttribute('y1', String(Math.round(edge.y)))
        line.setAttribute('x2', String(Math.round(connX)))
        line.setAttribute('y2', String(Math.round(connY)))
        circle.setAttribute('cx', String(Math.round(edge.x)))
        circle.setAttribute('cy', String(Math.round(edge.y)))
      })

      rafId = requestAnimationFrame(loop)
    }

    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [scene])

  return (
    <div className="sphere-screen">
      <div className="sphere-top-gradient" />

      {/* Top-left: view thumbnails */}
      <div className="views">
        <div className="view-item">
          <span className="view-label">CURRENT VIEW</span>
          <canvas ref={thumbRef} className="view-thumb" width={250} height={196} />
        </div>
        <div className="view-item">
          <span className="view-label">GOD'S VIEW</span>
          <div className="view-thumb" />
        </div>
        <div className="view-item">
          <span className="view-label">OUR VIEW</span>
          <div className="view-thumb" />
        </div>
      </div>

      {/* Top-right: year / Ethiopian date / UTC time */}
      <div className="time-display">
        <span className="time-years">7500 YEARS</span>
        <span className="time-et">{clock.et}</span>
        <span className="time-utc">{clock.utc}</span>
      </div>

      {/* SVG connector lines — no viewBox so user units == CSS pixels */}
      <svg className="callout-svg">
        {CALLOUTS.map((_, i) => (
          <g key={i}>
            <line
              ref={el => { lineRefs.current[i] = el }}
              x1="0" y1="0" x2="0" y2="0"
              stroke="white" strokeWidth="1" opacity="0.75"
            />
            <circle
              ref={el => { circleRefs.current[i] = el }}
              cx="0" cy="0" r="3"
              fill="white"
            />
          </g>
        ))}
      </svg>

      {/* Callout text panels — wrapper receives parallax transform */}
      <div ref={calloutWrapRef} className="callout-wrap">
        {CALLOUTS.map((cfg, i) => (
          <div
            key={cfg.id}
            className={`callout-text${cfg.textRight ? ' callout-text--right' : ''}`}
            style={cfg.textStyle}
          >
            <span className="callout-text-title">{cfg.title}</span>
            <span className="callout-text-desc">{cfg.description}</span>
            <button
              className="callout-circle"
              style={cfg.circleStyle}
              ref={el => { circleBtnRefs.current[i] = el }}
              onClick={(e) => handleCircleClick(i, e)}
            >
              <span className="callout-pulse" />
              <span className="callout-pulse callout-pulse--delay" />
            </button>
          </div>
        ))}
      </div>

      {/* Expanded callout page — zooms in from the circle's screen position */}
      {openPage !== null && (
        <div
          className="callout-page"
          style={{ transformOrigin: pageOrigin }}
          onClick={() => setOpenPage(null)}
        >
          <div className="callout-page-inner" onClick={e => e.stopPropagation()}>
            <canvas ref={pageCanvasRef} className="callout-page-canvas" />
            <div className="callout-page-content">
              <span className="callout-page-id">{CALLOUTS[openPage].id}</span>
              <h2 className="callout-page-title">{CALLOUTS[openPage].title}</h2>
              <p className="callout-page-desc">{CALLOUTS[openPage].description}</p>
            </div>
            <button className="callout-page-close" onClick={() => setOpenPage(null)}>✕</button>
          </div>
        </div>
      )}

      {/* Bottom-right attribution */}
      <div className="attribution">
        <span>FLAT EARTH (EARTH) MODEL · 2026</span>
        <span>3D MODEL REFERENCED FROM SKETCHFAB | THANKS TO THE ORIGINAL CREATORS</span>
        <span>DESIGNED AND CRAFTED BY NAHOM GIRMA</span>
      </div>

    </div>
  )
}
