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
