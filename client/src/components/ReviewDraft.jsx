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

      // Open Google review URL after exactly 800ms
      if (googleReviewUrl) {
        setTimeout(() => {
          window.open(googleReviewUrl, '_blank');
        }, 800);
      }
    } else {
      setCopyFailed(true);
    }
  };

  return (
    <div className="review-draft-container animate-fade-in" role="region" aria-label="Review draft">
      <div className="section-header">
        <h3 className="section-title">Your review</h3>
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
        {/* Confirmation message — appears immediately above the button when clicked */}
        {copied && (
          <p className="copy-confirm-message" role="status" aria-live="polite">
            Review copied — opening Google…
          </p>
        )}

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={handleCopyAndLeaveReview}
          disabled={copied}
          className={`btn btn-primary-review ${copied ? 'btn-copied-state' : ''}`}
          aria-label="Copy review and open Google review page"
        >
          <span>{copied ? '✓ Review Copied!' : 'Copy & Leave Review →'}</span>
        </button>

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
