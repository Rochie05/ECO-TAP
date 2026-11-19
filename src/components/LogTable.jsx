import Empty from './Empty.jsx';
import { fmt, when } from '../utils.js';

export default function LogTable({ logs }) {
  if (!logs?.length) return <Empty>No deposits match this view.</Empty>;
  return <div className="table-wrap"><table><thead><tr><th>Resident</th><th>Kiosk</th><th>Section</th><th>Material</th><th>Weight</th><th>Points</th><th>Time</th></tr></thead><tbody>{logs.map((log) => <tr key={log.id}><td>{log.resident}</td><td>{log.kiosk}</td><td>{String(log.section).toUpperCase()}</td><td>{log.material}</td><td>{fmt(log.weight)} kg</td><td>{log.points}</td><td>{when(log.time)}</td></tr>)}</tbody></table></div>;
}
