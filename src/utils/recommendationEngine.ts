import {
  attributeKeys,
  attributeLabels,
  type AttributeKey,
  type Product,
  type StatRecord,
} from '../data/products';

export interface RankedProduct extends Product {
  distance: number;
  score: number;
  point: { x: number; y: number };
}

export interface RecommendationLogEntry {
  id: string;
  time: string;
  action: 'buy' | 'skip';
  recommended: string;
  notRecommended: string;
  stateUpdate: string;
  matchDistance: string;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function createZeroDelta(): StatRecord {
  return {
    hydration: 0,
    energy: 0,
    sweetness: 0,
    protein: 0,
    comfort: 0,
    focus: 0,
    urgency: 0,
    temperature: 0,
    indulgence: 0,
    wellness: 0,
  };
}

export function getEffectiveStats(baseStats: StatRecord, delta: StatRecord) {
  const nextStats = {} as StatRecord;

  attributeKeys.forEach((key) => {
    nextStats[key] = clamp(baseStats[key] + delta[key], 0, 10);
  });

  return nextStats;
}

export function projectStats(stats: StatRecord) {
  const xSeed =
    stats.hydration * 0.22 +
    stats.temperature * 0.18 +
    stats.wellness * 0.12 +
    stats.comfort * 0.08 -
    stats.indulgence * 0.06;
  const ySeed =
    stats.energy * 0.22 +
    stats.focus * 0.18 +
    stats.urgency * 0.16 +
    stats.sweetness * 0.08 -
    stats.protein * 0.05;

  return {
    x: clamp(xSeed / 5.2, 0.08, 0.92),
    y: clamp(1 - ySeed / 5.8, 0.1, 0.9),
  };
}

export function calculateDistance(left: StatRecord, right: StatRecord) {
  const total = attributeKeys.reduce((sum, key) => {
    const difference = left[key] - right[key];
    return sum + difference * difference;
  }, 0);

  return Math.sqrt(total / attributeKeys.length) / 10;
}

export function rankProducts(
  products: Product[],
  personStats: StatRecord,
  productBias: Record<string, number>
) {
  return products
    .map<RankedProduct>((product) => {
      const distance = clamp(
        calculateDistance(personStats, product.stats) + (productBias[product.id] ?? 0),
        0,
        1
      );

      return {
        ...product,
        distance,
        score: clamp(1 - distance, 0, 1),
        point: projectStats(product.stats),
      };
    })
    .sort((left, right) => left.distance - right.distance);
}

export function applyInteractionDelta(
  baseStats: StatRecord,
  currentDelta: StatRecord,
  productStats: StatRecord,
  action: 'buy' | 'skip'
) {
  const nextDelta = { ...currentDelta };
  const multiplier = action === 'buy' ? 0.12 : -0.1;

  attributeKeys.forEach((key) => {
    const shift = (productStats[key] - baseStats[key]) * multiplier;
    nextDelta[key] = clamp(currentDelta[key] + shift, -2.5, 2.5);
  });

  return nextDelta;
}

export function summarizeStateChanges(previous: StatRecord, next: StatRecord) {
  return attributeKeys
    .map((key) => ({
      key,
      delta: next[key] - previous[key],
    }))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .filter((item) => Math.abs(item.delta) >= 0.05)
    .slice(0, 3)
    .map((item) => {
      const prefix = item.delta > 0 ? '+' : '';
      return `${attributeLabels[item.key]} ${prefix}${item.delta.toFixed(2)}`;
    });
}

export function buildNotRecommendedLabel(
  rankedProducts: RankedProduct[],
  activeProductId: string,
  topCount: number = 2
) {
  const deprioritized = rankedProducts
    .filter((product) => product.id !== activeProductId)
    .slice(-topCount)
    .map((product) => product.name);

  return deprioritized.join(', ');
}

export function pickNextRecommendation(
  rankedProducts: RankedProduct[],
  activeProductId: string
) {
  return (
    rankedProducts.find((product) => product.id !== activeProductId) ??
    rankedProducts.find((product) => product.id === activeProductId) ??
    rankedProducts[0]
  );
}

export function formatStatValue(key: AttributeKey, value: number) {
  if (key === 'temperature') {
    return `${value.toFixed(1)}/10 cold`;
  }

  return `${value.toFixed(1)}/10`;
}
