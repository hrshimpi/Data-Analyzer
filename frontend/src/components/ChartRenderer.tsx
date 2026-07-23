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
import { Box, Card, Stack, IconButton, Tooltip as MuiTooltip, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material'
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import type { ChartConfig } from '../types'

interface ChartRendererProps {
  charts: ChartConfig[]
}

const COLORS = [
  '#5B8DFF', '#F0A63A', '#5FBE83', '#EC7469', '#8E7CF0', '#4EC4C4',
  '#E888C0', '#B8D65E', '#63A6E0', '#E0956B',
]

export default function ChartRenderer({ charts }: ChartRendererProps) {
  if (charts.length === 0) {
    return null
  }

  return (
    <Box
      sx={{
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: 2,
      }}
    >
      {charts.map((chart, idx) => (
        <ChartContainer key={idx} chart={chart} index={idx} />
      ))}
    </Box>
  )
}

function ChartContainer({ chart, index }: { chart: ChartConfig; index: number }) {
  const chartRef = useRef<HTMLDivElement>(null)

  const handleExport = async (format: 'png' | 'svg') => {
    if (!chartRef.current) return

    try {
      const chartElement = chartRef.current.querySelector('.chart-content') || chartRef.current
      const svgElement = chartElement.querySelector('svg')

      if (!svgElement && (chart.type === 'boxplot' || chart.type === 'correlation')) {
        try {
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
        }
        return
      }

      if (!svgElement) return

      if (format === 'svg') {
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
        const svgData = new XMLSerializer().serializeToString(svgElement)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()

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

        img.onerror = () => URL.revokeObjectURL(url)
        img.src = url
      }
    } catch (error) {
      console.error('Export failed:', error)
    }
  }

  return (
    <Card
      ref={chartRef}
      variant="outlined"
      sx={{ p: 2, width: '100%', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1.5 }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
        {chart.title && (
          <Typography variant="subtitle2" fontWeight={600} noWrap title={chart.title}>
            {chart.title}
          </Typography>
        )}
        <Stack direction="row" spacing={0.5}>
          <MuiTooltip title="Export as PNG">
            <IconButton size="small" onClick={() => handleExport('png')} aria-label="Export chart as PNG">
              <ImageOutlinedIcon fontSize="small" />
            </IconButton>
          </MuiTooltip>
          {chart.type !== 'boxplot' && chart.type !== 'correlation' && (
            <MuiTooltip title="Export as SVG">
              <IconButton size="small" onClick={() => handleExport('svg')} aria-label="Export chart as SVG">
                <FileDownloadOutlinedIcon fontSize="small" />
              </IconButton>
            </MuiTooltip>
          )}
        </Stack>
      </Stack>
      <Box className="chart-content" sx={{ width: '100%', minWidth: 0 }}>
        {chart.type === 'boxplot' || chart.type === 'correlation' ? (
          renderChart(chart)
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            {renderChart(chart) as any}
          </ResponsiveContainer>
        )}
      </Box>
    </Card>
  )
}

function NoData({ label }: { label: string }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
      {label}
    </Typography>
  )
}

function renderChart(chart: ChartConfig) {
  if (!chart.data || chart.data.length === 0) {
    return <NoData label="No data available for this chart." />
  }

  switch (chart.type) {
    case 'bar': {
      if (chart.groupBy) {
        const groupKeys = getGroupKeys(chart.data)
        return (
          <BarChart data={chart.data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={chart.x} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend />
            {groupKeys.map((key, idx) => (
              <Bar key={key} dataKey={key} fill={COLORS[idx % COLORS.length]} stackId={chart.stacked ? 'stack' : undefined} />
            ))}
          </BarChart>
        )
      }
      if (!chart.y) return <NoData label="Missing Y-axis field for this chart." />
      return (
        <BarChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={chart.x} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar dataKey={chart.y} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      )
    }

    case 'line':
      if (!chart.y) return <NoData label="Missing Y-axis field for this chart." />
      return (
        <LineChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={chart.x} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey={chart.y} stroke={COLORS[0]} strokeWidth={2} dot={false} />
        </LineChart>
      )

    case 'area':
      if (!chart.y) return <NoData label="Missing Y-axis field for this chart." />
      return (
        <AreaChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={chart.x} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey={chart.y} stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.25} />
        </AreaChart>
      )

    case 'scatter':
      return (
        <ScatterChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={chart.x} type="number" tick={{ fontSize: 12 }} />
          <YAxis dataKey={chart.y} type="number" tick={{ fontSize: 12 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter dataKey={chart.y} fill={COLORS[0]} />
        </ScatterChart>
      )

    case 'pie': {
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
    }

    case 'combo':
      if (!chart.y) return <NoData label="Missing Y-axis field for this chart." />
      return (
        <ComposedChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={chart.x} tick={{ fontSize: 12 }} />
          <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey={chart.y} fill={COLORS[0]} radius={[4, 4, 0, 0]} />
          {chart.y2 && <Line yAxisId="right" type="monotone" dataKey={chart.y2} stroke={COLORS[1]} strokeWidth={2} dot={false} />}
        </ComposedChart>
      )

    case 'histogram':
      return (
        <BarChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bin" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={50} />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip />
          <Bar dataKey="count" fill={COLORS[0]} radius={[4, 4, 0, 0]} />
        </BarChart>
      )

    case 'boxplot': {
      if (!chart.data || chart.data.length === 0) return <NoData label="No boxplot data available." />
      const boxData = chart.data[0]
      const rows: [string, number | undefined][] = [
        ['Min', boxData.min],
        ['Q1', boxData.q1],
        ['Median', boxData.median],
        ['Q3', boxData.q3],
        ['Max', boxData.max],
      ]
      return (
        <Stack spacing={2} sx={{ py: 2 }}>
          <BoxPlotVisual min={boxData.min} q1={boxData.q1} median={boxData.median} q3={boxData.q3} max={boxData.max} />
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 1 }}>
            {rows.map(([label, value]) => (
              <Box key={label} sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  {label}
                </Typography>
                <Typography variant="body2" fontWeight={600} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {value?.toFixed(2) ?? '—'}
                </Typography>
              </Box>
            ))}
            {boxData.outliers && boxData.outliers.length > 0 && (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" display="block">
                  Outliers
                </Typography>
                <Typography variant="body2" fontWeight={600}>
                  {boxData.outliers.length}
                </Typography>
              </Box>
            )}
          </Box>
        </Stack>
      )
    }

    case 'bubble':
      return (
        <ScatterChart data={chart.data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={chart.x} type="number" tick={{ fontSize: 12 }} />
          <YAxis dataKey={chart.y} type="number" tick={{ fontSize: 12 }} />
          <Tooltip cursor={{ strokeDasharray: '3 3' }} />
          <Scatter dataKey={chart.y} fill={COLORS[0]}>
            {chart.data?.map((entry, index) => (
              <Cell key={`cell-${index}`} r={Math.sqrt(Number(entry[chart.z || 'z']) || 10) * 2} />
            ))}
          </Scatter>
        </ScatterChart>
      )

    case 'correlation': {
      if (!chart.data || chart.data.length === 0) return <NoData label="No correlation data available." />
      const columns = chart.columns || []
      const grouped = new Map<string, Record<string, number>>()
      chart.data.forEach((row) => {
        const rowLabel = String(row.column ?? row.x ?? '')
        const colLabel = String(row.y ?? '')
        const value = Number(row.value) || 0
        if (!grouped.has(rowLabel)) grouped.set(rowLabel, {})
        grouped.get(rowLabel)![colLabel] = value
      })
      const rowLabels = grouped.size > 0 ? Array.from(grouped.keys()) : columns
      return (
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell />
                {columns.map((col) => (
                  <TableCell key={col} align="center" sx={{ fontWeight: 600 }}>
                    {col}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rowLabels.map((rowLabel) => (
                <TableRow key={rowLabel}>
                  <TableCell sx={{ fontWeight: 600 }}>{rowLabel}</TableCell>
                  {columns.map((col) => {
                    const value = grouped.get(rowLabel)?.[col] ?? 0
                    const intensity = Math.min(Math.abs(value), 1)
                    const bg = value >= 0 ? `rgba(95, 190, 131, ${intensity})` : `rgba(236, 116, 105, ${intensity})`
                    return (
                      <TableCell
                        key={col}
                        align="center"
                        sx={{
                          bgcolor: bg,
                          color: intensity > 0.55 ? '#fff' : 'text.primary',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {value.toFixed(2)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )
    }

    default:
      return <NoData label={`Unsupported chart type: ${chart.type}`} />
  }
}

function BoxPlotVisual({
  min,
  q1,
  median,
  q3,
  max,
}: {
  min?: number
  q1?: number
  median?: number
  q3?: number
  max?: number
}) {
  if ([min, q1, median, q3, max].some((v) => v === undefined)) return null
  const range = (max as number) - (min as number) || 1
  const pct = (v: number) => ((v - (min as number)) / range) * 100

  return (
    <Box sx={{ position: 'relative', height: 56, mx: 2 }}>
      <Box sx={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, bgcolor: 'divider', transform: 'translateY(-50%)' }} />
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: `${pct(min as number)}%`,
          width: 2,
          height: 20,
          bgcolor: 'text.secondary',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: `${pct(max as number)}%`,
          width: 2,
          height: 20,
          bgcolor: 'text.secondary',
          transform: 'translate(-50%, -50%)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: `${pct(q1 as number)}%`,
          width: `${pct(q3 as number) - pct(q1 as number)}%`,
          height: 32,
          bgcolor: 'primary.main',
          opacity: 0.25,
          border: '1px solid',
          borderColor: 'primary.main',
          borderRadius: 1,
          transform: 'translateY(-50%)',
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          top: '50%',
          left: `${pct(median as number)}%`,
          width: 2,
          height: 32,
          bgcolor: 'primary.main',
          transform: 'translate(-50%, -50%)',
        }}
      />
    </Box>
  )
}

function getGroupKeys(data: Record<string, any>[]): string[] {
  if (!data || data.length === 0) return []
  const keys = new Set<string>()
  data.forEach((item) => {
    Object.keys(item).forEach((key) => {
      if (key !== 'x' && key !== 'category' && key !== 'value') {
        keys.add(key)
      }
    })
  })
  return Array.from(keys)
}
