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

- **POS Cashier**: Product grid with category filtering, cart management, SST (8%) calculation, payment methods (Cash/Card/E-Wallet)
- **Orders**: Order history with status management, detail view
- **Inventory**: Product CRUD, stock management, SST toggle per product
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
- **products**: id, name, description, price, category_id, sku, stock, taxable, active, image_url, created_at, updated_at
- **orders**: id, order_number, status, subtotal, tax_total, total, payment_method, amount_paid, change, notes, staff_id, created_at, updated_at
- **order_items**: id, order_id, product_id, product_name, quantity, unit_price, tax_rate, subtotal, tax, total

## API Routes

- `POST /api/auth/login` — PIN login
- `POST /api/auth/logout` — Logout
- `GET /api/auth/me` — Current session
- `GET/POST /api/categories` — Category management
- `PATCH/DELETE /api/categories/:id`
- `GET/POST /api/products` — Product management (supports ?categoryId, ?search, ?active filters)
- `GET/PATCH/DELETE /api/products/:id`
- `GET/POST /api/orders` — Order management (supports ?status, ?date filters)
- `GET /api/orders/:id`
- `PATCH /api/orders/:id/status`
- `GET/POST/PATCH/DELETE /api/staff`
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
