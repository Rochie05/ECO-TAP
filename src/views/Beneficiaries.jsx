import { useRef, useState } from 'react';
import Panel from '../components/Panel.jsx';
import Badge from '../components/Badge.jsx';
import Empty from '../components/Empty.jsx';
import { api } from '../api.js';
import { fmt, when } from '../utils.js';

// Receive Collected Waste: waste leaves a kiosk bin for a beneficiary, then is confirmed as received.
export default function Beneficiaries({ data, busy, act, canManage }) {
  const [person, setPerson] = useState({ name: '', contact: '', address: '' });
  const [handover, setHandover] = useState({ beneficiaryId: '', bin: '' });
  const handoverRequest = useRef(null);
  const beneficiaries = data.beneficiaries || [];
  const transfers = data.wasteTransfers || [];
  const bins = (data.stations || []).flatMap((s) => Object.entries(s.bins || {}).filter(([, b]) => b.weight > 0)
    .map(([section, b]) => ({ key: `${s.id}|${section}`, station: s.id, section, label: b.label, weight: b.weight })));
  const batches = (data.unshippedBatches || []).map((b) => ({ ...b, key: b.id, batchId: b.id, label: b.material }));
  const chosen = [...bins, ...batches].find((b) => b.key === handover.bin);
  const nameOf = (id) => beneficiaries.find((b) => b.id === id)?.name || id;
  const received = transfers.filter((t) => t.status === 'received').reduce((n, t) => n + t.weight, 0);
  const onTheWay = transfers.filter((t) => t.status !== 'received').reduce((n, t) => n + t.weight, 0);

  const addPerson = async (e) => { e.preventDefault(); if (await act(() => api('/api/beneficiaries', { method: 'POST', body: person }), `Beneficiary “${person.name.trim()}” added.`)) setPerson({ name: '', contact: '', address: '' }); };
  const dispatch = async (e) => {
    e.preventDefault();
    if (!chosen) return;
    const key = `${handover.beneficiaryId}|${chosen.key}`;
    if (handoverRequest.current?.key !== key) handoverRequest.current = { key, id: crypto.randomUUID() };
    const source = chosen.batchId ? { batchId: chosen.batchId } : { station: chosen.station, section: chosen.section };
    const body = { beneficiaryId: handover.beneficiaryId, ...source, idempotencyKey: handoverRequest.current.id };
    if (await act(() => api('/api/waste-transfers', { method: 'POST', body }), 'Batch dispatched. Contributors can see it in Notifications.')) {
      handoverRequest.current = null;
      setHandover({ beneficiaryId: '', bin: '' });
    }
  };
  const receive = (id) => act(() => api(`/api/waste-transfers/${encodeURIComponent(id)}/receive`, { method: 'POST' }), 'Marked as received.');

  return <>
    <div className="section-intro"><div><p className="eyebrow">Receive collected waste</p><h2>Beneficiaries</h2><p>{fmt(received)} kg received · {fmt(onTheWay)} kg on the way</p></div></div>
    {!canManage && <p className="muted">A supervisor or administrator can register beneficiaries and record handovers.</p>}
    <div className="two-col">
      <div className="schedule-list">
        <Panel title="Hand over waste"><form className="stack-form" onSubmit={dispatch}>
          <label>Beneficiary<select required value={handover.beneficiaryId} disabled={!canManage} onChange={(e) => setHandover({ ...handover, beneficiaryId: e.target.value })}><option value="">Choose beneficiary</option>{beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label>Kiosk bin or collected batch<select required value={handover.bin} disabled={!canManage} onChange={(e) => setHandover({ ...handover, bin: e.target.value })}>
            <option value="">Choose material to hand over</option>
            {bins.map((b) => <option key={b.key} value={b.key}>{b.station} · {b.section.toUpperCase()} · {b.label} ({fmt(b.weight)} kg)</option>)}
            {batches.map((b) => <option key={b.key} value={b.key}>{b.id} · {b.label} ({fmt(b.weight)} kg)</option>)}
          </select></label>
          {chosen ? <p className="muted">Measured weight · {fmt(chosen.weight)} kg</p> : null}
          <button className="button" disabled={busy || !canManage || !chosen}>Record handover</button>
        </form></Panel>
        <Panel title="Add beneficiary"><form className="stack-form" onSubmit={addPerson}>
          <label>Name<input required maxLength={100} value={person.name} disabled={!canManage} onChange={(e) => setPerson({ ...person, name: e.target.value })} /></label>
          <label>Contact<input maxLength={100} value={person.contact} disabled={!canManage} onChange={(e) => setPerson({ ...person, contact: e.target.value })} /></label>
          <label>Address<input maxLength={200} value={person.address} disabled={!canManage} onChange={(e) => setPerson({ ...person, address: e.target.value })} /></label>
          <button className="button outline" disabled={busy || !canManage}>Add beneficiary</button>
        </form></Panel>
      </div>
      <Panel title="Handovers"><div className="schedule-list">{transfers.length ? transfers.map((t) => <article className="schedule-item" key={t.id}>
        <div className="schedule-head"><div><strong>{t.batchId || t.id}</strong><small>{fmt(t.weight)} kg · {t.material} · {t.station} {String(t.section).toUpperCase()}</small></div><Badge tone={t.status === 'received' ? 'good' : ''}>{t.product ? 'Converted' : t.status === 'received' ? 'Received' : 'On the way'}</Badge></div>
        <p>{[t.origin || t.station, ...(t.stops || []), nameOf(t.beneficiaryId)].join(' → ')}</p>
        {t.batchId ? <p>{t.contributors} {t.contributors === 1 ? 'contributor' : 'contributors'}{t.product ? ` · Produced ${t.quantity} × ${t.product}` : ''}</p> : null}
        <p>Dispatched {when(t.dispatchedAt)} by {t.staff}{t.receivedAt ? ` · received ${when(t.receivedAt)}` : ''}</p>
        {t.status !== 'received' && canManage && <div className="inline-actions"><button className="button outline small" disabled={busy} onClick={() => receive(t.id)}>Mark received</button></div>}
        {canManage && t.batchId && !t.product ? <BatchUpdate key={t.status} transfer={t} act={act} busy={busy} /> : null}
      </article>) : <Empty>No handovers yet.</Empty>}</div></Panel>
    </div>
  </>;
}

function BatchUpdate({ transfer, act, busy }) {
  const [label, setLabel] = useState('');
  const [quantity, setQuantity] = useState('1');
  const received = transfer.status === 'received';
  const save = async (event) => {
    event.preventDefault();
    const body = received
      ? { kind: 'converted', product: label, quantity: Number(quantity) }
      : { kind: 'checkpoint', location: label };
    if (await act(() => api(`/api/waste-transfers/${encodeURIComponent(transfer.id)}/batch-updates`, { method: 'POST', body }),
      received ? 'Conversion recorded.' : 'Route stop recorded.')) setLabel('');
  };
  return (
    <form className="stack-form" onSubmit={save}>
      <label>{received ? 'Product made' : 'Route stop'}<input required value={label} maxLength={received ? 100 : 150}
        onChange={(event) => setLabel(event.target.value)} placeholder={received ? 'e.g. chair' : 'e.g. sorting facility'} /></label>
      {received ? <label>Quantity<input required type="number" min="1" max="2147483647" step="1"
        value={quantity} onChange={(event) => setQuantity(event.target.value)} /></label> : null}
      <button className="button outline small" disabled={busy || !label.trim()}>{received ? 'Record conversion' : 'Record route stop'}</button>
    </form>
  );
}
