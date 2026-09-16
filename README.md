# Minimal Mobile-First QR Restaurant Review Web App

A clean, mobile-first web app that supports **multiple businesses using a single reusable customer interface**.

Customers scan a QR code at any business, pick a star rating, select highlights or enter feedback, automatically generate an authentic review draft, copy it to their clipboard with one tap, and jump straight to that business's Google review page.

---

## Supported Businesses & Dynamic Routing

All businesses share the exact same reusable customer review interface:

| Business Name | Type | URL Route |
| :--- | :--- | :--- |
| **Demo Waffle Shop** | Waffle Shop | `/r/demo-waffle-shop` |
| **Royal Cafe** | Cafe | `/r/royal-cafe` |
| **Fresh Mart** | Grocery Store | `/r/fresh-mart` |
| **XYZ Bar** | Cocktail Bar | `/r/xyz-bar` |

The Developer & QR page at `/` automatically renders scannable QR codes for each business with their complete customer URL.

---

## Business Configuration

All businesses are configured in a clean local JavaScript configuration file (`server/data/businesses.js` and `client/src/data/businesses.js`):

```js
export const businesses = {
  "demo-waffle-shop": {
    name: "Demo Waffle Shop",
    type: "waffle shop",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4"
  },

  "royal-cafe": {
    name: "Royal Cafe",
    type: "cafe",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ3S4Uqc-uEmsRpdAnqj1k58s"
  },

  "fresh-mart": {
    name: "Fresh Mart",
    type: "grocery store",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJyeZ2_D-vEmsRLXo7H7P5v5Q"
  },

  "xyz-bar": {
    name: "XYZ Bar",
    type: "cocktail bar",
    googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJdd4hrwug2EcRmSrV3Vo6llI"
  }
};
```

---

## Core User Flow (Unchanged)

1. **Scan QR / Open URL**: Customer opens `/r/:businessSlug`.
2. **Interactive Rating**: "How was your experience at [Business Name]?" with 5 large stars.
3. **Experience Highlights**: "What did you like?" with multi-select pills (Food, Service, Ambience, Price, Cleanliness) and optional text note.
4. **Factual Review Generation**: Deterministic template built solely from customer input without hallucinated facts.
5. **1-Tap Copy**: "Copy Review" button changes to "Copied ✓".
6. **Google Review Redirect**: "Leave Google Review →" opens that business's specific Google review URL in a new tab.

---

## Getting Started

### 1. Run Development Server
```bash
npm run dev
```
- Express backend: `http://localhost:5000`
- Vite frontend: `http://localhost:5173`

### 2. Run Production Server
```bash
npm run build
npm start
```
- Express serves both the REST API and the built React frontend at `http://localhost:5000`.

### 3. Run Tests
```bash
# Run unit & API integration tests
npm test

# Run end-to-end multi-business browser test
npm run test:e2e
```
