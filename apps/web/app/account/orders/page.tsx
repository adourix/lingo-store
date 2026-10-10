"use client";
import { useEffect, useState } from "react";
const API = process.env.NEXT_PUBLIC_API_URL || "/api";
type Order = {
  id: string;
  invoiceNo: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  totalMinor: number | string;
  createdAt: string;
  items: Array<{ productName: string; quantity: number | string; totalMinor: number | string }>;
};
const money = (value: string | number) => {
  const minor = BigInt(value);
  return `${new Intl.NumberFormat("en").format(minor / 100n)}.${(minor % 100n).toString().padStart(2, "0")} EGP`;
};
export default function OrdersPage() {
  const [data, setData] = useState<Order[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    fetch(API + "/account/orders", { credentials: "include" })
      .then(async (r) => {
        if (r.status === 401) {
          location.href = "/login";
          return;
        }
        if (!r.ok) throw new Error();
        setData(await r.json());
      })
      .catch(() => setError("Orders are not available yet."));
  }, []);
  return (
    <main className="container section">
      <a className="brand" href="/account">
        Lingo Store
      </a>
      <h1>My orders</h1>
      {error ? (
        <p className="error">{error}</p>
      ) : data.length === 0 ? (
        <section className="card">
          <p className="muted">No orders yet.</p>
        </section>
      ) : (
        <div className="grid">
          {data.map((x) => (
            <article className="card" key={x.id}>
              <h2>{x.invoiceNo}</h2>
              <p>Order status: {x.status.replaceAll("_", " ")}</p>
              <p>Payment: Cash on delivery · {x.paymentStatus}</p>
              <time dateTime={x.createdAt}>{new Date(x.createdAt).toLocaleDateString()}</time>
              <ul>
                {x.items.map((item, index) => (
                  <li key={`${x.id}-${index}`}>
                    {item.productName} · {item.quantity} · {money(item.totalMinor)}
                  </li>
                ))}
              </ul>
              <p className="price">{money(x.totalMinor)}</p>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
