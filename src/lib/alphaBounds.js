/** حدود البكسلات غير الشفافة لقص صورة التصدير حول الموديل. */
export function alphaBounds(data, width, height, threshold = 1) {
  let left = width, top = height, right = -1, bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * 4 + 3] > threshold) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return right < left ? null : { left, top, right, bottom };
}
