/**
 * App.tsx — Root component and phase state machine.
 *
 * The experience has three sequential phases:
 *   'intro'  → Star Wars crawl with matrix title. User reads and scrolls,
 *              then clicks the glowing "light" word to advance.
 *   'burst'  → Full-screen radial light explosion animates over the canvas,
 *              masking the transition from intro to the 3D scene.
 *   'sphere' → Main interactive scene: flat-earth GLB model + wave background
 *              + callout annotations.
 *
 * The Three.js Scene is constructed once on mount and lives for the full
 * session. Scroll/drag interaction is gated behind scrollEnabled so the
 * model stays frozen during the burst transition.
 */

import { useEffect, useRef, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import Scene from './scenes/Scene'
import IntroScreen from './components/IntroScreen'
import LightBurst from './components/LightBurst'
import SphereScreen from './components/SphereScreen'
import WaveBackground from './components/WaveBackground'
import './index.css'

type Phase = 'intro' | 'burst' | 'sphere'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [burstOrigin, setBurstOrigin] = useState({ x: 0, y: 0 })

  // Build the Three.js scene once, bound to the persistent canvas element.
  useEffect(() => {
    if (!canvasRef.current) return
    sceneRef.current = new Scene(canvasRef.current)
    return () => sceneRef.current?.dispose()
  }, [])

  // Unlock model interaction only after the sphere phase is fully revealed.
  useEffect(() => {
    if (phase === 'sphere') sceneRef.current?.enableScroll()
  }, [phase])

  const handleLightClick = (origin: { x: number; y: number }) => {
    setBurstOrigin(origin)
    setPhase('burst')

    // Burst timeline: 0.8 s expand + 2 s hold + 1.2 s fade = 4 s.
    // Switch to sphere slightly after fade ends so there's no flash.
    setTimeout(() => setPhase('sphere'), 4200)
  }

  return (
    <>
      {/* Wave background sits below the 3D canvas (z-index 0) */}
      {phase === 'sphere' && <WaveBackground scene={sceneRef.current} />}

      {/* Shared Three.js canvas — used by Scene for the entire session */}
      <canvas ref={canvasRef} style={{ position: 'fixed', inset: 0, zIndex: 10 }} />

      {phase === 'intro' && (
        <IntroScreen onLightClick={handleLightClick} />
      )}
      {phase === 'burst' && (
        <LightBurst origin={burstOrigin} />
      )}

      {/* HUD overlay sits above the 3D canvas (z-index 20) */}
      {phase === 'sphere' && <SphereScreen scene={sceneRef.current} />}

      <Analytics />
      <SpeedInsights />
    </>
  )
}

export default App
