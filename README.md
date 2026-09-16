# Minimal Mobile-First QR Restaurant Review Web App

A minimal, mobile-first web app that allows businesses to instantly create review QR codes, and customers to submit authentic, factual Google reviews with a single click.

---

## Features & Flows

### 1. Business + QR Creation (`/`)
- **Header**: Create Your Review QR
- **Inputs**:
  - Business Name (e.g. `Royal Cafe`, `Bob's Waffle Shop`, `Fresh Mart Jaipur`)
  - Google Review URL
- **Automatic Slug Generation**:
  - Automatically converts business names to clean URL-safe slugs (`royal-cafe`, `bobs-waffle-shop`, `fresh-mart-jaipur`).
- **Dynamic Customer URL**:
  - Formed using current browser origin: `https://<current-host>/r/:businessSlug` (no hardcoded hosts).
- **Large Scannable QR Code**:
  - Encodes the complete customer URL (never the raw Google review link).
  - Renders inside a clean, screenshot-ready card frame.
- **Actions**:
  - **Download QR**: Exports a crisp PNG image (`<slug>-qr.png`).
  - **Copy URL**: Copies the customer review URL to clipboard.
- **Persistence**:
  - Stored in browser `localStorage` (`qr_review_custom_businesses`) surviving page refreshes without requiring a database.

### 2. Customer Review Flow (`/r/:businessSlug`)
- **Mobile-first touch interface**: Clean white/light theme with 48px+ touch targets.
- **Dynamic Greeting**: *"How was your experience at [Business Name]?"*
- **Star Rating**: 5 large empty stars `☆ ☆ ☆ ☆ ☆` with interactive highlighting.
- **Experience Highlights**: Multi-select pills (`Food`, `Service`, `Ambience`, `Price`, `Cleanliness`) + optional note.
- **Deterministic Draft Generator**: Generates natural review drafts based strictly and purely on customer inputs without hallucinated facts.
- **Editable Draft**: Textarea remains editable before submission.
- **Unified Action**: **"Copy & Leave Review →"**
  - Direct click copies review text to clipboard and opens the business's Google review URL in a new tab.
  - Subtle helper text: *"Your review has been copied. Paste it on Google and submit your rating."*

---

## Getting Started

### 1. Run Development Server
```bash
npm run dev
```
- Frontend runs at `http://localhost:5173`
- Backend API runs at `http://localhost:5000`

### 2. Run Production Build
```bash
npm run build
npm start
```
- Full-stack production server at `http://localhost:5000`

### 3. Run Automated Tests
```bash
# Run unit & API integration tests
npm test

# Run 10-step end-to-end browser test
npm run test:e2e
```
