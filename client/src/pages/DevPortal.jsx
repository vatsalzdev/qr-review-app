import React, { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { generateSlug } from '../utils/slugify';
import { saveCustomBusiness } from '../data/businesses';

export default function DevPortal() {
  const [businessName, setBusinessName] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [activeBusiness, setActiveBusiness] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [currentOrigin, setCurrentOrigin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  // Dynamically resolve current browser origin and load recent business from MongoDB
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setCurrentOrigin(window.location.origin);
    }

    async function fetchRecentBusiness() {
      try {
        const lastSlug = typeof window !== 'undefined' ? localStorage.getItem('qr_review_last_active_slug') : null;
        if (lastSlug) {
          const res = await fetch(`/api/businesses/${lastSlug}`);
          if (res.ok) {
            const json = await res.json();
            if (json.success && json.data) {
              setActiveBusiness(json.data);
              return;
            }
          }
        }
        // Fallback: fetch list and take the last configured business
        const resList = await fetch('/api/businesses');
        if (resList.ok) {
          const jsonList = await resList.json();
          if (jsonList.success && Array.isArray(jsonList.data) && jsonList.data.length > 0) {
            setActiveBusiness(jsonList.data[jsonList.data.length - 1]);
          }
        }
      } catch (err) {
        console.warn('Could not load recent business from database:', err);
      }
    }

    fetchRecentBusiness();
  }, []);

  const previewSlug = generateSlug(businessName);

  const handleGenerate = async (e) => {
    e.preventDefault();
    const trimmedName = businessName.trim();
    const trimmedUrl = googleReviewUrl.trim();

    if (!trimmedName || !trimmedUrl) return;

    const slug = generateSlug(trimmedName);
    if (!slug) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch('/api/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          slug,
          googleReviewUrl: trimmedUrl
        })
      });

      if (!res.ok) {
        throw new Error(`Failed to create business (status ${res.status})`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Expected JSON response, got ${contentType}`);
      }

      const data = await res.json();
      if (data.success && data.data) {
        setActiveBusiness(data.data);
        saveCustomBusiness(data.data);
        try {
          localStorage.setItem('qr_review_last_active_slug', data.data.slug);
        } catch (_) {}
        return;
      }
      throw new Error('Invalid business creation response');
    } catch (err) {
      console.warn('API business creation unavailable, using local persistence fallback:', err.message);
      // Fallback: render QR code immediately using locally persisted business configuration
      const fallbackBiz = saveCustomBusiness({
        name: trimmedName,
        slug,
        googleReviewUrl: trimmedUrl,
        status: 'active'
      });
      setActiveBusiness(fallbackBiz);
      try {
        localStorage.setItem('qr_review_last_active_slug', slug);
      } catch (_) {}
    } finally {
      setIsSubmitting(false);
    }
  };

  // Permanent, clean slug-only URL: no query parameters attached
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
    </div>
  );
}
