import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { generateSlug } from '../utils/slugify';
import {
  saveCustomBusiness,
  getBusinessBySlug,
  getAllBusinesses,
  getStoredCustomBusinesses
} from '../data/businesses';

export default function DevPortal() {
  const [businessName, setBusinessName] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [activeBusiness, setActiveBusiness] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [historyList, setHistoryList] = useState([]);
  const [currentOrigin, setCurrentOrigin] = useState('');

  // Dynamically resolve current browser origin
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }

    // Load any previously created or preset businesses
    const all = getAllBusinesses();
    setHistoryList(all);

    // If there is an active business or created businesses in localStorage, show the most recent one
    const custom = getStoredCustomBusinesses();
    const customKeys = Object.keys(custom);
    if (customKeys.length > 0) {
      const mostRecentKey = customKeys[customKeys.length - 1];
      setActiveBusiness(custom[mostRecentKey]);
    } else if (all.length > 0) {
      setActiveBusiness(all[0]);
    }
  }, []);

  const previewSlug = generateSlug(businessName);

  const handleGenerate = (e) => {
    e.preventDefault();
    const trimmedName = businessName.trim();
    const trimmedUrl = googleReviewUrl.trim();

    if (!trimmedName || !trimmedUrl) return;

    const slug = generateSlug(trimmedName);
    if (!slug) return;

    // Save to local browser storage (localStorage)
    const saved = saveCustomBusiness({
      name: trimmedName,
      slug,
      googleReviewUrl: trimmedUrl
    });

    setActiveBusiness(saved);
    setHistoryList(getAllBusinesses());
  };

  const handleSelectHistory = (slug) => {
    const biz = getBusinessBySlug(slug);
    if (biz) {
      setActiveBusiness(biz);
    }
  };

  const customerUrl = activeBusiness && currentOrigin
    ? `${currentOrigin}/r/${activeBusiness.slug}`
    : '';

  const handleDownloadQR = () => {
    const canvas = document.getElementById('business-qr-canvas');
    if (!canvas || !activeBusiness) return;

    const pngUrl = canvas.toDataURL('image/png');
    const downloadLink = document.createElement('a');
    downloadLink.download = `${activeBusiness.slug}-qr.png`;
    downloadLink.href = pngUrl;
    downloadLink.click();
  };

  const handleCopyUrl = async () => {
    if (!customerUrl) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(customerUrl);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = customerUrl;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2200);
    } catch (err) {
      console.error('Failed to copy URL: ', err);
    }
  };

  return (
    <div className="dev-portal-container">
      {/* 1. Header & Creation Form */}
      <div className="create-qr-card">
        <header className="create-qr-header">
          <span className="create-badge">QR Generation Hub</span>
          <h1 className="create-title">Create Your Review QR</h1>
          <p className="create-subtitle">
            Generate a custom QR code for your business that links customers straight to your review flow.
          </p>
        </header>

        <form onSubmit={handleGenerate} className="create-qr-form">
          <div className="form-group">
            <label htmlFor="business-name" className="form-label">
              Business Name
            </label>
            <input
              id="business-name"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Royal Cafe"
              required
              className="form-input"
            />
            {businessName.trim().length > 0 && (
              <span className="slug-preview">
                Customer path: <code>/r/{previewSlug}</code>
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="google-review-url" className="form-label">
              Google Review URL
            </label>
            <input
              id="google-review-url"
              type="url"
              value={googleReviewUrl}
              onChange={(e) => setGoogleReviewUrl(e.target.value)}
              placeholder="https://search.google.com/local/writereview?placeid=..."
              required
              className="form-input"
            />
          </div>

          <button type="submit" className="btn-generate-qr">
            Generate QR
          </button>
        </form>
      </div>

      {/* 2. After Submission: QR Presentation Section */}
      {activeBusiness && (
        <section className="generated-result-card animate-fade-in" id="qr-result-section">
          <div className="result-meta-header">
            <div className="result-field">
              <span className="field-label-muted">Business:</span>
              <h2 className="result-business-name">{activeBusiness.name}</h2>
            </div>

            <div className="result-field">
              <span className="field-label-muted">Customer URL:</span>
              <div className="customer-url-box">
                <a
                  href={customerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="customer-url-link"
                >
                  {customerUrl}
                </a>
              </div>
            </div>
          </div>

          {/* Screenshot-Friendly Printable Card */}
          <div className="qr-presentation-wrapper">
            <span className="field-label-muted">QR Code:</span>
            <div className="printable-qr-frame">
              <div className="qr-print-banner">
                <span className="print-brand-name">{activeBusiness.name}</span>
                <span className="print-tagline">Scan to leave a verified review</span>
              </div>

              <div className="qr-canvas-holder" data-qr-value={customerUrl}>
                <QRCodeCanvas
                  id="business-qr-canvas"
                  value={customerUrl}
                  size={240}
                  level="H"
                  includeMargin={true}
                />
              </div>

              <p className="qr-url-footer">{customerUrl}</p>
            </div>
            <p className="screenshot-hint">
              💡 Clean print layout: You can screenshot the box above directly or click Download QR.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="result-actions-grid">
            <button
              type="button"
              onClick={handleDownloadQR}
              className="btn btn-secondary-action btn-download-qr"
            >
              <span className="btn-icon">📥</span>
              <span>Download QR</span>
            </button>

            <button
              type="button"
              onClick={handleCopyUrl}
              className={`btn btn-secondary-action btn-copy-url ${copiedUrl ? 'btn-action-copied' : ''}`}
            >
              <span className="btn-icon">{copiedUrl ? '✓' : '📋'}</span>
              <span>{copiedUrl ? 'Copied ✓' : 'Copy URL'}</span>
            </button>

            <a
              href={customerUrl}
              className="btn btn-primary-launch"
            >
              <span>Open Customer Flow</span>
              <span className="btn-arrow">→</span>
            </a>
          </div>
        </section>
      )}

      {/* 3. Previously Created / Available Businesses */}
      {historyList.length > 0 && (
        <section className="saved-businesses-section">
          <h3 className="section-title-sm">Available Businesses ({historyList.length})</h3>
          <div className="business-pills-row">
            {historyList.map((b) => {
              const isSelected = activeBusiness?.slug === b.slug;
              return (
                <button
                  key={b.slug}
                  type="button"
                  onClick={() => handleSelectHistory(b.slug)}
                  className={`history-pill-btn ${isSelected ? 'history-pill-active' : ''}`}
                >
                  <span className="pill-name">{b.name}</span>
                  <span className="pill-slug">/r/{b.slug}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
