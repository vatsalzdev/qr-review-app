/**
 * Generates a short, natural customer review based strictly and deterministically
 * on the customer's selected rating, chosen aspects, and optional specific notes.
 *
 * Adheres strictly to the product constraints:
 * - Uses ONLY the information provided by the customer.
 * - Does NOT invent specific facts, dishes, employees, or events.
 * - Reflects the rating tone accurately.
 */

export function formatAspects(aspects = []) {
  if (!aspects || aspects.length === 0) return '';

  const labelMap = {
    food: 'food',
    service: 'service',
    ambience: 'ambience',
    price: 'price',
    cleanliness: 'cleanliness'
  };

  const clean = aspects.map(a => labelMap[a.toLowerCase()] || a.toLowerCase());

  if (clean.length === 1) {
    return `the ${clean[0]}`;
  }
  if (clean.length === 2) {
    return `the ${clean[0]} and ${clean[1]}`;
  }
  return `the ${clean.slice(0, -1).join(', ')}, and ${clean[clean.length - 1]}`;
}

export function formatCustomNote(note = '') {
  const trimmed = (note || '').trim();
  if (!trimmed) return '';
  // Ensure the note ends with a punctuation mark if not already present
  if (/[.!?]$/.test(trimmed)) {
    return trimmed;
  }
  return `${trimmed}.`;
}

export function generateReview({ businessName = 'this business', rating = 5, likedAspects = [], specificFeedback = '' }) {
  const name = businessName || 'this business';
  const aspectsText = formatAspects(likedAspects);
  const customNote = formatCustomNote(specificFeedback);
  const hasAspects = likedAspects && likedAspects.length > 0;
  const hasNote = Boolean(customNote);

  // Fallback defaults (when customer provides rating only, exactly as specified in the prompt)
  if (!hasAspects && !hasNote) {
    switch (rating) {
      case 5:
        return `Really enjoyed my experience at ${name}. The food and service were great, and the ambience was lovely.`;
      case 4:
        return `Had a really good experience at ${name}. I especially enjoyed the food and service.`;
      case 3:
        return `My experience at ${name} was decent. I liked the food and ambience, although there is some room for improvement.`;
      case 2:
        return `The experience was below what I expected. I liked the food, but there are areas that could be improved.`;
      case 1:
      default:
        return `My experience at ${name} was disappointing. There are several areas that could be improved.`;
    }
  }

  // Dynamic template generation incorporating customer's exact inputs
  let sentences = [];

  switch (rating) {
    case 5: {
      sentences.push(`Really enjoyed my experience at ${name}.`);
      if (hasAspects) {
        if (likedAspects.length === 1) {
          sentences.push(`${capitalize(aspectsText)} was great.`);
        } else {
          sentences.push(`${capitalize(aspectsText)} were great.`);
        }
      }
      break;
    }

    case 4: {
      sentences.push(`Had a really good experience at ${name}.`);
      if (hasAspects) {
        sentences.push(`I especially enjoyed ${aspectsText}.`);
      }
      break;
    }

    case 3: {
      sentences.push(`My experience at ${name} was decent.`);
      if (hasAspects) {
        sentences.push(`I liked ${aspectsText}, although there is some room for improvement.`);
      } else {
        sentences.push(`There is some room for improvement.`);
      }
      break;
    }

    case 2: {
      sentences.push(`The experience was below what I expected.`);
      if (hasAspects) {
        sentences.push(`I liked ${aspectsText}, but there are areas that could be improved.`);
      } else {
        sentences.push(`There are areas that could be improved.`);
      }
      break;
    }

    case 1:
    default: {
      sentences.push(`My experience at ${name} was disappointing.`);
      if (hasAspects) {
        sentences.push(`While I appreciated ${aspectsText}, there are several areas that could be improved.`);
      } else {
        sentences.push(`There are several areas that could be improved.`);
      }
      break;
    }
  }

  // Seamlessly incorporate customer's specific typed feedback if provided
  if (hasNote) {
    sentences.push(customNote);
  }

  return sentences.join(' ');
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
}
