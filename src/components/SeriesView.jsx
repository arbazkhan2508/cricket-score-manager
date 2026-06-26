import { useState } from 'react';
import { createSeriesMatch, oversText, seriesScore } from '../utils/cricket.js';

// ── Stats computation ─────────────────────────────────────────────────────────

function computeStats(series) {
  const batting = {};
  const bowling = {};

  for (const match of series.matches ?? []) {
    for (const inn of match.innings ?? []) {
      for (const bat of inn.batsmen ?? []) {
        if (!batting[bat.name]) {
          batting[bat.name] = {
            name: bat.name,
            team: inn.battingTeam,
            matchIds: new Set(),
            innings: 0,
            runs: 0,
            balls: 0,
            fours: 0,
            sixes: 0,
            dismissals: 0,
            highScore: 0,
          };
        }
        const p = batting[bat.name];
        p.matchIds.add(match.id);
        p.innings++;
        p.runs += bat.runs;
        p.balls += bat.balls;
        p.fours += bat.fours;
        p.sixes += bat.sixes;
        if (bat.out) p.dismissals++;
        if (bat.runs > p.highScore) p.highScore = bat.runs;
      }

      for (const bwl of inn.bowlers ?? []) {
        if (!bowling[bwl.name]) {
          bowling[bwl.name] = {
            name: bwl.name,
            team: inn.bowlingTeam,
            matchIds: new Set(),
            balls: 0,
            runs: 0,
            wickets: 0,
          };
        }
        const p = bowling[bwl.name];
        p.matchIds.add(match.id);
        p.balls += bwl.balls;
        p.runs += bwl.runs;
        p.wickets += bwl.wickets;
      }
    }
  }

  const avg = (r, d) => (d > 0 ? (r / d).toFixed(1) : r > 0 ? 'N/O' : '-');
  const sr = (r, b) => (b > 0 ? ((r / b) * 100).toFixed(1) : '-');
  const econ = (r, b) => (b > 0 ? (r / (b / 6)).toFixed(1) : '-');
  const bAvg = (r, w) => (w > 0 ? (r / w).toFixed(1) : '-');

  return {
    batting: Object.values(batting)
      .map((p) => ({
        name: p.name,
        team: p.team,
        matches: p.matchIds.size,
        innings: p.innings,
        runs: p.runs,
        hs: p.highScore,
        balls: p.balls,
        fours: p.fours,
        sixes: p.sixes,
        avg: avg(p.runs, p.dismissals),
        sr: sr(p.runs, p.balls),
      }))
      .sort((a, b) => b.runs - a.runs),

    bowling: Object.values(bowling)
      .map((p) => ({
        name: p.name,
        team: p.team,
        matches: p.matchIds.size,
        overs: `${Math.floor(p.balls / 6)}.${p.balls % 6}`,
        wickets: p.wickets,
        runs: p.runs,
        econ: econ(p.runs, p.balls),
        avg: bAvg(p.runs, p.wickets),
      }))
      .sort((a, b) => b.wickets - a.wickets || parseFloat(a.econ) - parseFloat(b.econ)),
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
  const [overs, setOvers] = useState(8);
  const [powerplayOvers, setPowerplayOvers] = useState(2);
  const [error, setError] = useState('');

  const handleStart = () => {
    if (overs < 1 || overs > 50) return setError('Overs must be between 1 and 50.');
    if (powerplayOvers < 0 || powerplayOvers > overs)
      return setError('Powerplay overs cannot exceed total overs.');
    setError('');
    onStart({ tossWinner, decision, overs, powerplayOvers });
  };

  return (
    <div className="panel">
      <h3 style={{ marginBottom: 4 }}>Match {series.matches.length + 1}</h3>
      <p className="hint">Record the toss result, then start scoring.</p>
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
      <div className="form-row">
        <label>
          Overs per side
          <input
            type="number"
            min="1"
            max="50"
            value={overs}
            onChange={(e) => setOvers(Number(e.target.value))}
          />
        </label>
        <label>
          Powerplay overs
          <input
            type="number"
            min="0"
            max="50"
            value={powerplayOvers}
            onChange={(e) => setPowerplayOvers(Number(e.target.value))}
          />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="form-actions">
        <button className="btn primary" onClick={handleStart}>
          Start Match
        </button>
      </div>
    </div>
  );
}

function SquadsPanel({ series, onSquadsChange }) {
  const [editing, setEditing] = useState(false);
  const [nameA, setNameA] = useState('');
  const [nameB, setNameB] = useState('');
  const [textA, setTextA] = useState('');
  const [textB, setTextB] = useState('');
  const [a, b] = series.teams;

  const startEdit = () => {
    setNameA(a.name);
    setNameB(b.name);
    setTextA(a.players.join('\n'));
    setTextB(b.players.join('\n'));
    setEditing(true);
  };

  const save = () => {
    const parse = (t) =>
      [...new Set(t.split('\n').map((l) => l.trim()).filter(Boolean))];
    const pA = parse(textA);
    const pB = parse(textB);
    const finalNameA = nameA.trim() || a.name;
    const finalNameB = nameB.trim() || b.name;
    if (pA.length < 2 || pB.length < 2) return;
    onSquadsChange([
      { name: finalNameA, players: pA },
      { name: finalNameB, players: pB },
    ]);
    setEditing(false);
  };

  return (
    <div className="panel">
      <div className="innings-head">
        <h3>Teams &amp; Squads</h3>
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
            You can rename teams and edit player lists. Team renames apply to all matches.
            Player changes apply to future matches only.
          </p>
          <div className="form-row">
            <label>
              Team name
              <input
                type="text"
                value={nameA}
                onChange={(e) => setNameA(e.target.value)}
                placeholder={a.name}
              />
            </label>
            <label>
              Team name
              <input
                type="text"
                value={nameB}
                onChange={(e) => setNameB(e.target.value)}
                placeholder={b.name}
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              {nameA || a.name} players (one per line)
              <textarea rows={9} value={textA} onChange={(e) => setTextA(e.target.value)} />
            </label>
            <label>
              {nameB || b.name} players (one per line)
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

function StatsPanel({ series }) {
  const [activeTab, setActiveTab] = useState('batting');
  const stats = computeStats(series);
  const hasStats = stats.batting.length > 0 || stats.bowling.length > 0;

  return (
    <div className="panel stats-panel">
      <div className="innings-head">
        <h3>Player Stats</h3>
      </div>

      {!hasStats ? (
        <p className="muted hint">Stats appear once matches are played.</p>
      ) : (
        <>
          <div className="stats-tabs">
            <button
              className={`tab ${activeTab === 'batting' ? 'active' : ''}`}
              onClick={() => setActiveTab('batting')}
            >
              Batting
            </button>
            <button
              className={`tab ${activeTab === 'bowling' ? 'active' : ''}`}
              onClick={() => setActiveTab('bowling')}
            >
              Bowling
            </button>
          </div>

          {activeTab === 'batting' && (
            <div className="stats-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="left">Player</th>
                    <th className="left">Team</th>
                    <th title="Matches played">M</th>
                    <th title="Innings batted">Inn</th>
                    <th title="Total runs">R</th>
                    <th title="Highest score">HS</th>
                    <th title="Batting average">Avg</th>
                    <th title="Strike rate">SR</th>
                    <th>4s</th>
                    <th>6s</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.batting.map((p) => (
                    <tr key={p.name}>
                      <td className="left">
                        <strong>{p.name}</strong>
                      </td>
                      <td className="left muted">{p.team}</td>
                      <td>{p.matches}</td>
                      <td>{p.innings}</td>
                      <td>
                        <strong>{p.runs}</strong>
                      </td>
                      <td>{p.hs}</td>
                      <td>{p.avg}</td>
                      <td>{p.sr}</td>
                      <td>{p.fours}</td>
                      <td>{p.sixes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'bowling' && (
            <div className="stats-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="left">Player</th>
                    <th className="left">Team</th>
                    <th title="Matches played">M</th>
                    <th title="Overs bowled">O</th>
                    <th title="Wickets taken">W</th>
                    <th title="Runs conceded">R</th>
                    <th title="Economy rate">Econ</th>
                    <th title="Bowling average">Avg</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.bowling.map((p) => (
                    <tr key={p.name}>
                      <td className="left">
                        <strong>{p.name}</strong>
                      </td>
                      <td className="left muted">{p.team}</td>
                      <td>{p.matches}</td>
                      <td>{p.overs}</td>
                      <td>
                        <strong>{p.wickets}</strong>
                      </td>
                      <td>{p.runs}</td>
                      <td>{p.econ}</td>
                      <td>{p.avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export default function SeriesView({
  series,
  onSquadsChange,
  onMatchCreate,
  onMatchDelete,
  onOpenMatch,
}) {
  const score = seriesScore(series);
  const [a, b] = series.teams.map((t) => t.name);
  const liveMatch = series.matches.find((m) => m.status === 'live');
  const canStartMatch = !liveMatch && series.matches.length < series.bestOf;

  const startMatch = (toss) => {
    const match = createSeriesMatch(series, toss);
    // onMatchCreate handles both the state update AND navigation in one React batch
    onMatchCreate(match);
  };

  const handleDeleteMatch = (matchId) => {
    if (!confirm('Delete this match permanently?')) return;
    onMatchDelete(matchId);
  };

  return (
    <div>
      {/* ── Series header ── */}
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
        </div>
      </div>

      {/* ── Live alert ── */}
      {liveMatch && (
        <div className="panel live-note" onClick={() => onOpenMatch(liveMatch.id)}>
          ● Match {liveMatch.matchNo} is live — tap to continue scoring
        </div>
      )}

      {/* ── Start next match ── */}
      {canStartMatch && <NewMatchPanel series={series} onStart={startMatch} />}

      {/* ── Match history ── */}
      {series.matches.length > 0 && (
        <div className="match-list">
          {[...series.matches].reverse().map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              onOpen={() => onOpenMatch(m.id)}
              onDelete={() => handleDeleteMatch(m.id)}
            />
          ))}
        </div>
      )}

      {/* ── Squads editor ── */}
      <SquadsPanel series={series} onSquadsChange={onSquadsChange} />

      {/* ── Per-player series stats ── */}
      <StatsPanel series={series} />
    </div>
  );
}
