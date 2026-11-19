import Panel from '../components/Panel.jsx';
import Badge from '../components/Badge.jsx';
import Empty from '../components/Empty.jsx';
import { when } from '../utils.js';

export default function Notifications({ data }) {
  return <><div className="section-intro"><div><p className="eyebrow">Activity and alerts</p><h2>Notifications</h2><p>Alerts and updates from kiosks and schedules.</p></div></div><Panel title="Recent notifications"><div className="schedule-list">{data.notifications?.length ? [...data.notifications].reverse().map((item) => <article className="notification-item" key={item.id}><div className="schedule-head"><div><strong>{item.title}</strong><small>{item.to} · {when(item.time)}</small></div><Badge>{item.type}</Badge></div><p>{item.message}</p></article>) : <Empty>No notifications yet.</Empty>}</div></Panel></>;
}
