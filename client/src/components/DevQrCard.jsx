import React, { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

const TYPE_EMOJI_MAP = {
  'waffle shop': '🧇',
  'cafe': '☕',
  'grocery store': '🛒',
  'cocktail bar': '🍸',
  'restaurant': '🍽️',
  'bar': '🍻'
};

export default function DevQrCard({ business, onUpdateGoogleUrl }) {
  const [tempUrl, setTempUrl] = useState(business?.googleReviewUrl || '');
  const [isSaved, setIsSaved] = useState(false);

  if (!business) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const customerReviewUrl = `${currentOrigin}/r/${business.slug}`;
  const emoji = TYPE_EMOJI_MAP[business.type?.toLowerCase()] || '🏪';

  const handleSaveUrl = (e) => {
    e.preventDefault();
    if (onUpdateGoogleUrl) {
      onUpdateGoogleUrl(business.slug, tempUrl);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    }
  };

  return (
    <div className="dev-card" id={`card-${business.slug}`}>
      <div className="dev-card-header">
        <div className="biz-header-top">
          <span className="biz-emoji">{emoji}</span>
          <span className="business-type-badge">{business.type}</span>
        </div>
        <h2 className="biz-name">{business.name}</h2>
        <div className="biz-route-tag">
          <code>/r/{business.slug}</code>
        </div>
      </div>

      <div className="qr-preview-section">
        <div className="qr-box">
          <QRCodeSVG
            value={customerReviewUrl}
            size={180}
            level="H"
            includeMargin={true}
          />
        </div>

        <div className="qr-meta">
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
        <form onSubmit={handleSaveUrl} className="config-form">
          <label htmlFor={`google-url-${business.slug}`}>
            Configured Google Review URL:
          </label>
          <div className="input-group">
            <input
              id={`google-url-${business.slug}`}
              type="url"
              value={tempUrl}
              onChange={(e) => setTempUrl(e.target.value)}
              placeholder="https://search.google.com/local/writereview?placeid=..."
              required
              className="config-input"
            />
            <button type="submit" className="config-save-btn">
              {isSaved ? 'Saved ✓' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
