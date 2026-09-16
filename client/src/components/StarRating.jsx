import React, { useState } from 'react';

/**
 * 5 large interactive stars designed for mobile touch.
 * Visually highlights selected stars with subtle animation.
 */
export default function StarRating({ rating, onRatingChange, businessName }) {
  const [hovered, setHovered] = useState(0);

  const starLabels = [
    'Disappointing (1 star)',
    'Below expected (2 stars)',
    'Decent (3 stars)',
    'Really good (4 stars)',
    'Exceptional (5 stars)'
  ];

  return (
    <div className="star-rating-container" role="region" aria-label="Star rating selection">
      <h2 className="rating-prompt">
        How was your experience at{' '}
        <span className="business-name-highlight">{businessName || 'our shop'}</span>?
      </h2>

      <div className="stars-wrapper" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((starValue) => {
          const isFilled = (hovered || rating) >= starValue;
          const isSelected = rating === starValue;

          return (
            <button
              key={starValue}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={starLabels[starValue - 1]}
              className={`star-button ${isFilled ? 'filled' : 'empty'} ${isSelected ? 'selected' : ''}`}
              onClick={() => onRatingChange(starValue)}
              onMouseEnter={() => setHovered(starValue)}
              onMouseLeave={() => setHovered(0)}
              onTouchStart={() => setHovered(starValue)}
              onTouchEnd={() => setHovered(0)}
            >
              <svg
                viewBox="0 0 24 24"
                className="star-svg"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                  fill={isFilled ? '#F59E0B' : 'transparent'}
                  stroke={isFilled ? '#D97706' : '#CBD5E1'}
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          );
        })}
      </div>

      {rating > 0 && (
        <div className="rating-caption animate-fade-in">
          {rating === 5 && '🌟 Loved it!'}
          {rating === 4 && '👍 Really liked it!'}
          {rating === 3 && '🙂 Decent experience'}
          {rating === 2 && '😐 Needs some work'}
          {rating === 1 && '🙁 Disappointing'}
        </div>
      )}
    </div>
  );
}
