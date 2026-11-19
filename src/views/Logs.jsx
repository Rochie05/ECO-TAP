import { useMemo, useState } from 'react';
import Panel from '../components/Panel.jsx';
import LogTable from '../components/LogTable.jsx';
import { fmt } from '../utils.js';

export default function Logs({ data }) {
  const [query, setQuery] = useState('');
  const logs = useMemo(() => (data.logs || []).filter((row) => Object.values(row).join(' ').toLowerCase().includes(query.toLowerCase())), [data.logs, query]);
  const total = logs.reduce((n, item) => n + Number(item.weight || 0), 0);
  return <><div className="section-intro"><div><p className="eyebrow">Deposit history</p><h2>Collection logs</h2><p>{logs.length} deposits · {fmt(total)} kg in the current list</p></div><label className="search-field"><span className="sr-only">Search collection logs</span><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search logs" /></label></div><Panel title="Deposits"><LogTable logs={logs} /></Panel></>;
}
