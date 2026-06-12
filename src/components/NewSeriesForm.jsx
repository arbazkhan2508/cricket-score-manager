import { useState } from 'react';
import { createSeries } from '../utils/cricket.js';

const parsePlayers = (text) =>
  [...new Set(
    text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
  )];

export default function NewSeriesForm({ onCreate, onCancel }) {
  const [name, setName] = useState('');
  const [teamA, setTeamA] = useState('BLASTERS');
  const [teamB, setTeamB] = useState('TITANS');
  const [playersA, setPlayersA] = useState('');
  const [playersB, setPlayersB] = useState('');
  const [bestOf, setBestOf] = useState(3);
  const [overs, setOvers] = useState(8);
  const [powerplayOvers, setPowerplayOvers] = useState(2);
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    const a = teamA.trim();
    const b = teamB.trim();
    if (!a || !b) return setError('Both team names are required.');
    if (a.toLowerCase() === b.toLowerCase())
      return setError('Team names must be different.');
    const pA = parsePlayers(playersA);
    const pB = parsePlayers(playersB);
    if (pA.length < 2 || pB.length < 2)
      return setError('Each team needs at least 2 players (one name per line).');
    if (overs < 1 || overs > 50) return setError('Overs must be between 1 and 50.');
    if (powerplayOvers < 0 || powerplayOvers > overs)
      return setError('Powerplay overs cannot exceed total overs.');
    onCreate(
      createSeries({
        name: name.trim() || `${a} vs ${b}`,
        teamA: a,
        teamB: b,
        playersA: pA,
        playersB: pB,
        bestOf,
        overs,
        powerplayOvers,
      })
    );
  };

  return (
    <form className="panel new-match" onSubmit={submit}>
      <h2>New Series</h2>
      <p className="hint">
        Set up the teams and turf rules once — every match in the series uses them, and
        you pick batsmen &amp; bowlers from these squads while scoring.
      </p>

      <label>
        Series name (optional)
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. BLASTERS vs TITANS"
        />
      </label>

      <div className="form-row">
        <label>
          Team A
          <input value={teamA} onChange={(e) => setTeamA(e.target.value)} />
        </label>
        <label>
          Team B
          <input value={teamB} onChange={(e) => setTeamB(e.target.value)} />
        </label>
      </div>

      <div className="form-row">
        <label>
          {teamA.trim() || 'Team A'} squad — one name per line (8 players)
          <textarea
            rows={9}
            value={playersA}
            onChange={(e) => setPlayersA(e.target.value)}
            placeholder={'Player 1\nPlayer 2\nPlayer 3\n...'}
          />
        </label>
        <label>
          {teamB.trim() || 'Team B'} squad — one name per line (8 players)
          <textarea
            rows={9}
            value={playersB}
            onChange={(e) => setPlayersB(e.target.value)}
            placeholder={'Player 1\nPlayer 2\nPlayer 3\n...'}
          />
        </label>
      </div>

      <div className="form-row">
        <label>
          Series length
          <select value={bestOf} onChange={(e) => setBestOf(Number(e.target.value))}>
            <option value={2}>2 matches</option>
            <option value={3}>3 matches</option>
          </select>
        </label>
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
      </div>

      <div className="form-row">
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
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn primary">
          Create Series
        </button>
      </div>
    </form>
  );
}
