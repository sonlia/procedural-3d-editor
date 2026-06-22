/**
 * 材质缓存 - material-cache
 * Map-based cache for compiled materials
 */

const _cache = new Map()

/**
 * Get a material from cache
 * @param {string} key
 * @returns {*}
 */
export function getMaterialFromCache(key) {
  return _cache.get(key) || null
}

/**
 * Store a material in cache
 * @param {string} key
 * @param {*} material
 */
export function setMaterialCache(key, material) {
  _cache.set(key, material)
}

/**
 * Check if a material exists in cache
 * @param {string} key
 * @returns {boolean}
 */
export function hasMaterialCache(key) {
  return _cache.has(key)
}

/**
 * Remove a material from cache
 * @param {string} key
 */
export function removeMaterialCache(key) {
  _cache.delete(key)
}

/**
 * Clear all cached materials
 */
export function clearMaterialCache() {
  for (const [, mat] of _cache) {
    if (mat && typeof mat.dispose === 'function') {
      mat.dispose()
    }
  }
  _cache.clear()
}

/**
 * Get cache size
 * @returns {number}
 */
export function getMaterialCacheSize() {
  return _cache.size
}