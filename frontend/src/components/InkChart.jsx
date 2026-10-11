// Grafic in stilul unui plotter cu cerneala: o singura linie, fara biblioteci externe.
export default function InkChart({ values, color = 'var(--burgundy)', height = 120, label }) {
  const W = 600
  const points = values.length > 1 ? values : [0, 0]
  const step = W / Math.max(points.length - 1, 1)
  const y = (v) => height - 6 - (Math.min(Math.max(v, 0), 100) / 100) * (height - 12)
  const line = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = `${line} L${W},${height} L0,${height} Z`
  return (
    <svg className="ink-chart" viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {[25, 50, 75].map((g) => (
        <line key={g} x1="0" x2={W} y1={y(g)} y2={y(g)} className="ink-grid" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={area} fill={color} opacity="0.09" />
      <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
