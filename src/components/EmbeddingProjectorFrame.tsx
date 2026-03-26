import { useEffect, useMemo, useRef, useState } from 'react';
import { attributeKeys, attributeLabels, type Product, type StatRecord } from '../data/products';
import type { RankedProduct } from '../utils/recommendationEngine';

interface EmbeddingProjectorFrameProps {
  personLabel: string;
  personStats: StatRecord;
  products: Product[];
  rankedProducts: RankedProduct[];
  activeProductId: string;
}

interface ViewerPoint {
  id: string;
  label: string;
  type: 'person' | 'product';
  color: string;
  vector: number[];
  score?: number;
  distance?: number;
  price?: number;
  isActive?: boolean;
  isTopMatch?: boolean;
  stats: Record<string, number>;
}

interface ViewerPayload {
  activeId: string;
  points: ViewerPoint[];
}

function buildViewerPayload(
  personLabel: string,
  personStats: StatRecord,
  products: Product[],
  rankedProducts: RankedProduct[],
  activeProductId: string
): ViewerPayload {
  const rankedMap = new Map(rankedProducts.map((product) => [product.id, product]));
  const topIds = new Set(rankedProducts.slice(0, 5).map((product) => product.id));

  const personPoint: ViewerPoint = {
    id: 'detected-person',
    label: personLabel,
    type: 'person',
    color: '#0f172a',
    vector: attributeKeys.map((key) => personStats[key]),
    isActive: true,
    isTopMatch: true,
    stats: Object.fromEntries(
      attributeKeys.map((key) => [attributeLabels[key], Number(personStats[key].toFixed(2))])
    ),
  };

  const productPoints = products.map<ViewerPoint>((product) => {
    const rankedProduct = rankedMap.get(product.id);

    return {
      id: product.id,
      label: product.name,
      type: 'product',
      color: product.id === activeProductId ? '#f59e0b' : product.accent,
      vector: attributeKeys.map((key) => product.stats[key]),
      score: rankedProduct ? Number(rankedProduct.score.toFixed(3)) : undefined,
      distance: rankedProduct ? Number(rankedProduct.distance.toFixed(3)) : undefined,
      price: product.price,
      isActive: product.id === activeProductId,
      isTopMatch: topIds.has(product.id),
      stats: Object.fromEntries(
        attributeKeys.map((key) => [attributeLabels[key], Number(product.stats[key].toFixed(2))])
      ),
    };
  });

  return {
    activeId: activeProductId,
    points: [personPoint, ...productPoints],
  };
}

export default function EmbeddingProjectorFrame({
  personLabel,
  personStats,
  products,
  rankedProducts,
  activeProductId,
}: EmbeddingProjectorFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const viewerPayload = useMemo(
    () =>
      buildViewerPayload(personLabel, personStats, products, rankedProducts, activeProductId),
    [activeProductId, personLabel, personStats, products, rankedProducts]
  );

  useEffect(() => {
    if (!isLoaded || !iframeRef.current?.contentWindow) {
      return;
    }

    iframeRef.current.contentWindow.postMessage(
      {
        type: 'embedding-data',
        payload: viewerPayload,
      },
      window.location.origin
    );
  }, [isLoaded, viewerPayload]);

  return (
    <div className="h-[420px] overflow-hidden rounded-sm bg-slate-100">
      <iframe
        ref={iframeRef}
        src="/embedding_graph_viewer.html"
        title="Embedding viewer"
        className="h-full w-full border-0"
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
}
