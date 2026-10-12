"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import CleanProductImage from "../CleanProductImage";
import FavoriteButton from "./FavoriteButton";
import AddToCartButton from "./AddToCartButton";

type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  priceMinor: number | string;
  imageUrl: string | null;
  brand: string | null;
  stock: number | null;
  category: { id: string; name: string; description: string | null } | null;
};

const API = process.env.NEXT_PUBLIC_API_URL || "/api";

function minorMoney(value: number | string): string {
  const minor = BigInt(value);
  const major = minor / 100n;
  const fraction = (minor % 100n).toString().padStart(2, "0");
  return `${new Intl.NumberFormat("en").format(major)}.${fraction} EGP`;
}

function minorNumber(value: number | string): number {
  return Number(BigInt(value));
}

export default function ProductGrid({ products, initialCategory = "" }: { products: Product[]; initialCategory?: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [brand, setBrand] = useState("");
  const [sort, setSort] = useState("featured");
  const [compact, setCompact] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [availability, setAvailability] = useState<"all" | "in-stock" | "out-of-stock">("all");
  const [availabilityOpen, setAvailabilityOpen] = useState(true);

  const priceBounds = useMemo(() => {
    if (!products.length) return { min: 0, max: 0 };
    const values = products.map((product) => minorNumber(product.priceMinor));
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [products]);
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);

  useEffect(() => {
    setMinPrice(priceBounds.min);
    setMaxPrice(priceBounds.max);
  }, [priceBounds.min, priceBounds.max]);

  useEffect(() => {
    let active = true;
    fetch(API + "/account/favorites", { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const body: unknown = await response.json();
        if (!active || !body || typeof body !== "object" || !("productIds" in body) || !Array.isArray(body.productIds)) return;
        setFavoriteIds(new Set(body.productIds.filter((id): id is string => typeof id === "string")));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const categories = useMemo(
    () => [...new Map(products.flatMap((p) => (p.category ? [[p.category.id, p.category]] : []))).values()].sort((a, b) => a.name.localeCompare(b.name)),
    [products],
  );
  const brands = useMemo(
    () => [...new Set(products.map((p) => p.brand).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    const matches = products.filter((product) => {
      const text = [product.name, product.sku, product.description ?? "", product.brand ?? ""];
      const price = minorNumber(product.priceMinor);
      const isInStock = product.stock === null || product.stock > 0;
      return (
        (!search || text.some((value) => value.toLocaleLowerCase().includes(search))) &&
        (!category || product.category?.id === category) &&
        (!brand || product.brand === brand) &&
        (priceBounds.max === 0 || (price >= minPrice && price <= maxPrice)) &&
        (availability === "all" || (availability === "in-stock" ? isInStock : !isInStock))
      );
    });
    if (sort === "price-low") matches.sort((a, b) => Number(BigInt(a.priceMinor) - BigInt(b.priceMinor)));
    if (sort === "price-high") matches.sort((a, b) => Number(BigInt(b.priceMinor) - BigInt(a.priceMinor)));
    return matches;
  }, [products, query, category, brand, sort, minPrice, maxPrice, priceBounds.max, availability]);

  function setFavorite(productId: string, favorite: boolean) {
    setFavoriteIds((current) => {
      const next = new Set(current);
      if (favorite) next.add(productId); else next.delete(productId);
      return next;
    });
  }

  function clearFilters() {
    setQuery("");
    setCategory("");
    setBrand("");
    setAvailability("all");
    setMinPrice(priceBounds.min);
    setMaxPrice(priceBounds.max);
  }

  const hasFilters = Boolean(category || brand || query || availability !== "all" || minPrice !== priceBounds.min || maxPrice !== priceBounds.max);
  const priceRange = Math.max(1, priceBounds.max - priceBounds.min);
  const minPercent = Math.max(0, Math.min(100, ((minPrice - priceBounds.min) / priceRange) * 100));
  const maxPercent = Math.max(0, Math.min(100, ((maxPrice - priceBounds.min) / priceRange) * 100));

  return (
    <div className="catalog-layout">
      <aside className="catalog-sidebar" aria-label="Product filters">
        <div className="catalog-sidebar-head">
          <div><p className="eyebrow">Browse</p><h2>Filters</h2></div>
          {hasFilters && <button type="button" onClick={clearFilters}>Clear all</button>}
        </div>

        <div className="catalog-filter-section">
          <h3>Categories</h3>
          <button className={!category ? "filter-choice active" : "filter-choice"} type="button" onClick={() => setCategory("")}><span>All products</span><b>{products.length}</b></button>
          {categories.map((item) => {
            const count = products.filter((product) => product.category?.id === item.id).length;
            return <button className={category === item.id ? "filter-choice active" : "filter-choice"} key={item.id} type="button" onClick={() => setCategory(item.id)}><span>{item.name}</span><b>{count}</b></button>;
          })}
        </div>

        {brands.length > 0 && <div className="catalog-filter-section">
          <h3>Brand</h3>
          <button className={!brand ? "filter-choice active" : "filter-choice"} type="button" onClick={() => setBrand("")}><span>All brands</span><b>{products.length}</b></button>
          {brands.map((item) => {
            const count = products.filter((product) => product.brand === item).length;
            return <button className={brand === item ? "filter-choice active" : "filter-choice"} key={item} type="button" onClick={() => setBrand(item)}><span>{item}</span><b>{count}</b></button>;
          })}
        </div>}

        {products.length > 0 && <div className="catalog-filter-section shop-price-filter">
          <h3>Price range</h3>
          <div className="shop-price-range">
            <div className="range-track">
              <div className="range-fill" style={{ left: `${minPercent}%`, right: `${100 - maxPercent}%` }} />
              <input aria-label="Minimum price" type="range" min={priceBounds.min} max={priceBounds.max} value={minPrice} onChange={(event) => setMinPrice(Math.min(Number(event.target.value), maxPrice))} />
              <input aria-label="Maximum price" type="range" min={priceBounds.min} max={priceBounds.max} value={maxPrice} onChange={(event) => setMaxPrice(Math.max(Number(event.target.value), minPrice))} />
            </div>
            <div className="shop-price-values">
              <div className="shop-price-value"><span>EGP</span>{Math.round(minPrice / 100).toLocaleString("en")}</div>
              <div className="shop-price-value"><span>EGP</span>{Math.round(maxPrice / 100).toLocaleString("en")}</div>
            </div>
          </div>
        </div>}

        <div className="catalog-filter-section shop-availability-section">
          <button className="shop-availability-toggle" type="button" onClick={() => setAvailabilityOpen((open) => !open)}>Availability</button>
          {availabilityOpen && <div className="shop-availability-options">
            <label><input type="radio" name="availability" checked={availability === "all"} onChange={() => setAvailability("all")} /> All products</label>
            <label><input type="radio" name="availability" checked={availability === "in-stock"} onChange={() => setAvailability("in-stock")} /> In stock</label>
            <label><input type="radio" name="availability" checked={availability === "out-of-stock"} onChange={() => setAvailability("out-of-stock")} /> Out of stock</label>
          </div>}
        </div>
      </aside>

      <div className="catalog-results">
        <div className="filter-bar" role="search">
          <div className="catalog-search-wrap"><span aria-hidden="true">⌕</span><input aria-label="Search products" placeholder="Search products, SKU or brand..." value={query} onChange={(event) => setQuery(event.target.value)} /></div>
          <select aria-label="Sort products" value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="price-low">Price: low to high</option><option value="price-high">Price: high to low</option></select>
          <div className="catalog-view-toggle" aria-label="Product view"><button type="button" className={!compact ? "active" : ""} onClick={() => setCompact(false)} aria-label="Grid view">▦</button><button type="button" className={compact ? "active" : ""} onClick={() => setCompact(true)} aria-label="List view">☷</button></div>
        </div>
        <div className="products-toolbar-meta"><span>{filtered.length} {filtered.length === 1 ? "product" : "products"}</span><span>Showing 1 – {filtered.length} of {filtered.length}</span></div>
        {filtered.length === 0 ? (
          <section className="state-panel" aria-live="polite"><h2>{query || category || brand || availability !== "all" ? "No matching products" : "No products yet"}</h2><p>{query || category || brand || availability !== "all" ? "Try another search or clear the active filters." : "Published products will appear here."}</p></section>
        ) : (
          <div className={compact ? "catalog-product-grid compact" : "catalog-product-grid"} aria-live="polite">
            {filtered.map((product) => (
              <article className="catalog-product-card" key={product.id}>
                <div className="catalog-product-image">
                  <FavoriteButton productId={product.id} favorite={favoriteIds.has(product.id)} onChange={(favorite) => setFavorite(product.id, favorite)} />
                  <Link href={`/products/${encodeURIComponent(product.sku)}`} aria-label={`View ${product.name}`}>
                    {product.imageUrl ? <CleanProductImage src={product.imageUrl} alt={product.name} /> : <span aria-hidden="true">{product.category?.name?.slice(0, 1).toUpperCase() || "L"}</span>}
                  </Link>
                </div>
                <div className="catalog-product-body">
                  <Link className="catalog-product-copy" href={`/products/${encodeURIComponent(product.sku)}`}>
                    <div className="product-meta-row"><span className="eyebrow">{product.category?.name || "Product"}</span>{product.brand && <span className="muted">{product.brand}</span>}</div>
                    <h3>{product.name}</h3>
                    {product.description && <p>{product.description}</p>}
                  </Link>
                  <div className="catalog-product-footer"><strong className="price">{minorMoney(product.priceMinor)}</strong></div>
                  <div className="shop-card-actions">
                    <Link className="button secondary" href={`/products/${encodeURIComponent(product.sku)}`}>View details <span aria-hidden="true">→</span></Link>
                    <AddToCartButton productId={product.id} compact />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
