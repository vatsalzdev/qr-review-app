import React from 'react';

const ASPECT_OPTIONS = [
  { id: 'Food', label: 'Food', icon: '🍽️' },
  { id: 'Service', label: 'Service', icon: '🤝' },
  { id: 'Ambience', label: 'Ambience', icon: '✨' },
  { id: 'Price', label: 'Price', icon: '🏷️' },
  { id: 'Cleanliness', label: 'Cleanliness', icon: '🧼' },
];

export default function ExperienceSelection({
  selectedAspects,
  onToggleAspect,
  specificFeedback,
  onFeedbackChange,
  rating
}) {
  // Respectful tone tweak based on rating while keeping prompt's exact core question
  const headingText = rating <= 2 ? 'What aspects stood out?' : 'What did you like?';
  const subPromptText = rating <= 2
    ? 'Select any areas you want to highlight (optional):'
    : 'Select all that apply:';

  return (
    <div className="experience-container animate-fade-in" role="region" aria-label="Experience details">
      <div className="section-header">
        <h3 className="section-title">{headingText}</h3>
        <span className="section-subtitle">{subPromptText}</span>
      </div>

      <div className="pill-grid" role="group" aria-label="Experience options">
        {ASPECT_OPTIONS.map(({ id, label, icon }) => {
          const isChecked = selectedAspects.includes(id);
          return (
            <button
              key={id}
              type="button"
              role="checkbox"
              aria-checked={isChecked}
              onClick={() => onToggleAspect(id)}
              className={`pill-button ${isChecked ? 'pill-selected' : ''}`}
            >
              <span className="pill-icon">{icon}</span>
              <span className="pill-label">{label}</span>
              {isChecked && <span className="pill-check">✓</span>}
            </button>
          );
        })}
      </div>

      <div className="feedback-field-container">
        <label htmlFor="specific-enjoyed-input" className="field-label">
          Anything specific you enjoyed? <span className="optional-tag">(optional)</span>
        </label>
        <textarea
          id="specific-enjoyed-input"
          value={specificFeedback}
          onChange={(e) => onFeedbackChange(e.target.value)}
          placeholder="e.g. Loved the chocolate waffle and friendly service"
          rows={3}
          className="feedback-textarea"
          maxLength={300}
        />
        <div className="character-hint">
          {specificFeedback.length > 0 && `${specificFeedback.length}/300 characters`}
        </div>
      </div>
    </div>
  );
}
