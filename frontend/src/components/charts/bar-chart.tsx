type BarChartDatum = {
  name: string
  value: number
  color?: string
}

export interface BarChartProps {
  data: BarChartDatum[]
  title?: string
  className?: string
}

export function BarChart({ data, title, className = '' }: BarChartProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 1)

  return (
    <div className={className}>
      {title ? <h3 className="mb-4 text-lg font-semibold text-slate-50">{title}</h3> : null}

      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.name} className="space-y-1.5">
            <div className="flex items-center justify-between gap-4 text-xs text-slate-300">
              <span>{item.name}</span>
              <span>{item.value.toLocaleString('en-IN')}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800/90">
              <div
                className="h-full rounded-full transition-[width] duration-500"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  background: item.color ?? '#60a5fa',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BarChart
