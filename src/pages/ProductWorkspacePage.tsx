import { useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquareText, ShoppingCart } from 'lucide-react';
import AppShell from '../components/AppShell';
import ProductCarousel from '../components/ProductCarousel';
import {
  attributeKeys,
  type AttributeKey,
  type Product,
  type RetailPersonSession,
  type StatRecord,
} from '../data/products';

interface ProductWorkspacePageProps {
  products: Product[];
  selectedProduct: Product;
  activePersonSession: RetailPersonSession | null;
  personSessionStatus: 'idle' | 'processing' | 'ready' | 'error';
  onSelectProduct: (productId: string) => void;
  onBuyProduct: () => void;
  onRecommendSomethingElse: () => void;
}

const reasonPhrases: Record<AttributeKey, string> = {
  hydration: 'leans into a clean, immediate refresh',
  energy: 'adds a sharper lift',
  sweetness: 'brings a rounder, softer finish',
  protein: 'has more staying power',
  comfort: 'feels familiar and easy to say yes to',
  focus: 'keeps the choice crisp and streamlined',
  urgency: 'fits a fast grab-and-go moment',
  temperature: 'makes the most sense as a cold pick',
  indulgence: 'adds more of a treat-like edge',
  wellness: 'keeps the choice feeling light and balanced',
};

const betterMatchPhrases: Record<AttributeKey, string> = {
  hydration: 'leans closer to the kind of clean refreshment the visitor seems ready for',
  energy: 'adds the extra lift this moment appears to support',
  sweetness: 'offers a softer finish that may land better right now',
  protein: 'gives the choice more staying power without changing the pace',
  comfort: 'feels more familiar and easier to commit to',
  focus: 'keeps the direction sharper and more composed',
  urgency: 'matches the quick pace of the interaction more closely',
  temperature: 'pushes further toward the colder serve that fits this read',
  indulgence: 'brings in more reward if the visitor is leaning treat-first',
  wellness: 'keeps things cleaner and lighter than the previous option',
};

function pickTopReasonKeys(productStats: StatRecord, personStats: StatRecord) {
  return [...attributeKeys]
    .sort((left, right) => {
      const leftScore =
        personStats[left] +
        productStats[left] * 0.8 -
        Math.abs(personStats[left] - productStats[left]) * 1.6;
      const rightScore =
        personStats[right] +
        productStats[right] * 0.8 -
        Math.abs(personStats[right] - productStats[right]) * 1.6;

      return rightScore - leftScore;
    })
    .slice(0, 2);
}

function pickBetterMatchKey(
  nextProductStats: StatRecord,
  previousProductStats: StatRecord,
  personStats: StatRecord
) {
  return [...attributeKeys].sort((left, right) => {
    const leftImprovement =
      Math.abs(previousProductStats[left] - personStats[left]) -
      Math.abs(nextProductStats[left] - personStats[left]);
    const rightImprovement =
      Math.abs(previousProductStats[right] - personStats[right]) -
      Math.abs(nextProductStats[right] - personStats[right]);

    return rightImprovement - leftImprovement;
  })[0];
}

function buildWaitingNarrative(status: ProductWorkspacePageProps['personSessionStatus']) {
  if (status === 'processing') {
    return [
      'Retail profile capture is in progress.',
      'The analytics page has accepted a shopper image and is waiting for the server-side profile model.',
      'Once the retail variables return, this page will update to the recommended drink automatically.',
    ];
  }

  if (status === 'error') {
    return [
      'Retail profile capture is paused.',
      'The analytics page could not complete the current shopper profile.',
      'Hold the recommendation here until a new capture completes successfully.',
    ];
  }

  return [
    'Waiting for a captured retail profile.',
    'The kiosk will greet the next shopper after the analytics camera locks a clear, stable image.',
    'A recommended drink and explanation will appear here automatically.',
  ];
}

function buildInitialNarrative(product: Product, session: RetailPersonSession) {
  const [primaryReasonKey, secondaryReasonKey] = pickTopReasonKeys(product.stats, session.stats);

  return [
    'Hello there. Welcome in.',
    session.summary,
    `${product.name} is leading because it ${reasonPhrases[primaryReasonKey]}.`,
    secondaryReasonKey
      ? `It also ${reasonPhrases[secondaryReasonKey]}, which makes it a strong first drink to surface.`
      : `It feels like the cleanest first drink to put in front of this shopper.`,
  ];
}

function buildAlternativeNarrative(
  product: Product,
  previousProduct: Product,
  session: RetailPersonSession
) {
  const betterMatchKey = pickBetterMatchKey(product.stats, previousProduct.stats, session.stats);
  const [primaryReasonKey, secondaryReasonKey] = pickTopReasonKeys(product.stats, session.stats);

  return [
    `A switch to ${product.name} may be the better call.`,
    `Compared with ${previousProduct.name}, it ${betterMatchPhrases[betterMatchKey]}.`,
    `${product.name} still ${reasonPhrases[primaryReasonKey]}, so the recommendation stays aligned with the shopper.`,
    secondaryReasonKey
      ? `It also ${reasonPhrases[secondaryReasonKey]}, which is a good reason to move it to the front.`
      : 'If the shopper is changing course, this is a sensible drink to keep highlighted.',
  ];
}

export default function ProductWorkspacePage({
  products,
  selectedProduct,
  activePersonSession,
  personSessionStatus,
  onSelectProduct,
  onBuyProduct,
  onRecommendSomethingElse,
}: ProductWorkspacePageProps) {
  const [historyLines, setHistoryLines] = useState<string[]>([]);
  const [typedLines, setTypedLines] = useState<string[]>([]);
  const previousLinesRef = useRef<string[]>([]);
  const previousProductRef = useRef<Product | null>(null);
  const previousSessionIdRef = useRef<string | null>(null);

  const chatResponseLines = useMemo(() => {
    if (!activePersonSession) {
      return buildWaitingNarrative(personSessionStatus);
    }

    const isNewSession =
      activePersonSession && previousSessionIdRef.current !== activePersonSession.id;

    return !isNewSession &&
      previousProductRef.current &&
      previousProductRef.current.id !== selectedProduct.id
      ? buildAlternativeNarrative(selectedProduct, previousProductRef.current, activePersonSession)
      : buildInitialNarrative(selectedProduct, activePersonSession);
  }, [activePersonSession, personSessionStatus, selectedProduct]);

  useEffect(() => {
    previousSessionIdRef.current = activePersonSession?.id ?? null;
    previousProductRef.current = selectedProduct;

    if (previousLinesRef.current.length > 0) {
      setHistoryLines((current) => [...current, ...previousLinesRef.current].slice(-18));
    }

    setTypedLines([]);
    let lineIndex = 0;
    let charIndex = 0;
    const timer = window.setInterval(() => {
      const activeLine = chatResponseLines[lineIndex];
      charIndex += 1;

      setTypedLines([
        ...chatResponseLines.slice(0, lineIndex),
        activeLine.slice(0, charIndex),
      ]);

      if (charIndex >= activeLine.length) {
        lineIndex += 1;
        charIndex = 0;
      }

      if (lineIndex >= chatResponseLines.length) {
        setTypedLines(chatResponseLines);
        previousLinesRef.current = chatResponseLines;
        window.clearInterval(timer);
      }
    }, 22);

    return () => {
      window.clearInterval(timer);
    };
  }, [activePersonSession?.id, chatResponseLines, selectedProduct]);

  const visibleLines = [...historyLines, ...typedLines].slice(-6);
  const isTyping =
    typedLines.length !== chatResponseLines.length ||
    typedLines.some((line, index) => line !== chatResponseLines[index]);

  return (
    <AppShell>
      <section className="overflow-hidden bg-slate-950">
        <div className="relative min-h-screen">
          <img
            src={selectedProduct.image}
            alt={selectedProduct.name}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,_rgba(15,23,42,0.28)_0%,_rgba(15,23,42,0.32)_25%,_rgba(15,23,42,0.55)_62%,_rgba(15,23,42,0.92)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.16),_transparent_25%),radial-gradient(circle_at_center_right,_rgba(255,196,45,0.12),_transparent_18%)]" />

          <div className="relative flex min-h-screen flex-col justify-between p-3 lg:p-4">
            <div className="pt-8">
              <div className="max-w-4xl rounded-lg bg-slate-950/52 p-3 shadow-[0_24px_70px_-40px_rgba(15,23,42,0.8)] backdrop-blur-md">
                <div className="mb-3 flex items-center gap-3 text-sm font-medium text-slate-100">
                  <MessageSquareText className="h-4 w-4 text-[#ffc42d]" />
                  Agent Impact
                </div>
                <div className="flex h-[192px] flex-col justify-end overflow-hidden rounded-md bg-black/34 p-5 font-mono text-sm leading-[1.3] text-slate-100">
                  {visibleLines.map((line, index) => {
                    const depth = visibleLines.length - index - 1;
                    const opacity = Math.max(0.2, 1 - depth * 0.16);
                    const translateY = -depth * 3;
                    const isNewestLine = index === visibleLines.length - 1;

                    return (
                      <div
                        key={`${index}-${line}`}
                        className="chat-line mb-1 whitespace-pre-line transition-all duration-500 ease-out"
                        style={{
                          opacity,
                          transform: `translateY(${translateY}px)`,
                        }}
                      >
                        {line}
                        {isNewestLine && isTyping ? (
                          <span className="typewriter-caret ml-0.5 inline-block text-[#ffc42d]">
                            |
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex flex-1 items-center">
              <div className="max-w-xl rounded-lg bg-black/24 p-6 text-white backdrop-blur-sm">
                <p className="text-sm uppercase tracking-[0.24em] text-white/68">
                  {selectedProduct.tagline}
                </p>
                <h2 className="mt-3 text-5xl font-semibold tracking-tight text-white">
                  {selectedProduct.name}
                </h2>
                <p className="mt-4 max-w-lg text-base leading-[1.3] text-white/85">
                  {selectedProduct.description}
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4">
                  <span className="text-5xl font-bold text-white">
                    ${selectedProduct.price.toFixed(0)}
                  </span>
                  <span className="rounded-md bg-white/18 px-3 py-1 text-sm font-semibold text-white/90">
                    {activePersonSession ? 'Retail Profile Ready' : 'Waiting For Profile'}
                  </span>
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={!activePersonSession}
                    onClick={onBuyProduct}
                    className="inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-white/50"
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Buy Product
                  </button>
                  <button
                    type="button"
                    disabled={!activePersonSession}
                    onClick={onRecommendSomethingElse}
                    className="rounded-md bg-white/16 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/22 disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-white/55"
                  >
                    Recommend Something Else
                  </button>
                </div>
              </div>
            </div>

            <div className="pb-2">
              <ProductCarousel
                products={products}
                selectedProduct={selectedProduct}
                onSelectProduct={onSelectProduct}
              />
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
