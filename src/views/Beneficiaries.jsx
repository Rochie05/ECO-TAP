import { useState } from 'react';
import Panel from '../components/Panel.jsx';
import Badge from '../components/Badge.jsx';
import Empty from '../components/Empty.jsx';
import { api } from '../api.js';
import { fmt, when } from '../utils.js';

// Receive Collected Waste: waste leaves a kiosk bin for a beneficiary, then is confirmed as received.
export default function Beneficiaries({ data, busy, act, canManage }) {
  const [person, setPerson] = useState({ name: '', contact: '', address: '' });
  const [handover, setHandover] = useState({ beneficiaryId: '', bin: '' });
  const beneficiaries = data.beneficiaries || [];
  const transfers = data.wasteTransfers || [];
  const bins = (data.stations || []).flatMap((s) => Object.entries(s.bins || {}).filter(([, b]) => b.weight > 0).map(([section, b]) => ({ key: `${s.id}|${section}`, station: s.id, section, label: b.label, weight: b.weight })));
  const chosen = bins.find((b) => b.key === handover.bin);
  const nameOf = (id) => beneficiaries.find((b) => b.id === id)?.name || id;
  const received = transfers.filter((t) => t.status === 'received').reduce((n, t) => n + t.weight, 0);
  const onTheWay = transfers.filter((t) => t.status !== 'received').reduce((n, t) => n + t.weight, 0);

  const addPerson = async (e) => { e.preventDefault(); if (await act(() => api('/api/beneficiaries', { method: 'POST', body: person }), `Beneficiary “${person.name.trim()}” added.`)) setPerson({ name: '', contact: '', address: '' }); };
  const dispatch = async (e) => {
    e.preventDefault();
    const body = { beneficiaryId: handover.beneficiaryId, station: chosen.station, section: chosen.section, idempotencyKey: crypto.randomUUID() };
    if (await act(() => api('/api/waste-transfers', { method: 'POST', body }), 'Waste dispatched to beneficiary.')) setHandover({ beneficiaryId: '', bin: '' });
  };
  const receive = (id) => act(() => api(`/api/waste-transfers/${encodeURIComponent(id)}/receive`, { method: 'POST' }), 'Marked as received.');

  return <>
    <div className="section-intro"><div><p className="eyebrow">Receive collected waste</p><h2>Beneficiaries</h2><p>{fmt(received)} kg received · {fmt(onTheWay)} kg on the way</p></div></div>
    {!canManage && <p className="muted">A supervisor or administrator can register beneficiaries and record handovers.</p>}
    <div className="two-col">
      <div className="schedule-list">
        <Panel title="Hand over waste"><form className="stack-form" onSubmit={dispatch}>
          <label>Beneficiary<select required value={handover.beneficiaryId} disabled={!canManage} onChange={(e) => setHandover({ ...handover, beneficiaryId: e.target.value })}><option value="">Choose beneficiary</option>{beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
          <label>Kiosk bin<select required value={handover.bin} disabled={!canManage} onChange={(e) => setHandover({ ...handover, bin: e.target.value })}><option value="">Choose a bin with waste</option>{bins.map((b) => <option key={b.key} value={b.key}>{b.station} · {b.section.toUpperCase()} · {b.label} ({fmt(b.weight)} kg)</option>)}</select></label>
          <p className="muted">{chosen ? `The full measured contents (${fmt(chosen.weight)} kg, from the bin's load cell) will be handed over.` : 'Weight is taken from the bin\'s load cell. It cannot be typed in.'}</p>
          <button className="button" disabled={busy || !canManage}>Record handover</button>
        </form></Panel>
        <Panel title="Add beneficiary"><form className="stack-form" onSubmit={addPerson}>
          <label>Name<input required maxLength={100} value={person.name} disabled={!canManage} onChange={(e) => setPerson({ ...person, name: e.target.value })} /></label>
          <label>Contact<input maxLength={100} value={person.contact} disabled={!canManage} onChange={(e) => setPerson({ ...person, contact: e.target.value })} /></label>
          <label>Address<input maxLength={200} value={person.address} disabled={!canManage} onChange={(e) => setPerson({ ...person, address: e.target.value })} /></label>
          <button className="button outline" disabled={busy || !canManage}>Add beneficiary</button>
        </form></Panel>
      </div>
      <Panel title="Handovers"><div className="schedule-list">{transfers.length ? transfers.map((t) => <article className="schedule-item" key={t.id}>
        <div className="schedule-head"><div><strong>{nameOf(t.beneficiaryId)}</strong><small>{t.id} · {fmt(t.weight)} kg · {t.material} · {t.station} {String(t.section).toUpperCase()}</small></div><Badge tone={t.status === 'received' ? 'good' : ''}>{t.status === 'received' ? 'Received' : 'On the way'}</Badge></div>
        <p>Dispatched {when(t.dispatchedAt)} by {t.staff}{t.receivedAt ? ` · received ${when(t.receivedAt)}` : ''}</p>
        {t.status !== 'received' && canManage && <div className="inline-actions"><button className="button outline small" disabled={busy} onClick={() => receive(t.id)}>Mark received</button></div>}
      </article>) : <Empty>No handovers yet.</Empty>}</div></Panel>
    </div>
  </>;
}
