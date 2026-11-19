import Panel from '../components/Panel.jsx';
import Badge from '../components/Badge.jsx';
import { api } from '../api.js';
import { fmt } from '../utils.js';

export default function Bins({ data, busy, act, canManage }) {
  const stations = data.stations || [];
  const scan = () => act(() => api('/api/scan-bins', { method: 'POST', body: { scanId: crypto.randomUUID() } }), 'Bin scan complete.');
  return <>
    <div className="section-intro"><div><p className="eyebrow">Collection network</p><h2>Segregation kiosks</h2><p>Fill levels refresh when you scan the bins.</p></div>{canManage && <button className="button" disabled={busy} onClick={scan}>{busy ? 'Scanning…' : 'Scan bins now'}</button>}</div>
    {!canManage && <p className="muted">A supervisor or administrator can run a bin scan.</p>}
    <div className="station-grid">{stations.map((station) => <Panel key={station.id} title={<>{station.id}<span className="station-location">{station.location}</span></>} action={<Badge tone="good">{station.status}</Badge>}><div className="bin-list">{Object.entries(station.bins || {}).map(([key, bin]) => <div className="bin-row" key={key}><div className="bin-row-head"><div><strong>{key.toUpperCase()} · {bin.grindable ? 'Grindable' : 'Mixed materials'}</strong><small>{bin.label}</small></div><Badge tone={bin.capacity >= 100 ? 'alert' : ''}>{bin.capacity}%</Badge></div><div className="capacity-meter large"><span style={{ width: `${Math.min(100, bin.capacity)}%` }} /></div><div className="bin-meta"><span>{fmt(bin.weight)} kg collected</span><span>{bin.grindable ? bin.grindingStatus : 'Not grindable'}</span></div></div>)}</div><div className="panel-foot">{station.depositsToday} deposits today <span>Last update: {station.lastSync}</span></div></Panel>)}</div>
  </>;
}
