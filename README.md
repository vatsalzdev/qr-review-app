# Minimal Mobile-First QR Restaurant Review Web App

A clean, mobile-first web app that enables customers to scan a QR code at a restaurant, pick a star rating, select highlights or enter feedback, automatically generate an authentic review draft, copy it to their clipboard with one tap, and jump straight to the restaurant's Google review page.

---

## Features & Core User Flow

1. **Business QR / URL**:
   - Access URL: `/r/demo-waffle-shop`
   - Generated QR Code available on the development portal (`/`).
2. **Customer Landing Page**:
   - Asks *"How was your experience at Demo Waffle Shop?"*
   - 5 large interactive touch-friendly empty stars: `☆ ☆ ☆ ☆ ☆`
   - Visually highlights selected stars with smooth animations.
3. **Experience Selection**:
   - Seamlessly reveals *"What did you like?"* after rating.
   - Multi-select pill toggles: `Food`, `Service`, `Ambience`, `Price`, `Cleanliness`.
   - Optional text field: *"Anything specific you enjoyed?"* with placeholder `e.g. Loved the chocolate waffle and friendly service`.
4. **Review Draft Generation**:
   - Generates a natural, factual review using **only** customer-provided inputs.
   - Deterministic JavaScript templates — does not hallucinate facts, dishes, or events.
5. **1-Tap Copy Review**:
   - Prominent **Copy Review** button.
   - Temporarily changes to **Copied ✓** for instant confirmation.
6. **Google Review Button**:
   - Prominent **Leave Google Review →** button that directs customer to the business's configurable Google review URL in a new tab.

---

## Tech Stack & Architecture

- **Frontend**: React, Vite, JavaScript, CSS3 (Mobile-first, touch-optimized, light theme)
- **Backend**: Node.js, Express (separate business repository and REST API)
- **Icons & QR**: Lucide React, `qrcode.react` (High-density SVG)
- **Testing**: Node test assertions, Puppeteer E2E test suite

### Project Structure

```
├── server/
│   ├── data/
│   │   └── businesses.js       # Business catalog and configuration
│   ├── routes/
│   │   └── api.js              # REST endpoints (/api/businesses/:slug)
│   └── index.js                # Express app & static server
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── StarRating.jsx          # 5 large interactive stars
│   │   │   ├── ExperienceSelection.jsx # Multi-select pills & custom feedback
│   │   │   ├── ReviewDraft.jsx         # Review box, Copy & Google buttons
│   │   │   └── DevQrCard.jsx           # Live QR preview & URL editor
│   │   ├── pages/
│   │   │   ├── CustomerReviewPage.jsx  # /r/:slug mobile review flow
│   │   │   └── DevPortal.jsx           # / developer overview & QR hub
│   │   ├── services/
│   │   │   └── reviewGenerator.js      # Deterministic review draft engine
│   │   ├── App.jsx
│   │   └── index.css                   # Mobile-first stylesheet
│   └── index.html
├── test/
│   ├── test-review-generator.js        # Unit test suite
│   ├── test-server.js                  # Integration test suite
│   └── e2e.js                          # End-to-end mobile flow test
└── package.json
```

---

## Getting Started

### 1. Run Development Server
```bash
npm run dev
```
- Express backend runs at `http://localhost:5000`
- Vite frontend runs with hot reloading at `http://localhost:5173`

### 2. Run Production Server
```bash
npm run build
npm start
```
- Express serves both the REST API and the built React frontend at `http://localhost:5000`.

### 3. URLs
- **Customer Flow**: `http://localhost:5173/r/demo-waffle-shop` (or `http://localhost:5000/r/demo-waffle-shop`)
- **Developer Hub & QR Code**: `http://localhost:5173/` (or `http://localhost:5000/`)

### 4. Running Tests
```bash
# Run unit & API integration tests
npm test

# Run end-to-end mobile browser test
npm run test:e2e
```

---

## Business Configuration

Business configurations are decoupled from UI components in `server/data/businesses.js`:

```javascript
{
  id: 'b1',
  name: 'Demo Waffle Shop',
  slug: 'demo-waffle-shop',
  googleReviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4'
}
```
You can also update the Google review URL dynamically from the Developer Hub on `/` or via `PATCH /api/businesses/demo-waffle-shop`.
