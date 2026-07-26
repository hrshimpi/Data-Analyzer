import { Responsive, WidthProvider } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import { Box, Stack, Typography } from '@mui/material'
import DashboardCustomizeOutlinedIcon from '@mui/icons-material/DashboardCustomizeOutlined'
import { useAppState } from '../context/AppContext'
import type { AppAction } from '../context/reducer'
import { ChartCard } from './ChartRenderer'

const ResponsiveGridLayout = WidthProvider(Responsive)

export default function DashboardCanvas() {
  const { state, dispatch } = useAppState()
  const activeThread = state.activeThreadId ? state.chatThreads.find((t) => t.id === state.activeThreadId) : null
  const pinnedCharts = activeThread?.pinnedCharts ?? []

  if (pinnedCharts.length === 0) {
    return (
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', py: 8 }}>
        <Stack spacing={1.5} alignItems="center" sx={{ textAlign: 'center', maxWidth: 360 }}>
          <DashboardCustomizeOutlinedIcon sx={{ fontSize: 40, color: 'text.secondary' }} />
          <Typography variant="subtitle1" fontWeight={600}>
            Your dashboard is empty
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Pin a chart from the Chat tab — click the pin icon on any chart — to build a persistent dashboard you can
            rearrange and resize.
          </Typography>
        </Stack>
      </Box>
    )
  }

  const layout = pinnedCharts.map((p) => ({ i: p.id, x: p.layout.x, y: p.layout.y, w: p.layout.w, h: p.layout.h, minW: 3, minH: 4 }))

  const handleLayoutChange = (newLayout: Array<{ i: string; x: number; y: number; w: number; h: number }>) => {
    if (!activeThread) return
    dispatch({
      type: 'UPDATE_DASHBOARD_LAYOUT',
      payload: {
        threadId: activeThread.id,
        layouts: newLayout.map((l) => ({ id: l.i, x: l.x, y: l.y, w: l.w, h: l.h })),
      },
    } as AppAction)
  }

  const handleRemove = (chartId: string) => {
    if (!activeThread) return
    dispatch({ type: 'UNPIN_CHART', payload: { threadId: activeThread.id, chartId } } as AppAction)
  }

  return (
    <Box sx={{ flex: 1, overflowY: 'auto', px: { xs: 2, md: 4 }, py: 3 }}>
      <ResponsiveGridLayout
        className="dashboard-grid"
        layouts={{ lg: layout }}
        breakpoints={{ lg: 0 }}
        cols={{ lg: 12 }}
        rowHeight={32}
        margin={[16, 16]}
        draggableHandle=".chart-card-drag-handle"
        onLayoutChange={handleLayoutChange}
      >
        {pinnedCharts.map((pin) => (
          <div key={pin.id}>
            <ChartCard chart={pin.chart} index={0} dragHandle fillHeight onRemove={() => handleRemove(pin.id)} />
          </div>
        ))}
      </ResponsiveGridLayout>
    </Box>
  )
}
