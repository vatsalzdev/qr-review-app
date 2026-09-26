import React, { useState, useEffect, useRef, useCallback } from 'react';
import StarRating from '../components/StarRating';
import ReviewDraft from '../components/ReviewDraft';
import ReviewGenerationAnimation from '../components/ReviewGenerationAnimation';
import { getBusinessBySlug } from '../data/businesses';
import { generateReview } from '../services/reviewGenerator';

const TYPE_EMOJI_MAP = {
  'waffle shop': '🧇',
  'cafe': '☕',
  'grocery store': '🛒',
  'cocktail bar': '🍸',
  'restaurant': '🍽️',
  'bar': '🍻'
};

export default function CustomerReviewPage({ slug }) {
  const [business, setBusiness] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [pendingReview, setPendingReview] = useState('');
  const [generationState, setGenerationState] = useState('idle'); // 'idle' | 'generating' | 'revealing' | 'ready' | 'error'
  const [generationError, setGenerationError] = useState(null);

  const reviewSectionRef = useRef(null);
  const latestRequestId = useRef(0);
  const abortControllerRef = useRef(null);
  const requestStartTimeRef = useRef(0);

  // Fetch business configuration from backend MongoDB by slug
  useEffect(() => {
    // Reset review-interaction state when navigating to a different business
    setRating(0);
    setReviewText('');
    setPendingReview('');
    setGenerationState('idle');
    setGenerationError(null);
    setLoading(true);
    setError(null);

    async function fetchBusiness() {
      try {
        const res = await fetch(`/api/businesses/${slug}`);
        if (!res.ok) {
          throw new Error(res.status === 404 ? 'Business not found' : 'Failed to load business');
        }
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          throw new Error('Expected JSON response');
        }
        const data = await res.json();
        if (data.success && data.data) {
          setBusiness(data.data);
          return;
        }
        throw new Error('Business not found');
      } catch (err) {
        const local = getBusinessBySlug(slug);
        if (local) {
          setBusiness(local);
          return;
        }
        setError(err.message);
        setBusiness(null);
      } finally {
        setLoading(false);
      }
    }

    fetchBusiness();
  }, [slug]);

  // Request review from AI backend endpoint
  const fetchAiReview = useCallback(async (targetRating) => {
    if (!targetRating) return;

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const requestId = ++latestRequestId.current;
    requestStartTimeRef.current = Date.now();

    setGenerationState('generating');
    setPendingReview('');
    setGenerationError(null);

    try {
      const res = await fetch('/api/generate-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: business?.name || '',
          rating: targetRating
        }),
        signal: controller.signal
      });

      if (!res.ok) {
        throw new Error(`Generation failed with status ${res.status}`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(`Expected JSON response, got ${contentType}`);
      }

      const data = await res.json();
      if (requestId === latestRequestId.current) {
        const generated = data.review || data.data?.review || '';
        if (!generated) {
          throw new Error('No review returned');
        }

        // Real API synchronization:
        // Ensure a brief minimum duration (500ms) so fast responses don't cause
        // a visual flicker, while still remaining instant and responsive.
        const elapsed = Date.now() - requestStartTimeRef.current;
        const minStreamDuration = 500;
        const delay = Math.max(0, minStreamDuration - elapsed);

        setTimeout(() => {
          if (requestId === latestRequestId.current) {
            setPendingReview(generated);
            setGenerationState('revealing');
          }
        }, delay);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        return;
      }
      try {
        const localReview = generateReview({
          businessName: business?.name || 'this business',
          rating: targetRating
        });
        if (localReview && requestId === latestRequestId.current) {
          const elapsed = Date.now() - requestStartTimeRef.current;
          const minStreamDuration = 500;
          const delay = Math.max(0, minStreamDuration - elapsed);

          setTimeout(() => {
            if (requestId === latestRequestId.current) {
              setPendingReview(localReview);
              setGenerationState('revealing');
            }
          }, delay);
          return;
        }
      } catch (_) {}
      if (requestId === latestRequestId.current) {
        setGenerationError('Unable to generate review automatically. Please try again.');
        setGenerationState('error');
      }
    }
  }, [business?.name]);

  const handleRevealComplete = useCallback(() => {
    setReviewText(pendingReview);
    setGenerationState('ready');
  }, [pendingReview]);

  const handleRatingSelect = (newRating) => {
    setRating(newRating);
    fetchAiReview(newRating);

    setTimeout(() => {
      if (reviewSectionRef.current) {
        reviewSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 120);
  };

  if (loading) {
    return (
      <div className="mobile-canvas flex-center">
        <div className="loader-spinner" />
        <p className="loading-text">Loading...</p>
      </div>
    );
  }

  if (error || !business) {
    return (
      <div className="mobile-canvas flex-center error-page">
        <div className="error-icon">⚠️</div>
        <h2>Business Not Found</h2>
        <p>We couldn't locate a business for <code>/r/{slug}</code>.</p>
        <a href="/" className="btn btn-secondary">Go to Developer Portal</a>
      </div>
    );
  }

  // Handle suspended business status
  if (business.status === 'suspended') {
    return (
      <div className="mobile-canvas flex-center suspended-page">
        <div className="suspended-icon">⏸️</div>
        <h2>Service Currently Unavailable</h2>
        <p>Review collection for <strong>{business.name}</strong> is currently paused.</p>
        <span className="status-badge-suspended">Status: Suspended</span>
      </div>
    );
  }

  const avatar = TYPE_EMOJI_MAP[business.type?.toLowerCase()] || '🏪';

  return (
    <div className="mobile-wrapper">
      <main className="mobile-canvas">
        {/* Reusable Header */}
        <header className="shop-header">
          <div className="shop-avatar">
            <span>{avatar}</span>
          </div>
          <h1 className="shop-name">{business.name}</h1>
          {business.type && (
            <span className="business-type-pill">{business.type}</span>
          )}
        </header>

        {/* 1. Star Rating Selection */}
        <section className="step-card">
          <StarRating
            rating={rating}
            onRatingChange={handleRatingSelect}
            businessName={business.name}
          />
        </section>

        {/* 2. Review Generation & Review Draft Display */}
        {rating > 0 && (
          <div ref={reviewSectionRef} className="step-section">
            {(generationState === 'generating' || generationState === 'revealing') && (
              <section className="step-card animate-fade-in" aria-live="polite">
                <ReviewGenerationAnimation
                  state={generationState}
                  rating={rating}
                  businessName={business.name}
                  generatedReview={pendingReview}
                  onRevealComplete={handleRevealComplete}
                />
              </section>
            )}

            {generationState === 'error' && generationError && (
              <section className="step-card animate-fade-in">
                <div className="generation-error" role="alert">
                  <p className="generation-error-msg">{generationError}</p>
                  <button
                    type="button"
                    onClick={() => fetchAiReview(rating)}
                    className="btn-retry"
                  >
                    Try Again
                  </button>
                </div>
              </section>
            )}

            {generationState === 'ready' && reviewText && (
              <section className="step-card animate-fade-in">
                <ReviewDraft
                  key={rating}
                  reviewText={reviewText}
                  onReviewChange={setReviewText}
                  googleReviewUrl={business.googleReviewUrl}
                  rating={rating}
                />
              </section>
            )}
          </div>
        )}

        {/* Minimal footer */}
        <footer className="page-footer">
          <p className="footer-note">
            Fast, genuine reviews powered by direct customer feedback.
          </p>
        </footer>
      </main>
    </div>
  );
}
