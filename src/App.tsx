import { useEffect, useRef, useState } from 'react'
import { Analytics } from '@vercel/analytics/react'
import Scene from './scenes/Scene'
import IntroScreen from './components/IntroScreen'
import './index.css'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [introVisible, setIntroVisible] = useState(true)
  const [introFading, setIntroFading] = useState(false)

  useEffect(() => {
    if (!canvasRef.current) return
    const scene = new Scene(canvasRef.current)
    return () => scene.dispose()
  }, [])

  const handleIntroComplete = () => {
    setIntroFading(true)
    setTimeout(() => setIntroVisible(false), 1000)
  }

  return (
    <>
      <canvas ref={canvasRef} />
      {introVisible && (
        <div
          style={{
            opacity: introFading ? 0 : 1,
            transition: 'opacity 1s ease',
            position: 'fixed',
            inset: 0,
          }}
        >
          <IntroScreen onComplete={handleIntroComplete} />
        </div>
      )}
      <Analytics />
    </>
  )
}

export default App
