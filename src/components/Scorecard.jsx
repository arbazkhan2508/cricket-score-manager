import {
  oversText,
  strikeRate,
  economy,
  totalExtras,
  squadOf,
} from '../utils/cricket.js';

function InningsCard({ inn, index, isCurrent, match }) {
  const batted = new Set(inn.batsmen.map((b) => b.name));
  const yetToBat = squadOf(match, inn.battingTeam).filter((n) => !batted.has(n));
  return (
    <div className="panel innings-card">
      <div className="innings-head">
        <h3>
          {index + 1}
          {index === 0 ? 'st' : 'nd'} Innings — {inn.battingTeam}
        </h3>
        <span className="innings-total">
          {inn.runs}/{inn.wickets} ({oversText(inn.balls)} ov)
        </span>
      </div>

      <table>
        <thead>
          <tr>
            <th className="left">Batsman</th>
            <th className="left">Status</th>
            <th>R</th>
            <th>B</th>
            <th>4s</th>
            <th>6s</th>
            <th>SR</th>
          </tr>
        </thead>
        <tbody>
          {inn.batsmen.length === 0 && (
            <tr>
              <td colSpan="7" className="muted left">
                Yet to bat
              </td>
            </tr>
          )}
          {inn.batsmen.map((b, i) => {
            return (
              <tr key={i}>
                <td className="left">
                  {b.name}
                  {isCurrent && i === inn.strikerIdx && !b.out ? ' *' : ''}
                </td>
                <td className="left muted">{b.out ? b.outDesc : 'not out'}</td>
                <td>
                  <strong>{b.runs}</strong>
                </td>
                <td>{b.balls}</td>
                <td>{b.fours}</td>
                <td>{b.sixes}</td>
                <td>{strikeRate(b.runs, b.balls)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          {yetToBat.length > 0 && (
            <tr>
              <td className="left muted" colSpan="7">
                {isCurrent ? 'Yet to bat' : 'Did not bat'}: {yetToBat.join(', ')}
              </td>
            </tr>
          )}
          <tr>
            <td className="left" colSpan="2">
              Extras (wd {inn.extras.wides}, nb {inn.extras.noballs}, b {inn.extras.byes},
              lb {inn.extras.legbyes})
            </td>
            <td>
              <strong>{totalExtras(inn.extras)}</strong>
            </td>
            <td colSpan="4"></td>
          </tr>
          <tr>
            <td className="left" colSpan="2">
              <strong>Total</strong>
            </td>
            <td colSpan="5" className="left">
              <strong>
                {inn.runs}/{inn.wickets}
              </strong>{' '}
              in {oversText(inn.balls)} of {match.overs} overs
            </td>
          </tr>
        </tfoot>
      </table>

      {inn.bowlers.length > 0 && (
        <table>
          <thead>
            <tr>
              <th className="left">Bowler</th>
              <th>O</th>
              <th>R</th>
              <th>W</th>
              <th>Econ</th>
            </tr>
          </thead>
          <tbody>
            {inn.bowlers.map((b, i) => (
              <tr key={i}>
                <td className="left">{b.name}</td>
                <td>{oversText(b.balls)}</td>
                <td>{b.runs}</td>
                <td>
                  <strong>{b.wickets}</strong>
                </td>
                <td>{economy(b.runs, b.balls)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function Scorecard({ match }) {
  return (
    <div className="scorecard">
      {match.result && (
        <div className="panel result-panel">
          <strong>{match.result}</strong>
        </div>
      )}
      {match.toss && (
        <p className="toss-line muted">
          Match {match.matchNo} · Toss: {match.toss.winner} chose to {match.toss.decision}{' '}
          first
        </p>
      )}
      {match.innings.map((inn, i) => (
        <InningsCard
          key={i}
          inn={inn}
          index={i}
          isCurrent={i === match.currentInnings && match.status === 'live'}
          match={match}
        />
      ))}
    </div>
  );
}
