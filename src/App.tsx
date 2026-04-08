import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import KioskMenuPage from './pages/KioskMenuPage';
import ProductWorkspacePage from './pages/ProductWorkspacePage';
import {
  type Product,
  products as fallbackProducts,
  type RetailPersonSession,
  type StableCaptureCandidate,
} from './data/products';
import {
  createPersonSession,
  fetchActivePersonSession,
  fetchProducts,
  resetServerProducts,
  sendRecommendationAction,
} from './lib/api';
import type { RecommendationLogEntry } from './utils/recommendationEngine';

const STORAGE_KEY = 'impact-vending-selected-product';

function getInitialProductId(products: Product[]) {
  const storedProductId = window.localStorage.getItem(STORAGE_KEY);
  return products.some((product) => product.id === storedProductId)
    ? storedProductId!
    : products[0]?.id;
}

function App() {
  const [catalog, setCatalog] = useState<Product[]>(fallbackProducts);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(
    getInitialProductId(fallbackProducts)
  );
  const [activePersonSession, setActivePersonSession] = useState<RetailPersonSession | null>(null);
  const [capturePreviewImage, setCapturePreviewImage] = useState<string | null>(null);
  const [personSessionStatus, setPersonSessionStatus] = useState<
    'idle' | 'processing' | 'ready' | 'error'
  >('idle');
  const [personSessionMessage, setPersonSessionMessage] = useState(
    'Waiting for a shopper to hold a stable position in front of the camera.'
  );
  const [interactionLog, setInteractionLog] = useState<RecommendationLogEntry[]>([]);
  const selectedProduct =
    catalog.find((product) => product.id === selectedProductId) ?? catalog[0];

  useEffect(() => {
    let cancelled = false;

    const hydrateApp = async () => {
      try {
        const [serverProducts, serverSession] = await Promise.all([
          fetchProducts(),
          fetchActivePersonSession(),
        ]);

        if (cancelled) {
          return;
        }

        setCatalog(serverProducts);
        setActivePersonSession(serverSession);

        if (serverSession) {
          setSelectedProductId(serverSession.activeProductId);
          setCapturePreviewImage(serverSession.captureImage);
          setPersonSessionStatus('ready');
          setPersonSessionMessage(serverSession.summary);
        } else {
          setSelectedProductId((current) => current ?? getInitialProductId(serverProducts));
        }
      } catch {
        setSelectedProductId((current) => current ?? getInitialProductId(fallbackProducts));
      }
    };

    void hydrateApp();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedProductId) {
      window.localStorage.setItem(STORAGE_KEY, selectedProductId);
    }
  }, [selectedProductId]);

  const handleProductSelection = useCallback(
    async (productId: string) => {
      setSelectedProductId(productId);

      if (!activePersonSession) {
        return;
      }

      try {
        const response = await sendRecommendationAction(activePersonSession.id, 'select', productId);
        setCatalog(response.products);
        setActivePersonSession(response.session);
        setSelectedProductId(response.activeRecommendationId);
      } catch {
        // Keep local selection if API selection fails.
      }
    },
    [activePersonSession]
  );

  const handleAction = useCallback(
    async (actionType: 'buy' | 'skip') => {
      if (!activePersonSession || !selectedProduct) {
        return;
      }

      try {
        const response = await sendRecommendationAction(
          activePersonSession.id,
          actionType,
          selectedProduct.id
        );

        setCatalog(response.products);
        setActivePersonSession(response.session);
        setSelectedProductId(response.activeRecommendationId);
        setPersonSessionStatus('ready');
        setPersonSessionMessage(response.session.summary);

        if (response.interactionLogEntry) {
          const nextEntry = response.interactionLogEntry;
          setInteractionLog((currentLog) => [nextEntry, ...currentLog].slice(0, 8));
        }
      } catch (error) {
        setPersonSessionStatus('error');
        setPersonSessionMessage(
          error instanceof Error
            ? error.message
            : 'Unable to update the recommendation state.'
        );
      }
    },
    [activePersonSession, selectedProduct]
  );

  const handleStableCapture = useCallback(async (candidate: StableCaptureCandidate) => {
    setCapturePreviewImage(candidate.image);
    setPersonSessionStatus('processing');
    setPersonSessionMessage('Captured retail profile. Waiting for server analysis.');

    try {
      const response = await createPersonSession(candidate);
      setActivePersonSession(response.session);
      setSelectedProductId(response.activeRecommendationId);
      setCapturePreviewImage(response.session.captureImage);
      setPersonSessionStatus('ready');
      setPersonSessionMessage(response.session.summary);
      setInteractionLog([]);
    } catch (error) {
      setPersonSessionStatus('error');
      setPersonSessionMessage(
        error instanceof Error
          ? error.message
          : 'Unable to build a retail profile for this shopper.'
      );
    }
  }, []);

  const handleResetProducts = useCallback(async () => {
    try {
      const response = await resetServerProducts();
      setCatalog(response.products);

      if (response.session) {
        setActivePersonSession(response.session);
        setSelectedProductId(response.activeRecommendationId ?? response.session.activeProductId);
        setPersonSessionStatus('ready');
        setPersonSessionMessage(response.session.summary);
      } else {
        setActivePersonSession(null);
        setSelectedProductId((current) => current ?? getInitialProductId(response.products));
        setPersonSessionStatus('idle');
        setPersonSessionMessage(
          'Product state reset. Waiting for a shopper to hold a stable position in front of the camera.'
        );
      }

      setInteractionLog([]);
    } catch (error) {
      setPersonSessionStatus('error');
      setPersonSessionMessage(
        error instanceof Error ? error.message : 'Unable to reset product state.'
      );
    }
  }, []);

  if (!selectedProduct) {
    return null;
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <ProductWorkspacePage
              products={catalog}
              selectedProduct={selectedProduct}
              activePersonSession={activePersonSession}
              personSessionStatus={personSessionStatus}
              onSelectProduct={handleProductSelection}
              onBuyProduct={() => void handleAction('buy')}
              onRecommendSomethingElse={() => void handleAction('skip')}
            />
          }
        />
        <Route
          path="/kiosk"
          element={
            <KioskMenuPage
              products={catalog}
              selectedProduct={selectedProduct}
              activePersonSession={activePersonSession}
              capturePreviewImage={capturePreviewImage}
              personSessionStatus={personSessionStatus}
              personSessionMessage={personSessionMessage}
              interactionLog={interactionLog}
              onSelectProduct={handleProductSelection}
              onBuyProduct={() => void handleAction('buy')}
              onRecommendSomethingElse={() => void handleAction('skip')}
              onStableCapture={handleStableCapture}
              onResetProducts={() => void handleResetProducts()}
            />
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
