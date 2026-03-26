import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import KioskMenuPage from './pages/KioskMenuPage';
import ProductWorkspacePage from './pages/ProductWorkspacePage';
import { products } from './data/products';

const STORAGE_KEY = 'impact-vending-selected-product';

function getInitialProductId() {
  const storedProductId = window.localStorage.getItem(STORAGE_KEY);
  return products.some((product) => product.id === storedProductId)
    ? storedProductId!
    : products[0].id;
}

function App() {
  const [selectedProductId, setSelectedProductId] = useState(getInitialProductId);
  const selectedProduct =
    products.find((product) => product.id === selectedProductId) ?? products[0];

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, selectedProductId);
  }, [selectedProductId]);

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <ProductWorkspacePage
              products={products}
              selectedProduct={selectedProduct}
              onSelectProduct={setSelectedProductId}
            />
          }
        />
        <Route
          path="/kiosk"
          element={
            <KioskMenuPage
              products={products}
              selectedProduct={selectedProduct}
              onSelectProduct={setSelectedProductId}
            />
          }
        />
        <Route path="*" element={<Navigate replace to="/" />} />
      </Routes>
    </Router>
  );
}

export default App;
