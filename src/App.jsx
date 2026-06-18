import { useEffect, useState, useCallback } from 'react';
import SeriesList from './components/SeriesList.jsx';
import NewSeriesForm from './components/NewSeriesForm.jsx';
import SeriesView from './components/SeriesView.jsx';
import ScoringView from './components/ScoringView.jsx';
import './App.css';

async function apiFetch(path, options = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  return res.json();
}

export default function App() {
  const [seriesList, setSeriesList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState('');
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

  // ── Initial load ────────────────────────────────────────────────────────────

  useEffect(() => {
    apiFetch('/series')
      .then((data) => { setSeriesList(data); setLoading(false); })
      .catch((err) => { setApiError(`Cannot reach backend: ${err.message}`); setLoading(false); });
  }, []);

  // ── Series operations ────────────────────────────────────────────────────────

  const addSeries = useCallback(async (series) => {
    try {
      const saved = await apiFetch('/series', {
        method: 'POST',
        body: JSON.stringify(series),
      });
      setSeriesList((list) => [saved, ...list]);
      setView({ name: 'series', seriesId: saved.id });
    } catch (err) {
      alert(`Failed to save series: ${err.message}`);
    }
  }, []);

  // Squad-only update — never touches match/innings data
  const updateSeriesTeams = useCallback(async (seriesId, newTeams) => {
    setSeriesList((list) =>
      list.map((s) => (s.id === seriesId ? { ...s, teams: newTeams } : s))
    );
    try {
      await apiFetch(`/series/${seriesId}`, {
        method: 'PUT',
        body: JSON.stringify({ teams: newTeams }),
      });
    } catch (err) {
      console.error('Squad save failed:', err.message);
    }
  }, []);

  const deleteSeries = useCallback(
    async (id) => {
      if (!confirm('Delete this series and all its matches permanently?')) return;
      setSeriesList((list) => list.filter((s) => s.id !== id));
      if (view.seriesId === id) setView({ name: 'home' });
      try {
        await apiFetch(`/series/${id}`, { method: 'DELETE' });
      } catch (err) {
        console.error('Delete failed:', err.message);
      }
    },
    [view.seriesId]
  );

  // ── Match operations ─────────────────────────────────────────────────────────

  const createMatch = useCallback((seriesId, match) => {
    // Both state updates in one synchronous block so React batches them —
    // activeMatch is guaranteed to be non-null when ScoringView renders.
    setSeriesList((list) =>
      list.map((s) =>
        s.id === seriesId ? { ...s, matches: [...s.matches, match] } : s
      )
    );
    setView({ name: 'match', seriesId, matchId: match.id });
    // Persist to backend (fire-and-forget — optimistic update already applied)
    apiFetch(`/series/${seriesId}/matches`, {
      method: 'POST',
      body: JSON.stringify(match),
    }).catch((err) => console.error('Match create failed:', err.message));
  }, []);

  // Called on every ball — optimistic update keeps the UI instant
  const updateMatch = useCallback(async (seriesId, match) => {
    setSeriesList((list) =>
      list.map((s) =>
        s.id === seriesId
          ? { ...s, matches: s.matches.map((m) => (m.id === match.id ? match : m)) }
          : s
      )
    );
    try {
      await apiFetch(`/series/${seriesId}/matches/${match.id}`, {
        method: 'PUT',
        body: JSON.stringify(match),
      });
    } catch (err) {
      console.error('Match save failed:', err.message);
    }
  }, []);

  const deleteMatch = useCallback(async (seriesId, matchId) => {
    setSeriesList((list) =>
      list.map((s) =>
        s.id === seriesId
          ? { ...s, matches: s.matches.filter((m) => m.id !== matchId) }
          : s
      )
    );
    try {
      await apiFetch(`/series/${seriesId}/matches/${matchId}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Match delete failed:', err.message);
    }
  }, []);

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
        {loading && (
          <div className="panel" style={{ textAlign: 'center', padding: '2rem' }}>
            <p className="muted">Loading…</p>
          </div>
        )}

        {!loading && apiError && (
          <div className="panel" style={{ textAlign: 'center', padding: '2rem' }}>
            <p className="error">{apiError}</p>
            <p className="hint">
              Start the backend first:{' '}
              <code>cd backend &amp;&amp; npm run dev</code>
            </p>
          </div>
        )}

        {!loading && !apiError && view.name === 'home' && (
          <SeriesList
            seriesList={seriesList}
            onOpen={(id) => setView({ name: 'series', seriesId: id })}
            onDelete={deleteSeries}
          />
        )}
        {!loading && !apiError && view.name === 'newSeries' && (
          <NewSeriesForm onCreate={addSeries} onCancel={() => setView({ name: 'home' })} />
        )}
        {!loading && !apiError && view.name === 'series' && activeSeries && (
          <SeriesView
            series={activeSeries}
            onSquadsChange={(teams) => updateSeriesTeams(activeSeries.id, teams)}
            onMatchCreate={(match) => createMatch(activeSeries.id, match)}
            onMatchDelete={(matchId) => deleteMatch(activeSeries.id, matchId)}
            onOpenMatch={(matchId) =>
              setView({ name: 'match', seriesId: activeSeries.id, matchId })
            }
          />
        )}
        {!loading && !apiError && view.name === 'match' && activeMatch && (
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
