import { useEffect, useRef } from 'react'
import './IntroScreen.css'

interface Props {
  onComplete: () => void
}

export default function IntroScreen({ onComplete }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const draw = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (let i = 0; i < 280; i++) {
        const x = Math.random() * canvas.width
        const y = Math.random() * canvas.height
        const r = Math.random() * 1.2 + 0.1
        const a = Math.random() * 0.75 + 0.25
        ctx.fillStyle = `rgba(255,255,255,${a})`
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])

  useEffect(() => {
    const t = setTimeout(onComplete, 26000)
    return () => clearTimeout(t)
  }, [onComplete])

  return (
    <div className="intro">
      <canvas ref={canvasRef} className="intro-stars" />

      {/* gradient mask so text fades into the void at the top */}
      <div className="intro-fade-top" />
      <div className="intro-fade-bottom" />

      <div className="intro-scene">
        <div className="intro-crawl">
          <p>
            In the beginning God created the heavens and the earth.
          </p>
          <p>
            2&nbsp;&nbsp;Now the earth was formless and empty, darkness
            was over the surface of the deep, and the Spirit of God was
            hovering over the waters.
          </p>
          <p className="intro-reference">Genesis 1:1–2</p>
        </div>
      </div>

      <button className="intro-skip" onClick={onComplete}>
        Skip
      </button>
    </div>
  )
}
