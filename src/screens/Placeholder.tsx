export default function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <main>
      <header className="page-head">
        <h1 className="large-title">{title}</h1>
      </header>
      <section className="card empty">
        <p className="empty-title">Coming soon</p>
        <p className="empty-text">{note}</p>
      </section>
    </main>
  );
}
