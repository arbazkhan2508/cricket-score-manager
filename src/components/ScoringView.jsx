import { useState } from 'react';
import Scorecard from './Scorecard.jsx';
import {
  newBatsman,
  newBowler,
  newInnings,
  oversText,
  runRate,
  inningsOver,
  inPowerplay,
  target,
  computeResult,
  squadOf,
} from '../utils/cricket.js';

const clone = (obj) => JSON.parse(JSON.stringify(obj));

const DISMISSALS = ['Bowled', 'Caught', 'LBW', 'Run out', 'Stumped', 'Hit wicket'];

export default function ScoringView({ match, onChange }) {
  const [history, setHistory] = useState([]);
  const [followUp, setFollowUp] = useState(null); // extra type of last delivery, for "+runs" bar
  const [wicketOpen, setWicketOpen] = useState(false);
  const [tab, setTab] = useState('score'); // score | card

  // ---- toss / reset (must be before any early return) ----
  const hasToss = Boolean(match.toss) && match.innings.length > 0;

  const applyToss = ({ tossWinner, decision, battingFirst, bowlingFirst }) => {
    setHistory([]);
    setFollowUp(null);
    onChange({
      ...match,
      toss: { winner: tossWinner, decision },
      innings: [newInnings(battingFirst, bowlingFirst)],
      currentInnings: 0,
      status: 'live',
      result: '',
      winner: null,
    });
  };

  const resetMatch = () => {
    if (!confirm('Reset this match to the toss? All scoring data will be lost.')) return;
    setHistory([]);
    setFollowUp(null);
    setWicketOpen(false);
    onChange({
      ...match,
      toss: null,
      innings: [],
      currentInnings: 0,
      status: 'live',
      result: '',
      winner: null,
    });
  };

  if (!hasToss) {
    return (
      <div className="scoring">
        <div className="panel score-header">
          <div className="score-header-top">
            <h2>Match {match.matchNo} · {match.teamA} vs {match.teamB}</h2>
            <span className="badge live">● LIVE</span>
          </div>
          <p className="toss-line muted">{match.overs} overs · {match.powerplayOvers} PP overs</p>
        </div>
        <TossPicker match={match} onConfirm={applyToss} />
      </div>
    );
  }

  const inn = match.innings[match.currentInnings];
  const striker = inn.strikerIdx !== null ? inn.batsmen[inn.strikerIdx] : null;
  const nonStriker = inn.nonStrikerIdx !== null ? inn.batsmen[inn.nonStrikerIdx] : null;
  const bowler = inn.bowlerIdx !== null ? inn.bowlers[inn.bowlerIdx] : null;

  const battingSquad = squadOf(match, inn.battingTeam);
  const bowlingSquad = squadOf(match, inn.bowlingTeam);
  const usedNames = new Set(inn.batsmen.map((b) => b.name));
  const retiredBatsmen = inn.batsmen.filter((b) => b.retired);
  const availableNewBatsmen = battingSquad.filter((n) => !usedNames.has(n));

  const needsOpeners = match.status === 'live' && inn.batsmen.length === 0;
  const needsNewBatsman =
    match.status === 'live' &&
    !needsOpeners &&
    (inn.strikerIdx === null || inn.nonStrikerIdx === null) &&
    (availableNewBatsmen.length > 0 || retiredBatsmen.length > 0);
  const needsBowler =
    match.status === 'live' && !needsOpeners && !needsNewBatsman && inn.bowlerIdx === null;
  const canScore = match.status === 'live' && !needsOpeners && !needsNewBatsman && !needsBowler;

  const apply = (mutator) => {
    setHistory((h) => [...h.slice(-49), clone(match)]);
    const next = clone(match);
    mutator(next, next.innings[next.currentInnings]);
    onChange(next);
  };

  const undo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    onChange(prev);
    setWicketOpen(false);
    setFollowUp(null);
  };

  // ---- innings / match progression ----
  const checkProgress = (m, i) => {
    const tgt = m.innings.length > 1 ? m.innings[0].runs + 1 : null;
    const chased = tgt !== null && i.runs >= tgt;
    if (chased || inningsOver(i, m)) {
      if (m.currentInnings === 0) {
        m.innings.push(newInnings(i.bowlingTeam, i.battingTeam));
        m.currentInnings = 1;
      } else {
        m.status = 'completed';
        const r = computeResult(m);
        m.result = r.text;
        m.winner = r.winner;
      }
    }
  };

  const endOfOverIfNeeded = (i) => {
    if (i.balls % 6 === 0 && i.balls > 0) {
      i.lastOverBowler = i.bowlerIdx !== null ? i.bowlers[i.bowlerIdx].name : null;
      [i.strikerIdx, i.nonStrikerIdx] = [i.nonStrikerIdx, i.strikerIdx];
      i.bowlerIdx = null;
      i.thisOver = [];
    }
  };

  const rotateStrike = (i, runs) => {
    if (runs % 2 === 1) [i.strikerIdx, i.nonStrikerIdx] = [i.nonStrikerIdx, i.strikerIdx];
  };

  // ---- scoring actions ----
  const applyDelivery = (m, i, n, mode) => {
    const bat = i.batsmen[i.strikerIdx];
    const bwl = i.bowlers[i.bowlerIdx];

    if (mode === 'wide') {
      i.runs += n + 1;
      i.extras.wides += n + 1;
      bwl.runs += n + 1;
      i.thisOver.push(n ? `${n}wd` : 'wd');
      rotateStrike(i, n);
    } else if (mode === 'noball') {
      i.runs += n + 1;
      i.extras.noballs += 1;
      bat.runs += n;
      bat.balls += 1;
      if (n === 4) bat.fours += 1;
      if (n === 6) bat.sixes += 1;
      bwl.runs += n + 1;
      i.thisOver.push(n ? `${n}nb` : 'nb');
      rotateStrike(i, n);
    } else if (mode === 'bye' || mode === 'legbye') {
      i.runs += n;
      i.extras[mode === 'bye' ? 'byes' : 'legbyes'] += n;
      bat.balls += 1;
      bwl.balls += 1;
      i.balls += 1;
      i.thisOver.push(`${n}${mode === 'bye' ? 'b' : 'lb'}`);
      rotateStrike(i, n);
      endOfOverIfNeeded(i);
    } else {
      i.runs += n;
      bat.runs += n;
      bat.balls += 1;
      if (n === 4) bat.fours += 1;
      if (n === 6) bat.sixes += 1;
      bwl.runs += n;
      bwl.balls += 1;
      i.balls += 1;
      i.thisOver.push(String(n));
      rotateStrike(i, n);
      endOfOverIfNeeded(i);
    }
    checkProgress(m, i);
  };

  const scoreRuns = (n) => {
    setFollowUp(null);
    apply((m, i) => applyDelivery(m, i, n, 'none'));
  };

  const recordExtra = (mode) => {
    const base = mode === 'bye' || mode === 'legbye' ? 1 : 0;
    apply((m, i) => applyDelivery(m, i, base, mode));
    setFollowUp(mode);
  };

  const adjustExtra = (mode, n) => {
    const prev = history[history.length - 1];
    if (!prev) return;
    const next = clone(prev);
    applyDelivery(next, next.innings[next.currentInnings], n, mode);
    onChange(next);
    setFollowUp(null);
  };

  // who: 'striker' | 'nonstriker'
  // how: dismissal type string
  // runsCompleted: number (only relevant for Run out)
  const recordWicket = (who, how, runsCompleted) => {
    setWicketOpen(false);
    setFollowUp(null);
    apply((m, i) => {
      const strikerBat = i.batsmen[i.strikerIdx];
      const outIdx = who === 'striker' ? i.strikerIdx : i.nonStrikerIdx;
      const outBat = i.batsmen[outIdx];
      const bwl = i.bowlers[i.bowlerIdx];
      const creditBowler = how !== 'Run out';

      // Striker always faces the ball — gets runs and ball counted
      i.runs += runsCompleted;
      strikerBat.runs += runsCompleted;
      strikerBat.balls += 1;

      // Mark the correct batsman out
      outBat.out = true;
      outBat.outDesc = creditBowler
        ? `${how.toLowerCase()} b ${bwl.name}`
        : 'run out';

      // Bowler stats
      bwl.balls += 1;
      bwl.runs += runsCompleted;
      if (creditBowler) bwl.wickets += 1;

      i.balls += 1;
      i.wickets += 1;
      i.thisOver.push(runsCompleted ? `W+${runsCompleted}` : 'W');

      // Vacate the dismissed batsman's slot — a new player will be picked next
      if (who === 'striker') {
        i.strikerIdx = null;
      } else {
        i.nonStrikerIdx = null;
      }

      endOfOverIfNeeded(i);
      checkProgress(m, i);
    });
  };

  const swapStrike = () => {
    setFollowUp(null);
    apply((m, i) => {
      [i.strikerIdx, i.nonStrikerIdx] = [i.nonStrikerIdx, i.strikerIdx];
    });
  };

  // ---- setup actions ----
  const addOpeners = (s, ns) =>
    apply((m, i) => {
      i.batsmen.push(newBatsman(s), newBatsman(ns));
      i.strikerIdx = 0;
      i.nonStrikerIdx = 1;
    });

  const retireBatsman = (who) =>
    apply((m, i) => {
      const idx = who === 'striker' ? i.strikerIdx : i.nonStrikerIdx;
      if (idx === null) return;
      i.batsmen[idx].retired = true;
      if (who === 'striker') i.strikerIdx = null;
      else i.nonStrikerIdx = null;
      // No wicket increment — retirement is not a dismissal
    });

  const addNextBatsman = (name) =>
    apply((m, i) => {
      const retiredIdx = i.batsmen.findIndex((b) => b.name === name && b.retired);
      if (retiredIdx >= 0) {
        // Bring back a retired batsman at any position
        i.batsmen[retiredIdx].retired = false;
        if (i.strikerIdx === null) i.strikerIdx = retiredIdx;
        else i.nonStrikerIdx = retiredIdx;
      } else {
        // Fresh new batsman
        i.batsmen.push(newBatsman(name));
        const idx = i.batsmen.length - 1;
        if (i.strikerIdx === null) i.strikerIdx = idx;
        else i.nonStrikerIdx = idx;
      }
    });

  const setBowlerByName = (name) =>
    apply((m, i) => {
      const idx = i.bowlers.findIndex(
        (b) => b.name.toLowerCase() === name.toLowerCase()
      );
      if (idx >= 0) {
        i.bowlerIdx = idx;
      } else {
        i.bowlers.push(newBowler(name));
        i.bowlerIdx = i.bowlers.length - 1;
      }
    });

  const tgt = target(match);
  const powerplay = match.status === 'live' && canScore && inPowerplay(inn, match);

  return (
    <div className="scoring">
      <div className="score-header panel">
        <div className="score-header-top">
          <h2>
            Match {match.matchNo} · {match.teamA} vs {match.teamB}
          </h2>
          <span className={`badge ${match.status}`}>
            {match.status === 'live' ? '● LIVE' : 'COMPLETED'}
          </span>
        </div>
        <p className="toss-line muted">
          Toss: {match.toss.winner} chose to {match.toss.decision} first
        </p>
        <div className="batting-label">{inn.battingTeam}</div>
        <div className="big-score">
          <span className="score-num">
            {inn.runs}/{inn.wickets}
          </span>
          <span className="overs-num">
            ({oversText(inn.balls)}/{match.overs} ov)
          </span>
          {powerplay && <span className="badge powerplay">⚡ PP</span>}
        </div>
        <div className="score-meta">
          <span>CRR {runRate(inn.runs, inn.balls)}</span>
          {match.result && <strong className="result-banner">{match.result}</strong>}
        </div>

        {tgt !== null && match.status === 'live' && (
          <div className="chase-bar-wrap">
            <div className="chase-label">
              <span>Target {tgt}</span>
              <span className="need">
                Need {Math.max(0, tgt - inn.runs)} off {match.overs * 6 - inn.balls} balls
              </span>
            </div>
            <div className="chase-track">
              <div
                className="chase-fill"
                style={{ width: `${Math.min(100, (inn.runs / tgt) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {inn.thisOver.length > 0 && (
          <div className="this-over">
            <div className="this-over-label">This over</div>
            <div className="balls-row">
              {inn.thisOver.map((b, idx) => {
                const cls = b.startsWith('W') ? 'w' : b === '4' ? 'four' : b === '6' ? 'six' : '';
                return (
                  <span key={idx} className={`ball-chip${cls ? ` ${cls}` : ''}`}>
                    {b}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === 'score' ? 'active' : ''}`}
          onClick={() => setTab('score')}
        >
          Scoring
        </button>
        <button
          className={`tab ${tab === 'card' ? 'active' : ''}`}
          onClick={() => setTab('card')}
        >
          Full Scorecard
        </button>
      </div>

      {tab === 'card' && <Scorecard match={match} />}

      {tab === 'score' && (
        <>
          {needsOpeners && (
            <OpenersPicker
              key={match.currentInnings}
              team={inn.battingTeam}
              squad={battingSquad}
              onSubmit={addOpeners}
            />
          )}
          {needsNewBatsman && (
            <PlayerPicker
              title={`New batsman in for ${inn.battingTeam}`}
              players={availableNewBatsmen}
              retiredPlayers={retiredBatsmen}
              onPick={addNextBatsman}
            />
          )}
          {needsBowler && (
            <BowlerPicker
              squad={bowlingSquad}
              bowlers={inn.bowlers}
              lastOverBowler={inn.lastOverBowler}
              team={inn.bowlingTeam}
              onPick={setBowlerByName}
            />
          )}

          {canScore && (
            <>
              <div className="panel players-now">
                <div className="batsmen-now">
                  <div className="player-line striker">
                    <span>🏏 {striker.name}*</span>
                    <span>
                      {striker.runs} ({striker.balls})
                    </span>
                    <button
                      className="btn small"
                      onClick={() => retireBatsman('striker')}
                      title="Retire this batsman — they can return later at any position"
                    >
                      Retire
                    </button>
                  </div>
                  <div className="player-line">
                    <span>{nonStriker.name}</span>
                    <span>
                      {nonStriker.runs} ({nonStriker.balls})
                    </span>
                    <button
                      className="btn small"
                      onClick={() => retireBatsman('nonstriker')}
                      title="Retire this batsman — they can return later at any position"
                    >
                      Retire
                    </button>
                  </div>
                </div>
                <div className="bowler-now">
                  <span>⚾ {bowler.name}</span>
                  <span>
                    {bowler.wickets}/{bowler.runs} ({oversText(bowler.balls)})
                  </span>
                </div>
              </div>

              <div className="panel controls">
                <p className="hint">Runs</p>
                <div className="run-buttons">
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      className={`btn run ${n === 4 ? 'four' : n === 6 ? 'six' : ''}`}
                      onClick={() => scoreRuns(n)}
                    >
                      {n === 0 ? '·' : n}
                    </button>
                  ))}
                  <button className="btn run wicket" onClick={() => setWicketOpen(true)}>
                    W
                  </button>
                </div>
                <p className="hint">Extras</p>
                <div className="extra-toggles">
                  {[
                    ['wide', 'Wide'],
                    ['noball', 'No Ball'],
                    ['bye', 'Bye'],
                    ['legbye', 'Leg Bye'],
                  ].map(([mode, label]) => (
                    <button key={mode} className="btn" onClick={() => recordExtra(mode)}>
                      {label}
                    </button>
                  ))}
                </div>
                {followUp && (
                  <div className="follow-up">
                    <p className="hint">
                      Runs scored on that {followUp === 'noball' ? 'no ball' : followUp === 'legbye' ? 'leg bye' : followUp}?
                    </p>
                    <div className="extra-toggles">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          className="btn small"
                          onClick={() => adjustExtra(followUp, n)}
                        >
                          {followUp === 'wide' || followUp === 'noball'
                            ? `+${n} run${n > 1 ? 's' : ''}`
                            : `${n} run${n > 1 ? 's' : ''}`}
                        </button>
                      ))}
                      <button className="btn small" onClick={() => setFollowUp(null)}>
                        ✕
                      </button>
                    </div>
                  </div>
                )}
                <div className="util-buttons">
                  <button className="btn" onClick={swapStrike}>
                    ⇄ Swap Strike
                  </button>
                  <button className="btn" onClick={undo} disabled={history.length === 0}>
                    ↩ Undo Last Ball
                  </button>
                  <button className="btn danger small" onClick={resetMatch}>
                    ↺ Reset
                  </button>
                </div>
              </div>
            </>
          )}

          {match.status === 'completed' && (
            <div className="panel completed-note">
              <p>
                <strong>{match.result}</strong>
              </p>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn" onClick={undo} disabled={history.length === 0}>
                  ↩ Undo Last Ball
                </button>
                <button className="btn danger" onClick={resetMatch}>
                  ↺ Reset Match
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {wicketOpen && striker && nonStriker && (
        <WicketModal
          striker={striker}
          nonStriker={nonStriker}
          onCancel={() => setWicketOpen(false)}
          onConfirm={recordWicket}
        />
      )}
    </div>
  );
}

function OpenersPicker({ team, squad, onSubmit }) {
  const [picked, setPicked] = useState([]);

  const toggle = (name) => {
    setPicked((p) =>
      p.includes(name) ? p.filter((n) => n !== name) : p.length < 2 ? [...p, name] : p
    );
  };

  return (
    <div className="panel setup-form">
      <h3>Opening batsmen — {team}</h3>
      <p className="hint">Pick two. The first one you tap takes strike.</p>
      <div className="player-grid">
        {squad.map((name) => {
          const idx = picked.indexOf(name);
          return (
            <button
              key={name}
              className={`btn toggle ${idx >= 0 ? 'on' : ''}`}
              onClick={() => toggle(name)}
            >
              {name}
              {idx === 0 ? ' 🏏*' : idx === 1 ? ' 🏏' : ''}
            </button>
          );
        })}
      </div>
      <button
        className="btn primary"
        disabled={picked.length !== 2}
        onClick={() => onSubmit(picked[0], picked[1])}
      >
        Confirm Openers
      </button>
    </div>
  );
}

function PlayerPicker({ title, players, retiredPlayers = [], onPick }) {
  return (
    <div className="panel setup-form">
      <h3>{title}</h3>
      {retiredPlayers.length > 0 && (
        <>
          <p className="hint">Retired — can bat at any position:</p>
          <div className="player-grid">
            {retiredPlayers.map((b) => (
              <button key={b.name} className="btn retire-return" onClick={() => onPick(b.name)}>
                ↩ {b.name} · {b.runs}({b.balls})
              </button>
            ))}
          </div>
        </>
      )}
      {players.length > 0 && (
        <>
          {retiredPlayers.length > 0 && <p className="hint">New batsmen:</p>}
          <div className="player-grid">
            {players.map((name) => (
              <button key={name} className="btn" onClick={() => onPick(name)}>
                {name}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function BowlerPicker({ squad, bowlers, lastOverBowler, team, onPick }) {
  const statsFor = (name) => bowlers.find((b) => b.name === name);
  return (
    <div className="panel setup-form">
      <h3>Select bowler — {team}</h3>
      {lastOverBowler && (
        <p className="hint">{lastOverBowler} bowled the last over and can't bowl this one.</p>
      )}
      <div className="player-grid">
        {squad.map((name) => {
          const s = statsFor(name);
          return (
            <button
              key={name}
              className="btn"
              disabled={name === lastOverBowler}
              onClick={() => onPick(name)}
            >
              {name}
              {s ? ` · ${oversText(s.balls)} ov, ${s.wickets}/${s.runs}` : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function WicketModal({ striker, nonStriker, onCancel, onConfirm }) {
  const [who, setWho] = useState('striker'); // 'striker' | 'nonstriker'
  const [how, setHow] = useState('Bowled');
  const [runs, setRuns] = useState(0);

  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <h3>Wicket!</h3>

        <p className="hint" style={{ marginBottom: '0.5rem' }}>
          Who is out?
        </p>
        <div className="wicket-who-grid">
          <button
            className={`btn toggle wicket-batsman ${who === 'striker' ? 'on' : ''}`}
            onClick={() => setWho('striker')}
          >
            <span className="wicket-role">Striker</span>
            <span className="wicket-name">{striker.name} *</span>
            <span className="wicket-stats">
              {striker.runs} ({striker.balls})
            </span>
          </button>
          <button
            className={`btn toggle wicket-batsman ${who === 'nonstriker' ? 'on' : ''}`}
            onClick={() => setWho('nonstriker')}
          >
            <span className="wicket-role">Non-striker</span>
            <span className="wicket-name">{nonStriker.name}</span>
            <span className="wicket-stats">
              {nonStriker.runs} ({nonStriker.balls})
            </span>
          </button>
        </div>

        <p className="hint" style={{ margin: '1rem 0 0.5rem' }}>
          How out?
        </p>
        <div className="dismissal-grid">
          {DISMISSALS.map((d) => (
            <button
              key={d}
              className={`btn toggle ${how === d ? 'on' : ''}`}
              onClick={() => setHow(d)}
            >
              {d}
            </button>
          ))}
        </div>

        {how === 'Run out' && (
          <label style={{ marginTop: '0.75rem', display: 'block' }}>
            Runs completed before run out
            <input
              type="number"
              min="0"
              max="3"
              value={runs}
              onChange={(e) => setRuns(Math.max(0, Number(e.target.value)))}
            />
          </label>
        )}

        <div className="form-actions">
          <button className="btn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn danger"
            onClick={() => onConfirm(who, how, how === 'Run out' ? runs : 0)}
          >
            Confirm — {who === 'striker' ? striker.name : nonStriker.name} out
          </button>
        </div>
      </div>
    </div>
  );
}

function TossPicker({ match, onConfirm }) {
  const [tossWinner, setTossWinner] = useState(match.teamA);
  const [decision, setDecision] = useState('bat');

  const handleConfirm = () => {
    const other = tossWinner === match.teamA ? match.teamB : match.teamA;
    const battingFirst = decision === 'bat' ? tossWinner : other;
    const bowlingFirst = battingFirst === match.teamA ? match.teamB : match.teamA;
    onConfirm({ tossWinner, decision, battingFirst, bowlingFirst });
  };

  return (
    <div className="panel setup-form">
      <h3>Record the Toss</h3>
      <p className="hint">Do the toss on the turf, then record it here to start scoring.</p>
      <div className="form-row">
        <label>
          Toss won by
          <select value={tossWinner} onChange={(e) => setTossWinner(e.target.value)}>
            <option value={match.teamA}>{match.teamA}</option>
            <option value={match.teamB}>{match.teamB}</option>
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
        <button className="btn primary" onClick={handleConfirm}>
          Confirm Toss &amp; Start
        </button>
      </div>
    </div>
  );
}
