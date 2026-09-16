import React, { useState } from 'react';

export default function ReviewDraft({
  reviewText,
  onReviewChange,
  googleReviewUrl,
  rating
}) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const handleCopyAndLeaveReview = async () => {
    let success = false;

    // 1. Copy the current editable review text to clipboard
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(reviewText);
        success = true;
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = reviewText;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand('copy');
        textArea.remove();
      }
    } catch (err) {
      console.warn('Clipboard write failed: ', err);
      success = false;
    }

    if (success) {
      setCopied(true);
      setCopyFailed(false);
      setTimeout(() => setCopied(false), 4000);
    } else {
      setCopyFailed(true);
    }

    // 2. Open configured Google review URL in a new tab
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
          Generated based purely on what you shared. Feel free to edit below before submitting.
        </p>
      </div>

      <div className="draft-box-wrapper">
        <textarea
          className="draft-textarea"
          value={reviewText}
          onChange={(e) => onReviewChange(e.target.value)}
          rows={4}
          aria-label="Editable review draft"
        />
      </div>

      <div className="actions-container">
        {/* Single Primary Action Button */}
        <button
          type="button"
          onClick={handleCopyAndLeaveReview}
          className={`btn btn-primary-review ${copied ? 'btn-copied-state' : ''}`}
          aria-label="Copy review and open Google review page"
        >
          <span>{copied ? 'Copied ✓ & Opening Google' : 'Copy & Leave Review'}</span>
          <span className="btn-arrow">→</span>
        </button>

        {/* Subtle helper text */}
        <p className={`subtle-helper-text ${copied ? 'helper-active' : ''}`}>
          Your review has been copied. Paste it on Google and submit your rating.
        </p>

        {/* Graceful clipboard failure message */}
        {copyFailed && (
          <div className="copy-error-banner" role="alert">
            <span className="error-icon">⚠️</span>
            <span>Couldn&apos;t copy automatically. Please manually select and copy your review draft above.</span>
          </div>
        )}
      </div>
    </div>
  );
}
