"use client";

import { useEffect } from "react";

type Product = {
  id: string;
  name: string;
  sku: string;
  category?: { id: string; name: string } | null;
};

type Category = { id: string; name: string };

function syncCategoryUi(products: Product[], categories: Category[]) {
  const strip = document.querySelector<HTMLElement>(".pos-category-strip");
  const grid = document.querySelector<HTMLElement>(".product-grid");
  if (!strip || !grid) return;

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
        const [productsResponse, categoriesResponse] = await Promise.all([
          fetch("/api/pos/catalog/products", { credentials: "include", cache: "no-store" }),
          fetch("/api/public/categories", { credentials: "omit", cache: "no-store" }),
        ]);
        if (!productsResponse.ok || cancelled) return;

        const products = (await productsResponse.json()) as Product[];
        const publicCategories = categoriesResponse.ok ? ((await categoriesResponse.json()) as unknown) : [];
        const categories = Array.isArray(publicCategories)
          ? publicCategories.filter(
              (category): category is Category =>
                Boolean(category) &&
                typeof category === "object" &&
                typeof (category as { id?: unknown }).id === "string" &&
                typeof (category as { name?: unknown }).name === "string",
            )
          : [];

        if (cancelled || !Array.isArray(products)) return;
        syncCategoryUi(products, categories);
        const grid = document.querySelector(".product-grid");
        if (grid) {
          observer = new MutationObserver(() => syncCategoryUi(products, categories));
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
