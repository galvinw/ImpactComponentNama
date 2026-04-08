import type { Product, RetailPersonSession, StableCaptureCandidate } from '../data/products';
import type { RecommendationLogEntry } from '../utils/recommendationEngine';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:3030';

interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  error?: string;
}

interface RecommendationActionResponse {
  products: Product[];
  session: RetailPersonSession;
  activeRecommendationId: string;
  topProductIds: string[];
  interactionLogEntry: RecommendationLogEntry | null;
}

function getErrorMessage(payload: unknown) {
  if (payload && typeof payload === 'object' && 'error' in payload && typeof payload.error === 'string') {
    return payload.error;
  }

  return 'Request failed.';
}

async function apiRequest<T>(path: string, init?: RequestInit) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await response.json()) as ApiEnvelope<T> | { error?: string };

  if (!response.ok) {
    throw new Error(getErrorMessage(payload));
  }

  return (payload as ApiEnvelope<T>).data;
}

export function fetchProducts() {
  return apiRequest<Product[]>('/api/products');
}

export function fetchActivePersonSession() {
  return apiRequest<RetailPersonSession | null>('/api/person-session/active');
}

export function createPersonSession(candidate: StableCaptureCandidate) {
  return apiRequest<{
    session: RetailPersonSession;
    activeRecommendationId: string;
    topProductIds: string[];
  }>('/api/person-session', {
    method: 'POST',
    body: JSON.stringify({
      personSessionId: candidate.personSessionId,
      captureImage: candidate.image,
      captureMetadata: candidate.captureMetadata,
    }),
  });
}

export function sendRecommendationAction(
  personSessionId: string,
  actionType: 'buy' | 'skip' | 'select',
  productId: string
) {
  return apiRequest<RecommendationActionResponse>('/api/recommendation-action', {
    method: 'POST',
    body: JSON.stringify({
      personSessionId,
      actionType,
      productId,
    }),
  });
}

export function resetServerProducts() {
  return apiRequest<{
    products: Product[];
    session: RetailPersonSession | null;
    activeRecommendationId?: string;
    topProductIds?: string[];
  }>('/api/products/reset', {
    method: 'POST',
  });
}
