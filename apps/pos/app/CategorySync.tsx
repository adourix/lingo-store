"use client";

import { useEffect } from "react";

type Product = {
  id: string;
  name: string;
  sku: string;
  category?: { id: string; name: string } | null;
};

function syncCategoryUi(products: Product[]) {
  const strip = document.querySelector<HTMLElement>(".pos-category-strip");
  const grid = document.querySelector<HTMLElement>(".product-grid");
  if (!strip || !grid) return;

  const categories = Array.from(
    new Map(
      products
        .map((product) => product.category)
        .filter((category): category is { id: string; name: string } => Boolean(category?.id && category.name.trim())),
    ).values(),
  );

  strip.replaceChildren();
  const buttons = [
    { id: "__all__", name: "All" },
    ...categories,
  ].map((category, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = category.name;
    button.dataset.categoryId = category.id;
    button.className = index === 0 ? "active" : "";
    return button;
  });
  buttons.forEach((button) => strip.appendChild(button));

  const tiles = () => Array.from(grid.querySelectorAll<HTMLButtonElement>(".product-tile"));
  const productForTile = (tile: HTMLButtonElement) => {
    const name = tile.querySelector<HTMLElement>(".product-name")?.textContent?.trim() || "";
    const values = Array.from(tile.querySelectorAll("span")).map((element) => element.textContent?.trim() || "");
    const sku = values.find((value) => value && value !== name) || "";
    return products.find((product) => product.name === name && product.sku === sku) || products.find((product) => product.name === name);
  };

  const apply = (categoryId: string) => {
    for (const tile of tiles()) {
      const product = productForTile(tile);
      const visible = categoryId === "__all__" || product?.category?.id === categoryId;
      tile.hidden = !visible;
    }
  };

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      buttons.forEach((item) => item.classList.toggle("active", item === button));
      apply(button.dataset.categoryId || "__all__");
    });
  });

  apply("__all__");
}

export default function CategorySync() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;

    const load = async () => {
      try {
        const response = await fetch("/api/pos/catalog/products", { credentials: "include", cache: "no-store" });
        if (!response.ok || cancelled) return;
        const products = (await response.json()) as Product[];
        if (cancelled || !Array.isArray(products)) return;
        syncCategoryUi(products);
        const grid = document.querySelector(".product-grid");
        if (grid) {
          observer = new MutationObserver(() => syncCategoryUi(products));
          observer.observe(grid, { childList: true });
        }
      } catch {
        // The POS screen owns its normal catalog error handling.
      }
    };

    void load();
    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}
