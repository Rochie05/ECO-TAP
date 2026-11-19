import { useEffect, useState } from 'react';
import Panel from '../components/Panel.jsx';
import Empty from '../components/Empty.jsx';
import { api } from '../api.js';
import { fmt } from '../utils.js';

const PERIODS = [['daily', 'Daily', 'Last 14 days'], ['weekly', 'Weekly', 'Last 12 weeks (week starting Monday)'], ['monthly', 'Monthly', 'Last 12 months']];

export default function Analytics({ data }) {
  const [period, setPeriod] = useState('daily');
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  // Reload whenever the portal data refreshes so new deposits show up.
  useEffect(() => {
    let live = true;
    api('/api/analytics').then((next) => { if (live) { setStats(next); setError(''); } }).catch((err) => { if (live) setError(err.message); });
    return () => { live = false; };
  }, [data]);

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!stats) return <p className="muted">Loading analytics…</p>;
  const series = stats.periods[period];
  const max = Math.max(0.1, ...series.map((item) => item.kg));
  const current = series[series.length - 1];
  const sum = series.reduce((acc, item) => ({ kg: acc.kg + item.kg, points: acc.points + item.points, deposits: acc.deposits + item.deposits }), { kg: 0, points: 0, deposits: 0 });
  const label = PERIODS.find(([id]) => id === period);
  const cards = [
    [`Waste in ${label[1].toLowerCase()} view`, `${fmt(sum.kg)} kg`, label[2]],
    ['Latest period', `${fmt(current?.kg)} kg`, current?.key],
    ['Points awarded', fmt(sum.points, 0), `${sum.deposits} deposits in view`],
    ['Received by beneficiaries', `${fmt(stats.beneficiaries.receivedKg)} kg`, `${fmt(stats.beneficiaries.pendingKg)} kg on the way`],
  ];
  return <>
    <div className="section-intro"><div><p className="eyebrow">Monitor waste volume</p><h2>Waste analytics</h2><p>{fmt(stats.totals.kg)} kg collected overall · {stats.totals.deposits} deposits · {stats.totals.residents} residents</p></div>
      <div className="inline-actions flush" role="group" aria-label="Reporting period">{PERIODS.map(([id, name]) => <button key={id} className={`button small ${period === id ? '' : 'outline'}`} aria-pressed={period === id} onClick={() => setPeriod(id)}>{name}</button>)}</div></div>
    <div className="stat-grid">{cards.map(([name, value, caption]) => <article className="stat-card" key={name}><span>{name}</span><strong>{value}</strong><small>{caption}</small></article>)}</div>
    <Panel title={`${label[1]} waste volume (kg)`}>
      {sum.deposits ? <div className="bar-chart" role="img" aria-label={`${label[1]} waste volume in kilograms`}>{series.map((item) => <div className="bar-col" key={item.key} title={`${item.key}: ${fmt(item.kg, 2)} kg · ${item.deposits} deposits`}>
        <span className="bar-value">{item.kg ? fmt(item.kg) : ''}</span><div className="bar-track"><div className="bar-fill" style={{ height: `${(item.kg / max) * 100}%` }} /></div><span className="bar-label">{period === 'monthly' ? item.key.slice(2) : item.key.slice(5)}</span>
      </div>)}</div> : <Empty>No deposits recorded in this period yet.</Empty>}
    </Panel>
    <div className="two-col">
      <Panel title="By waste category">{stats.byCategory.length ? <div className="table-wrap"><table><thead><tr><th>Category</th><th>Deposits</th><th>Weight</th><th>Points</th></tr></thead><tbody>{stats.byCategory.map((c) => <tr key={c.material}><td>{c.name}</td><td>{c.deposits}</td><td>{fmt(c.kg, 2)} kg</td><td>{fmt(c.points, 0)}</td></tr>)}</tbody></table></div> : <Empty>No deposits yet.</Empty>}</Panel>
      <Panel title="Period breakdown"><div className="table-wrap"><table><thead><tr><th>{label[1] === 'Monthly' ? 'Month' : label[1] === 'Weekly' ? 'Week of' : 'Day'}</th><th>Deposits</th><th>Weight</th><th>Points</th></tr></thead><tbody>{[...series].reverse().map((item) => <tr key={item.key}><td>{item.key}</td><td>{item.deposits}</td><td>{fmt(item.kg, 2)} kg</td><td>{fmt(item.points, 0)}</td></tr>)}</tbody></table></div></Panel>
    </div>
  </>;
}
