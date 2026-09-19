# CloudGST Pro

**Production-ready, multi-tenant cloud GST billing, POS, and inventory management system for India.**

[![Node.js](https://img.shields.io/badge/Node.js-v24-green)](https://nodejs.org) [![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue)](https://typescriptlang.org) [![React](https://img.shields.io/badge/React-18-61DAFB)](https://react.dev) [![Prisma](https://img.shields.io/badge/Prisma-5.22-2D3748)](https://prisma.io)

---

## Features

- ✅ **Multi-company / Multi-tenant** — Isolated data per company, unlimited companies
- ✅ **GST Billing** — CGST/SGST/IGST, Cess, Inclusive/Exclusive, HSN codes, all rates (0–28%)
- ✅ **POS Screen** — Touch + keyboard optimized, barcode scan, cart management, real-time GST calc
- ✅ **Tax Invoice Printing** — Full GST invoice with amount-in-words, QR code, print/PDF
- ✅ **Inventory** — Multi-warehouse, stock transactions, adjustments, low-stock alerts
- ✅ **Purchases** — Full purchase orders with live GST calculation, supplier management
- ✅ **Quotations** — Price quotes with validity dates, terms & conditions
- ✅ **GST Reports** — GSTR-1, GSTR-3B summary, HSN/SAC table, ITC tracking
- ✅ **Excel Export** — Invoices, products, customers, GST reports with branded formatting
- ✅ **Barcode Labels** — Generate and print product labels in multiple sizes
- ✅ **Staff Management** — Role-based access control (RBAC) with granular permissions
- ✅ **Audit Logging** — Every action tracked with user, timestamp, and IP
- ✅ **JWT Auth** — Refresh token rotation, multi-session management
- ✅ **PWA Ready** — Installable on mobile and desktop
- ✅ **Fully Tested** — 42 unit tests for GST engine, all passing

---

## Quick Start

### Prerequisites

- Node.js v18+ (tested on v24.21.0)
- npm v9+

### 1. Clone & Install

```bash
# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

### 2. Configure Environment

```bash
# backend/.env (already pre-configured for dev)
cp backend/.env.example backend/.env
```

Key variables:
```env
DATABASE_URL="file:./prisma/dev.db"    # SQLite (dev)
JWT_SECRET="your-strong-secret-here"
REFRESH_TOKEN_SECRET="your-refresh-secret"
PORT=4000
```

### 3. Initialize Database

```bash
cd backend

# Run migrations
npx prisma migrate dev --name init

# Seed demo data
npx ts-node prisma/seed.ts
```

### 4. Start Development Servers

**Backend** (in `backend/` folder):
```bash
# Windows PowerShell:
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm run dev
# → http://localhost:4000
```

**Frontend** (in `frontend/` folder, new terminal):
```bash
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npm run dev
# → http://localhost:5173
```

---

## Default Admin Credentials

| Role | Email | Password |
|------|-------|----------|
| **Super Admin** | `superadmin@cloudgstpro.com` | `SuperAdmin@123` |


---

## Tech Stack

### Backend
| Package | Purpose |
|---------|---------|
| Express.js | REST API server |
| Prisma ORM | Type-safe database access |
| SQLite (dev) / PostgreSQL (prod) | Database |
| jsonwebtoken | JWT authentication |
| bcryptjs | Password hashing |
| zod | Input validation |
| winston | Structured logging |
| helmet | Security headers |
| express-rate-limit | Rate limiting |
| Nodemailer | Email (stub → real SMTP) |

### Frontend
| Package | Purpose |
|---------|---------|
| React 18 | UI framework |
| Vite | Build tool + HMR |
| TypeScript | Type safety |
| React Router v6 | Client routing |
| Zustand | State management (auth, cart) |
| TanStack Query | Server state & caching |
| React Hook Form + Zod | Form validation |
| Recharts | Dashboard charts |
| ExcelJS | Excel export |
| Lucide React | Icons |
| react-hot-toast | Notifications |
| vite-plugin-pwa | PWA support |

---

## Project Structure

```
f:\Project\POS\
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma         # 40+ models, full GST billing schema
│   │   ├── seed.ts               # Demo data seeder
│   │   └── dev.db                # SQLite database
│   └── src/
│       ├── controllers/          # 20+ controllers (products, invoices, etc.)
│       ├── routes/               # 20+ route files
│       ├── services/
│       │   ├── tax.service.ts    # GST engine (centralized, tested)
│       │   ├── stock.service.ts  # Inventory engine (atomic transactions)
│       │   ├── numbering.service.ts # Document auto-numbering
│       │   ├── audit.service.ts  # Audit logging
│       │   └── email.service.ts  # Email (stub + Nodemailer)
│       ├── middleware/           # auth, errorHandler, logger, rateLimiter
│       └── tests/
│           └── tax.service.test.ts  # 42 unit tests ✅
└── frontend/
    └── src/
        ├── pages/                # 30+ pages
        │   ├── auth/             # Login, Register, Company Select
        │   ├── pos/              # POS Billing
        │   ├── invoices/         # Invoice list + detail (printable)
        │   ├── purchases/        # Purchase list + create form
        │   ├── quotations/       # Quotation list + create form
        │   ├── inventory/        # Stock levels + movements
        │   ├── reports/          # Reports hub + GST report
        │   └── barcodes/         # Barcode label printing
        ├── components/
        │   └── layout/           # AppLayout (sidebar, topbar)
        ├── store/                # Zustand stores (auth, cart, UI)
        ├── api/                  # Axios client (JWT refresh, company header)
        ├── utils/
        │   ├── taxUtils.ts       # Frontend GST calculator (mirrors backend)
        │   └── excelExport.ts    # Excel export utility (ExcelJS)
        └── styles/               # Complete CSS design system
```

---

## Running Tests

```bash
cd backend

# GST Engine Unit Tests (42 tests)
npx ts-node -e "require('./src/tests/tax.service.test')"
```

Expected output: `42 passed, 0 failed — All tests PASSED!`

---

## Production Deployment

### 1. Switch to PostgreSQL

In `backend/prisma/schema.prisma`:
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Update `DATABASE_URL` in `.env`:
```env
DATABASE_URL="postgresql://user:password@host:5432/cloudgst?schema=public"
```

Run: `npx prisma migrate deploy`

### 2. Build Frontend

```bash
cd frontend && npm run build
# Output: frontend/dist/
```

### 3. Environment Variables for Production

```env
NODE_ENV=production
JWT_SECRET=<strong-256bit-secret>
REFRESH_TOKEN_SECRET=<another-strong-secret>
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=<sendgrid-api-key>
FROM_EMAIL=noreply@yourcompany.com
```

---

## API Reference

Base URL: `http://localhost:4000/api/v1`

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login with email + password |
| POST | `/auth/register` | Register new user |
| POST | `/auth/refresh` | Refresh JWT tokens |
| GET | `/dashboard/summary` | Dashboard KPIs and charts |
| GET/POST | `/products` | Product management |
| GET/POST | `/invoices` | Invoice management |
| GET/POST | `/purchases` | Purchase management |
| GET/POST | `/quotations` | Quotation management |
| GET | `/reports/gst/summary` | GST summary report |
| GET | `/reports/gst/hsn-summary` | HSN/SAC table |
| POST | `/products/stock-adjust` | Stock adjustment |
| GET | `/products/stock-movements` | Stock transaction history |

All protected routes require:
- `Authorization: Bearer <accessToken>`
- `X-Company-Id: <companyId>`

---

## License

MIT © CloudGST Pro
