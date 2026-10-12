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

function setStyle(element: HTMLElement, property: string, value: string): void {
  element.style.setProperty(property, value, "important");
}

function applyHeroLayout(): void {
  const stage = document.querySelector<HTMLElement>(".hero-stage");
  if (!stage) return;

  setStyle(stage, "position", "relative");
  setStyle(stage, "width", "100%");
  setStyle(stage, "height", "600px");
  setStyle(stage, "min-height", "600px");
  setStyle(stage, "overflow", "visible");
  setStyle(stage, "background", "radial-gradient(circle at 72% 48%, rgba(224,228,255,.82) 0 18%, rgba(238,241,255,.55) 19% 34%, transparent 35%), radial-gradient(circle at 81% 12%, rgba(255,167,78,.9) 0 8%, transparent 8.5%), radial-gradient(circle at 50% 58%, rgba(245,247,255,.9), transparent 60%)");

  const stack = document.querySelector<HTMLElement>(".hero-product-stack");
  if (stack) {
    setStyle(stack, "position", "absolute");
    setStyle(stack, "inset", "0");
    setStyle(stack, "z-index", "5");
  }

  const cards = Array.from(document.querySelectorAll<HTMLElement>(".hero-featured-product"));
  const desktop = window.innerWidth > 1050;
  const tablet = window.innerWidth > 700 && window.innerWidth <= 1050;
  const mobile = window.innerWidth <= 700;
  const compact = window.innerWidth <= 480;

  const positions = desktop
    ? [
        { left: "32%", top: "18%", width: "300px", height: "455px", rows: "340px auto", rotate: "3deg", z: "12" },
        { left: "0%", top: "27%", width: "220px", height: "330px", rows: "245px auto", rotate: "-10deg", z: "10" },
        { left: "70%", top: "19%", width: "215px", height: "315px", rows: "235px auto", rotate: "8deg", z: "9" },
        { left: "63%", top: "57%", width: "205px", height: "300px", rows: "220px auto", rotate: "10deg", z: "8" },
      ]
    : tablet
      ? [
          { left: "30%", top: "18%", width: "275px", height: "425px", rows: "315px auto", rotate: "3deg", z: "12" },
          { left: "0%", top: "28%", width: "195px", height: "300px", rows: "220px auto", rotate: "-10deg", z: "10" },
          { left: "69%", top: "20%", width: "190px", height: "285px", rows: "210px auto", rotate: "8deg", z: "9" },
          { left: "61%", top: "58%", width: "180px", height: "270px", rows: "195px auto", rotate: "10deg", z: "8" },
        ]
      : mobile
        ? [
            { left: "23%", top: "19%", width: compact ? "190px" : "225px", height: compact ? "305px" : "365px", rows: compact ? "230px auto" : "278px auto", rotate: "3deg", z: "12" },
            { left: "0%", top: "32%", width: compact ? "135px" : "165px", height: compact ? "230px" : "285px", rows: compact ? "165px auto" : "210px auto", rotate: "-10deg", z: "10" },
            { left: "61%", top: "30%", width: compact ? "135px" : "165px", height: compact ? "230px" : "285px", rows: compact ? "165px auto" : "210px auto", rotate: "8deg", z: "9" },
            { left: "56%", top: "62%", width: compact ? "125px" : "155px", height: compact ? "205px" : "250px", rows: compact ? "148px auto" : "180px auto", rotate: "10deg", z: "8" },
          ]
        : [];

  cards.forEach((card, index) => {
    const position = positions[index];
    if (!position) return;
    setStyle(card, "position", "absolute");
    setStyle(card, "display", "grid");
    setStyle(card, "grid-template-rows", position.rows);
    setStyle(card, "left", position.left);
    setStyle(card, "right", "auto");
    setStyle(card, "top", position.top);
    setStyle(card, "bottom", "auto");
    setStyle(card, "width", position.width);
    setStyle(card, "height", position.height);
    setStyle(card, "min-height", "0");
    setStyle(card, "border", "1px solid rgba(255,255,255,.98)");
    setStyle(card, "border-radius", "20px");
    setStyle(card, "background", "rgba(255,255,255,.98)");
    setStyle(card, "box-shadow", "0 24px 50px rgba(16,24,40,.14)");
    setStyle(card, "overflow", "hidden");
    setStyle(card, "transform", `rotate(${position.rotate})`);
    setStyle(card, "z-index", position.z);
  });

  const imageAreas = Array.from(document.querySelectorAll<HTMLElement>(".hero-featured-image"));
  imageAreas.forEach((area, index) => {
    setStyle(area, "display", "grid");
    setStyle(area, "place-items", "center");
    setStyle(area, "min-height", "0");
    setStyle(area, "overflow", "hidden");
    setStyle(area, "background", "#fff");
    setStyle(area, "padding", index === 0 ? "20px" : index === 3 ? "14px" : "18px");
  });

  const infos = Array.from(document.querySelectorAll<HTMLElement>(".hero-featured-info"));
  infos.forEach((info) => {
    setStyle(info, "display", "grid");
    setStyle(info, "gap", "3px");
    setStyle(info, "padding", "12px 13px 13px");
    setStyle(info, "background", "#fff");
  });

  const available = document.querySelector<HTMLElement>(".hero-available-now");
  if (available) {
    setStyle(available, "position", "absolute");
    setStyle(available, "top", "2px");
    setStyle(available, "right", "2%");
    setStyle(available, "min-width", mobile ? "210px" : "255px");
    setStyle(available, "padding", "12px 13px 12px 15px");
    setStyle(available, "gap", "11px");
    setStyle(available, "border", "0");
    setStyle(available, "border-radius", "999px");
    setStyle(available, "background", "rgba(255,255,255,.94)");
    setStyle(available, "box-shadow", "0 14px 34px rgba(16,24,40,.08)");
    setStyle(available, "z-index", "20");
  }

  const icon = document.querySelector<HTMLElement>(".hero-available-icon");
  if (icon) {
    setStyle(icon, "width", "34px");
    setStyle(icon, "height", "34px");
    setStyle(icon, "display", mobile && compact ? "none" : "grid");
    setStyle(icon, "place-items", "center");
    setStyle(icon, "border-radius", "10px");
    setStyle(icon, "background", "#eef1ff");
    setStyle(icon, "color", "#2335ad");
    setStyle(icon, "font-size", "16px");
  }

  const availableLink = document.querySelector<HTMLElement>(".hero-available-now a");
  if (availableLink) {
    setStyle(availableLink, "width", "38px");
    setStyle(availableLink, "height", "38px");
    setStyle(availableLink, "flex-basis", "38px");
    setStyle(availableLink, "margin-left", "auto");
    setStyle(availableLink, "background", "#eef1ff");
    setStyle(availableLink, "color", "#2335ad");
    setStyle(availableLink, "font-size", "18px");
  }

  const orbits = Array.from(document.querySelectorAll<HTMLElement>(".hero-stage-orbit"));
  orbits.forEach((orbit, index) => {
    setStyle(orbit, "position", "absolute");
    setStyle(orbit, "left", "55%");
    setStyle(orbit, "top", "52%");
    setStyle(orbit, "transform", "translate(-50%, -50%)");
    setStyle(orbit, "border-radius", "50%");
    setStyle(orbit, "pointer-events", "none");
    setStyle(orbit, "z-index", "2");
    setStyle(orbit, "width", index === 0 ? "470px" : "330px");
    setStyle(orbit, "height", index === 0 ? "470px" : "330px");
    setStyle(orbit, "border", index === 0 ? "1px solid rgba(35,53,173,.10)" : "1px dashed rgba(35,53,173,.12)");
  });

  const dots = Array.from(document.querySelectorAll<HTMLElement>(".hero-stage-dot"));
  dots.forEach((dot, index) => {
    setStyle(dot, "position", "absolute");
    setStyle(dot, "border-radius", "50%");
    setStyle(dot, "pointer-events", "none");
    setStyle(dot, "z-index", "3");
    if (index === 0) {
      setStyle(dot, "right", "8%");
      setStyle(dot, "top", "66%");
      setStyle(dot, "width", "17px");
      setStyle(dot, "height", "17px");
      setStyle(dot, "background", "#2335ad");
    } else {
      setStyle(dot, "left", "6%");
      setStyle(dot, "bottom", "10%");
      setStyle(dot, "width", "9px");
      setStyle(dot, "height", "9px");
      setStyle(dot, "background", "#d9dfff");
    }
  });
}

export default function SiteNavActive() {
  const pathname = usePathname();

  useEffect(() => {
    const navs = Array.from(document.querySelectorAll<HTMLElement>("header.site-header .nav"));
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

    if (pathname === "/") {
      window.requestAnimationFrame(applyHeroLayout);
    }
  }, [pathname]);

  return null;
}
