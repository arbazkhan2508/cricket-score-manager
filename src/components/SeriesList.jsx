import { seriesScore } from '../utils/cricket.js';

export default function SeriesList({ seriesList, onOpen, onDelete }) {
  if (seriesList.length === 0) {
    return (
      <div className="empty">
        <p>No series yet.</p>
        <p>
          Click <strong>+ New Series</strong> to set up your teams and start the
          tournament!
        </p>
      </div>
    );
  }

  return (
    <div className="match-list">
      {seriesList.map((s) => {
        const score = seriesScore(s);
        const live = s.matches.some((m) => m.status === 'live');
        return (
          <div key={s.id} className="match-card" onClick={() => onOpen(s.id)}>
            <div className="match-card-head">
              <span className="match-title">{s.name}</span>
              <span className={`badge ${live ? 'live' : 'completed'}`}>
                {live ? '● LIVE' : score.decided ? 'FINISHED' : 'SERIES'}
              </span>
            </div>
            <div className="inn-line">
              <span className="inn-team">
                {s.teams[0].name} vs {s.teams[1].name}
              </span>
              <span className="inn-score">
                {score.wins[s.teams[0].name]}–{score.wins[s.teams[1].name]}
              </span>
            </div>
            <div className="match-card-foot">
              <span className="result-text">
                {score.text} · {s.matches.length}/{s.bestOf} matches · {s.overs} ov
              </span>
              <button
                className="btn small danger"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(s.id);
                }}
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
