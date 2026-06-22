/**
 * 材质工具函数 - material-utils
 * 安全表达式求值、颜色转换等
 */

/**
 * 安全地求值数学表达式
 */
export function evaluateExpression(expr, context = {}) {
  if (typeof expr === 'number') return expr
  if (typeof expr !== 'string') return 0

  try {
    const keys = Object.keys(context)
    const values = Object.values(context)
    const fn = new Function(...keys, `"use strict"; return (${expr});`)
    return fn(...values)
  } catch {
    // Fall back: replace known variables
    let result = expr
    for (const [key, val] of Object.entries(context)) {
      result = result.replace(new RegExp(`\\b${key}\\b`, 'g'), String(val))
    }
    try {
      return new Function(`"use strict"; return (${result});`)()
    } catch {
      return 0
    }
  }
}

/**
 * Hex color → { r, g, b } (0–1 range)
 */
export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return { r: 0, g: 0, b: 0 }
  let h = hex.replace('#', '')
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
  const num = parseInt(h, 16)
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255
  }
}

/**
 * { r, g, b } (0–1) → hex color
 */
export function rgbToHex(r, g, b) {
  const toHex = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

/**
 * HSL → RGB (0–1 range)
 */
export function hslToRgb(h, s, l) {
  let r, g, b
  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }
  return { r, g, b }
}

/**
 * RGB → HSL (0–1 range)
 */
export function rgbToHsl(r, g, b) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0, s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break
      case g: h = ((b - r) / d + 2) / 6; break
      case b: h = ((r - g) / d + 4) / 6; break
    }
  }

  return { h, s, l }
}

/**
 * Linear → sRGB
 */
export function linearToSrgb(linear) {
  return linear <= 0.0031308
    ? 12.92 * linear
    : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055
}

/**
 * sRGB → Linear
 */
export function srgbToLinear(srgb) {
  return srgb <= 0.04045
    ? srgb / 12.92
    : Math.pow((srgb + 0.055) / 1.055, 2.4)
}

/**
 * Clamp a value between min and max
 */
export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

/**
 * Lerp between two values
 */
export function lerp(a, b, t) {
  return a + (b - a) * t
}