import React, { useState } from 'react';

export default function ReviewDraft({
  reviewText,
  onReviewChange,
  googleReviewUrl,
  rating
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(reviewText);
      } else {
        // Fallback for non-https or restricted webviews
        const textArea = document.createElement('textarea');
        textArea.value = reviewText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }

      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => {
        setCopied(false);
      }, 2500);
    } catch (err) {
      console.error('Failed to copy text: ', err);
      setCopyFailed(true);
      setTimeout(() => setCopyFailed(false), 2000);
    }
  };

  const handleGoogleReviewClick = () => {
    // Open configurable Google review URL in a new tab
    if (googleReviewUrl) {
      window.open(googleReviewUrl, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <div className="review-draft-container animate-fade-in" role="region" aria-label="Review draft">
      <div className="section-header">
        <div className="draft-header-row">
          <h3 className="section-title">Your review draft</h3>
          <span className="badge-rating">{rating} ★ rating</span>
        </div>
        <p className="draft-subtitle">
          Generated based purely on what you shared. You can edit this text directly before copying.
        </p>
      </div>

      <div className="draft-box-wrapper">
        <textarea
          className="draft-textarea"
          value={reviewText}
          onChange={(e) => onReviewChange(e.target.value)}
          rows={4}
          aria-label="Generated review draft"
        />
      </div>

      <div className="actions-container">
        {/* Prominent Copy Review Button */}
        <button
          type="button"
          onClick={handleCopy}
          className={`btn btn-copy ${copied ? 'btn-copied' : ''}`}
          aria-live="polite"
        >
          {copied ? (
            <>
              <span className="btn-icon">✓</span>
              <span>Copied ✓</span>
            </>
          ) : (
            <>
              <span className="btn-icon">📋</span>
              <span>Copy Review</span>
            </>
          )}
        </button>

        {copyFailed && (
          <p className="copy-error-hint">Please manually select and copy the text above.</p>
        )}

        {/* Step hint showing the seamless flow */}
        <div className="flow-hint">
          <span className="flow-step">1. Tap <strong>Copy Review</strong></span>
          <span className="flow-arrow">→</span>
          <span className="flow-step">2. Tap <strong>Leave Google Review</strong></span>
          <span className="flow-arrow">→</span>
          <span className="flow-step">3. Paste your review on Google</span>
        </div>

        {/* Prominent Google Review Button */}
        <button
          type="button"
          onClick={handleGoogleReviewClick}
          className="btn btn-google"
          aria-label="Open Google review page"
        >
          <span>Leave Google Review</span>
          <span className="btn-arrow">→</span>
        </button>
      </div>
    </div>
  );
}
