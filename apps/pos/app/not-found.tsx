export const dynamic = "force-static";

export default function NotFound() {
  return (
    <main className="pos-center">
      <div className="pos-card">
        <h1>404</h1>
        <p>Page not found.</p>
        <a href="/">Return to POS</a>
      </div>
    </main>
  );
}
