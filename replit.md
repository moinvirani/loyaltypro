# LoyaltyPro - Loyalty Card Management Platform

## Overview

LoyaltyPro is a SaaS loyalty card management platform for the UAE market that enables businesses to create, manage, and distribute digital loyalty cards with Apple Wallet integration. The platform targets the UAE market with competitive pricing against brand-wallet.com, starting with ISF sports business for daily testing.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (January 2026)

- **Stripe Integration**: Set up subscription billing with 3 pricing tiers (Starter 29 AED, Growth 79 AED, Enterprise 199 AED)
- **Landing Page**: Created marketing page with hero, features, pricing toggle (monthly/yearly), testimonials
- **Dashboard Enhancement**: Added analytics charts (area, pie, bar), stat cards with trends, quick actions sidebar
- **Card Designer Templates**: Added 8 pre-built templates (Coffee Shop, Fitness, Spa, Restaurant, Retail, Pet Care, Sports Club, Bakery)
- **Sports Club Template**: Updated to use green colors (#22C55E primary) for ISF testing
- **Billing Portal**: Opens in new tab to preserve SPA flow

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and data fetching
- Radix UI components with Tailwind CSS for consistent, accessible UI
- shadcn/ui component library for pre-built UI patterns
- Recharts for analytics visualizations

**Key Routes:**
- `/` - Landing page (no sidebar/layout)
- `/dashboard` - Main dashboard with analytics
- `/cards` - Card designer and management
- `/customers` - Customer management
- `/branches` - Branch location management

**Card Designer Features:**
- 8 pre-built templates with visual previews
- Live preview with Card and Wallet tabs
- Color customization (primary, background, gradient)
- Logo upload with 5MB limit
- Stamp count configuration (1-15)
- Apple Wallet pass generation

### Backend Architecture

**Technology Stack:**
- Express.js server with TypeScript
- Drizzle ORM for type-safe database operations
- PostgreSQL database
- Stripe integration for subscription billing
- node-forge for Apple Wallet cryptographic signing

**Stripe Integration Pattern:**
- NEVER create tables in stripe schema (managed by stripe-replit-sync)
- NEVER use SQL INSERT for products/prices (use Stripe API)
- Query from stripe.products/prices tables
- Store Stripe IDs in application tables (businesses.stripeCustomerId, businesses.stripeSubscriptionId)
- Initialization order: runMigrations() → getStripeSync() → findOrCreateManagedWebhook() → syncBackfill()

**API Design:**
- RESTful endpoints under `/api` prefix
- Stripe webhook route registered BEFORE express.json()
- Request/response logging middleware for API routes only
- JSON body parsing with 10MB limit for image uploads

**Apple Wallet Integration:**
- PKCS#7 detached signature generation for .pkpass files
- Certificate chain validation with Apple WWDR certificates
- SHA-1 manifest hashing for pass integrity
- ZIP packaging with proper MIME types
- Pass structure compliant with Apple Wallet specifications

### Data Architecture

**Database Schema (Drizzle ORM):**

**Businesses Table:**
- Core business entity with authentication credentials
- Stripe customer and subscription IDs
- Logo storage as base64 or URL
- Email-based unique identification

**Loyalty Cards Table:**
- Card design stored as JSONB with Zod validation
- Design properties: colors, logos, stamps, gradients, styles
- Active/inactive status for card management
- Business association for multi-tenancy

**Customers Table:**
- Customer profiles linked to businesses
- Email-based identification
- Points and stamps tracking

**Branches Table:**
- Multiple location support per business
- Address and naming information

### External Dependencies

**Stripe (Configured):**
- Products and prices managed via Stripe API
- Webhooks for subscription events
- Customer portal for billing management

**Apple Developer Requirements:**
- Pass Type ID certificate (APPLE_SIGNING_CERT)
- Private key for certificate (APPLE_SIGNING_KEY)
- Apple Worldwide Developer Relations certificate (APPLE_WWDR_CERT)
- Team Identifier (APPLE_TEAM_ID)
- Pass Type ID (APPLE_PASS_TYPE_ID)

**Google Wallet (Pending):**
- Requires Google Cloud Console setup
- Service account credentials needed
- Not yet implemented

### Business Context

**Target Market:** UAE
**Competitive Advantage:** Better pricing than brand-wallet.com
**Testing Partner:** ISF Sports Business (daily validation)
**Pricing Tiers:**
- Starter: 29 AED/month - 1 card, 100 customers
- Growth: 79 AED/month - 5 cards, 1000 customers
- Enterprise: 199 AED/month - Unlimited cards/customers

### Known Issues

- Apple Wallet pass generation works but requires matching certificate pairs
- No authentication system implemented yet (uses hardcoded businessId: 1)
- Google Wallet integration pending (needs service account setup)
