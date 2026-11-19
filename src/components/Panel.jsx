export default function Panel({ title, action, children, className = '' }) {
  return <section className={`panel ${className}`}>
    {(title || action) && <div className="panel-head">{title && <h2>{title}</h2>}{action}</div>}
    {children}
  </section>;
}
