import express from 'express';
import cors from 'cors';
import {
  getActivePersonSession,
  getAnalyses,
  getProducts,
  getTimestamps,
  resetProducts,
  saveActivePersonSession,
  saveAnalysis,
  saveProducts,
  saveTimestamp,
} from './storage.js';
import { generateRetailProfile } from './llmClient.js';
import {
  applyProductAction,
  buildNotRecommendedLabel,
  pickNextRecommendation,
  rankProducts,
} from './recommendationEngine.js';
import { initPeriodicCapture, getLastCaptures, hasCaptureAttempts } from './rtspCapture.js';

const app = express();
const PORT = process.env.PORT || 3030;

app.use(cors());
app.use(express.json({ limit: '12mb' }));

function formatStateUpdate(changes) {
  return changes
    .slice(0, 4)
    .map((change) => {
      const prefix = change.delta > 0 ? '+' : '';
      return `${change.key} ${prefix}${change.delta.toFixed(2)}`;
    })
    .join(', ');
}

function buildSessionPayload(session) {
  return {
    id: session.id,
    label: session.label,
    captureImage: session.captureImage,
    stats: session.stats,
    summary: session.summary,
    activeProductId: session.activeProductId,
    topProductIds: session.topProductIds,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

app.post('/api/update-analysis', async (req, res) => {
  try {
    const {
      environment,
      description,
      number_of_people,
      threats,
      is_anomaly,
      anomaly_reason,
      analysis_id,
    } = req.body;

    if (!environment || !description || number_of_people === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: environment, description, number_of_people',
      });
    }

    const result = await saveAnalysis({
      id: analysis_id,
      environment,
      description,
      number_of_people,
      threats: threats || null,
      is_anomaly: is_anomaly || false,
      anomaly_reason: anomaly_reason || null,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/analyses', async (req, res) => {
  try {
    const analyses = await getAnalyses();
    res.json({ success: true, data: analyses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/record-timestamp', async (req, res) => {
  try {
    const { id, time, analysis_id } = req.body;

    if (id === undefined || time === undefined) {
      return res.status(400).json({
        error: 'Missing required fields: id (0-2), time (milliseconds)',
      });
    }

    if (![0, 1, 2, 3].includes(id)) {
      return res.status(400).json({
        error:
          'Invalid id. Must be 0 (image capture), 1 (capture analysis complete), 2 (recommendation update), or 3 (total time)',
      });
    }

    const result = await saveTimestamp({
      event_id: id,
      timestamp_ms: time,
      analysis_id: analysis_id || null,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/timestamps', async (req, res) => {
  try {
    const timestamps = await getTimestamps();
    res.json({ success: true, data: timestamps });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products', async (_req, res) => {
  try {
    const products = await getProducts();
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/person-session/active', async (_req, res) => {
  try {
    const session = await getActivePersonSession();
    res.json({ success: true, data: session ? buildSessionPayload(session) : null });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/person-session', async (req, res) => {
  try {
    const { personSessionId, captureImage, captureMetadata } = req.body;

    if (!personSessionId || !captureImage) {
      return res.status(400).json({
        error: 'Missing required fields: personSessionId, captureImage',
      });
    }

    const profile = await generateRetailProfile({
      personSessionId,
      captureImage,
      captureMetadata: captureMetadata || {},
    });
    const products = await getProducts();
    const rankedProducts = rankProducts(products, profile.stats);
    const activeRecommendation = rankedProducts[0];

    if (!activeRecommendation) {
      return res.status(500).json({ error: 'No products available for recommendation.' });
    }

    const timestamp = new Date().toISOString();
    const session = await saveActivePersonSession({
      id: personSessionId,
      label: profile.label,
      captureImage,
      stats: profile.stats,
      summary: profile.summary,
      activeProductId: activeRecommendation.id,
      topProductIds: rankedProducts.slice(0, 5).map((product) => product.id),
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    res.json({
      success: true,
      data: {
        session: buildSessionPayload(session),
        activeRecommendationId: activeRecommendation.id,
        topProductIds: session.topProductIds,
      },
    });
  } catch (error) {
    res.status(502).json({ error: error.message });
  }
});

app.post('/api/recommendation-action', async (req, res) => {
  try {
    const { personSessionId, actionType, productId } = req.body;

    if (!personSessionId || !actionType || !productId) {
      return res.status(400).json({
        error: 'Missing required fields: personSessionId, actionType, productId',
      });
    }

    if (!['buy', 'skip', 'select'].includes(actionType)) {
      return res.status(400).json({ error: 'Invalid actionType.' });
    }

    const session = await getActivePersonSession();
    if (!session || session.id !== personSessionId) {
      return res.status(404).json({ error: 'Active person session not found.' });
    }

    const products = await getProducts();
    const productIndex = products.findIndex((product) => product.id === productId);
    if (productIndex < 0) {
      return res.status(404).json({ error: 'Product not found.' });
    }

    const targetProduct = products[productIndex];
    const { nextStats, changes } = applyProductAction(targetProduct.stats, session.stats, actionType);
    const nextProducts = [...products];

    if (actionType !== 'select') {
      nextProducts[productIndex] = {
        ...targetProduct,
        stats: nextStats,
      };
      await saveProducts(nextProducts);
    }

    const rankedProducts = rankProducts(nextProducts, session.stats);
    const nextActiveProduct =
      actionType === 'select'
        ? rankedProducts.find((product) => product.id === productId) ?? rankedProducts[0]
        : pickNextRecommendation(rankedProducts, productId);

    if (!nextActiveProduct) {
      return res.status(500).json({ error: 'Unable to compute next recommendation.' });
    }

    const nextSession = await saveActivePersonSession({
      ...session,
      activeProductId: nextActiveProduct.id,
      topProductIds: rankedProducts.slice(0, 5).map((product) => product.id),
      updatedAt: new Date().toISOString(),
    });

    const activeRankedProduct = rankedProducts.find((product) => product.id === productId) ?? nextActiveProduct;
    const interactionLogEntry =
      actionType === 'select'
        ? null
        : {
            id: `${Date.now()}-${actionType}`,
            time: new Date().toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
            action: actionType,
            recommended: targetProduct.name,
            notRecommended: buildNotRecommendedLabel(rankedProducts, nextActiveProduct.id),
            stateUpdate: formatStateUpdate(changes) || 'No significant state shift',
            matchDistance: activeRankedProduct.distance.toFixed(2),
          };

    res.json({
      success: true,
      data: {
        products: nextProducts,
        session: buildSessionPayload(nextSession),
        activeRecommendationId: nextActiveProduct.id,
        topProductIds: nextSession.topProductIds,
        interactionLogEntry,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/products/reset', async (_req, res) => {
  try {
    const products = await resetProducts();
    const session = await getActivePersonSession();

    if (!session) {
      return res.json({ success: true, data: { products, session: null } });
    }

    const rankedProducts = rankProducts(products, session.stats);
    const nextActiveProduct = rankedProducts[0];
    const nextSession = await saveActivePersonSession({
      ...session,
      activeProductId: nextActiveProduct?.id ?? session.activeProductId,
      topProductIds: rankedProducts.slice(0, 5).map((product) => product.id),
      updatedAt: new Date().toISOString(),
    });

    res.json({
      success: true,
      data: {
        products,
        session: buildSessionPayload(nextSession),
        activeRecommendationId: nextSession.activeProductId,
        topProductIds: nextSession.topProductIds,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/camera-feeds', (req, res) => {
  try {
    const captures = getLastCaptures();
    const attempted = hasCaptureAttempts();

    res.json({
      success: true,
      data: {
        camera: captures.camera,
        attempted,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'API server is running' });
});

initPeriodicCapture(5000);

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
