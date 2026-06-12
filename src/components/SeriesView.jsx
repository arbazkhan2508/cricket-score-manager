import { useState } from 'react';
import { createSeriesMatch, oversText, seriesScore } from '../utils/cricket.js';

function MatchCard({ match, onOpen, onDelete }) {
  return (
    <div className="match-card" onClick={onOpen}>
      <div className="match-card-head">
        <span className="match-title">
          Match {match.matchNo} · {match.teamA} vs {match.teamB}
        </span>
        <span className={`badge ${match.status}`}>
          {match.status === 'live' ? '● LIVE' : 'COMPLETED'}
        </span>
      </div>
      <p className="toss-line muted">
        Toss: {match.toss.winner} chose to {match.toss.decision} first
      </p>
      {match.innings.map((inn, i) => (
        <div key={i} className="inn-line">
          <span className="inn-team">{inn.battingTeam}</span>
          <span className="inn-score">
            {inn.runs}/{inn.wickets} <small>({oversText(inn.balls)} ov)</small>
          </span>
        </div>
      ))}
      <div className="match-card-foot">
        <span className="result-text">
          {match.result || `${match.overs} overs per side`}
        </span>
        <button
          className="btn small danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

function NewMatchPanel({ series, onStart }) {
  const [a, b] = series.teams.map((t) => t.name);
  const [tossWinner, setTossWinner] = useState(a);
  const [decision, setDecision] = useState('bat');
  return (
    <div className="panel">
      <h3>Start Match {series.matches.length + 1}</h3>
      <p className="hint">Do the toss on the turf, then record it here.</p>
      <div className="form-row">
        <label>
          Toss won by
          <select value={tossWinner} onChange={(e) => setTossWinner(e.target.value)}>
            <option value={a}>{a}</option>
            <option value={b}>{b}</option>
          </select>
        </label>
        <label>
          Elected to
          <select value={decision} onChange={(e) => setDecision(e.target.value)}>
            <option value="bat">Bat first</option>
            <option value="bowl">Bowl first</option>
          </select>
        </label>
      </div>
      <div className="form-actions">
        <button className="btn primary" onClick={() => onStart({ tossWinner, decision })}>
          Start Match
        </button>
      </div>
    </div>
  );
}

function SquadsPanel({ series, onChange }) {
  const [editing, setEditing] = useState(false);
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [a, b] = series.teams;

  const startEdit = () => {
    setTextA(a.players.join('\n'));
    setTextB(b.players.join('\n'));
    setEditing(true);
  };

  const save = () => {
    const parse = (t) =>
      [...new Set(t.split('\n').map((l) => l.trim()).filter(Boolean))];
    const pA = parse(textA);
    const pB = parse(textB);
    if (pA.length < 2 || pB.length < 2) return;
    onChange({
      ...series,
      teams: [
        { ...a, players: pA },
        { ...b, players: pB },
      ],
    });
    setEditing(false);
  };

  return (
    <div className="panel">
      <div className="innings-head">
        <h3>Squads</h3>
        {!editing ? (
          <button className="btn small" onClick={startEdit}>
            ✎ Edit
          </button>
        ) : (
          <div className="form-actions" style={{ margin: 0 }}>
            <button className="btn small" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn small primary" onClick={save}>
              Save
            </button>
          </div>
        )}
      </div>
      {editing ? (
        <>
          <p className="hint">
            One name per line. Changes apply to future matches only — matches already
            started keep their squads.
          </p>
          <div className="form-row">
            <label>
              {a.name}
              <textarea rows={9} value={textA} onChange={(e) => setTextA(e.target.value)} />
            </label>
            <label>
              {b.name}
              <textarea rows={9} value={textB} onChange={(e) => setTextB(e.target.value)} />
            </label>
          </div>
        </>
      ) : (
        <div className="squads">
          {[a, b].map((t) => (
            <div key={t.name} className="squad-col">
              <h4>
                {t.name} <small className="muted">({t.players.length})</small>
              </h4>
              <ol>
                {t.players.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SeriesView({ series, onChange, onOpenMatch }) {
  const score = seriesScore(series);
  const [a, b] = series.teams.map((t) => t.name);
  const liveMatch = series.matches.find((m) => m.status === 'live');
  const canStartMatch = !liveMatch && series.matches.length < series.bestOf;

  const startMatch = (toss) => {
    const match = createSeriesMatch(series, toss);
    onChange({ ...series, matches: [...series.matches, match] });
    onOpenMatch(match.id);
  };

  const deleteMatch = (id) => {
    if (!confirm('Delete this match permanently?')) return;
    onChange({ ...series, matches: series.matches.filter((m) => m.id !== id) });
  };

  return (
    <div>
      <div className="panel series-header">
        <h2>{series.name}</h2>
        <div className="series-score">
          <span className="series-team">{a}</span>
          <span className="series-nums">
            {score.wins[a]} – {score.wins[b]}
          </span>
          <span className="series-team">{b}</span>
        </div>
        <p className={`series-status ${score.decided ? 'decided' : ''}`}>{score.text}</p>
        <div className="rule-chips">
          <span className="rule-chip">Best of {series.bestOf}</span>
          <span className="rule-chip">{series.overs} overs/side</span>
          <span className="rule-chip">⚡ Powerplay: first {series.powerplayOvers} ov</span>
        </div>
      </div>

      {liveMatch && (
        <div className="panel live-note" onClick={() => onOpenMatch(liveMatch.id)}>
          ● Match {liveMatch.matchNo} is live — tap to continue scoring
        </div>
      )}

      {canStartMatch && <NewMatchPanel series={series} onStart={startMatch} />}

      {series.matches.length > 0 && (
        <div className="match-list">
          {[...series.matches].reverse().map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              onOpen={() => onOpenMatch(m.id)}
              onDelete={() => deleteMatch(m.id)}
            />
          ))}
        </div>
      )}

      <SquadsPanel series={series} onChange={onChange} />
    </div>
  );
}
