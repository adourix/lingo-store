"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: number | string;
};

function minorMoney(value: number | string): string {
  const minor = BigInt(value);
  const major = minor / 100n;
  const fraction = (minor % 100n).toString().padStart(2, "0");
  return `${new Intl.NumberFormat("en").format(major)}.${fraction} EGP`;
}

export default function ProductGrid({ products }: { products: Product[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("featured");
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const matches = products.filter((product) =>
      [product.name, product.sku, product.description ?? ""].some((value) =>
        value.toLocaleLowerCase().includes(search),
      ),
    );
    if (sort === "price-low")
      matches.sort((a, b) => {
        const left = BigInt(a.priceMinor);
        const right = BigInt(b.priceMinor);
        return left < right ? -1 : left > right ? 1 : 0;
      });
    if (sort === "price-high")
      matches.sort((a, b) => {
        const left = BigInt(a.priceMinor);
        const right = BigInt(b.priceMinor);
        return left > right ? -1 : left < right ? 1 : 0;
      });
    return matches;
  }, [products, query, sort]);

  return (
    <>
      <div className="filter-bar">
        <input
          aria-label="Search products"
          placeholder="Search products"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <select
          aria-label="Sort products"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="featured">Featured</option>
          <option value="price-low">Price: low to high</option>
          <option value="price-high">Price: high to low</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <section className="card" aria-live="polite">
          <h2>{query ? "No matching products" : "No products yet"}</h2>
          <p className="muted">
            {query
              ? "Try a different product name, SKU, or description."
              : "Published products will appear here."}
          </p>
        </section>
      ) : (
        <div className="grid" aria-live="polite">
          {filtered.map((product) => (
            <Link
              className="card product-card"
              href={"/products/" + encodeURIComponent(product.sku)}
              key={product.id}
            >
              <div className="product-image" aria-hidden="true" />
              <p className="eyebrow">{product.sku}</p>
              <h3>{product.name}</h3>
              {product.description && <p>{product.description}</p>}
              <p className="price">{minorMoney(product.priceMinor)}</p>
              <span className="button primary">View product</span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
