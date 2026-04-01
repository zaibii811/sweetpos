# SweetPOS Workspace

## Overview

Full-stack Point-of-Sale (POS) web app for a Malaysian candy and cake shop called **SweetPOS**. Built as a PWA (Progressive Web App) for tablet and phone use. 

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + Tailwind CSS (artifacts/sweet-pos)
- **Backend**: Express 5 API server (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Session-based PIN login (express-session)

## Features

- **POS Cashier**: Product grid, cake modifiers popup, discount (% or RM), SST toggle, cash numpad with change, QR placeholders for TNG/DuitNow, split payment, receipt modal with WhatsApp share. Weight-based products trigger a weight numpad popup with bag toggle and auto price calculation.
- **Orders**: Order history with status management, detail view
- **Inventory Management**: Full inventory module with:
  - Products tab: fixed-price and weight-based (per 100g) products, expiry dates, cost price, low-stock thresholds, SST toggle, category, SKU, CSV import via papaparse
  - Consumables tab: plastic bags and supplies with stock tracking, low-stock threshold
  - Stock adjustment modal with history log (top-up / deduction)
  - Bag Size Rules settings panel — maps weight thresholds to specific bag consumables
  - Alert banners for low stock, expiring (within 7 days), expired products
  - Nav badge on Inventory showing total live alert count
- **Staff**: Staff management with PIN authentication, role-based access (admin/manager/cashier)
- **Reports**: Sales analytics, top products, daily chart, category breakdown
- **PWA**: Service worker + manifest for offline support on tablets/phones

## Currency & Tax

- Currency: Malaysian Ringgit (MYR), displayed as "RM X.XX"
- Tax: 8% SST (Sales & Service Tax) — toggleable per product

## Default Staff PINs (seed data)

- Admin: `1234`
- Siti Rahimah (manager): `2222`
- Ahmad Faizal (cashier): `3333`
- Nur Ain (cashier): `4444`

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── sweet-pos/          # React Vite frontend (SweetPOS)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
│       └── src/schema/
│           ├── categories.ts
│           ├── staff.ts
│           ├── products.ts
│           └── orders.ts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Database Schema

- **categories**: id, name, color, icon, created_at
- **staff**: id, name, pin, role (admin/manager/cashier), active, created_at
- **products**: id, name, description, product_type (fixed|weight), price, cost_price, category_id, sku, stock, low_stock_threshold, taxable, active, image_url, expiry_date, created_at, updated_at
- **orders**: id, order_number, status, subtotal, tax_total, total, payment_method, amount_paid, change, notes, staff_id, created_at, updated_at
- **order_items**: id, order_id, product_id, product_name, quantity, unit_price, tax_rate, subtotal, tax, total
- **consumables**: id, name, unit, stock, low_stock_threshold, cost_per_unit, active, created_at, updated_at
- **stock_adjustments**: id, item_type, item_id, item_name, adjustment_type, quantity, reason, staff_id, staff_name, created_at
- **bag_size_rules**: id, name, max_weight_grams, consumable_id, created_at

## API Routes

- `POST /api/auth/login` — PIN login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Current session
- `GET/POST /api/categories` — Category management
- `PATCH/DELETE /api/categories/:id`
- `GET/POST /api/products` — Product management (supports ?categoryId, ?search, ?active, ?productType filters)
- `GET/PATCH/DELETE /api/products/:id`
- `GET/POST /api/orders` — Order management (supports bagDeductions[], itemPriceOverrides[] extra body fields)
- `GET /api/orders/:id`
- `PATCH /api/orders/:id/status`
- `GET/POST/PATCH/DELETE /api/staff`
- `GET/POST/PATCH/DELETE /api/consumables`
- `GET/POST /api/stock-adjustments` — Manual stock adjustments (deducts/tops-up stock automatically)
- `GET/POST/PATCH/DELETE /api/bag-size-rules`
- `GET /api/inventory/alerts` — Returns lowStockProducts, expiringProducts, expiredProducts, lowStockConsumables, totalAlertCount
- `GET /api/reports/summary` — Sales summary (?period=today|week|month)
- `GET /api/reports/top-products`
- `GET /api/reports/sales-by-day` (?days=7|30)
- `GET /api/reports/sales-by-category`
- `GET /api/reports/recent-activity`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json`. Run `pnpm run typecheck` for full typecheck.

## Codegen

After any OpenAPI spec change, re-run:
```bash
pnpm --filter @workspace/api-spec run codegen
```

## Development

```bash
# API server
pnpm --filter @workspace/api-server run dev

# Frontend
pnpm --filter @workspace/sweet-pos run dev

# DB schema push
pnpm --filter @workspace/db run push
```
