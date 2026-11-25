import Panel from '../components/Panel.jsx';
import LogTable from '../components/LogTable.jsx';
import { fmt } from '../utils.js';

export default function Dashboard({ data, setView }) {
  const stats = data.stats || {};
  const cards = [
    ['Active kiosks', stats.kiosks ?? data.stations?.length ?? 0, 'stations reporting'],
    ['Deposits today', stats.depositsToday ?? data.logs?.length ?? 0, 'recorded today'],
    ['Plastic collected', `${fmt(stats.totalWeight ?? data.logs?.reduce((n, x) => n + Number(x.weight || 0), 0))} kg`, 'across all kiosks'],
    ['Bins at capacity', stats.fullBins ?? data.stations?.flatMap((s) => Object.values(s.bins || {})).filter((b) => b.capacity >= 100).length ?? 0, 'need collection'],
  ];
  const recent = [...(data.logs || [])].slice(0, 5);
  const bins = data.stations?.flatMap((station) => Object.entries(station.bins || {}).map(([key, bin]) => ({ station, key, bin }))) || [];
  return <>
    <div className="welcome-row"><div><p className="eyebrow">Welcome back, {data.user?.name || 'team'}</p><h2>Today at a glance</h2><p>Monitor collection activity and manage the next steps.</p></div><button className="button secondary" onClick={() => setView('bins')}>View kiosks <span aria-hidden="true">→</span></button></div>
    <div className="stat-grid">{cards.map(([label, value, caption]) => <article className="stat-card" key={label}><span>{label}</span><strong>{value}</strong><small>{caption}</small></article>)}</div>
    <div className="two-col">
      <Panel title="Kiosk capacity">
        {bins.slice(0, 6).map(({ station, key, bin }) => <div className="capacity-row" key={`${station.id}-${key}`}><div className="capacity-copy"><strong>{station.id} · {key.toUpperCase()}</strong><span>{bin.label}</span></div><div className="capacity-meter" role="progressbar" aria-label={`${station.id} ${key} capacity`} aria-valuenow={bin.capacity} aria-valuemin="0" aria-valuemax="100"><span style={{ width: `${Math.min(100, bin.capacity)}%` }} /></div><span className="capacity-value">{bin.capacity}%</span></div>)}
      </Panel>
      <Panel title="Quick actions"><div className="quick-links">
        {[["beneficiaries", "Record a handover", "Dispatch or track a collection batch"], ["rewards", "Redeem rewards", "Process resident points"], ["notifications", "Review alerts", "Check kiosk updates"]].map(([id, label, sub]) => <button key={id} className="quick-link" onClick={() => setView(id)}><span><strong>{label}</strong><small>{sub}</small></span><span aria-hidden="true">→</span></button>)}
      </div></Panel>
    </div>
    <Panel title="Recent deposits" action={<button className="text-button" onClick={() => setView('logs')}>View logs →</button>}><LogTable logs={recent} /></Panel>
  </>;
}
