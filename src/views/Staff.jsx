import Badge from '../components/Badge.jsx';

export default function Staff({ data, onManageAccounts }) {
  return <><div className="section-intro"><div><p className="eyebrow">Team directory</p><h2>Staff</h2><p>Team members and their kiosk assignments.</p></div>{onManageAccounts ? <button className="button outline" onClick={onManageAccounts}>Manage account assignments</button> : null}</div><div className="staff-grid">{data.staff?.map((person) => <article className="panel staff-card" key={person.id}><div className="avatar">{person.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><h3>{person.name}</h3><Badge>{person.role}</Badge></div><p>Assigned kiosks</p><strong>{person.assignedKiosks?.join(', ')}</strong><small>{person.contact}</small></article>)}</div></>;
}
