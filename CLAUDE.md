# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Vercel MCP test project - a Next.js 14 application demonstrating integration between Vercel's Model Context Protocol (MCP), Vercel Postgres database, and a simple transaction management system. The project serves as a foundation for future bank transaction tracking applications.

## Development Commands

```bash
# Development
npm run dev              # Start Next.js dev server on http://localhost:3000

# Build & Production
npm run build            # Build production bundle (checks TypeScript errors)
npm start                # Start production server

# Database
npm run init-db          # Initialize database schema and insert sample data
vercel env pull .env.local  # Pull environment variables from Vercel
```

## Deployment Commands

```bash
# Deploy to Vercel
vercel deploy --prod --yes  # Deploy to production via Vercel CLI

# Project linking (if needed)
vercel link              # Link local directory to Vercel project
```

## Architecture

### Database Layer (`@vercel/postgres`)

- **Connection**: Uses Vercel Postgres (Neon) with connection pooling
- **Environment**: Requires `POSTGRES_URL` in `.env.local` (pull via `vercel env pull`)
- **Schema**: Single `transactions` table with indexed `date` and `category` fields
- **Initialization**: `scripts/init-db.ts` - creates tables, indexes, and sample data
  - **Important**: Script uses `dotenv` to load `.env.local` explicitly via `config({ path: resolve(process.cwd(), '.env.local') })`

### API Routes (Next.js App Router)

**`/api/transactions`** - Transaction collection
- `GET`: List transactions (supports `?limit=N` and `?category=X` query params)
  - Returns: `{ transactions: [], count: number, balance: string }`
  - Balance calculated server-side (credits - debits)
- `POST`: Create transaction
  - Body: `{ amount, description, date, category, type: 'debit'|'credit' }`
  - Validates required fields and type enum

**`/api/transactions/[id]`** - Single transaction operations
- `GET`: Fetch by ID
- `PUT`: Update transaction (uses `COALESCE` for partial updates)
- `DELETE`: Remove transaction

### Frontend (`app/page.tsx`)

- **Client Component**: Uses `'use client'` directive
- **State Management**: React hooks (`useState`, `useEffect`)
- **Features**:
  - Transaction list with real-time balance display
  - Form for creating new transactions
  - Delete functionality with confirmation
  - Console logging for debugging (per project preferences)

### Styling

- **Mobile-first CSS**: `app/globals.css` with responsive breakpoints
- **Gradient theme**: Purple gradient background (#667eea → #764ba2)
- **Transaction types**: Color-coded (green for credit, red for debit)

## Database Schema

```sql
CREATE TABLE transactions (
  id SERIAL PRIMARY KEY,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT NOT NULL,
  date TIMESTAMP NOT NULL,
  category VARCHAR(100) DEFAULT 'uncategorized',
  type VARCHAR(10) CHECK (type IN ('debit', 'credit')) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_category ON transactions(category);
```

## Vercel MCP Integration

**MCP Server**: `https://mcp.vercel.com`

**Available via MCP**:
- Project management (list, get)
- Deployment operations (deploy, list, get logs)
- Documentation search
- URL fetching (with auth bypass for protected deployments)

**NOT Available via MCP**:
- Database creation (must use Vercel Dashboard → Storage → Create Database → Postgres → Neon)
- Environment variable management (use `vercel env pull`)

## Environment Setup Workflow

1. Create Vercel Postgres database via dashboard (choose Neon, skip built-in auth)
2. Pull environment variables: `vercel env pull .env.local`
3. Initialize database: `npm run init-db`
4. Deploy: `vercel deploy --prod --yes`

## Project Configuration

- **Framework**: Next.js 14 with App Router
- **TypeScript**: Strict mode enabled
- **Path Alias**: `@/*` maps to project root
- **Node Version**: 22.x (defined in Vercel project settings)
- **Database Package**: `@vercel/postgres` for direct SQL queries (no ORM)

## Code Preferences

- Use `console.log` for debugging (not logger libraries)
- Mobile-first CSS with responsive breakpoints at 768px
- Check TypeScript errors after changes: `npm run build`
