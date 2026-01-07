# LoyaltyPro - Loyalty Card Management Platform

## Overview

LoyaltyPro is a SaaS loyalty card management platform for the UAE market that enables businesses to create, manage, and distribute digital loyalty cards with Apple Wallet integration. The platform targets the UAE market with competitive pricing against brand-wallet.com, starting with ISF sports business for daily testing.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes (January 2026)

- **Three Loyalty Types**: Now supports stamp cards, points cards, AND membership cards (visit tracking)
- **Customer Enrollment Flow**: New /join/:cardId page with branded form matching business colors, customers scan QR → fill form → Add to Apple Wallet
- **Enrollment Form Customization**: Businesses can customize welcome title, subtitle, submit button text, and terms checkbox
- **Card Designer Redesign**: Sticky preview on desktop, improved mobile template gallery, 3-type selection with icons
- **Staff Scanner Update**: Handles all 3 card types - adds stamps/points OR logs visits for membership cards
- **Multi-Tenancy Fix**: Updated ALL 22 API routes to use authenticated business ID instead of hardcoded businessId: 1
- **Built-in QR Scanner**: Integrated html5-qrcode camera scanning in staff page, eliminating need for external scanner apps
- **Onboarding Wizard**: 4-step wizard (business info, plan selection with 14-day trial, first card, complete)
- **Free Trial**: Server-enforced 14-day trial period (TRIAL_DAYS constant), client passes withTrial boolean only
- **Authentication System**: Complete business login/signup with password hashing (scrypt), passport-local strategy, session management

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
- `/auth` - Login/register page
- `/onboarding` - New business onboarding wizard (protected)
- `/dashboard` - Main dashboard with analytics (protected)
- `/cards` - Card designer and management (protected)
- `/customers` - Customer management (protected)
- `/branches` - Branch location management (protected)
- `/staff` - Staff scanner for adding stamps/points (public for tablet use)
- `/join/:cardId` - Customer enrollment form (public, branded per business)

**Card Designer Features:**
- 8 pre-built templates with visual previews and mobile-friendly gallery
- Three loyalty types: stamps (stamp cards), points (service businesses), membership (visit tracking)
- Sticky live preview on desktop, bottom preview on mobile
- Color customization (primary, background, gradient)
- Logo upload with 5MB limit
- Stamp count configuration (1-15), points per currency, reward thresholds
- Enrollment form template customization (welcome title/subtitle, submit button, terms checkbox)
- Apple Wallet pass generation with QR code for customer enrollment

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

### Authentication System

**Backend (server/auth.ts):**
- Password hashing with scrypt and random salts
- Session management with MemoryStore (secure cookies in production)
- passport-local strategy adapted for businesses table
- Endpoints: /api/register, /api/login, /api/logout, /api/user, PATCH /api/business/profile

**Frontend:**
- AuthProvider context with user state and mutations
- ProtectedRoute component for authenticated-only pages
- Automatic redirect to /auth for unauthenticated users
- Logout button in dashboard sidebar

**Security:**
- SESSION_SECRET environment variable required for production
- Secure cookies enabled for production, sameSite protection
- Error responses properly handled to prevent caching failed auth attempts

### Known Issues

- Apple Wallet pass generation works but requires matching certificate pairs
- Google Wallet integration pending (needs service account setup)
