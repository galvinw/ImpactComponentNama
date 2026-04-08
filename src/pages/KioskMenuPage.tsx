import { Sparkles, RotateCcw, ShoppingCart, XCircle } from 'lucide-react';
import AppShell from '../components/AppShell';
import EmbeddingProjectorFrame from '../components/EmbeddingProjectorFrame';
import HumanWebcamFeed from '../components/HumanWebcamFeed';
import {
  attributeKeys,
  attributeLabels,
  type Product,
  type RetailPersonSession,
  type StableCaptureCandidate,
} from '../data/products';
import {
  formatStatValue,
  rankProducts,
  type RecommendationLogEntry,
} from '../utils/recommendationEngine';

interface KioskMenuPageProps {
  products: Product[];
  selectedProduct: Product;
  activePersonSession: RetailPersonSession | null;
  capturePreviewImage: string | null;
  personSessionStatus: 'idle' | 'processing' | 'ready' | 'error';
  personSessionMessage: string;
  interactionLog: RecommendationLogEntry[];
  onSelectProduct: (productId: string) => void;
  onBuyProduct: () => void;
  onRecommendSomethingElse: () => void;
  onStableCapture: (candidate: StableCaptureCandidate) => void;
  onResetProducts: () => void;
}

export default function KioskMenuPage({
  products,
  selectedProduct,
  activePersonSession,
  capturePreviewImage,
  personSessionStatus,
  personSessionMessage,
  interactionLog,
  onSelectProduct,
  onBuyProduct,
  onRecommendSomethingElse,
  onStableCapture,
  onResetProducts,
}: KioskMenuPageProps) {
  const rankedProducts = activePersonSession
    ? rankProducts(products, activePersonSession.stats, {})
    : [];
  const topMatches = activePersonSession
    ? activePersonSession.topProductIds
        .map((productId) => rankedProducts.find((product) => product.id === productId))
        .filter((product): product is NonNullable<typeof product> => Boolean(product))
    : [];

  return (
    <AppShell>
      <section className="h-screen overflow-hidden p-3">
        <div className="grid h-[calc(100vh-24px)] gap-3 lg:grid-cols-[0.82fr_1.18fr]">
          <HumanWebcamFeed
            analysisState={personSessionStatus}
            analysisMessage={personSessionMessage}
            onStableCapture={onStableCapture}
          />

          <div className="grid h-full gap-3 lg:grid-rows-[0.82fr_1.02fr_0.9fr]">
            <div className="grid min-h-0 gap-3 rounded-lg bg-[#3f6d8f] p-4 text-white shadow-[0_30px_70px_-45px_rgba(15,23,42,0.45)] sm:grid-cols-[0.66fr_1.34fr]">
              <div className="rounded-md bg-white/10 p-3">
                {capturePreviewImage ? (
                  <img
                    src={capturePreviewImage}
                    alt="Accepted still capture from person detection"
                    className="h-full min-h-[220px] w-full rounded-md object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[220px] items-center justify-center rounded-md bg-slate-950/30 px-6 text-center text-sm text-white/75">
                    Waiting for the first accepted shopper capture.
                  </div>
                )}
              </div>
              <div className="rounded-md bg-slate-950/10 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-white/90">
                    <Sparkles className="h-3.5 w-3.5 text-[#ffc42d]" />
                    Captured Retail Profile
                  </div>
                  <button
                    type="button"
                    onClick={onResetProducts}
                    className="inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/85 transition hover:bg-white/15"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Reset Products
                  </button>
                </div>
                <p className="mt-4 text-sm leading-6 text-white/80">{personSessionMessage}</p>
                <div className="mt-5 grid gap-x-4 gap-y-3 sm:grid-cols-2">
                  {attributeKeys.map((key) => (
                    <div key={key} className="rounded-md bg-white/8 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.18em] text-white/60">
                        {attributeLabels[key]}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-white">
                        {activePersonSession ? formatStatValue(key, activePersonSession.stats[key]) : '--'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid min-h-0 gap-3 rounded-lg bg-[#3f6d8f] p-4 text-white shadow-[0_30px_70px_-45px_rgba(15,23,42,0.45)] lg:grid-cols-[1fr_0.98fr]">
              <div className="min-h-0 rounded-md bg-white p-3 text-slate-950">
                <EmbeddingProjectorFrame
                  personLabel={activePersonSession?.label ?? 'Waiting for shopper'}
                  personStats={activePersonSession?.stats ?? products[0].stats}
                  products={products}
                  rankedProducts={rankedProducts}
                  activeProductId={selectedProduct.id}
                  heightClassName="h-full min-h-[300px]"
                />
              </div>

              <div className="flex min-h-0 flex-col gap-3">
                <div className={`rounded-md bg-gradient-to-br ${selectedProduct.background} p-5 text-slate-950`}>
                  <div className="flex gap-4">
                    <img
                      src={selectedProduct.image}
                      alt={selectedProduct.name}
                      className="h-28 w-28 rounded-md object-cover shadow-[0_20px_45px_-30px_rgba(15,23,42,0.55)]"
                    />
                    <div className="flex-1">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                        Current Recommendation
                      </p>
                      <h3 className="mt-2 text-3xl font-semibold text-slate-950">
                        {selectedProduct.name}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {selectedProduct.description}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-4">
                        <span className="text-3xl font-bold text-slate-950">
                          $
                          {selectedProduct.price.toFixed(0)}
                        </span>
                        <span className="rounded-md bg-white/80 px-3 py-1 text-sm font-semibold text-slate-700">
                          {activePersonSession ? 'Profile Locked' : 'Awaiting Profile'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={!activePersonSession}
                      onClick={onBuyProduct}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-700/60"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Buy Product
                    </button>
                    <button
                      type="button"
                      disabled={!activePersonSession}
                      onClick={onRecommendSomethingElse}
                      className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-white/70"
                    >
                      <XCircle className="h-4 w-4" />
                      Recommend Something Else
                    </button>
                  </div>
                </div>

                <div className="min-h-0 rounded-md bg-slate-950/10 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">Top 5 Compared Objects</h3>
                    <span className="text-sm text-white/70">Frozen per shopper session</span>
                  </div>
                  <div className="space-y-2">
                    {topMatches.length > 0 ? (
                      topMatches.map((product, index) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => onSelectProduct(product.id)}
                          className={`flex w-full items-center justify-between rounded-md px-4 py-3 text-left transition ${
                            product.id === selectedProduct.id
                              ? 'bg-white text-slate-950'
                              : 'bg-white/5 text-white hover:bg-white/10'
                          }`}
                        >
                          <span>
                            <span className="block text-xs uppercase tracking-[0.18em] opacity-60">
                              Rank {index + 1}
                            </span>
                            <span className="mt-1 block text-base font-semibold">{product.name}</span>
                          </span>
                          <span className="text-base font-semibold">{product.distance.toFixed(2)}</span>
                        </button>
                      ))
                    ) : (
                      <div className="rounded-md bg-white/8 px-4 py-5 text-sm text-white/75">
                        The top recommendations will freeze here after the first accepted shopper
                        profile is generated.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="min-h-0 rounded-lg bg-[#3f6d8f] p-5 text-white shadow-[0_30px_70px_-45px_rgba(15,23,42,0.45)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-white/65">
                    Recommendation Log
                  </p>
                  <h3 className="mt-2 text-xl font-semibold">Action And State History</h3>
                </div>
                <span className="rounded-md bg-white/10 px-3 py-1 text-sm text-white/80">
                  {interactionLog.length} events
                </span>
              </div>

              <div className="h-[calc(100%-68px)] overflow-x-auto rounded-md bg-white/95 text-slate-950">
                <table className="min-w-full text-left text-sm">
                  <thead className="sticky top-0 bg-slate-900 text-white">
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
                          After a shopper is accepted, each buy or alternate recommendation action
                          will log the exact stat changes applied to the current product state.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
