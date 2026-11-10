export type PixelBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type WhiteBackgroundOptions = {
  threshold?: number;
  maximumChroma?: number;
  featherStart?: number;
};

export function shouldRemoveProductImageBackground(src: string) {
  return /^\/media\/.*\.(?:avif|jpe?g|png|webp)(?:\?.*)?$/i.test(src);
}

function lightnessDistance(
  pixels: Uint8ClampedArray,
  offset: number,
) {
  return 255 - Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]);
}

function chroma(pixels: Uint8ClampedArray, offset: number) {
  const red = pixels[offset];
  const green = pixels[offset + 1];
  const blue = pixels[offset + 2];
  return Math.max(red, green, blue) - Math.min(red, green, blue);
}

export function removeConnectedWhiteBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  options: WhiteBackgroundOptions = {},
) {
  if (width <= 0 || height <= 0 || pixels.length !== width * height * 4) {
    throw new Error("INVALID_IMAGE_DATA");
  }

  const threshold = options.threshold ?? 34;
  const maximumChroma = options.maximumChroma ?? 24;
  const featherStart = Math.min(options.featherStart ?? 8, threshold - 1);
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let queueStart = 0;
  let queueEnd = 0;

  const canRemove = (index: number) => {
    const offset = index * 4;
    return (
      pixels[offset + 3] > 0 &&
      lightnessDistance(pixels, offset) <= threshold &&
      chroma(pixels, offset) <= maximumChroma
    );
  };

  const enqueue = (index: number) => {
    if (visited[index] || !canRemove(index)) return;
    visited[index] = 1;
    queue[queueEnd] = index;
    queueEnd += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }

  while (queueStart < queueEnd) {
    const index = queue[queueStart];
    queueStart += 1;
    const x = index % width;
    const y = Math.floor(index / width);

    for (let deltaY = -1; deltaY <= 1; deltaY += 1) {
      for (let deltaX = -1; deltaX <= 1; deltaX += 1) {
        if (deltaX === 0 && deltaY === 0) continue;
        const nextX = x + deltaX;
        const nextY = y + deltaY;
        if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue;
        enqueue(nextY * width + nextX);
      }
    }
  }

  let changedPixels = 0;
  for (let index = 0; index < visited.length; index += 1) {
    if (!visited[index]) continue;
    const offset = index * 4;
    const distance = lightnessDistance(pixels, offset);
    const opacity = Math.max(
      0,
      Math.min(1, (distance - featherStart) / (threshold - featherStart)),
    );
    const nextAlpha = Math.round(pixels[offset + 3] * opacity);
    if (nextAlpha !== pixels[offset + 3]) {
      pixels[offset + 3] = nextAlpha;
      changedPixels += 1;
    }
  }

  return changedPixels;
}

export function findOpaqueBounds(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  minimumAlpha = 24,
): PixelBounds | null {
  let minimumX = width;
  let minimumY = height;
  let maximumX = -1;
  let maximumY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (pixels[(y * width + x) * 4 + 3] < minimumAlpha) continue;
      minimumX = Math.min(minimumX, x);
      minimumY = Math.min(minimumY, y);
      maximumX = Math.max(maximumX, x);
      maximumY = Math.max(maximumY, y);
    }
  }

  if (maximumX < minimumX || maximumY < minimumY) return null;
  return {
    x: minimumX,
    y: minimumY,
    width: maximumX - minimumX + 1,
    height: maximumY - minimumY + 1,
  };
}
