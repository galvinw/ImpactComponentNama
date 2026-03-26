import { useCallback, useState } from 'react';
import { ShoppingCart, Sparkles, XCircle } from 'lucide-react';
import AppShell from '../components/AppShell';
import EmbeddingProjectorFrame from '../components/EmbeddingProjectorFrame';
import HumanWebcamFeed, { type HumanWebcamMetrics } from '../components/HumanWebcamFeed';
import {
  attributeKeys,
  attributeLabels,
  detectedPerson,
  type Product,
} from '../data/products';
import {
  applyInteractionDelta,
  buildNotRecommendedLabel,
  createZeroDelta,
  formatStatValue,
  getEffectiveStats,
  pickNextRecommendation,
  rankProducts,
  summarizeStateChanges,
  type RecommendationLogEntry,
} from '../utils/recommendationEngine';

interface KioskMenuPageProps {
  products: Product[];
  selectedProduct: Product;
  onSelectProduct: (productId: string) => void;
}

export default function KioskMenuPage({
  products,
  selectedProduct,
  onSelectProduct,
}: KioskMenuPageProps) {
  const [preferenceDelta, setPreferenceDelta] = useState(createZeroDelta);
  const [productBias, setProductBias] = useState<Record<string, number>>({});
  const [interactionLog, setInteractionLog] = useState<RecommendationLogEntry[]>([]);
  const [captureImage, setCaptureImage] = useState(detectedPerson.captureImage);
  const [liveSummary, setLiveSummary] = useState(
    'Connecting to the webcam feed and waiting for a body and face mesh lock.'
  );

  const effectivePersonStats = getEffectiveStats(detectedPerson.stats, preferenceDelta);
  const rankedProducts = rankProducts(products, effectivePersonStats, productBias);
  const selectedRankedProduct =
    rankedProducts.find((product) => product.id === selectedProduct.id) ?? rankedProducts[0];
  const activeProduct = (selectedRankedProduct ?? rankedProducts[0])!;
  const comparisonSet = rankedProducts
    .filter((product) => product.id !== activeProduct.id)
    .slice(0, 4);
  const topMatches = [activeProduct, ...comparisonSet];

  const handleInteraction = (action: 'buy' | 'skip') => {
    const nextDelta = applyInteractionDelta(
      detectedPerson.stats,
      preferenceDelta,
      activeProduct.stats,
      action
    );
    const nextBias = {
      ...productBias,
      [activeProduct.id]: (productBias[activeProduct.id] ?? 0) + (action === 'buy' ? 0.22 : 0.35),
    };
    const updatedPersonStats = getEffectiveStats(detectedPerson.stats, nextDelta);
    const nextRanking = rankProducts(products, updatedPersonStats, nextBias);
    const nextRecommendation = pickNextRecommendation(nextRanking, activeProduct.id) ?? activeProduct;
    const stateChanges = summarizeStateChanges(preferenceDelta, nextDelta);

    const nextLogEntry: RecommendationLogEntry = {
      id: `${Date.now()}-${action}`,
      time: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      action,
      recommended: activeProduct.name,
      notRecommended: buildNotRecommendedLabel(nextRanking, nextRecommendation.id),
      stateUpdate: stateChanges.join(', ') || 'No significant state shift',
      matchDistance: activeProduct.distance.toFixed(2),
    };

    setPreferenceDelta(nextDelta);
    setProductBias(nextBias);
    setInteractionLog((currentLog) => [nextLogEntry, ...currentLog].slice(0, 8));
    onSelectProduct(nextRecommendation.id);
  };

  const handleMetricsChange = useCallback((metrics: HumanWebcamMetrics) => {
    if (metrics.status === 'error') {
      setLiveSummary('Webcam detection could not start. The analytics panels are using the last known kiosk profile.');
      return;
    }

    if (metrics.faceCount > 0 && metrics.bodyCount > 0) {
      setLiveSummary(
        `Live capture is tracking ${metrics.faceCount} face mesh${metrics.faceCount > 1 ? 'es' : ''} and ${metrics.bodyCount} body profile${metrics.bodyCount > 1 ? 's' : ''} for the active kiosk visitor.`
      );
      return;
    }

    setLiveSummary(metrics.message);
  }, []);

  return (
    <AppShell>
      <section className="grid min-h-screen gap-3 p-3 lg:grid-cols-[0.8fr_1.2fr]">
        <HumanWebcamFeed
          onCaptureChange={setCaptureImage}
          onMetricsChange={handleMetricsChange}
        />

        <div className="grid gap-3 lg:grid-rows-[0.88fr_1fr_0.88fr]">
          <div className="grid gap-3 rounded-lg bg-[#3f6d8f] p-4 text-white shadow-[0_30px_70px_-45px_rgba(15,23,42,0.45)] sm:grid-cols-[0.72fr_1.28fr]">
            <div className="rounded-md bg-white/10 p-3">
              <img
                src={captureImage}
                alt="Still capture from person detection"
                className="h-full min-h-[240px] w-full rounded-md object-cover"
              />
            </div>
            <div className="rounded-md bg-slate-950/10 p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/90">
                  <Sparkles className="h-3.5 w-3.5 text-[#ffc42d]" />
                  AI Person Attributes
                </div>
                <span className="text-sm text-white/70">{detectedPerson.label}</span>
                </div>
              <p className="mt-4 text-sm leading-6 text-white/80">{liveSummary}</p>
              <div className="mt-6 grid gap-x-6 gap-y-4 sm:grid-cols-2">
                {attributeKeys.map((key) => (
                  <div key={key} className="rounded-md bg-white/8 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                      {attributeLabels[key]}
                    </p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {formatStatValue(key, effectivePersonStats[key])}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg bg-[#3f6d8f] p-4 text-white shadow-[0_30px_70px_-45px_rgba(15,23,42,0.45)] lg:grid-cols-[0.96fr_1.04fr]">
            <div className="rounded-md bg-white p-4 text-slate-950">
              <EmbeddingProjectorFrame
                personLabel={detectedPerson.label}
                personStats={effectivePersonStats}
                products={products}
                rankedProducts={rankedProducts}
                activeProductId={activeProduct.id}
              />
            </div>

            <div className="flex flex-col gap-4">
              <div className={`rounded-md bg-gradient-to-br ${activeProduct.background} p-5 text-slate-950`}>
                <div className="flex gap-4">
                  <img
                    src={activeProduct.image}
                    alt={activeProduct.name}
                    className="h-32 w-32 rounded-md object-cover shadow-[0_20px_45px_-30px_rgba(15,23,42,0.55)]"
                  />
                  <div className="flex-1">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                      Current Recommendation
                    </p>
                    <h3 className="mt-2 text-3xl font-semibold text-slate-950">
                      {activeProduct.name}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {activeProduct.description}
                    </p>
                    <div className="mt-4 flex flex-wrap items-center gap-4">
                      <span className="text-3xl font-bold text-slate-950">
                        {activeProduct.score.toFixed(2)}
                      </span>
                      <span className="rounded-md bg-white/80 px-3 py-1 text-sm font-semibold text-slate-700">
                        Match score
                      </span>
                      <span className="text-lg font-semibold text-slate-700">
                        ${activeProduct.price.toFixed(0)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleInteraction('buy')}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Buy Recommendation
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInteraction('skip')}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <XCircle className="h-4 w-4" />
                    Not This Time
                  </button>
                </div>
              </div>

              <div className="rounded-md bg-slate-950/10 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Top 5 Compared Objects</h3>
                  <span className="text-sm text-white/70">distance 0 is best</span>
                </div>
                <div className="space-y-3">
                  {topMatches.map((product, index) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => onSelectProduct(product.id)}
                      className={`flex w-full items-center justify-between rounded-md px-4 py-3 text-left transition ${
                        product.id === activeProduct.id
                          ? 'bg-white text-slate-950'
                          : 'bg-white/5 text-white hover:bg-white/10'
                      }`}
                    >
                      <span>
                        <span className="block text-xs uppercase tracking-[0.18em] opacity-60">
                          Rank {index + 1}
                        </span>
                        <span className="mt-1 block text-lg font-semibold">{product.name}</span>
                      </span>
                      <span className="text-lg font-semibold">{product.distance.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-[#3f6d8f] p-5 text-white shadow-[0_30px_70px_-45px_rgba(15,23,42,0.45)]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-white/65">
                  Recommendation Log
                </p>
                <h3 className="mt-2 text-2xl font-semibold">Action And State History</h3>
              </div>
              <span className="rounded-md bg-white/10 px-3 py-1 text-sm text-white/80">
                {interactionLog.length} events
              </span>
            </div>

            <div className="overflow-x-auto rounded-md bg-white/95 text-slate-950">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-900 text-white">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Time</th>
                    <th className="px-4 py-3 font-semibold">Recommended</th>
                    <th className="px-4 py-3 font-semibold">Outcome</th>
                    <th className="px-4 py-3 font-semibold">Not Recommended</th>
                    <th className="px-4 py-3 font-semibold">State Update</th>
                    <th className="px-4 py-3 font-semibold">Match Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {interactionLog.length > 0 ? (
                    interactionLog.map((entry) => (
                      <tr key={entry.id} className="border-t border-slate-200 align-top">
                        <td className="px-4 py-3">{entry.time}</td>
                        <td className="px-4 py-3 font-semibold">{entry.recommended}</td>
                        <td className="px-4 py-3">
                          {entry.action === 'buy' ? 'Buy button pressed' : 'Recommendation skipped'}
                        </td>
                        <td className="px-4 py-3">{entry.notRecommended}</td>
                        <td className="px-4 py-3">{entry.stateUpdate}</td>
                        <td className="px-4 py-3">{entry.matchDistance}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-5 text-slate-500" colSpan={6}>
                        No interaction recorded yet. Use the buttons above to generate the first
                        recommendation update and log how the state vector changes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
