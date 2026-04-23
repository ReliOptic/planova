function sRGBtoLinear(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(r: number, g: number, b: number): number {
  return 0.2126 * sRGBtoLinear(r) + 0.7152 * sRGBtoLinear(g) + 0.0722 * sRGBtoLinear(b);
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export interface BlockColorStyle {
  backgroundColor: string;
  color: string;
  borderColor: string;
}

/**
 * Computes inline CSS color values for a task block.
 * Text color is WCAG-determined against the rgba-over-white blended effective background,
 * so it remains readable at any opacity level.
 */
export function computeBlockColorStyle(hex: string, opacity: number): BlockColorStyle {
  const alpha = Math.max(0.2, Math.min(1, opacity / 100));
  const [r, g, b] = hexToRgb(hex);

  // Effective color after compositing rgba over white (#fff)
  const er = r * alpha + 255 * (1 - alpha);
  const eg = g * alpha + 255 * (1 - alpha);
  const eb = b * alpha + 255 * (1 - alpha);

  const lum = relativeLuminance(er, eg, eb);
  const onWhite = 1.05 / (lum + 0.05);
  const onBlack = (lum + 0.05) / 0.05;
  const textColor = onBlack > onWhite ? 'rgba(0,0,0,0.87)' : 'rgba(255,255,255,0.95)';

  return {
    backgroundColor: `rgba(${r},${g},${b},${alpha.toFixed(2)})`,
    color: textColor,
    borderColor: `rgba(${r},${g},${b},${Math.min(1, alpha + 0.2).toFixed(2)})`,
  };
}
