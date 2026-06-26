// Cricket helpers and series/match model utilities

// crypto.randomUUID() only works in secure contexts (HTTPS / localhost).
// When scoring from a phone over LAN (http://192.168.x.x), use getRandomValues()
// instead — it works in ALL browser contexts.
function uid() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC-4122 v4 UUID fallback via getRandomValues
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] & 15;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const newBatsman = (name) => ({
  name,
  runs: 0,
  balls: 0,
  fours: 0,
  sixes: 0,
  out: false,
  outDesc: '',
  retired: false,
});

export const newBowler = (name) => ({
  name,
  balls: 0,
  runs: 0,
  wickets: 0,
});

export const newInnings = (battingTeam, bowlingTeam) => ({
  battingTeam,
  bowlingTeam,
  runs: 0,
  wickets: 0,
  balls: 0, // legal deliveries
  extras: { wides: 0, noballs: 0, byes: 0, legbyes: 0 },
  batsmen: [],
  bowlers: [],
  strikerIdx: null,
  nonStrikerIdx: null,
  bowlerIdx: null,
  lastOverBowler: null, // can't bowl two overs in a row
  thisOver: [], // labels of deliveries in current over, e.g. '1', 'W', 'wd'
});

export const createSeries = ({
  name,
  teamA,
  teamB,
  playersA,
  playersB,
  bestOf,
}) => ({
  id: uid(),
  createdAt: Date.now(),
  name,
  teams: [
    { name: teamA, players: playersA },
    { name: teamB, players: playersB },
  ],
  bestOf: Number(bestOf),
  matches: [],
});

// Snapshot teams + per-match overs onto the match so squad edits don't break scoring
export const createSeriesMatch = (series, { tossWinner, decision, overs, powerplayOvers }) => {
  const [a, b] = series.teams;
  const other = tossWinner === a.name ? b.name : a.name;
  const battingFirst = decision === 'bat' ? tossWinner : other;
  const bowlingFirst = battingFirst === a.name ? b.name : a.name;
  return {
    id: uid(),
    createdAt: Date.now(),
    matchNo: series.matches.length + 1,
    teamA: a.name,
    teamB: b.name,
    squads: { [a.name]: [...a.players], [b.name]: [...b.players] },
    overs: Number(overs),
    powerplayOvers: Number(powerplayOvers),
    toss: { winner: tossWinner, decision },
    status: 'live', // live | completed
    innings: [newInnings(battingFirst, bowlingFirst)],
    currentInnings: 0,
    result: '',
    winner: null, // team name | 'tie' | null
  };
};

export const squadOf = (match, team) => match.squads[team] ?? [];

export const oversText = (balls) => `${Math.floor(balls / 6)}.${balls % 6}`;

export const strikeRate = (runs, balls) =>
  balls === 0 ? '0.00' : ((runs / balls) * 100).toFixed(2);

export const economy = (runs, balls) =>
  balls === 0 ? '0.00' : (runs / (balls / 6)).toFixed(2);

export const runRate = (runs, balls) =>
  balls === 0 ? '0.00' : (runs / (balls / 6)).toFixed(2);

export const totalExtras = (e) => e.wides + e.noballs + e.byes + e.legbyes;

export const inPowerplay = (inn, match) =>
  match.powerplayOvers > 0 && inn.balls < match.powerplayOvers * 6;

export const inningsOver = (inn, match) => {
  const maxBalls = match.overs * 6;
  const allOut = inn.wickets >= squadOf(match, inn.battingTeam).length - 1;
  return allOut || inn.balls >= maxBalls;
};

export const target = (match) =>
  match.innings.length > 1 ? match.innings[0].runs + 1 : null;

export const computeResult = (match) => {
  const [i1, i2] = match.innings;
  if (!i2) return { text: '', winner: null };
  if (i2.runs >= i1.runs + 1) {
    const wktsLeft = squadOf(match, i2.battingTeam).length - 1 - i2.wickets;
    return {
      text: `${i2.battingTeam} won by ${wktsLeft} wicket${wktsLeft === 1 ? '' : 's'}`,
      winner: i2.battingTeam,
    };
  }
  if (i2.runs === i1.runs) return { text: 'Match tied', winner: 'tie' };
  const margin = i1.runs - i2.runs;
  return {
    text: `${i1.battingTeam} won by ${margin} run${margin === 1 ? '' : 's'}`,
    winner: i1.battingTeam,
  };
};

export const seriesScore = (series) => {
  const [a, b] = series.teams.map((t) => t.name);
  const wins = { [a]: 0, [b]: 0 };
  let played = 0;
  for (const m of series.matches) {
    if (m.status !== 'completed') continue;
    played += 1;
    if (m.winner && m.winner !== 'tie') wins[m.winner] += 1;
  }
  const needed = Math.floor(series.bestOf / 2) + 1;
  const scoreline = `${wins[a]}–${wins[b]}`;
  let text;
  let decided = false;
  if (wins[a] >= needed || wins[b] >= needed) {
    const champ = wins[a] >= needed ? a : b;
    text = `🏆 ${champ} won the series ${wins[a] >= needed ? scoreline : `${wins[b]}–${wins[a]}`}`;
    decided = true;
  } else if (played >= series.bestOf) {
    if (wins[a] === wins[b]) text = `Series drawn ${scoreline}`;
    else {
      const champ = wins[a] > wins[b] ? a : b;
      text = `🏆 ${champ} won the series ${wins[a] > wins[b] ? scoreline : `${wins[b]}–${wins[a]}`}`;
    }
    decided = true;
  } else if (played === 0) {
    text = `Best of ${series.bestOf} · yet to begin`;
  } else if (wins[a] === wins[b]) {
    text = `Series level ${scoreline}`;
  } else {
    const leader = wins[a] > wins[b] ? a : b;
    text = `${leader} lead ${wins[a] > wins[b] ? scoreline : `${wins[b]}–${wins[a]}`}`;
  }
  return { wins, played, text, decided };
};
