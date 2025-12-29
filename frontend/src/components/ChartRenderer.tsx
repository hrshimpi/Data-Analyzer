import { useRef } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  ScatterChart,
  Scatter,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts'
import type { ChartConfig } from '../types'

interface ChartRendererProps {
  charts: ChartConfig[]
}

const COLORS = [
  '#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d',
  '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181', '#aa96da'
]

export default function ChartRenderer({ charts }: ChartRendererProps) {
  if (charts.length === 0) {
    return null
  }

  return (
    <div className="chart-renderer">
      {charts.map((chart, idx) => (
        <ChartContainer key={idx} chart={chart} index={idx} />
      ))}
    </div>
  )
}

function ChartContainer({ chart, index }: { chart: ChartConfig; index: number }) {
  const chartRef = useRef<HTMLDivElement>(null)

  const handleExport = async (format: 'png' | 'svg') => {
    if (!chartRef.current) return

    try {
      const chartElement = chartRef.current.querySelector('.chart-content') || chartRef.current
      const svgElement = chartElement.querySelector('svg')
      
      // For custom charts (boxplot, correlation) that don't have SVG
      if (!svgElement && (chart.type === 'boxplot' || chart.type === 'correlation')) {
        try {
          // Use html2canvas for non-SVG charts
          const html2canvas = (await import('html2canvas')).default
          const canvas = await html2canvas(chartElement as HTMLElement, {
            scale: 2,
            logging: false,
            useCORS: true,
            backgroundColor: '#ffffff',
          } as any)
          canvas.toBlob((blob: Blob | null) => {
            if (blob) {
              const url = URL.createObjectURL(blob)
              const downloadLink = document.createElement('a')
              downloadLink.href = url
              downloadLink.download = `${chart.title || `chart-${index + 1}`}.png`
              document.body.appendChild(downloadLink)
              downloadLink.click()
              document.body.removeChild(downloadLink)
              URL.revokeObjectURL(url)
            }
          }, 'image/png')
        } catch (err) {
          console.error('html2canvas error:', err)
          alert('Export feature requires html2canvas. Please install it: npm install html2canvas')
        }
        return
      }

      if (!svgElement) {
        alert('Chart element not found')
        return
      }

      if (format === 'svg') {
        // Export as SVG
        const svgData = new XMLSerializer().serializeToString(svgElement)
        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
        const svgUrl = URL.createObjectURL(svgBlob)
        const downloadLink = document.createElement('a')
        downloadLink.href = svgUrl
        downloadLink.download = `${chart.title || `chart-${index + 1}`}.svg`
        document.body.appendChild(downloadLink)
        downloadLink.click()
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(svgUrl)
      } else {
        // Export as PNG using canvas
        const svgData = new XMLSerializer().serializeToString(svgElement)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()

        // Get SVG dimensions
        const svgRect = svgElement.getBoundingClientRect()
        const svgWidth = parseInt(svgElement.getAttribute('width') || String(svgRect.width)) || 800
        const svgHeight = parseInt(svgElement.getAttribute('height') || String(svgRect.height)) || 400

        const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' })
        const url = URL.createObjectURL(svgBlob)

        img.onload = () => {
          canvas.width = svgWidth
          canvas.height = svgHeight
          if (ctx) {
            ctx.fillStyle = '#ffffff'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)
            canvas.toBlob((blob) => {
              if (blob) {
                const downloadUrl = URL.createObjectURL(blob)
                const downloadLink = document.createElement('a')
                downloadLink.href = downloadUrl
                downloadLink.download = `${chart.title || `chart-${index + 1}`}.png`
                document.body.appendChild(downloadLink)
                downloadLink.click()
                document.body.removeChild(downloadLink)
                URL.revokeObjectURL(downloadUrl)
              }
            }, 'image/png')
          }
          URL.revokeObjectURL(url)
        }

        img.onerror = () => {
          URL.revokeObjectURL(url)
          alert('Failed to export chart as PNG. Please try SVG format.')
        }

        img.src = url
      }
    } catch (error) {
      console.error('Export failed:', error)
      alert('Failed to export chart. Please try again.')
    }
  }

  return (
    <div ref={chartRef} className="chart-container">
      <div className="chart-header">
        {chart.title && <h3>{chart.title}</h3>}
        <div className="chart-actions">
          <button
            className="export-btn"
            onClick={() => handleExport('png')}
            title="Export as PNG"
          >
            📥 PNG
          </button>
          {(chart.type !== 'boxplot' && chart.type !== 'correlation') && (
            <button
              className="export-btn"
              onClick={() => handleExport('svg')}
              title="Export as SVG"
            >
              📥 SVG
            </button>
          )}
        </div>
      </div>
      <div className="chart-content">
        <ResponsiveContainer width="100%" height={350}>
          {renderChart(chart)}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function renderChart(chart: ChartConfig) {
  if (!chart.data || chart.data.length === 0) {
    return <div className="no-data">No data available for chart</div>
  }

  switch (chart.type) {
    case 'bar':
      // Check if it's a grouped/stacked bar chart
      if (chart.groupBy) {
        const groupKeys = getGroupKeys(chart.data)
        return (
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey={chart.x}
              label={{ value: chart.x || 'X Axis', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle' } }}
            />
            <YAxis 
              label={{ value: chart.y || 'Y Axis', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
            />
            <Tooltip />
            <Legend />
            {groupKeys.map((key, idx) => (
              <Bar
                key={key}
                dataKey={key}
                fill={COLORS[idx % COLORS.length]}
                stackId={chart.stacked ? 'stack' : undefined}
              />
            ))}
          </BarChart>
        )
      }
      // Simple bar chart
      if (!chart.y) return <div className="no-data">Missing Y axis data</div>
      const yKey = chart.y
      return (
        <BarChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={chart.x} 
            label={{ value: chart.x || 'X Axis', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle' } }}
          />
          <YAxis 
            label={{ value: yKey || 'Y Axis', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          />
          <Tooltip />
          <Legend />
          <Bar dataKey={yKey} fill={COLORS[0]} />
        </BarChart>
      )

    case 'line':
      if (!chart.y) return <div className="no-data">Missing Y axis data</div>
      return (
        <LineChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={chart.x}
            label={{ value: chart.x || 'X Axis', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle' } }}
          />
          <YAxis 
            label={{ value: chart.y || 'Y Axis', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={chart.y} stroke={COLORS[0]} strokeWidth={2} />
        </LineChart>
      )

    case 'area':
      if (!chart.y) return <div className="no-data">Missing Y axis data</div>
      return (
        <AreaChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={chart.x}
            label={{ value: chart.x || 'X Axis', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle' } }}
          />
          <YAxis 
            label={{ value: chart.y || 'Y Axis', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          />
          <Tooltip />
          <Legend />
          <Area
            type="monotone"
            dataKey={chart.y}
            stroke={COLORS[0]}
            fill={COLORS[0]}
            fillOpacity={0.6}
          />
        </AreaChart>
      )

    case 'scatter':
      return (
        <ScatterChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={chart.x} 
            type="number"
            label={{ value: chart.x || 'X Axis', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle' } }}
          />
          <YAxis 
            dataKey={chart.y} 
            type="number"
            label={{ value: chart.y || 'Y Axis', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter dataKey={chart.y} fill={COLORS[0]} />
        </ScatterChart>
      )

    case 'pie':
      const pieData = chart.data.map((item) => ({
        name: String(item[chart.category || 'category'] || ''),
        value: Number(item[chart.value || 'value'] || 0),
      }))
      return (
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            outerRadius={100}
            fill="#8884d8"
            dataKey="value"
          >
            {pieData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend />
        </PieChart>
      )

    case 'combo':
      if (!chart.y) return <div className="no-data">Missing Y axis data</div>
      const comboYKey = chart.y
      return (
        <ComposedChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={chart.x}
            label={{ value: chart.x || 'X Axis', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle' } }}
          />
          <YAxis 
            yAxisId="left"
            label={{ value: comboYKey || 'Y Axis (Left)', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          />
          <YAxis 
            yAxisId="right" 
            orientation="right"
            label={{ value: chart.y2 || 'Y Axis (Right)', angle: 90, position: 'insideRight', style: { textAnchor: 'middle' } }}
          />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey={comboYKey} fill={COLORS[0]} />
          {chart.y2 && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey={chart.y2}
              stroke={COLORS[1]}
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      )

    case 'histogram':
      return (
        <BarChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="bin"
            label={{ value: chart.x || 'Bin Range', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle' } }}
          />
          <YAxis 
            label={{ value: 'Frequency', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle' } }}
          />
          <Tooltip />
          <Legend />
          <Bar dataKey="count" fill={COLORS[0]} />
        </BarChart>
      )

    case 'boxplot':
      if (chart.data && chart.data.length > 0) {
        const boxData = chart.data[0]
        return (
          <div className="boxplot-container">
            <div className="boxplot-visual">
              <div className="boxplot-box">
                <div className="boxplot-whisker-top"></div>
                <div className="boxplot-rect">
                  <div className="boxplot-median"></div>
                </div>
                <div className="boxplot-whisker-bottom"></div>
              </div>
              <div className="boxplot-labels">
                <div>Min: {boxData.min?.toFixed(2)}</div>
                <div>Q1: {boxData.q1?.toFixed(2)}</div>
                <div>Median: {boxData.median?.toFixed(2)}</div>
                <div>Q3: {boxData.q3?.toFixed(2)}</div>
                <div>Max: {boxData.max?.toFixed(2)}</div>
                {boxData.outliers && boxData.outliers.length > 0 && (
                  <div>Outliers: {boxData.outliers.length}</div>
                )}
              </div>
            </div>
          </div>
        )
      }
      return <div className="no-data">No boxplot data available</div>

    case 'bubble':
      return (
        <ScatterChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={chart.x} type="number" />
          <YAxis dataKey={chart.y} type="number" />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter dataKey={chart.y} fill={COLORS[0]}>
            {chart.data?.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                r={Math.sqrt(Number(entry[chart.z || 'z']) || 10) * 2}
              />
            ))}
          </Scatter>
        </ScatterChart>
      )

    case 'correlation':
      if (!chart.data || chart.data.length === 0) {
        return <div className="no-data">No correlation data available</div>
      }
      const columns = chart.columns || []
      return (
        <div className="correlation-heatmap">
          <table className="heatmap-table">
            <thead>
              <tr>
                <th></th>
                {columns.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {chart.data.map((row, idx) => (
                <tr key={idx}>
                  <td className="row-label">{row.column}</td>
                  {columns.map((col) => {
                    const value = Number(row[col]) || 0
                    const intensity = Math.abs(value)
                    const color = value >= 0 
                      ? `rgba(0, 255, 0, ${intensity})` 
                      : `rgba(255, 0, 0, ${intensity})`
                    return (
                      <td
                        key={col}
                        className="heatmap-cell"
                        style={{
                          backgroundColor: color,
                          color: intensity > 0.5 ? '#fff' : '#000',
                        }}
                      >
                        {value.toFixed(2)}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )

    default:
      return <div className="no-data">Unsupported chart type: {chart.type}</div>
  }
}

// Helper function to get group keys from data
function getGroupKeys(data: Record<string, any>[]): string[] {
  if (!data || data.length === 0) return []
  
  const keys = new Set<string>()
  data.forEach(item => {
    Object.keys(item).forEach(key => {
      // Exclude the x-axis key and known chart keys
      if (key !== 'x' && key !== 'category' && key !== 'value') {
        keys.add(key)
      }
    })
  })
  
  return Array.from(keys)
}

