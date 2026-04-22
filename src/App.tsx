import { useEffect, useRef } from 'react'
import Scene from './scenes/Scene'
import './index.css'

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    const scene = new Scene(canvasRef.current)
    return () => scene.dispose()
  }, [])

  return <canvas ref={canvasRef} />
}

export default App
