import { Box, Chip, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material'
import { useAppState } from '../context/AppContext'

export default function DataPreview() {
  const { state } = useAppState()

  if (!state.schema) return null

  const { columns, summary } = state.schema

  return (
    <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="subtitle2" fontWeight={600}>
          Dataset schema
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {columns.length} columns
        </Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 260, overflowX: 'auto' }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Column</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Mean</TableCell>
              <TableCell align="right">Range</TableCell>
              <TableCell align="right">Unique</TableCell>
              <TableCell align="right">Total</TableCell>
              <TableCell align="right">Nulls</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {columns.map((col, idx) => {
              const stats = summary[col.name]
              return (
                <TableRow key={idx} hover>
                  <TableCell sx={{ fontWeight: 600 }}>{col.name}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={col.type}
                      color={col.type === 'number' ? 'primary' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.mean != null ? stats.mean.toFixed(2) : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.min != null && stats?.max != null
                      ? `${stats.min.toFixed(0)} – ${stats.max.toFixed(0)}`
                      : '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.uniqueCount ?? '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {stats?.totalCount ?? '—'}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', color: (stats?.nullCount ?? 0) > 0 ? 'warning.main' : undefined }}>
                    {stats?.nullCount ?? 0}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}
