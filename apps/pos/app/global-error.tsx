"use client";

export const dynamic = "force-static";

export default function GlobalError() {
  return (
    <html lang="en" dir="ltr">
      <body>
        <main className="pos-center">
          <div className="pos-card">
            <h1>500</h1>
            <p>Something went wrong.</p>
            <a href="/">Return to POS</a>
          </div>
        </main>
      </body>
    </html>
  );
}
