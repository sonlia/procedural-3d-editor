/**
 * 材质预设 - material-presets
 * 常用材质参数预设
 */

export const MATERIAL_PRESETS = [
  {
    id: 'gold',
    label: 'Gold',
    category: 'metal',
    baseColor: { r: 1.0, g: 0.76, b: 0.34 },
    metallic: 1.0,
    roughness: 0.2,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  },
  {
    id: 'chrome',
    label: 'Chrome',
    category: 'metal',
    baseColor: { r: 0.85, g: 0.85, b: 0.85 },
    metallic: 1.0,
    roughness: 0.05,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  },
  {
    id: 'copper',
    label: 'Copper',
    category: 'metal',
    baseColor: { r: 0.72, g: 0.45, b: 0.2 },
    metallic: 1.0,
    roughness: 0.3,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  },
  {
    id: 'iron',
    label: 'Iron',
    category: 'metal',
    baseColor: { r: 0.56, g: 0.56, b: 0.58 },
    metallic: 1.0,
    roughness: 0.5,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  },
  {
    id: 'plastic_red',
    label: 'Plastic (Red)',
    category: 'plastic',
    baseColor: { r: 0.9, g: 0.1, b: 0.1 },
    metallic: 0.0,
    roughness: 0.4,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  },
  {
    id: 'plastic_blue',
    label: 'Plastic (Blue)',
    category: 'plastic',
    baseColor: { r: 0.1, g: 0.3, b: 0.9 },
    metallic: 0.0,
    roughness: 0.4,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  },
  {
    id: 'plastic_white',
    label: 'Plastic (White)',
    category: 'plastic',
    baseColor: { r: 0.95, g: 0.95, b: 0.93 },
    metallic: 0.0,
    roughness: 0.35,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  },
  {
    id: 'glass',
    label: 'Glass',
    category: 'glass',
    baseColor: { r: 0.9, g: 0.95, b: 1.0 },
    metallic: 0.0,
    roughness: 0.0,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 0.3
  },
  {
    id: 'glass_tinted',
    label: 'Glass (Tinted)',
    category: 'glass',
    baseColor: { r: 0.2, g: 0.5, b: 0.8 },
    metallic: 0.0,
    roughness: 0.0,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 0.4
  },
  {
    id: 'wood_oak',
    label: 'Wood (Oak)',
    category: 'organic',
    baseColor: { r: 0.72, g: 0.53, b: 0.3 },
    metallic: 0.0,
    roughness: 0.75,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  },
  {
    id: 'wood_dark',
    label: 'Wood (Dark)',
    category: 'organic',
    baseColor: { r: 0.35, g: 0.2, b: 0.1 },
    metallic: 0.0,
    roughness: 0.7,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  },
  {
    id: 'rubber',
    label: 'Rubber',
    category: 'plastic',
    baseColor: { r: 0.15, g: 0.15, b: 0.15 },
    metallic: 0.0,
    roughness: 0.95,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  },
  {
    id: 'emissive_green',
    label: 'Emissive (Green)',
    category: 'emissive',
    baseColor: { r: 0.1, g: 0.5, b: 0.1 },
    metallic: 0.0,
    roughness: 0.5,
    emissive: { r: 0.0, g: 0.8, b: 0.0 },
    alpha: 1.0
  },
  {
    id: 'emissive_blue',
    label: 'Emissive (Blue)',
    category: 'emissive',
    baseColor: { r: 0.1, g: 0.1, b: 0.5 },
    metallic: 0.0,
    roughness: 0.5,
    emissive: { r: 0.0, g: 0.2, b: 1.0 },
    alpha: 1.0
  },
  {
    id: 'ceramic',
    label: 'Ceramic',
    category: 'other',
    baseColor: { r: 0.98, g: 0.96, b: 0.92 },
    metallic: 0.0,
    roughness: 0.15,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  },
  {
    id: 'concrete',
    label: 'Concrete',
    category: 'other',
    baseColor: { r: 0.6, g: 0.58, b: 0.55 },
    metallic: 0.0,
    roughness: 0.9,
    emissive: { r: 0, g: 0, b: 0 },
    alpha: 1.0
  }
]

/**
 * Get preset by ID
 */
export function getPresetById(id) {
  return MATERIAL_PRESETS.find(p => p.id === id) || null
}

/**
 * Get presets by category
 */
export function getPresetsByCategory(category) {
  return MATERIAL_PRESETS.filter(p => p.category === category)
}

/**
 * Get all categories
 */
export function getPresetCategories() {
  const cats = new Set(MATERIAL_PRESETS.map(p => p.category))
  return [...cats]
}