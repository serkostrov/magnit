import assert from "node:assert/strict";
import test from "node:test";
import {
  findOpaqueBounds,
  removeConnectedWhiteBackground,
  shouldRemoveProductImageBackground,
} from "../lib/media/white-background.ts";

function pixels(width, height, color = [255, 255, 255, 255]) {
  const value = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < width * height; index += 1) {
    value.set(color, index * 4);
  }
  return value;
}

function setPixel(value, width, x, y, color) {
  value.set(color, (y * width + x) * 4);
}

function alpha(value, width, x, y) {
  return value[(y * width + x) * 4 + 3];
}

test("removes only light background connected to image edges", () => {
  const width = 7;
  const height = 7;
  const value = pixels(width, height);
  for (let y = 2; y <= 4; y += 1) {
    for (let x = 2; x <= 4; x += 1) {
      setPixel(value, width, x, y, [190, 192, 194, 255]);
    }
  }
  setPixel(value, width, 3, 3, [255, 255, 255, 255]);

  const changed = removeConnectedWhiteBackground(value, width, height);

  assert.ok(changed > 0);
  assert.equal(alpha(value, width, 0, 0), 0);
  assert.equal(alpha(value, width, 3, 3), 255);
  assert.equal(alpha(value, width, 2, 2), 255);
  assert.deepEqual(findOpaqueBounds(value, width, height), {
    x: 2,
    y: 2,
    width: 3,
    height: 3,
  });
});

test("keeps a colored edge and validates malformed image data", () => {
  const value = pixels(2, 2, [250, 232, 220, 255]);
  assert.equal(removeConnectedWhiteBackground(value, 2, 2), 0);
  assert.equal(alpha(value, 2, 0, 0), 255);
  assert.throws(
    () => removeConnectedWhiteBackground(new Uint8ClampedArray(3), 2, 2),
    /INVALID_IMAGE_DATA/,
  );
});

test("selects only managed product media for background removal", () => {
  assert.equal(shouldRemoveProductImageBackground("/media/products/a/photo.jpg"), true);
  assert.equal(shouldRemoveProductImageBackground("/media/products/a/photo.webp?v=2"), true);
  assert.equal(shouldRemoveProductImageBackground("/assets/bs-10x2.webp"), false);
  assert.equal(shouldRemoveProductImageBackground("https://example.com/photo.jpg"), false);
});
