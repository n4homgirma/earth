import { useEffect, useRef } from 'react'
import './IntroScreen.css'

interface Props {
  onLightClick: () => void
}

export default function IntroScreen({ onLightClick }: Props) {
  const crawlRef = useRef<HTMLDivElement>(null)
  const targetY = useRef(0)
  const posY = useRef(0)
  const animRef = useRef(0)

  useEffect(() => {
    const el = crawlRef.current
    if (!el) return

    // Position element just below the viewport to start
    el.style.top = `${window.innerHeight}px`

    const maxScroll = el.scrollHeight + window.innerHeight * 1.5

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120)
      targetY.current = Math.max(0, Math.min(maxScroll, targetY.current + delta))
    }

    const onKey = (e: KeyboardEvent) => {
      const keys = ['ArrowDown', 'ArrowUp', ' ', 'PageDown', 'PageUp']
      if (!keys.includes(e.key)) return
      e.preventDefault()
      const large = [' ', 'PageDown', 'PageUp'].includes(e.key)
      const dir = ['ArrowDown', ' ', 'PageDown'].includes(e.key) ? 1 : -1
      const step = large ? window.innerHeight * 0.6 : 60
      targetY.current = Math.max(0, Math.min(maxScroll, targetY.current + step * dir))
    }

    let touchPrev = 0
    const onTouchStart = (e: TouchEvent) => { touchPrev = e.touches[0].clientY }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const dy = (touchPrev - e.touches[0].clientY) * 2
      touchPrev = e.touches[0].clientY
      targetY.current = Math.max(0, Math.min(maxScroll, targetY.current + dy))
    }

    const tick = () => {
      // smooth lerp toward target
      posY.current += (targetY.current - posY.current) * 0.07
      el.style.top = `${window.innerHeight - posY.current}px`
      animRef.current = requestAnimationFrame(tick)
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey)
    window.addEventListener('touchstart', onTouchStart, { passive: true })
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    animRef.current = requestAnimationFrame(tick)

    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchmove', onTouchMove)
      cancelAnimationFrame(animRef.current)
    }
  }, [])

  return (
    <div className="intro">
      <div className="intro-fade-top" />

      <div className="intro-scene">
        <div className="intro-crawl" ref={crawlRef}>
          <p>
            In the beginning God created the heavens and the earth.
          </p>
          <p>
            2&nbsp;&nbsp;Now the earth was formless and empty, darkness
            was over the surface of the deep, and the Spirit of God was
            hovering over the waters.
          </p>
          <p className="intro-reference">Genesis 1:1–2</p>

          <div className="intro-separator" />

          <p>
            And God said, &ldquo;Let there be{' '}
            <button className="light-word" onClick={onLightClick}>light</button>
            ,&rdquo; and there was{' '}
            <button className="light-word" onClick={onLightClick}>light</button>.
          </p>
        </div>
      </div>
    </div>
  )
}
