function StatCard({ label, value, accent }) {
  return (
    <article className={`stat-card ${accent}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </article>
  );
}

export default StatCard;
