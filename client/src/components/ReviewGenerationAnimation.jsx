import React, { useState, useEffect, useMemo } from 'react';

const STATUS_MESSAGES = [
  'Creating your review',
  'Finding the right words',
  'Making it sound natural',
  'Almost there'
];

const SNIPPETS_BY_RATING = {
  5: [
    { text: 'Exceptional quality', icon: '★', tilt: -1.2, scale: 1.02 },
    { text: 'Loved the atmosphere', icon: '✨', tilt: 1.5, scale: 0.98 },
    { text: 'Incredible customer care', icon: '🤝', tilt: -0.8, scale: 1.03 },
    { text: 'Top-notch experience', icon: '🌟', tilt: 1.0, scale: 0.97 },
    { text: 'Warm & welcoming team', icon: '💫', tilt: -1.5, scale: 1.01 },
    { text: 'Highly recommended', icon: '👌', tilt: 0.8, scale: 0.99 },
    { text: 'Wonderful visit', icon: '❤️', tilt: -1.0, scale: 1.02 },
    { text: 'Spotless & attentive', icon: '✨', tilt: 1.2, scale: 0.98 }
  ],
  4: [
    { text: 'Really solid visit', icon: '★', tilt: -1.0, scale: 1.01 },
    { text: 'Friendly & prompt staff', icon: '👍', tilt: 1.4, scale: 0.98 },
    { text: 'Comfortable atmosphere', icon: '☕', tilt: -1.2, scale: 1.03 },
    { text: 'Great customer care', icon: '🤝', tilt: 0.8, scale: 0.97 },
    { text: 'Dependable quality', icon: '👌', tilt: -0.6, scale: 1.02 },
    { text: 'Smooth experience', icon: '💫', tilt: 1.1, scale: 0.99 },
    { text: 'Courteous team', icon: '🌿', tilt: -1.4, scale: 1.0 },
    { text: 'Pleasant impression', icon: '✨', tilt: 1.2, scale: 0.98 }
  ],
  3: [
    { text: 'Decent overall visit', icon: '★', tilt: -1.0, scale: 1.0 },
    { text: 'Polite staff', icon: '🙂', tilt: 1.2, scale: 0.98 },
    { text: 'Met basic expectations', icon: '⚖️', tilt: -0.8, scale: 1.02 },
    { text: 'Room to improve', icon: '🔍', tilt: 1.0, scale: 0.97 },
    { text: 'Fair experience', icon: '👌', tilt: -1.3, scale: 1.01 },
    { text: 'Good potential', icon: '🌱', tilt: 0.9, scale: 0.99 },
    { text: 'Average visit', icon: '💬', tilt: -1.1, scale: 1.0 }
  ],
  2: [
    { text: 'Below expectations', icon: '★', tilt: -1.2, scale: 1.01 },
    { text: 'Needs some work', icon: '⚠️', tilt: 1.0, scale: 0.98 },
    { text: 'Inconsistent pace', icon: '⏳', tilt: -0.7, scale: 1.02 },
    { text: 'Staff was polite', icon: '💬', tilt: 1.3, scale: 0.97 },
    { text: 'Several areas lacking', icon: '🔍', tilt: -1.1, scale: 1.0 },
    { text: 'Underwhelming visit', icon: '📉', tilt: 0.8, scale: 0.99 }
  ],
  1: [
    { text: 'Disappointing visit', icon: '★', tilt: -1.0, scale: 1.0 },
    { text: 'Standards fell short', icon: '⚠️', tilt: 1.2, scale: 0.98 },
    { text: 'Significant issues', icon: '❗', tilt: -1.1, scale: 1.02 },
    { text: 'Needs attention', icon: '🔍', tilt: 0.8, scale: 0.97 },
    { text: 'Poor consistency', icon: '📉', tilt: -1.4, scale: 1.01 },
    { text: 'Frustrating visit', icon: '⚠️', tilt: 1.0, scale: 0.99 }
  ]
};

export default function ReviewGenerationAnimation({
  state, // 'generating' | 'revealing'
  rating = 5,
  businessName,
  generatedReview,
  onRevealComplete
}) {
  const [copyIndex, setCopyIndex] = useState(0);
  const isRevealing = state === 'revealing';

  // Cycle copy messages smoothly during generation
  useEffect(() => {
    if (isRevealing) return;

    setCopyIndex(0);
    const interval = setInterval(() => {
      setCopyIndex((prev) => (prev < STATUS_MESSAGES.length - 1 ? prev + 1 : prev));
    }, 1200);

    return () => clearInterval(interval);
  }, [isRevealing, rating]);

  // When in revealing state, allow the settled card to bloom before transitioning to ready
  useEffect(() => {
    if (!isRevealing) return;

    const timer = setTimeout(() => {
      if (onRevealComplete) {
        onRevealComplete();
      }
    }, 550);

    return () => clearTimeout(timer);
  }, [isRevealing, onRevealComplete]);

  const snippets = useMemo(() => {
    const validRating = Math.max(1, Math.min(5, Math.round(Number(rating)) || 5));
    return SNIPPETS_BY_RATING[validRating] || SNIPPETS_BY_RATING[5];
  }, [rating]);

  // Staggered duplicates for continuous marquee flow
  const row1Snippets = useMemo(() => [...snippets, ...snippets], [snippets]);
  const row2Snippets = useMemo(() => {
    const shifted = [...snippets.slice(3), ...snippets.slice(0, 3)];
    return [...shifted, ...shifted];
  }, [snippets]);

  const currentCopy = isRevealing ? 'Review ready' : STATUS_MESSAGES[copyIndex];

  return (
    <div
      className={`review-gen-animation-container ${isRevealing ? 'is-revealing' : ''}`}
      role="status"
      aria-live="polite"
    >
      {/* 1. Concise, Honest Status Copy Header */}
      <div className="gen-copy-header">
        <span
          className={`gen-status-indicator ${isRevealing ? 'is-ready' : 'is-generating'}`}
          aria-hidden="true"
        />
        <span key={currentCopy} className="gen-status-text animate-copy-fade">
          {currentCopy}
        </span>
      </div>

      {/* 2. Rapid Horizontal Streaming Cards Viewport */}
      <div className="card-stream-viewport" aria-hidden="true">
        <div className="stream-vignette vignette-left" />
        <div className="stream-vignette vignette-right" />

        <div className="stream-rows-holder">
          {/* Row 1 Track */}
          <div className="card-stream-track track-row-1">
            {row1Snippets.map((item, idx) => (
              <div
                key={`r1-${idx}`}
                className="stream-card"
                style={{
                  transform: `rotate(${item.tilt}deg) scale(${item.scale})`
                }}
              >
                <span className="stream-card-icon">{item.icon}</span>
                <span className="stream-card-text">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Row 2 Track */}
          <div className="card-stream-track track-row-2">
            {row2Snippets.map((item, idx) => (
              <div
                key={`r2-${idx}`}
                className="stream-card"
                style={{
                  transform: `rotate(${item.tilt * -0.8}deg) scale(${item.scale})`
                }}
              >
                <span className="stream-card-icon">{item.icon}</span>
                <span className="stream-card-text">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 3. Settled Card Reveal */}
        {isRevealing && generatedReview && (
          <div className="settled-card-overlay animate-settle-in">
            <div className="settled-card">
              <div className="settled-card-header">
                <span className="settled-badge">✨ Review drafted</span>
                <span className="settled-stars">{'★'.repeat(rating)}</span>
              </div>
              <p className="settled-card-body">
                {generatedReview}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
