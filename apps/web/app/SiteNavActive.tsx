"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

function activeKey(pathname: string): string {
  if (pathname === "/") return "/";
  if (pathname === "/categories" || pathname.startsWith("/categories/")) return "/categories";
  if (pathname === "/products" || pathname.startsWith("/products/")) return "/products";
  if (pathname === "/about" || pathname.startsWith("/about/")) return "/about";
  if (pathname === "/contact" || pathname.startsWith("/contact/")) return "/contact";
  return "";
}

export default function SiteNavActive() {
  const pathname = usePathname();

  useEffect(() => {
    const navs = Array.from(document.querySelectorAll<HTMLElement>("header.site-header .nav"));
    if (!navs.length) return;

    const key = activeKey(pathname);
    navs.forEach((nav) => {
      const links = Array.from(nav.querySelectorAll<HTMLAnchorElement>("a"));
      links.forEach((link) => {
        const label = link.textContent?.trim().toLowerCase() || "";
        if (label === "categories") link.setAttribute("href", "/categories");

        let active = false;
        if (label === "home") active = key === "/";
        else if (label === "shop") active = key === "/products";
        else if (label === "categories") active = key === "/categories";
        else if (label === "about") active = key === "/about";
        else if (label === "support") active = key === "/contact";

        if (active) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
    });
  }, [pathname]);

  return null;
}
