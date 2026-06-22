/**
 * 材质纹理工具 - material-textures
 * 纹理加载和管理辅助函数
 */
import { Texture, TextureSampler } from '@babylonjs/core'

/**
 * Create a procedural checker texture using a dynamic texture approach
 * Returns a data URL for use as texture
 */
export function createCheckerDataURL(size = 256, divisions = 4, c1 = '#ffffff', c2 = '#000000') {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) return null
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const cellW = size / divisions
  const cellH = size / divisions

  for (let row = 0; row < divisions; row++) {
    for (let col = 0; col < divisions; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? c1 : c2
      ctx.fillRect(col * cellW, row * cellH, cellW, cellH)
    }
  }

  return canvas.toDataURL()
}

/**
 * Create a procedural noise/grain texture data URL
 */
export function createNoiseDataURL(size = 256) {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) return null
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(size, size)

  for (let i = 0; i < imageData.data.length; i += 4) {
    const v = Math.random() * 255
    imageData.data[i] = v
    imageData.data[i + 1] = v
    imageData.data[i + 2] = v
    imageData.data[i + 3] = 255
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL()
}

/**
 * Create a gradient texture data URL (vertical gradient)
 */
export function createGradientDataURL(size = 256, colorTop = '#ffffff', colorBottom = '#000000') {
  const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null
  if (!canvas) return null
  canvas.width = 1
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const gradient = ctx.createLinearGradient(0, 0, 0, size)
  gradient.addColorStop(0, colorTop)
  gradient.addColorStop(1, colorBottom)
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 1, size)
  return canvas.toDataURL()
}

/**
 * Load a texture from URL with common settings
 */
export function loadTexture(url, scene, options = {}) {
  if (!scene || !url) return null

  const tex = new Texture(url, scene, options.noMipmap || false, options.invertY, options.samplingMode)
  tex.wrapU = options.wrapU || Texture.TRILINEAR_SAMPLINGMODE
  tex.wrapV = options.wrapV || Texture.TRILINEAR_SAMPLINGMODE

  if (options.uScale !== undefined) tex.uScale = options.uScale
  if (options.vScale !== undefined) tex.vScale = options.vScale
  if (options.uOffset !== undefined) tex.uOffset = options.uOffset
  if (options.vOffset !== undefined) tex.vOffset = options.vOffset
  if (options.rotation !== undefined) tex.uAng = options.rotation

  return tex
}

/**
 * Create a default texture with checker pattern
 */
export function createDefaultTexture(scene) {
  const dataUrl = createCheckerDataURL()
  if (!dataUrl || !scene) return null
  return new Texture(dataUrl, scene)
}