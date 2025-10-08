# Loyalty Card Management System

## Overview

A full-stack loyalty card management platform that enables businesses to create, manage, and distribute digital loyalty cards. The system features a React frontend for card design and customer management, with Express/Node.js backend handling Apple Wallet pass generation and database operations.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React 18 with TypeScript for type-safe component development
- Vite as the build tool and development server
- Wouter for lightweight client-side routing
- TanStack Query (React Query) for server state management and data fetching
- Radix UI components with Tailwind CSS for consistent, accessible UI
- shadcn/ui component library for pre-built UI patterns

**Design System:**
- Tailwind CSS utility-first styling with custom theme configuration
- Theme JSON plugin for dynamic color scheme management
- Professional variant with customizable primary colors and radius
- Support for light/dark mode through CSS variables

**State Management:**
- React Query for async server state with optimistic updates disabled
- Local component state for form inputs and UI interactions
- No global state management library (intentional architectural decision)

**Key Features:**
- Dashboard with business metrics and analytics
- Card designer with live preview (both physical card and Apple Wallet views)
- Customer management with metrics tracking
- Branch location management
- Real-time form validation using react-hook-form with Zod schemas

### Backend Architecture

**Technology Stack:**
- Express.js server with TypeScript
- Drizzle ORM for type-safe database operations
- PostgreSQL database (configured via Drizzle, though DB may not be provisioned yet)
- Node.js crypto and node-forge for Apple Wallet cryptographic signing

**API Design:**
- RESTful endpoints under `/api` prefix
- Request/response logging middleware for API routes only
- JSON body parsing with 10MB limit for image uploads
- Error handling middleware with status code propagation

**Apple Wallet Integration:**
- PKCS#7 detached signature generation for .pkpass files
- Certificate chain validation with Apple WWDR certificates
- SHA-1 manifest hashing for pass integrity
- ZIP packaging with proper MIME types (`application/vnd.apple.pkpass`)
- QR code generation for pass distribution
- Pass structure compliant with Apple Wallet specifications

**Image Processing:**
- Sharp library for image optimization and resizing
- Base64 encoding/decoding for logo uploads
- Image validation with 5MB size limits
- Automatic format conversion to PNG

### Data Architecture

**Database Schema (Drizzle ORM):**

**Businesses Table:**
- Core business entity with authentication credentials
- Logo storage as base64 or URL
- Email-based unique identification

**Branches Table:**
- Multiple location support per business
- Address and naming information
- Foreign key relationship to businesses

**Loyalty Cards Table:**
- Card design stored as JSONB with Zod validation
- Design properties: colors, logos, stamps, gradients, styles
- Active/inactive status for card management
- Business association for multi-tenancy

**Customers Table:**
- Customer profiles linked to businesses
- Email-based identification
- Tracks customer engagement

**Design Schema (Zod-validated JSONB):**
- Primary and background colors
- Optional logo image
- Configurable stamp count
- Gradient support with secondary colors
- Text color customization
- Card style variants (modern, classic, minimalist, elegant)

### External Dependencies

**Apple Developer Requirements:**
- Pass Type ID certificate (APPLE_SIGNING_CERT)
- Private key for certificate (APPLE_SIGNING_KEY)
- Apple Worldwide Developer Relations certificate (APPLE_WWDR_CERT)
- Team Identifier for pass generation
- Note: Current certificates have validation issues due to key/certificate mismatch

**Third-Party Services:**
- QRCode.react for QR code SVG generation in browser
- qrcode library for server-side QR generation (visible in test files)
- Sharp for server-side image processing
- node-forge for PKCS#7 cryptographic operations

**Database:**
- PostgreSQL via DATABASE_URL environment variable
- WebSocket support (ws library) for Drizzle with Neon serverless
- Migration system via drizzle-kit

**Development Tools:**
- Replit-specific plugins for theme management and error overlay
- TypeScript with strict mode enabled
- ESM module system throughout

**Known Issues:**
- Apple Wallet pass generation is complete but requires matching certificate pairs
- iOS signature validation fails due to certificate/key mismatch in environment variables
- Database may not be provisioned (throws error if DATABASE_URL missing)
- No authentication system implemented (uses hardcoded businessId: 1)