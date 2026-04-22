import { useEffect, useRef, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import Scene from './scenes/Scene'
import IntroScreen from './components/IntroScreen'
import LightBurst from './components/LightBurst'
import './index.css'

type Phase = 'intro' | 'burst' | 'sphere'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<Scene | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [burstOrigin, setBurstOrigin] = useState({ x: 0, y: 0 })

  useEffect(() => {
    if (!canvasRef.current) return
    sceneRef.current = new Scene(canvasRef.current)
    return () => sceneRef.current?.dispose()
  }, [])

  // Enable sphere interaction once it's fully revealed
  useEffect(() => {
    if (phase === 'sphere') sceneRef.current?.enableScroll()
  }, [phase])

  const handleLightClick = (origin: { x: number; y: number }) => {
    setBurstOrigin(origin)
    setPhase('burst')

    // Timing: 0.8 s expand + 2 s hold + 1.2 s fade = 4 s total
    // Remove burst overlay a touch after the fade ends
    setTimeout(() => setPhase('sphere'), 4200)
  }

  return (
    <>
      <canvas ref={canvasRef} />
      {phase === 'intro' && (
        <IntroScreen onLightClick={handleLightClick} />
      )}
      {phase === 'burst' && (
        <LightBurst origin={burstOrigin} />
      )}
      <Analytics />
      <SpeedInsights />
    </>
  )
}

export default App
