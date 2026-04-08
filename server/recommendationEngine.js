import { attributeKeys } from './defaultProducts.js';

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function calculateDistance(left, right) {
  const total = attributeKeys.reduce((sum, key) => {
    const difference = left[key] - right[key];
    return sum + difference * difference;
  }, 0);

  return Math.sqrt(total / attributeKeys.length) / 10;
}

export function rankProducts(products, personStats) {
  return [...products]
    .map((product) => {
      const distance = clamp(calculateDistance(personStats, product.stats), 0, 1);
      return {
        ...product,
        distance,
        score: clamp(1 - distance, 0, 1),
      };
    })
    .sort((left, right) => left.distance - right.distance);
}

export function pickNextRecommendation(rankedProducts, activeProductId) {
  return (
    rankedProducts.find((product) => product.id !== activeProductId) ??
    rankedProducts.find((product) => product.id === activeProductId) ??
    rankedProducts[0]
  );
}

export function buildNotRecommendedLabel(rankedProducts, activeProductId, topCount = 2) {
  return rankedProducts
    .filter((product) => product.id !== activeProductId)
    .slice(-topCount)
    .map((product) => product.name)
    .join(', ');
}

export function applyProductAction(currentStats, personStats, actionType) {
  if (actionType === 'select') {
    return {
      nextStats: { ...currentStats },
      changes: [],
    };
  }

  const multiplier = actionType === 'buy' ? 0.18 : -0.12;
  const nextStats = { ...currentStats };

  attributeKeys.forEach((key) => {
    const difference = personStats[key] - currentStats[key];
    nextStats[key] = clamp(currentStats[key] + difference * multiplier, 0, 10);
  });

  const changes = attributeKeys
    .map((key) => ({
      key,
      previous: currentStats[key],
      next: nextStats[key],
      delta: nextStats[key] - currentStats[key],
    }))
    .filter((entry) => Math.abs(entry.delta) >= 0.01)
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta));

  return { nextStats, changes };
}
