export const attributeLabels = {
  hydration: 'Hydration',
  energy: 'Energy',
  sweetness: 'Sweetness',
  protein: 'Protein',
  comfort: 'Comfort',
  focus: 'Focus',
  urgency: 'Urgency',
  temperature: 'Cold Bias',
  indulgence: 'Indulgence',
  wellness: 'Wellness',
} as const;

export type AttributeKey = keyof typeof attributeLabels;

export type StatRecord = Record<AttributeKey, number>;

export interface Product {
  id: string;
  name: string;
  tagline: string;
  description: string;
  price: number;
  image: string;
  accent: string;
  background: string;
  stats: StatRecord;
}

export interface PersonProfile {
  id: string;
  label: string;
  summary: string;
  feedImage: string;
  captureImage: string;
  stats: StatRecord;
}

export const attributeKeys = Object.keys(attributeLabels) as AttributeKey[];

export const detectedPerson: PersonProfile = {
  id: 'visitor-001',
  label: 'Visitor 01',
  summary: 'High hydration need, moderate energy demand, and a strong preference for cold, quick-grab items.',
  feedImage:
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80',
  captureImage:
    'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=700&q=80',
  stats: {
    hydration: 9,
    energy: 6,
    sweetness: 4,
    protein: 3,
    comfort: 6,
    focus: 7,
    urgency: 8,
    temperature: 10,
    indulgence: 4,
    wellness: 8,
  },
};

export const products: Product[] = [
  {
    id: 'bottled-water',
    name: 'Bottled Water',
    tagline: 'Still water',
    description: 'Pure hydration with the strongest cold-refresh match in the kiosk.',
    price: 10,
    image:
      'https://images.unsplash.com/photo-1564419320461-6870880221ad?auto=format&fit=crop&w=900&q=80',
    accent: '#0ea5e9',
    background: 'from-cyan-100 via-white to-slate-50',
    stats: {
      hydration: 10,
      energy: 1,
      sweetness: 1,
      protein: 1,
      comfort: 6,
      focus: 5,
      urgency: 9,
      temperature: 10,
      indulgence: 2,
      wellness: 10,
    },
  },
  {
    id: 'powerade',
    name: 'Powerade',
    tagline: 'Electrolyte drink',
    description: 'Fast recovery drink with strong hydration and urgency support.',
    price: 18,
    image:
      'https://images.unsplash.com/photo-1624517452488-04869289c4ca?auto=format&fit=crop&w=900&q=80',
    accent: '#2563eb',
    background: 'from-blue-100 via-white to-sky-50',
    stats: {
      hydration: 9,
      energy: 6,
      sweetness: 5,
      protein: 1,
      comfort: 6,
      focus: 5,
      urgency: 9,
      temperature: 10,
      indulgence: 4,
      wellness: 7,
    },
  },
  {
    id: 'ocha-green-tea',
    name: 'Ocha Green Tea',
    tagline: 'Unsweetened tea',
    description: 'Balanced cold tea for wellness-focused shoppers who still want refreshment.',
    price: 16,
    image:
      'https://images.unsplash.com/photo-1556679343-c7306c1976bc?auto=format&fit=crop&w=900&q=80',
    accent: '#16a34a',
    background: 'from-lime-100 via-white to-emerald-50',
    stats: {
      hydration: 8,
      energy: 4,
      sweetness: 2,
      protein: 1,
      comfort: 6,
      focus: 7,
      urgency: 7,
      temperature: 9,
      indulgence: 3,
      wellness: 9,
    },
  },
  {
    id: 'orange-juice',
    name: 'Orange Juice',
    tagline: 'Citrus juice',
    description: 'Cold juice option that leans toward wellness and moderate sweetness.',
    price: 19,
    image: '/products/orange-juice.svg',
    accent: '#f97316',
    background: 'from-orange-100 via-white to-amber-50',
    stats: {
      hydration: 8,
      energy: 5,
      sweetness: 6,
      protein: 1,
      comfort: 5,
      focus: 4,
      urgency: 6,
      temperature: 8,
      indulgence: 5,
      wellness: 8,
    },
  },
  {
    id: 'red-bull',
    name: 'Red Bull',
    tagline: 'Energy drink',
    description: 'High-energy upsell for users who trend toward urgency and stimulation.',
    price: 20,
    image:
      'https://images.unsplash.com/photo-1543253687-c931c8e01820?auto=format&fit=crop&w=900&q=80',
    accent: '#1d4ed8',
    background: 'from-sky-100 via-white to-blue-50',
    stats: {
      hydration: 4,
      energy: 10,
      sweetness: 6,
      protein: 1,
      comfort: 4,
      focus: 8,
      urgency: 9,
      temperature: 9,
      indulgence: 7,
      wellness: 3,
    },
  },
  {
    id: 'iced-coffee',
    name: 'Iced Coffee',
    tagline: 'Cold brew',
    description: 'Sharper focus profile with moderate energy and low sweetness.',
    price: 21,
    image:
      'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=900&q=80',
    accent: '#7c3f00',
    background: 'from-amber-100 via-stone-50 to-orange-50',
    stats: {
      hydration: 4,
      energy: 9,
      sweetness: 3,
      protein: 1,
      comfort: 5,
      focus: 10,
      urgency: 8,
      temperature: 8,
      indulgence: 4,
      wellness: 4,
    },
  },
  {
    id: 'protein-bar',
    name: 'Protein Bar',
    tagline: 'Fuel bar',
    description: 'Compact protein-heavy snack for utility-driven shoppers.',
    price: 14,
    image:
      'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=900&q=80',
    accent: '#92400e',
    background: 'from-yellow-100 via-white to-stone-50',
    stats: {
      hydration: 1,
      energy: 6,
      sweetness: 3,
      protein: 10,
      comfort: 4,
      focus: 6,
      urgency: 7,
      temperature: 2,
      indulgence: 4,
      wellness: 8,
    },
  },
  {
    id: 'trail-mix',
    name: 'Trail Mix',
    tagline: 'Nut snack',
    description: 'Balanced snack profile with more protein and comfort than sugar.',
    price: 13,
    image:
      'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=900&q=80',
    accent: '#b45309',
    background: 'from-amber-100 via-white to-yellow-50',
    stats: {
      hydration: 1,
      energy: 5,
      sweetness: 3,
      protein: 8,
      comfort: 6,
      focus: 5,
      urgency: 5,
      temperature: 2,
      indulgence: 5,
      wellness: 8,
    },
  },
  {
    id: 'snickers',
    name: 'Snickers',
    tagline: 'Chocolate bar',
    description: 'Familiar impulse purchase with indulgence and fast energy.',
    price: 5,
    image:
      'https://images.unsplash.com/photo-1621939514649-280e2ee25f60?auto=format&fit=crop&w=900&q=80',
    accent: '#8b4513',
    background: 'from-amber-100 via-stone-50 to-white',
    stats: {
      hydration: 1,
      energy: 7,
      sweetness: 8,
      protein: 3,
      comfort: 7,
      focus: 3,
      urgency: 5,
      temperature: 2,
      indulgence: 9,
      wellness: 2,
    },
  },
  {
    id: 'coca-cola',
    name: 'Coca-Cola',
    tagline: 'Cold can',
    description: 'Classic sparkling option with cold refresh and higher sweetness.',
    price: 17,
    image:
      'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=900&q=80',
    accent: '#d62828',
    background: 'from-rose-100 via-white to-red-50',
    stats: {
      hydration: 6,
      energy: 7,
      sweetness: 9,
      protein: 1,
      comfort: 7,
      focus: 5,
      urgency: 8,
      temperature: 9,
      indulgence: 8,
      wellness: 2,
    },
  },
  {
    id: 'pepsi',
    name: 'Pepsi',
    tagline: 'Sparkling drink',
    description: 'Alternative cola choice with a similar cold-sugar profile.',
    price: 12,
    image:
      'https://images.unsplash.com/photo-1629203851122-3726ecdf080e?auto=format&fit=crop&w=900&q=80',
    accent: '#1e3a8a',
    background: 'from-blue-100 via-white to-slate-100',
    stats: {
      hydration: 6,
      energy: 6,
      sweetness: 8,
      protein: 1,
      comfort: 7,
      focus: 5,
      urgency: 7,
      temperature: 9,
      indulgence: 7,
      wellness: 2,
    },
  },
  {
    id: 'daily-milk',
    name: 'Daily Milk',
    tagline: 'Sweet dairy drink',
    description: 'Creamier comfort-led option with higher indulgence than hydration.',
    price: 30,
    image:
      'https://images.unsplash.com/photo-1550583724-b2692b85b150?auto=format&fit=crop&w=900&q=80',
    accent: '#db2777',
    background: 'from-pink-100 via-white to-fuchsia-50',
    stats: {
      hydration: 4,
      energy: 5,
      sweetness: 7,
      protein: 4,
      comfort: 9,
      focus: 3,
      urgency: 4,
      temperature: 5,
      indulgence: 8,
      wellness: 4,
    },
  },
  {
    id: 'matcha-latte',
    name: 'Matcha Latte',
    tagline: 'Tea latte',
    description: 'Wellness-oriented latte with focus support and moderate comfort.',
    price: 22,
    image:
      'https://images.unsplash.com/photo-1515823064-d6e0c04616a7?auto=format&fit=crop&w=900&q=80',
    accent: '#15803d',
    background: 'from-green-100 via-white to-lime-50',
    stats: {
      hydration: 5,
      energy: 7,
      sweetness: 4,
      protein: 2,
      comfort: 7,
      focus: 8,
      urgency: 6,
      temperature: 6,
      indulgence: 4,
      wellness: 8,
    },
  },
];
