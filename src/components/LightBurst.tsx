/**
 * LightBurst.tsx — Full-screen radial light explosion that bridges the
 * 'intro' → 'sphere' phase transition.
 *
 * A single div (.burst-circle) is centred on the click origin and animated
 * with two chained CSS keyframes:
 *   burstExpand (0–0.8 s) — scale 0 → 70, fills the entire viewport.
 *   burstFade   (2.8–4 s) — opacity 1 → 0, reveals the 3D scene beneath.
 *
 * The component is unmounted by App after 4.2 s (slightly after fade ends).
 * No state, no JS animation — pure CSS.
 *
 * Props:
 *   origin — screen pixel coordinate of the "light" word click, used to
 *            position the burst circle so it radiates from the right spot.
 */

import './LightBurst.css'

interface Props {
  origin: { x: number; y: number }
}

export default function LightBurst({ origin }: Props) {
  return (
    <div className="burst-wrap">
      <div
        className="burst-circle"
        style={{ left: origin.x, top: origin.y }}
      />
    </div>
  )
}
