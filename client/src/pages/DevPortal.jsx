import React, { useState, useEffect } from 'react';
import DevQrCard from '../components/DevQrCard';
import { getAllBusinesses } from '../data/businesses.js';

export default function DevPortal() {
  const [businesses, setBusinesses] = useState(() => getAllBusinesses());

  useEffect(() => {
    async function loadBusinesses() {
      try {
        const res = await fetch('/api/businesses');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.data) && data.data.length > 0) {
            setBusinesses(data.data);
          }
        }
      } catch {
        // Keeps the local fallback businesses
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
          Scan or click any business below to test the reusable customer review experience.
        </p>
      </header>

      <div className="dev-businesses-grid">
        {businesses.map((biz) => (
          <DevQrCard
            key={biz.slug}
            business={biz}
            onUpdateGoogleUrl={handleUpdateGoogleUrl}
          />
        ))}
      </div>

      <div className="dev-card info-card" style={{ marginTop: '32px' }}>
        <h3>Multi-Tenant Architecture</h3>
        <p className="dev-subtitle" style={{ marginBottom: '16px' }}>
          All customer links route into the single reusable <code>&lt;CustomerReviewPage /&gt;</code> component via <code>/r/:businessSlug</code>.
        </p>
        <div className="quick-links-row">
          {businesses.map((b) => (
            <a key={b.slug} href={`/r/${b.slug}`} className="direct-link-pill">
              /r/{b.slug} ({b.name})
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
