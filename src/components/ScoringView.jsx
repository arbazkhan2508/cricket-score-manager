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

  const inn = match.innings[match.currentInnings];
  const striker = inn.strikerIdx !== null ? inn.batsmen[inn.strikerIdx] : null;
  const nonStriker = inn.nonStrikerIdx !== null ? inn.batsmen[inn.nonStrikerIdx] : null;
  const bowler = inn.bowlerIdx !== null ? inn.bowlers[inn.bowlerIdx] : null;

  const battingSquad = squadOf(match, inn.battingTeam);
  const bowlingSquad = squadOf(match, inn.bowlingTeam);
  const usedNames = new Set(inn.batsmen.map((b) => b.name));
  const availableBatsmen = battingSquad.filter((n) => !usedNames.has(n));

  const needsOpeners = match.status === 'live' && inn.batsmen.length === 0;
  const needsNewBatsman =
    match.status === 'live' &&
    !needsOpeners &&
    (inn.strikerIdx === null || inn.nonStrikerIdx === null) &&
    availableBatsmen.length > 0;
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
      // swap strike, demand a (possibly new) bowler for next over
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

  // Run buttons: runs off the bat, recorded immediately
  const scoreRuns = (n) => {
    setFollowUp(null);
    apply((m, i) => applyDelivery(m, i, n, 'none'));
  };

  // Extra buttons: one click records the delivery instantly
  // (wide/no-ball = 1 run, bye/leg-bye = 1 run), then a follow-up
  // bar lets the user bump the runs taken on that same delivery.
  const recordExtra = (mode) => {
    const base = mode === 'bye' || mode === 'legbye' ? 1 : 0;
    apply((m, i) => applyDelivery(m, i, base, mode));
    setFollowUp(mode);
  };

  // Re-record the just-scored extra with more runs: rebuild from the
  // snapshot taken before it, so totals/strike/over state stay exact.
  const adjustExtra = (mode, n) => {
    const prev = history[history.length - 1];
    if (!prev) return;
    const next = clone(prev);
    applyDelivery(next, next.innings[next.currentInnings], n, mode);
    onChange(next);
    setFollowUp(null);
  };

  const recordWicket = (how, runsCompleted) => {
    setWicketOpen(false);
    setFollowUp(null);
    apply((m, i) => {
      const bat = i.batsmen[i.strikerIdx];
      const bwl = i.bowlers[i.bowlerIdx];
      const credit = how !== 'Run out';

      i.runs += runsCompleted;
      bat.runs += runsCompleted;
      bat.balls += 1;
      bat.out = true;
      bat.outDesc = credit ? `${how.toLowerCase()} b ${bwl.name}` : 'run out';
      bwl.balls += 1;
      bwl.runs += runsCompleted;
      if (credit) bwl.wickets += 1;
      i.balls += 1;
      i.wickets += 1;
      i.thisOver.push(runsCompleted ? `W+${runsCompleted}` : 'W');
      i.strikerIdx = null; // demand new batsman
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

  // ---- setup actions (players come from the squad list) ----
  const addOpeners = (s, ns) =>
    apply((m, i) => {
      i.batsmen.push(newBatsman(s), newBatsman(ns));
      i.strikerIdx = 0;
      i.nonStrikerIdx = 1;
    });

  const addNextBatsman = (name) =>
    apply((m, i) => {
      i.batsmen.push(newBatsman(name));
      const idx = i.batsmen.length - 1;
      if (i.strikerIdx === null) i.strikerIdx = idx;
      else i.nonStrikerIdx = idx;
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
        <div className="big-score">
          <span className="team-name">{inn.battingTeam}</span>
          <span className="score-num">
            {inn.runs}/{inn.wickets}
          </span>
          <span className="overs-num">
            ({oversText(inn.balls)}/{match.overs} ov)
          </span>
          {powerplay && <span className="badge powerplay">⚡ POWERPLAY</span>}
        </div>
        <div className="score-meta">
          <span>CRR: {runRate(inn.runs, inn.balls)}</span>
          {tgt !== null && match.status === 'live' && (
            <span>
              Target: {tgt} · Need {Math.max(0, tgt - inn.runs)} off{' '}
              {match.overs * 6 - inn.balls} balls
            </span>
          )}
          {match.result && <strong className="result-banner">{match.result}</strong>}
        </div>
        {inn.thisOver.length > 0 && (
          <div className="this-over">
            This over:{' '}
            {inn.thisOver.map((b, idx) => (
              <span key={idx} className={`ball-chip ${b.startsWith('W') ? 'w' : ''}`}>
                {b}
              </span>
            ))}
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
              players={availableBatsmen}
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
                  </div>
                  <div className="player-line">
                    <span>{nonStriker.name}</span>
                    <span>
                      {nonStriker.runs} ({nonStriker.balls})
                    </span>
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
                <p className="hint">Runs off the bat — recorded instantly:</p>
                <div className="run-buttons">
                  {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      className={`btn run ${n === 4 ? 'four' : ''} ${n === 6 ? 'six' : ''}`}
                      onClick={() => scoreRuns(n)}
                    >
                      {n}
                    </button>
                  ))}
                  <button className="btn run wicket" onClick={() => setWicketOpen(true)}>
                    W
                  </button>
                </div>
                <p className="hint">
                  Extras — one tap adds the run and updates the score immediately:
                </p>
                <div className="extra-toggles">
                  {[
                    ['wide', 'Wide +1'],
                    ['noball', 'No Ball +1'],
                    ['bye', 'Bye +1'],
                    ['legbye', 'Leg Bye +1'],
                  ].map(([mode, label]) => (
                    <button key={mode} className="btn" onClick={() => recordExtra(mode)}>
                      {label}
                    </button>
                  ))}
                </div>
                {followUp && (
                  <div className="follow-up">
                    <span className="hint">
                      Batsmen ran more on that{' '}
                      {followUp === 'noball' ? 'no ball' : followUp === 'legbye' ? 'leg bye' : followUp}? Set total runs:
                    </span>
                    <div className="extra-toggles">
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <button
                          key={n}
                          className="btn small"
                          onClick={() => adjustExtra(followUp, n)}
                        >
                          {followUp === 'wide' || followUp === 'noball' ? `+${n} run${n > 1 ? 's' : ''}` : `${n} run${n > 1 ? 's' : ''}`}
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
                    ↩ Undo
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
              <button className="btn" onClick={undo} disabled={history.length === 0}>
                ↩ Undo last ball
              </button>
            </div>
          )}
        </>
      )}

      {wicketOpen && (
        <WicketModal onCancel={() => setWicketOpen(false)} onConfirm={recordWicket} />
      )}
    </div>
  );
}

function OpenersPicker({ team, squad, onSubmit }) {
  const [picked, setPicked] = useState([]); // first pick takes strike

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

function PlayerPicker({ title, players, onPick }) {
  return (
    <div className="panel setup-form">
      <h3>{title}</h3>
      <div className="player-grid">
        {players.map((name) => (
          <button key={name} className="btn" onClick={() => onPick(name)}>
            {name}
          </button>
        ))}
      </div>
    </div>
  );
}

function BowlerPicker({ squad, bowlers, lastOverBowler, team, onPick }) {
  const statsFor = (name) => bowlers.find((b) => b.name === name);
  return (
    <div className="panel setup-form">
      <h3>Select bowler — {team}</h3>
      {lastOverBowler && (
        <p className="hint">{lastOverBowler} bowled the last over and can’t bowl this one.</p>
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

function WicketModal({ onCancel, onConfirm }) {
  const [how, setHow] = useState('Bowled');
  const [runs, setRuns] = useState(0);
  return (
    <div className="modal-backdrop" onClick={onCancel}>
      <div className="modal panel" onClick={(e) => e.stopPropagation()}>
        <h3>Wicket! How was the striker out?</h3>
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
          <label>
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
            onClick={() => onConfirm(how, how === 'Run out' ? runs : 0)}
          >
            Confirm Wicket
          </button>
        </div>
      </div>
    </div>
  );
}
