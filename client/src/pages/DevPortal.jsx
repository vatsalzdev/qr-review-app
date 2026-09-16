import React, { useState, useEffect } from 'react';
import DevQrCard from '../components/DevQrCard';

export default function DevPortal() {
  const [businesses, setBusinesses] = useState([
    {
      id: 'b1',
      name: 'Demo Waffle Shop',
      slug: 'demo-waffle-shop',
      category: 'Artisanal Waffle & Dessert Café',
      location: '124 Maple Street, Downtown',
      googleReviewUrl: 'https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4',
      avatarEmoji: '🧇'
    }
  ]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadBusinesses() {
      try {
        const res = await fetch('/api/businesses');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data && data.data.length > 0) {
            setBusinesses(data.data);
          }
        }
      } catch {
        // Fallback to local state if server isn't running yet
      }
    }
    loadBusinesses();
  }, []);

  const handleUpdateGoogleUrl = async (slug, newUrl) => {
    try {
      const res = await fetch(`/api/businesses/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleReviewUrl: newUrl })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setBusinesses(prev =>
            prev.map(b => b.slug === slug ? data.data : b)
          );
        }
      } else {
        // Local update if offline
        setBusinesses(prev =>
          prev.map(b => b.slug === slug ? { ...b, googleReviewUrl: newUrl } : b)
        );
      }
    } catch {
      setBusinesses(prev =>
        prev.map(b => b.slug === slug ? { ...b, googleReviewUrl: newUrl } : b)
      );
    }
  };

  return (
    <div className="dev-portal-container">
      <header className="dev-header">
        <div className="dev-logo-row">
          <span className="dev-logo-icon">📱</span>
          <h1>QR Review App Developer Portal</h1>
        </div>
        <p className="dev-header-desc">
          Generate, scan, and test the mobile customer review experience.
        </p>
      </header>

      <div className="dev-content-grid">
        {businesses.map((biz) => (
          <DevQrCard
            key={biz.slug}
            business={biz}
            onUpdateGoogleUrl={handleUpdateGoogleUrl}
          />
        ))}

        <div className="dev-card info-card">
          <h3>How the Flow Works</h3>
          <ol className="flow-list">
            <li>
              <strong>QR Code Placement:</strong> Printed on table tents, receipts, or checkout counter.
            </li>
            <li>
              <strong>Customer Scans:</strong> Opens <code>/r/{businesses[0]?.slug}</code> on their smartphone.
            </li>
            <li>
              <strong>Instant Rating:</strong> Customer taps 1-5 stars.
            </li>
            <li>
              <strong>Experience Tags:</strong> Food, Service, Ambience, Price, Cleanliness + custom note.
            </li>
            <li>
              <strong>Review Generated:</strong> Factual, deterministic template built solely from customer input.
            </li>
            <li>
              <strong>1-Tap Copy & Redirect:</strong> Review copied to clipboard; Google Place review page opened.
            </li>
          </ol>

          <div className="demo-links-box">
            <h4>Quick Links</h4>
            <a href={`/r/${businesses[0]?.slug}`} className="btn-link">
              Launch Customer View in this tab →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
