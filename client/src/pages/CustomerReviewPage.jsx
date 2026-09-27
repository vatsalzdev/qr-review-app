import React, { useState, useEffect, useRef, useCallback } from 'react';
import StarRating from '../components/StarRating';
import ReviewDraft from '../components/ReviewDraft';
import ReviewGenerationAnimation from '../components/ReviewGenerationAnimation';
import { getBusinessBySlug } from '../data/businesses';
import { generateReview } from '../services/reviewGenerator';
import { getBusinessPresentation } from '../utils/businessPersonalization';

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
    if (typeof window !== 'undefined') {
      window.__qrPerf = window.__qrPerf || {};
      window.__qrPerf.mountTime = performance.now();
      window.__qrPerf.businessFetchStart = performance.now();
    }

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
          if (typeof window !== 'undefined') {
            window.__qrPerf.businessFetchEnd = performance.now();
            window.__qrPerf.businessLookupMs = Math.round(window.__qrPerf.businessFetchEnd - window.__qrPerf.businessFetchStart);
            window.__qrPerf.pageInteractiveTime = performance.now();
          }
          setBusiness(data.data);
          return;
        }
        throw new Error('Business not found');
      } catch (err) {
        const local = getBusinessBySlug(slug);
        if (local) {
          if (typeof window !== 'undefined') {
            window.__qrPerf.businessFetchEnd = performance.now();
            window.__qrPerf.businessLookupMs = Math.round(window.__qrPerf.businessFetchEnd - window.__qrPerf.businessFetchStart);
            window.__qrPerf.pageInteractiveTime = performance.now();
          }
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

    if (typeof window !== 'undefined') {
      window.__qrPerf = window.__qrPerf || {};
      window.__qrPerf.aiRequestStart = performance.now();
    }

    setGenerationState('generating');
    setPendingReview('');
    setGenerationError(null);

    try {
      const res = await fetch('/api/generate-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: business?.name || '',
          rating: targetRating,
          businessType: business?.type || '',
          aiContext: business?.aiContext || '',
          slug: business?.slug || slug || ''
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
      if (typeof window !== 'undefined') {
        window.__qrPerf.aiResponseEnd = performance.now();
        window.__qrPerf.aiLatencyMs = Math.round(window.__qrPerf.aiResponseEnd - window.__qrPerf.aiRequestStart);
        if (data._perf) {
          window.__qrPerf.serverPerf = data._perf;
        }
      }

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
    if (typeof window !== 'undefined') {
      window.__qrPerf = window.__qrPerf || {};
      window.__qrPerf.reviewUsableTime = performance.now();
      if (window.__qrPerf.ratingTapTime) {
        window.__qrPerf.ratingToReviewMs = Math.round(window.__qrPerf.reviewUsableTime - window.__qrPerf.ratingTapTime);
      }
    }
    setReviewText(pendingReview);
    setGenerationState('ready');
  }, [pendingReview]);

  const handleRatingSelect = (newRating) => {
    if (typeof window !== 'undefined') {
      window.__qrPerf = window.__qrPerf || {};
      window.__qrPerf.ratingTapTime = performance.now();
    }
    const isFirstRating = rating === 0;
    setRating(newRating);
    fetchAiReview(newRating);

    if (isFirstRating) {
      setTimeout(() => {
        if (reviewSectionRef.current) {
          reviewSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }, 100);
    }
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

  const presentation = getBusinessPresentation(business.type);
  const avatar = presentation.icon;

  return (
    <div className="mobile-wrapper">
      <main className={`mobile-canvas ${presentation.themeClass}`}>
        {/* Reusable Header */}
        <header className="shop-header">
          <div className="shop-avatar" aria-hidden="true">
            <span>{avatar}</span>
          </div>
          <h1 className="shop-name">{business.name}</h1>
          <span className="business-type-pill">{presentation.label}</span>
        </header>

        {/* 1. Star Rating Selection */}
        <section className="step-card">
          <StarRating
            rating={rating}
            onRatingChange={handleRatingSelect}
            businessName={business.name}
            promptPrefix={presentation.promptPrefix}
          />
        </section>

        {/* 2. Review Generation & Review Draft Display */}
        {rating > 0 && (
          <div ref={reviewSectionRef} className="step-section">
            {(generationState === 'generating' || generationState === 'revealing') && (
              <section className="step-card animate-generation-surface" aria-live="polite">
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
              <section className="step-card animate-draft-morph">
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
