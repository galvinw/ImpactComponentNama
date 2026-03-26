import { useEffect, useRef } from 'react';
import type { MouseEvent, PointerEvent } from 'react';
import type { Product } from '../data/products';

interface ProductCarouselProps {
  products: Product[];
  selectedProduct: Product;
  onSelectProduct: (productId: string) => void;
}

const DUPLICATE_SETS = 3;

export default function ProductCarousel({
  products,
  selectedProduct,
  onSelectProduct,
}: ProductCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef({
    active: false,
    moved: false,
    engaged: false,
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
  });

  const repeatedProducts = Array.from({ length: DUPLICATE_SETS }, () => products).flat();

  useEffect(() => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    const initializePosition = () => {
      track.scrollLeft = track.scrollWidth / DUPLICATE_SETS;
    };

    const maintainInfiniteLoop = () => {
      const singleSetWidth = track.scrollWidth / DUPLICATE_SETS;

      if (track.scrollLeft < singleSetWidth * 0.5) {
        track.scrollLeft += singleSetWidth;
      } else if (track.scrollLeft > singleSetWidth * 1.5) {
        track.scrollLeft -= singleSetWidth;
      }
    };

    initializePosition();
    track.addEventListener('scroll', maintainInfiniteLoop);

    return () => {
      track.removeEventListener('scroll', maintainInfiniteLoop);
    };
  }, [products]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    if (!track) {
      return;
    }

    dragStateRef.current = {
      active: true,
      moved: false,
      engaged: false,
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: track.scrollLeft,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const track = trackRef.current;
    const dragState = dragStateRef.current;

    if (!track || !dragState.active) {
      return;
    }

    const delta = event.clientX - dragState.startX;
    if (Math.abs(delta) > 4) {
      dragState.moved = true;
    }

    if (dragState.moved && !dragState.engaged) {
      dragState.engaged = true;
      track.setPointerCapture(event.pointerId);
    }

    if (!dragState.engaged) {
      return;
    }

    track.scrollLeft = dragState.startScrollLeft - delta;
  };

  const handlePointerEnd = () => {
    const track = trackRef.current;
    const dragState = dragStateRef.current;

    if (!track || !dragState.active) {
      return;
    }

    if (dragState.engaged && track.hasPointerCapture(dragState.pointerId)) {
      track.releasePointerCapture(dragState.pointerId);
    }

    dragState.active = false;
    dragState.engaged = false;

    window.setTimeout(() => {
      dragState.moved = false;
    }, 0);
  };

  const handleCardClick = (
    event: MouseEvent<HTMLButtonElement>,
    productId: string
  ) => {
    if (dragStateRef.current.moved) {
      event.preventDefault();
      return;
    }

    onSelectProduct(productId);
  };

  return (
    <section className="rounded-lg bg-slate-950/68 p-3 text-white shadow-[0_30px_60px_-35px_rgba(15,23,42,0.85)] backdrop-blur-md">
      <div
        ref={trackRef}
        className="flex cursor-grab gap-4 overflow-x-auto pb-1 touch-pan-y [scrollbar-width:none] [&::-webkit-scrollbar]:hidden active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {repeatedProducts.map((product, index) => {
          const isSelected = product.id === selectedProduct.id;

          return (
            <button
              key={`${product.id}-${index}`}
              type="button"
              data-carousel-card="true"
              onClick={(event) => handleCardClick(event, product.id)}
              className={`min-w-[260px] flex-[0_0_260px] overflow-hidden rounded-md text-left transition ${
                isSelected
                  ? 'bg-white text-slate-950 shadow-[0_24px_50px_-30px_rgba(255,255,255,0.5)]'
                  : 'bg-white/10 text-white hover:bg-white/14'
              }`}
            >
              <img
                src={product.image}
                alt={product.name}
                className="h-36 w-full object-cover"
                draggable={false}
              />
              <div className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p
                      className={`text-xs uppercase tracking-[0.2em] ${
                        isSelected ? 'text-slate-500' : 'text-white/55'
                      }`}
                    >
                      {product.tagline}
                    </p>
                    <h4 className="mt-2 text-lg font-semibold">{product.name}</h4>
                  </div>
                  <span className="text-xl font-bold">${product.price.toFixed(0)}</span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span
                    className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${
                      isSelected
                        ? 'bg-[#ffc42d] text-slate-950'
                        : 'bg-white/10 text-white/80'
                    }`}
                  >
                    {isSelected ? 'Selected' : 'Select'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
