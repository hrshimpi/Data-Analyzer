import { useAppState } from '../context/AppContext'

export default function DataPreview() {
  const { state } = useAppState()

  if (!state.schema) {
    return null
  }

  const { columns, summary } = state.schema

  return (
    <div className="data-preview">
      <div className="schema-header">
        <h3>Dataset Schema</h3>
        <span className="schema-count">{columns.length} columns</span>
      </div>
      <div className="columns-grid">
        {columns.map((col, idx) => {
          const stats = summary[col.name]
          return (
            <div key={idx} className="column-card">
              <div className="column-card-header">
                <span className="column-name">{col.name}</span>
                <span className={`column-type-badge ${col.type.toLowerCase()}`}>
                  {col.type}
                </span>
              </div>
              {stats && (
                <div className="column-stats-chips">
                  {stats.mean !== undefined && (
                    <div className="stat-chip">
                      <span className="stat-label">Mean</span>
                      <span className="stat-value">{stats.mean.toFixed(2)}</span>
                    </div>
                  )}
                  {stats.min !== undefined && stats.max !== undefined && (
                    <div className="stat-chip">
                      <span className="stat-label">Range</span>
                      <span className="stat-value">{stats.min.toFixed(0)} - {stats.max.toFixed(0)}</span>
                    </div>
                  )}
                  {stats.uniqueCount !== undefined && (
                    <div className="stat-chip">
                      <span className="stat-label">Unique</span>
                      <span className="stat-value">{stats.uniqueCount}</span>
                    </div>
                  )}
                  <div className="stat-chip">
                    <span className="stat-label">Total</span>
                    <span className="stat-value">{stats.totalCount}</span>
                  </div>
                  {stats.nullCount > 0 && (
                    <div className="stat-chip warning">
                      <span className="stat-label">Nulls</span>
                      <span className="stat-value">{stats.nullCount}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

