<template>
  <div class="property-section">
    <div class="section-title" @click="collapsed = !collapsed">
      <q-icon :name="collapsed ? 'chevron_right' : 'expand_more'" size="16px" />
      <span>Environment</span>
    </div>
    <div v-show="!collapsed" class="section-body">
      <!-- Background Color -->
      <div class="prop-row">
        <label>BG Color</label>
        <input type="color" :value="bgColorHex" @input="updateEnv('bgColor', $event.target.value)" class="color-picker" />
        <span class="prop-value-narrow">{{ bgColorHex }}</span>
      </div>

      <!-- Ambient Light -->
      <div class="prop-group-label">Ambient Light</div>
      <div class="prop-row">
        <label>Intensity</label>
        <q-slider
          :model-value="env.ambientIntensity"
          @update:model-value="updateEnv('ambientIntensity', $event)"
          :min="0" :max="3" :step="0.1" dense dark color="blue-4" class="prop-slider"
        />
        <span class="prop-value-narrow">{{ env.ambientIntensity.toFixed(1) }}</span>
      </div>
      <div class="prop-row">
        <label>Color</label>
        <input type="color" :value="colorToHex(env.ambientColor)" @input="updateEnvColor('ambientColor', $event.target.value)" class="color-picker" />
      </div>

      <!-- Directional Light -->
      <div class="prop-group-label">Main Light</div>
      <div class="prop-row">
        <label>Intensity</label>
        <q-slider
          :model-value="env.dirLightIntensity"
          @update:model-value="updateEnv('dirLightIntensity', $event)"
          :min="0" :max="5" :step="0.1" dense dark color="yellow-4" class="prop-slider"
        />
        <span class="prop-value-narrow">{{ env.dirLightIntensity.toFixed(1) }}</span>
      </div>
      <div class="prop-row">
        <label>Color</label>
        <input type="color" :value="colorToHex(env.dirLightColor)" @input="updateEnvColor('dirLightColor', $event.target.value)" class="color-picker" />
      </div>
      <div class="prop-row-vec">
        <label class="vec-label x-label">X</label>
        <q-input :model-value="env.dirLightPosition.x" @update:model-value="updateDirPos('x', $event)" type="number" dense outlined dark class="prop-input-vec" step="0.5" />
        <label class="vec-label y-label">Y</label>
        <q-input :model-value="env.dirLightPosition.y" @update:model-value="updateDirPos('y', $event)" type="number" dense outlined dark class="prop-input-vec" step="0.5" />
        <label class="vec-label z-label">Z</label>
        <q-input :model-value="env.dirLightPosition.z" @update:model-value="updateDirPos('z', $event)" type="number" dense outlined dark class="prop-input-vec" step="0.5" />
      </div>

      <!-- Fill Light -->
      <div class="prop-group-label">Fill Light</div>
      <div class="prop-row">
        <label>Intensity</label>
        <q-slider
          :model-value="env.fillLightIntensity"
          @update:model-value="updateEnv('fillLightIntensity', $event)"
          :min="0" :max="3" :step="0.1" dense dark color="orange-4" class="prop-slider"
        />
        <span class="prop-value-narrow">{{ env.fillLightIntensity.toFixed(1) }}</span>
      </div>
      <div class="prop-row">
        <label>Color</label>
        <input type="color" :value="colorToHex(env.fillLightColor)" @input="updateEnvColor('fillLightColor', $event.target.value)" class="color-picker" />
      </div>

      <!-- Fog -->
      <div class="prop-group-label">Fog</div>
      <div class="prop-row">
        <label>Enabled</label>
        <q-toggle :model-value="env.fogEnabled" @update:model-value="updateEnv('fogEnabled', $event)" dense dark size="xs" />
      </div>
      <div class="prop-row" v-if="env.fogEnabled">
        <label>Density</label>
        <q-slider
          :model-value="env.fogDensity"
          @update:model-value="updateEnv('fogDensity', $event)"
          :min="0" :max="0.1" :step="0.001" dense dark color="grey-5" class="prop-slider"
        />
        <span class="prop-value-narrow">{{ env.fogDensity.toFixed(3) }}</span>
      </div>

      <!-- Shadows -->
      <div class="prop-row">
        <label>Shadows</label>
        <q-toggle :model-value="env.shadowEnabled" @update:model-value="updateEnv('shadowEnabled', $event)" dense dark size="xs" />
      </div>

      <!-- HDR Environment -->
      <div class="texture-section">
        <div class="section-sub-title">
          <q-icon name="wb_sunny" size="12px" />
          <span>HDRI Environment</span>
        </div>
        <div class="prop-row">
          <label>Load HDR</label>
          <q-btn flat dense size="xs" icon="upload_file" @click="loadHDR" />
          <span class="prop-value-narrow" v-if="hdrLoaded">loaded</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { Color3, Color4 } from '@babylonjs/core'
import sceneManager from '../../../core/scene/SceneManager.js'

const collapsed = ref(false)
const hdrLoaded = ref(false)

// 本地环境参数（与 SceneManager.environment 同步）
const env = reactive({ ...sceneManager.environment })

// ---- 辅助函数 ----
function colorToHex(c) {
  if (!c) return '#666666'
  const r = Math.round(c.r * 255).toString(16).padStart(2, '0')
  const g = Math.round(c.g * 255).toString(16).padStart(2, '0')
  const b = Math.round(c.b * 255).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

function hexToRgb(hex) {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255
  }
}

const bgColorHex = ref(colorToHex(env.bgColor))

// ---- 更新函数 ----
function updateEnv(key, value) {
  env[key] = value
  if (key === 'bgColor') {
    bgColorHex.value = colorToHex(value)
  }
  sceneManager.updateEnvironment({ [key]: value })
}

function updateEnvColor(key, hexValue) {
  const rgb = hexToRgb(hexValue)
  env[key] = { ...rgb }
  sceneManager.updateEnvironment({ [key]: { ...rgb } })
}

function updateDirPos(axis, value) {
  const num = Number(value)
  env.dirLightPosition[axis] = num
  sceneManager.updateEnvironment({
    dirLightPosition: { ...env.dirLightPosition }
  })
}

function loadHDR() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.hdr,.exr,.png,.jpg'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    // Babylon.js HDR 环境加载
    import('@babylonjs/core').then(({ HDRCubeTexture, EnvironmentHelper }) => {
      const scene = sceneManager.scene
      if (!scene) return
      try {
        // 创建 HDR 环境
        const hdrTexture = new HDRCubeTexture('hdrEnv', url, scene, 128, false, true, false, true)
        scene.environmentTexture = hdrTexture
        hdrLoaded.value = true
        console.log('[EnvironmentProperties] HDR loaded:', file.name)
      } catch (err) {
        console.error('[EnvironmentProperties] HDR load error:', err)
      }
    })
  }
  input.click()
}
</script>

<style scoped>
.property-section {
  border-bottom: 1px solid var(--editor-border);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--editor-text-secondary);
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}

.section-title:hover {
  background: var(--editor-bg-hover);
}

.section-body {
  padding: 4px 12px 10px;
}

.prop-group-label {
  font-size: 10px;
  color: var(--editor-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin: 8px 0 4px;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.prop-row label {
  min-width: 60px;
  font-size: 11px;
  color: var(--editor-text-secondary);
}

.prop-slider {
  flex: 1;
}

.prop-value-narrow {
  font-size: 10px;
  color: var(--editor-text-muted);
  min-width: 32px;
  text-align: right;
}

.color-picker {
  width: 32px;
  height: 22px;
  border: 1px solid var(--editor-border);
  border-radius: 3px;
  cursor: pointer;
  background: transparent;
  padding: 1px;
}

.prop-row-vec {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.vec-label {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.x-label { background: rgba(255, 100, 100, 0.3); color: #ff6b6b; }
.y-label { background: rgba(100, 255, 100, 0.3); color: #51cf66; }
.z-label { background: rgba(100, 100, 255, 0.3); color: #339af0; }

.prop-input-vec {
  width: 60px;
  min-width: 50px;
}

.prop-input-vec :deep(.q-field__control) {
  height: 22px;
  min-height: 22px;
}

.prop-input-vec :deep(.q-field__native) {
  font-size: 10px;
  padding: 0 4px;
}

.texture-section {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--editor-border);
}

.section-sub-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--editor-text-secondary);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}
</style>
