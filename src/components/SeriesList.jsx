import { seriesScore } from '../utils/cricket.js';

export default function SeriesList({ seriesList, onOpen, onDelete }) {
  if (seriesList.length === 0) {
    return (
      <div className="empty">
        <p style={{ fontSize: '2rem', marginBottom: '12px' }}>🏏</p>
        <p style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>No series yet</p>
        <p>Tap <strong style={{ color: 'var(--gold)' }}>+ New Series</strong> to set up your teams.</p>
      </div>
    );
  }

  return (
    <div className="match-list">
      {seriesList.map((s) => {
        const score = seriesScore(s);
        const [a, b] = s.teams;
        const live = s.matches.some((m) => m.status === 'live');
        return (
          <div key={s.id} className="match-card" onClick={() => onOpen(s.id)}>
            <div className="match-card-head">
              <span className="match-title">{s.name}</span>
              <span className={`badge ${live ? 'live' : 'completed'}`}>
                {live ? '● LIVE' : score.decided ? 'DONE' : 'SERIES'}
              </span>
            </div>

            {/* Scoreline */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '4px 0 10px' }}>
              <span style={{
                flex: 1, fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {a.name}
              </span>
              <span style={{
                fontSize: '1.6rem', fontWeight: 900, letterSpacing: '-0.04em',
                fontVariantNumeric: 'tabular-nums', color: 'var(--text)', whiteSpace: 'nowrap'
              }}>
                {score.wins[a.name]} – {score.wins[b.name]}
              </span>
              <span style={{
                flex: 1, fontSize: '0.78rem', fontWeight: 700, color: 'var(--muted)',
                textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
              }}>
                {b.name}
              </span>
            </div>

            <div className="match-card-foot">
              <span className="result-text">{score.text}</span>
              <button
                className="btn small danger"
                onClick={(e) => { e.stopPropagation(); onDelete(s.id); }}
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
