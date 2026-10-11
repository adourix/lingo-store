# Lingo Store Design System

## Direction

Lingo Store uses one brand system across three intentionally different surfaces:

- Public storefront: retail-first, spacious, product-led.
- Admin: dense, operational, table-first, with a dark navigation rail.
- POS: high-contrast, fast, touch-friendly cashier workspace with the cart and payment path always visible.

The surfaces share the Lingo blue and orange accent but are not visually identical.

## Brand

- Primary blue: `#2335AD`
- Deep blue: `#18268B`
- Navy: `#101828`
- Orange accent: `#FF7A1A`
- Page background: `#F6F7FB`
- Border: `#DFE3EA`
- Muted text: `#667085`

The Lingo wordmark is used from each app's public logo asset. Dark and light variants are kept separate where the surrounding surface requires different contrast.

## Typography

Use the existing system/Inter stack for the Latin UI. Arabic remains first-class and must be checked in both RTL and mixed-content layouts.

## Components

Prefer a small number of intentional primitives:

- primary and secondary buttons
- form controls with visible focus
- product cards
- operational tables
- status badges
- empty/loading/error states
- responsive navigation
- POS product tiles and cart rows

Avoid decorative gradients, excessive cards, excessive pills, fake metrics, and placeholder business content.

## Public storefront

The storefront uses a restrained retail composition: utility bar, branded navigation, product-led hero, category strip, catalog grid, concise supporting content, and a simple footer. Product imagery must come from catalog data when available.

## Admin

Admin remains information-dense and predictable. Tables remain tables on desktop. Search, filtering, sorting, pagination, permissions, destructive actions, and feedback states take priority over decorative analytics.

## POS

POS uses a dedicated operational language. The active sale screen exposes search, products, cart, total, payment, terminal state, cashier state, and connectivity without hiding primary actions behind menus. Touch targets remain large enough for tablet/desktop use.

## Responsive and RTL

Public UI is mobile-first. Admin is desktop-first but responsive. POS targets desktop/touch and remains usable on tablets. Use logical CSS properties and verify icon placement, form alignment, tables, currency, numbers, and mixed Arabic/English content in RTL.

## Accessibility

Target WCAG 2.2 AA. Keep semantic controls, visible focus, keyboard operation, accessible labels, adequate contrast, and non-hover-only information. Respect reduced-motion preferences when motion is added.
