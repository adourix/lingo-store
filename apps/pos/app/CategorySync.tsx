"use client";

import { useEffect } from "react";

type Product = {
  id: string;
  name: string;
  sku: string;
  stock: string | number;
  category?: { id: string; name: string } | null;
  imageUrl?: string | null;
};
type Category = { id: string; name: string };

function syncCategoryUi(products: Product[]) {
  const strip = document.querySelector<HTMLElement>(".pos-category-strip");
  const grid = document.querySelector<HTMLElement>(".product-grid");
  if (!strip || !grid) return;

  const categories = Array.from(
    new Map(products.filter((product) => Number(product.stock) > 0 && product.category).map((product) => [product.category!.id, product.category!])).values(),
  ) as Category[];
  const buttons = [{ id: "__all__", name: "All" }, ...categories].map((category, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = category.name;
    button.dataset.categoryId = category.id;
    button.className = index === 0 ? "active" : "";
    return button;
  });
  strip.replaceChildren(...buttons);

  const tiles = () => Array.from(grid.querySelectorAll<HTMLButtonElement>(".product-tile"));
  const productForTile = (tile: HTMLButtonElement) => {
    const name = tile.querySelector<HTMLElement>(".product-name")?.textContent?.trim() || "";
    const sku = Array.from(tile.querySelectorAll("span")).map((element) => element.textContent?.trim() || "").find((value) => value && value !== name) || "";
    return products.find((product) => product.name === name && product.sku === sku) || products.find((product) => product.name === name);
  };
  const apply = (categoryId: string) => {
    for (const tile of tiles()) {
      const product = productForTile(tile);
      tile.hidden = Number(product?.stock ?? 0) <= 0 || (categoryId !== "__all__" && product?.category?.id !== categoryId);
      const image = tile.querySelector<HTMLImageElement>(".product-image");
      if (image && product?.imageUrl) {
        image.src = product.imageUrl;
        image.style.display = "block";
      }
    }
  };
  buttons.forEach((button) => button.addEventListener("click", () => {
    buttons.forEach((item) => item.classList.toggle("active", item === button));
    apply(button.dataset.categoryId || "__all__");
  }));
  apply("__all__");
}

export default function CategorySync() {
  useEffect(() => {
    let cancelled = false;
    let applying = false;
    let products: Product[] = [];

    const run = () => {
      if (cancelled || applying || !products.length) return;
      const strip = document.querySelector(".pos-category-strip");
      const grid = document.querySelector(".product-grid");
      if (!strip || !grid) return;
      applying = true;
      try { syncCategoryUi(products); } finally { window.queueMicrotask(() => { applying = false; }); }
    };

    const observer = new MutationObserver(run);
    observer.observe(document.body, { childList: true, subtree: true });

    const load = async () => {
      try {
        const response = await fetch("/api/pos/catalog/products", { credentials: "include", cache: "no-store" });
        if (!response.ok || cancelled) return;
        const body = (await response.json()) as unknown;
        if (!Array.isArray(body)) return;
        products = body as Product[];
        run();
      } catch {}
    };
    void load();

    return () => { cancelled = true; observer.disconnect(); };
  }, []);
  return null;
}
