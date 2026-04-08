import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { defaultProducts } from './defaultProducts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const ANALYSIS_FILE = path.join(DATA_DIR, 'analysis.json');
const TIMESTAMPS_FILE = path.join(DATA_DIR, 'timestamps.json');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const PERSON_SESSION_FILE = path.join(DATA_DIR, 'person-session.json');

async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

async function readJsonFile(filePath, defaultValue = []) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data);
  } catch {
    return defaultValue;
  }
}

async function writeJsonFile(filePath, data) {
  await ensureDataDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeProducts(products) {
  return products.map((product) => ({
    ...product,
    stats: { ...product.stats },
    defaultStats: { ...(product.defaultStats ?? product.stats) },
  }));
}

export async function saveAnalysis(analysisData) {
  const analyses = await readJsonFile(ANALYSIS_FILE);
  const id = analysisData.id || Date.now().toString();
  const timestamp = new Date().toISOString();

  const existingIndex = analyses.findIndex(a => a.id === id);
  const newAnalysis = {
    id,
    ...analysisData,
    created_at: existingIndex >= 0 ? analyses[existingIndex].created_at : timestamp,
    updated_at: timestamp
  };

  if (existingIndex >= 0) {
    analyses[existingIndex] = newAnalysis;
  } else {
    analyses.push(newAnalysis);
  }

  await writeJsonFile(ANALYSIS_FILE, analyses);
  return newAnalysis;
}

export async function getAnalyses() {
  return await readJsonFile(ANALYSIS_FILE);
}

export async function saveTimestamp(timestampData) {
  const timestamps = await readJsonFile(TIMESTAMPS_FILE);
  const newTimestamp = {
    id: Date.now().toString(),
    ...timestampData,
    created_at: new Date().toISOString()
  };

  timestamps.push(newTimestamp);
  await writeJsonFile(TIMESTAMPS_FILE, timestamps);
  return newTimestamp;
}

export async function getTimestamps() {
  return await readJsonFile(TIMESTAMPS_FILE);
}

export async function getProducts() {
  const storedProducts = await readJsonFile(PRODUCTS_FILE, null);

  if (!Array.isArray(storedProducts) || storedProducts.length === 0) {
    const initialProducts = normalizeProducts(cloneData(defaultProducts));
    await writeJsonFile(PRODUCTS_FILE, initialProducts);
    return initialProducts;
  }

  const normalizedProducts = normalizeProducts(storedProducts);
  await writeJsonFile(PRODUCTS_FILE, normalizedProducts);
  return normalizedProducts;
}

export async function saveProducts(products) {
  const normalizedProducts = normalizeProducts(products);
  await writeJsonFile(PRODUCTS_FILE, normalizedProducts);
  return normalizedProducts;
}

export async function resetProducts() {
  const initialProducts = normalizeProducts(cloneData(defaultProducts));
  await writeJsonFile(PRODUCTS_FILE, initialProducts);
  return initialProducts;
}

export async function getActivePersonSession() {
  return await readJsonFile(PERSON_SESSION_FILE, null);
}

export async function saveActivePersonSession(session) {
  await writeJsonFile(PERSON_SESSION_FILE, session);
  return session;
}

export async function clearActivePersonSession() {
  await writeJsonFile(PERSON_SESSION_FILE, null);
}
