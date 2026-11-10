"use client";

import { useState } from "react";
import { ProductImage } from "./CatalogProductImage";

type ProductGalleryProps = {
  images: string[];
  name: string;
  badge?: string;
};

export function ProductGallery({
  images,
  name,
  badge,
}: ProductGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeImage = images[activeIndex] ?? images[0];

  return (
    <div className="product-gallery">
      <div className="product-main-image">
        <ProductImage src={activeImage} alt={name} loading="eager" />
        {badge && <span>{badge}</span>}
      </div>
      <div className="product-thumbnails" aria-label="Изображения товара">
        {images.map((image, index) => (
          <button
            className={index === activeIndex ? "is-active" : ""}
            type="button"
            key={`${image}-${index}`}
            onClick={() => setActiveIndex(index)}
            aria-label={`Показать изображение ${index + 1}`}
            aria-pressed={index === activeIndex}
          >
            <ProductImage src={image} alt="" />
          </button>
        ))}
      </div>
    </div>
  );
}
