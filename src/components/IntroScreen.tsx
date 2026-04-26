/**
 * IntroScreen.tsx — Star Wars-style perspective text crawl with a matrix
 * scramble title. Occupies the full viewport at z-index 100.
 *
 * Title animation:
 *   A rAF loop writes directly to the <span> DOM node each frame (no state
 *   updates). Each character cycles through SCRAMBLE_CHARS until its individual
 *   settle time (index * 60 ms + 800 ms) elapses, then snaps to the real glyph.
 *   The title fades out when the user first scrolls (hintOut = true).
 *
 * Crawl mechanics:
 *   JS drives `top` and `transform: rotateX(25deg) scale(N)` on the crawl div
 *   every rAF tick. Scale shrinks linearly with scroll progress (1 → 0.08),
 *   which creates the receding-into-space depth illusion via CSS perspective.
 *   Scroll input is clamped to [0, maxScroll] and smoothed with lerp (0.07).
 *
 * Interaction:
 *   Mouse wheel, keyboard arrows/space/page keys, and touch swipe all advance
 *   the crawl. First input dismisses the scroll-hint UI and fades the title.
 *   Clicking the glowing "light" word calls onLightClick with the click origin,
 *   which App uses to position the LightBurst transition.
 */

import { useEffect, useRef, useState } from 'react'
import './IntroScreen.css'

const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*!?<>[]{}|'
const TITLE_TEXT     = "ONCE YOU SEE, YOU CAN'T UNSEE"

interface Props {
  onLightClick: (origin: { x: number; y: number }) => void
}

export default function IntroScreen({ onLightClick }: Props) {
  const crawlRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLSpanElement>(null)
  const targetY = useRef(0)
  const posY = useRef(0)
  const animRef = useRef(0)
  const hintDone = useRef(false)
  const [hintOut, setHintOut] = useState(false)

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    const start = performance.now()
    let frame: number
    const tick = (now: number) => {
      const elapsed = now - start
      let done = true
      const chars = TITLE_TEXT.split('').map((ch, i) => {
        const settleAt = i * 60 + 800
        if (elapsed >= settleAt) return ch
        done = false
        if (ch === ' ') return ' '
        return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
      })
      el.textContent = chars.join('')
      if (!done) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  useEffect(() => {
    const el = crawlRef.current
    if (!el) return

    el.style.top = `${window.innerHeight}px`

    const maxScroll = el.scrollHeight + window.innerHeight * 1.5

    const dismissHint = () => {
      if (!hintDone.current) {
        hintDone.current = true
        setHintOut(true)
      }
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      dismissHint()
      const delta = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 120)
      targetY.current = Math.max(0, Math.min(maxScroll, targetY.current + delta))
    }

    const onKey = (e: KeyboardEvent) => {
      const keys = ['ArrowDown', 'ArrowUp', ' ', 'PageDown', 'PageUp']
      if (!keys.includes(e.key)) return
      e.preventDefault()
      dismissHint()
      const large = [' ', 'PageDown', 'PageUp'].includes(e.key)
      const dir = ['ArrowDown', ' ', 'PageDown'].includes(e.key) ? 1 : -1
      const step = large ? window.innerHeight * 0.6 : 60
      targetY.current = Math.max(0, Math.min(maxScroll, targetY.current + step * dir))
    }

    let touchPrev = 0
    const onTouchStart = (e: TouchEvent) => { touchPrev = e.touches[0].clientY }
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      dismissHint()
      const dy = (touchPrev - e.touches[0].clientY) * 2
      touchPrev = e.touches[0].clientY
      targetY.current = Math.max(0, Math.min(maxScroll, targetY.current + dy))
    }

    const tick = () => {
      posY.current += (targetY.current - posY.current) * 0.07

      // Scale shrinks as text recedes — drives the depth illusion
      const progress = Math.min(posY.current / maxScroll, 1)
      const scale = Math.max(0.08, 1 - progress * 0.92)

      el.style.top = `${window.innerHeight - posY.current}px`
      el.style.transform = `rotateX(25deg) scale(${scale.toFixed(4)})`

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

      <div className={`intro-title${hintOut ? ' intro-title--out' : ''}`}>
        <span ref={titleRef} />
      </div>

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
<div className='final-crawl'>
<p>
            And God said, &ldquo;Let there be{' '}
            <button className="light-word" onClick={(e) => onLightClick({ x: e.clientX, y: e.clientY })}>light</button>
            &rdquo;
          </p>
</div>
          
        </div>
      </div>

      <div className={`scroll-hint${hintOut ? ' scroll-hint--out' : ''}`}>
        <span className="scroll-hint-label">scroll to begin</span>
        <span className="scroll-hint-chevron" />
      </div>
    </div>
  )
}
