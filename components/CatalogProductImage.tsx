"use client";

import { useEffect, useState } from "react";
import {
  findOpaqueBounds,
  removeConnectedWhiteBackground,
  shouldRemoveProductImageBackground,
} from "../lib/media/white-background";

const processedImages = new Map<string, string>();
const pendingImages = new Map<string, Promise<string>>();

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
    image.src = src;
  });
}

function canvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error("IMAGE_ENCODE_FAILED")),
      "image/webp",
      0.92,
    );
  });
}

async function buildTransparentImage(src: string) {
  const image = await loadImage(src);
  const scale = Math.min(1, 720 / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const context = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("CANVAS_UNAVAILABLE");
  context.drawImage(image, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  const changedPixels = removeConnectedWhiteBackground(
    imageData.data,
    width,
    height,
  );
  if (changedPixels < width * height * 0.18) return src;
  context.putImageData(imageData, 0, 0);

  const bounds = findOpaqueBounds(imageData.data, width, height);
  if (!bounds) return src;
  const padding = Math.max(4, Math.round(Math.max(bounds.width, bounds.height) * 0.035));
  const sourceX = Math.max(0, bounds.x - padding);
  const sourceY = Math.max(0, bounds.y - padding);
  const sourceWidth = Math.min(width - sourceX, bounds.width + padding * 2);
  const sourceHeight = Math.min(height - sourceY, bounds.height + padding * 2);
  const outputCanvas = document.createElement("canvas");
  outputCanvas.width = sourceWidth;
  outputCanvas.height = sourceHeight;
  const outputContext = outputCanvas.getContext("2d");
  if (!outputContext) throw new Error("CANVAS_UNAVAILABLE");
  outputContext.drawImage(
    sourceCanvas,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    sourceWidth,
    sourceHeight,
  );
  return URL.createObjectURL(await canvasBlob(outputCanvas));
}

function processImage(src: string) {
  const cached = processedImages.get(src);
  if (cached) return Promise.resolve(cached);
  const pending = pendingImages.get(src);
  if (pending) return pending;

  const processing = buildTransparentImage(src)
    .then((resolved) => {
      processedImages.set(src, resolved);
      return resolved;
    })
    .finally(() => pendingImages.delete(src));
  pendingImages.set(src, processing);
  return processing;
}

export function enhanceProductImageElement(image: HTMLImageElement) {
  const src = image.dataset.productImageSource || image.getAttribute("src") || "";
  if (!src) return () => {};

  const shouldProcess = shouldRemoveProductImageBackground(src);
  const cachedSource = processedImages.get(src);
  let active = true;

  image.dataset.productImageSource = src;
  image.classList.add("product-cutout-image", "catalog-product-image");
  image.classList.toggle("is-processing", shouldProcess && !cachedSource);
  image.classList.toggle("is-ready", !shouldProcess || Boolean(cachedSource));

  if (cachedSource) image.src = cachedSource;

  const source = shouldProcess ? processImage(src) : Promise.resolve(src);
  source
    .then((processedSource) => {
      if (!active || image.dataset.productImageSource !== src) return;
      image.src = processedSource;
      image.classList.remove("is-processing");
      image.classList.add("is-ready");
    })
    .catch(() => {
      if (!active || image.dataset.productImageSource !== src) return;
      image.src = src;
      image.classList.remove("is-processing");
      image.classList.add("is-ready");
    });

  return () => {
    active = false;
  };
}

type ProductImageProps = {
  src: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
};

export function ProductImage({
  src,
  alt,
  className = "",
  loading = "lazy",
}: ProductImageProps) {
  const shouldProcess = shouldRemoveProductImageBackground(src);
  const initialSource = processedImages.get(src) || src;
  const [imageState, setImageState] = useState({
    originalSource: src,
    resolvedSource: initialSource,
    ready: !shouldProcess || initialSource !== src,
  });
  const cachedSource = processedImages.get(src);
  const isCurrentSource = imageState.originalSource === src;
  const resolvedSource = isCurrentSource
    ? imageState.resolvedSource
    : cachedSource || src;
  const ready = isCurrentSource
    ? imageState.ready
    : !shouldProcess || Boolean(cachedSource);

  useEffect(() => {
    if (!shouldProcess) return;
    let active = true;
    processImage(src)
      .then((processedSource) => {
        if (!active) return;
        setImageState({
          originalSource: src,
          resolvedSource: processedSource,
          ready: true,
        });
      })
      .catch(() => {
        if (!active) return;
        setImageState({
          originalSource: src,
          resolvedSource: src,
          ready: true,
        });
      });
    return () => { active = false; };
  }, [shouldProcess, src]);

  return (
    // The same-origin media file is decoded in a canvas to remove its connected white backdrop.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`product-cutout-image catalog-product-image ${ready ? "is-ready" : "is-processing"}${className ? ` ${className}` : ""}`}
      src={resolvedSource}
      alt={alt}
      decoding="async"
      loading={loading}
    />
  );
}

export const CatalogProductImage = ProductImage;
