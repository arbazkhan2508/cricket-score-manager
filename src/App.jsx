import { useEffect, useState } from 'react';
import SeriesList from './components/SeriesList.jsx';
import NewSeriesForm from './components/NewSeriesForm.jsx';
import SeriesView from './components/SeriesView.jsx';
import ScoringView from './components/ScoringView.jsx';
import './App.css';

const STORAGE_KEY = 'cricket-series-portal';

function loadSeries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? [];
  } catch {
    return [];
  }
}

export default function App() {
  const [seriesList, setSeriesList] = useState(loadSeries);
  // home | newSeries | series | match
  const [view, setView] = useState({ name: 'home' });

  const activeSeries =
    view.name === 'series' || view.name === 'match'
      ? seriesList.find((s) => s.id === view.seriesId)
      : null;
  const activeMatch =
    view.name === 'match' && activeSeries
      ? activeSeries.matches.find((m) => m.id === view.matchId)
      : null;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seriesList));
  }, [seriesList]);

  const addSeries = (series) => {
    setSeriesList((list) => [series, ...list]);
    setView({ name: 'series', seriesId: series.id });
  };

  const updateSeries = (updated) => {
    setSeriesList((list) => list.map((s) => (s.id === updated.id ? updated : s)));
  };

  const deleteSeries = (id) => {
    if (!confirm('Delete this series and all its matches permanently?')) return;
    setSeriesList((list) => list.filter((s) => s.id !== id));
    if (view.seriesId === id) setView({ name: 'home' });
  };

  const updateMatch = (seriesId, match) => {
    setSeriesList((list) =>
      list.map((s) =>
        s.id === seriesId
          ? { ...s, matches: s.matches.map((m) => (m.id === match.id ? match : m)) }
          : s
      )
    );
  };

  const back = () => {
    if (view.name === 'match') setView({ name: 'series', seriesId: view.seriesId });
    else setView({ name: 'home' });
  };

  return (
    <div className="app">
      <header className="topbar">
        <h1 onClick={() => setView({ name: 'home' })}>🏏 Turf Series Portal</h1>
        {view.name === 'home' ? (
          <button className="btn primary" onClick={() => setView({ name: 'newSeries' })}>
            + New Series
          </button>
        ) : (
          <button className="btn" onClick={back}>
            ← {view.name === 'match' ? 'Series' : 'All Series'}
          </button>
        )}
      </header>

      <main>
        {view.name === 'home' && (
          <SeriesList
            seriesList={seriesList}
            onOpen={(id) => setView({ name: 'series', seriesId: id })}
            onDelete={deleteSeries}
          />
        )}
        {view.name === 'newSeries' && (
          <NewSeriesForm onCreate={addSeries} onCancel={() => setView({ name: 'home' })} />
        )}
        {view.name === 'series' && activeSeries && (
          <SeriesView
            series={activeSeries}
            onChange={updateSeries}
            onOpenMatch={(matchId) =>
              setView({ name: 'match', seriesId: activeSeries.id, matchId })
            }
          />
        )}
        {view.name === 'match' && activeMatch && (
          <ScoringView
            match={activeMatch}
            series={activeSeries}
            onChange={(m) => updateMatch(activeSeries.id, m)}
          />
        )}
      </main>
    </div>
  );
}
