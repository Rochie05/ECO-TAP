import { useState } from 'react';
import Panel from '../components/Panel.jsx';
import Badge from '../components/Badge.jsx';
import Empty from '../components/Empty.jsx';
import { api } from '../api.js';
import { fmt, when } from '../utils.js';

export default function Rewards({ data, busy, act }) {
  const [residentId, setResidentId] = useState('');
  const [cart, setCart] = useState({});
  const resident = data.residents?.find((r) => r.id === residentId);
  const cost = Object.entries(cart).reduce((sum, [id, qty]) => sum + Number(data.rewardItems?.find((x) => x.id === id)?.cost || 0) * qty, 0);
  const add = (id, delta) => setCart((old) => ({ ...old, [id]: Math.max(0, Number(old[id] || 0) + delta) }));
  const submit = () => act(() => api('/api/redemptions', { method: 'POST', body: { residentId, items: Object.entries(cart).filter(([, qty]) => qty > 0).map(([id, qty]) => ({ id, qty })), idempotencyKey: crypto.randomUUID() } }), 'Reward redemption recorded.');
  const fulfill = (id) => act(() => api(`/api/redemptions/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status: 'fulfilled' } }), 'Redemption marked fulfilled.');
  return <>
    <div className="section-intro"><div><p className="eyebrow">Resident points desk</p><h2>Rewards</h2><p>Look up a resident, select rewards, and record a redemption.</p></div></div>
    <div className="two-col rewards-layout">
      <Panel title="New redemption"><div className="stack-form"><label>Resident<select value={residentId} onChange={(e) => { setResidentId(e.target.value); setCart({}); }}><option value="">Choose resident ID</option>{data.residents?.map((r) => <option key={r.id} value={r.id}>{r.id} · {r.name}</option>)}</select></label>
        {resident ? <div className="points-card"><span>{resident.name} · {resident.id}</span><strong>{fmt(resident.points, 0)} points</strong></div> : <p className="muted">Choose a resident to view their available points.</p>}
        <div className="reward-list">{data.rewardItems?.map((item) => <div className="reward-row" key={item.id}><div><strong>{item.name}</strong><small>{item.cost} points</small></div><div className="stepper"><button aria-label={`Remove one ${item.name}`} disabled={!cart[item.id]} onClick={() => add(item.id, -1)}>−</button><span>{cart[item.id] || 0}</span><button aria-label={`Add one ${item.name}`} onClick={() => add(item.id, 1)}>+</button></div></div>)}</div>
        <div className="checkout-row"><span>Total</span><strong>{cost} points</strong></div><button className="button full" disabled={!resident || !cost || cost > Number(resident?.points || 0) || busy} onClick={submit}>Record redemption</button>
      </div></Panel>
      <Panel title="Redemption history"><div className="schedule-list">{data.redemptions?.length ? data.redemptions.map((item) => <article className="schedule-item" key={item.id}><div className="schedule-head"><div><strong>{item.id}</strong><small>{item.resident} · {item.items} · {item.points} points</small></div><Badge tone={item.status === 'fulfilled' ? 'good' : ''}>{item.status}</Badge></div><p>{when(item.time)} · {item.staff}</p>{item.status === 'pending' && <button className="button small" disabled={busy} onClick={() => fulfill(item.id)}>Mark fulfilled</button>}</article>) : <Empty>No redemptions yet.</Empty>}</div></Panel>
      <Panel title="Reward point conversion"><p className="muted">Points a resident earns for each kilogram deposited at a kiosk.</p>
        <div className="table-wrap"><table><thead><tr><th>Category</th><th>Bin</th><th>Points per kg</th></tr></thead><tbody>{data.wasteCategories?.length ? data.wasteCategories.map((c) => <tr key={c.id}><td>{c.name}</td><td>{String(c.section).toUpperCase()}</td><td>{c.pointsPerKg}</td></tr>) : <tr><td colSpan="3">No categories set.</td></tr>}</tbody></table></div>
      </Panel>
    </div>
  </>;
}
