import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function DevQrCard({ business, onUpdateGoogleUrl }) {
  const [tempUrl, setTempUrl] = useState(business?.googleReviewUrl || '');
  const [isSaved, setIsSaved] = useState(false);

  if (!business) return null;

  // Build the full customer review URL based on the current window location
  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const customerReviewUrl = `${currentOrigin}/r/${business.slug}`;

  const handleSaveUrl = (e) => {
    e.preventDefault();
    if (onUpdateGoogleUrl) {
      onUpdateGoogleUrl(business.slug, tempUrl);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <div className="dev-card">
      <div className="dev-card-header">
        <span className="dev-badge">Development & Business Hub</span>
        <h2>{business.avatarEmoji || '🏪'} {business.name}</h2>
        <p className="dev-subtitle">{business.category} • {business.location}</p>
      </div>

      <div className="qr-preview-section">
        <div className="qr-box">
          <QRCodeSVG
            value={customerReviewUrl}
            size={200}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="qr-meta">
          <p className="qr-hint">Scan with your phone camera or tap the direct link below:</p>
          <a
            href={`/r/${business.slug}`}
            className="direct-link-btn"
          >
            Open Customer Flow (/r/{business.slug}) →
          </a>
          <span className="qr-url-text">{customerReviewUrl}</span>
        </div>
      </div>

      <div className="config-section">
        <h3>Business Configuration</h3>
        <form onSubmit={handleSaveUrl} className="config-form">
          <label htmlFor="google-review-url-input">
            Target Google Review URL:
          </label>
          <div className="input-group">
            <input
              id="google-review-url-input"
              type="url"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="https://search.google.com/local/writereview?placeid=..."
              required
              className="config-input"
            />
            <button type="submit" className="config-save-btn">
              {isSaved ? 'Saved ✓' : 'Update URL'}
            </button>
          </div>
          <span className="config-note">
            When customer taps &ldquo;Leave Google Review&rdquo;, this destination opens.
          </span>
        </form>
      </div>
    </div>
  );
}
