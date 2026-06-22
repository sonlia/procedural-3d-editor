<template>
  <div v-if="selectedObject" class="property-section">
    <div class="section-title" @click="collapsed = !collapsed">
      <q-icon :name="collapsed ? 'chevron_right' : 'expand_more'" size="16px" />
      <span>Material</span>
    </div>
    <div v-show="!collapsed" class="section-body">
      <!-- Material Preview -->
      <div class="material-preview-swatch" :style="{ background: matColor }"></div>

      <div class="prop-row">
        <label>Color</label>
        <input type="color" v-model="matColor" class="color-picker" />
        <span class="prop-value-narrow">{{ matColor }}</span>
      </div>
      <div class="prop-row">
        <label>Metalness</label>
        <q-slider
          v-model="matMetalness"
          :min="0"
          :max="1"
          :step="0.01"
          dense
          dark
          color="blue-4"
          class="prop-slider"
        />
        <span class="prop-value-narrow">{{ matMetalness.toFixed(2) }}</span>
      </div>
      <div class="prop-row">
        <label>Roughness</label>
        <q-slider
          v-model="matRoughness"
          :min="0"
          :max="1"
          :step="0.01"
          dense
          dark
          color="blue-4"
          class="prop-slider"
        />
        <span class="prop-value-narrow">{{ matRoughness.toFixed(2) }}</span>
      </div>
      <div class="prop-row">
        <label>Emissive</label>
        <input type="color" v-model="matEmissive" class="color-picker" />
        <span class="prop-value-narrow">{{ matEmissive }}</span>
      </div>
      <div class="prop-row">
        <label>Emissive Int.</label>
        <q-slider
          v-model="matEmissiveIntensity"
          :min="0"
          :max="5"
          :step="0.1"
          dense
          dark
          color="orange-4"
          class="prop-slider"
        />
        <span class="prop-value-narrow">{{ matEmissiveIntensity.toFixed(1) }}</span>
      </div>
      <div class="prop-row">
        <label>Opacity</label>
        <q-slider
          v-model="matOpacity"
          :min="0"
          :max="1"
          :step="0.01"
          dense
          dark
          color="blue-4"
          class="prop-slider"
        />
        <span class="prop-value-narrow">{{ matOpacity.toFixed(2) }}</span>
      </div>
      <div class="prop-row">
        <label>Transparent</label>
        <q-toggle v-model="matTransparent" dense dark size="xs" />
      </div>
      <div class="prop-row">
        <label>Wireframe</label>
        <q-toggle v-model="matWireframe" dense dark size="xs" />
      </div>
      <div class="prop-row">
        <label>Double Sided</label>
        <q-toggle v-model="matDoubleSided" dense dark size="xs" />
      </div>
      <!-- Texture Map Buttons -->
      <div class="texture-section">
        <div class="section-sub-title">
          <q-icon name="texture" size="12px" />
          <span>Texture Maps</span>
        </div>
        <div class="texture-row">
          <label>Base Color</label>
          <q-btn flat dense size="xs" icon="upload_file" @click="loadTexture('albedoTexture')" />
          <q-btn flat dense size="xs" icon="close" @click="removeTexture('albedoTexture')" v-if="hasTexture('albedoTexture')" />
          <span class="prop-value-narrow" v-if="hasTexture('albedoTexture')">loaded</span>
        </div>
        <div class="texture-row">
          <label>Normal Map</label>
          <q-btn flat dense size="xs" icon="upload_file" @click="loadTexture('normalTexture')" />
          <q-btn flat dense size="xs" icon="close" @click="removeTexture('normalTexture')" v-if="hasTexture('normalTexture')" />
          <span class="prop-value-narrow" v-if="hasTexture('normalTexture')">loaded</span>
        </div>
        <div class="texture-row">
          <label>Roughness Map</label>
          <q-btn flat dense size="xs" icon="upload_file" @click="loadTexture('roughnessTexture')" />
          <q-btn flat dense size="xs" icon="close" @click="removeTexture('roughnessTexture')" v-if="hasTexture('roughnessTexture')" />
          <span class="prop-value-narrow" v-if="hasTexture('roughnessTexture')">loaded</span>
        </div>
        <div class="texture-row">
          <label>Metalness Map</label>
          <q-btn flat dense size="xs" icon="upload_file" @click="loadTexture('metallicTexture')" />
          <q-btn flat dense size="xs" icon="close" @click="removeTexture('metallicTexture')" v-if="hasTexture('metallicTexture')" />
          <span class="prop-value-narrow" v-if="hasTexture('metallicTexture')">loaded</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { Color3, PBRMetallicRoughnessMaterial, PBRMaterial } from '@babylonjs/core'
import { useSceneStore } from '../../../stores/sceneStore'
import selectionManager from '../../../core/editing/SelectionManager.js'
import sceneManager from '../../../core/scene/SceneManager.js'

/** 根据 objectId 从 Babylon.js scene 中查找 Mesh（安全遍历） */
function findMeshByObjectId(scene, objectId) {
  if (!scene) return null
  return scene.meshes.find(m => m.metadata?.objectId === objectId) || null
}

const sceneStore = useSceneStore()

const selectedObject = computed(() => {
  const ids = selectionManager.state.selectedObjectIds
  if (ids.length === 0) return null
  return sceneStore.objects.find(o => o.id === ids[0]) || null
})

// 本地响应式材质属性
const matColor = ref('#5352ed')
const matMetalness = ref(0.3)
const matRoughness = ref(0.4)
const matEmissive = ref('#000000')
const matEmissiveIntensity = ref(0)
const matOpacity = ref(1)
const matTransparent = ref(false)
const matWireframe = ref(false)
const matDoubleSided = ref(false)

const collapsed = ref(false)

// 辅助函数：Color3 → hex string
function color3ToHex(color3) {
  if (!color3) return '#5352ed'
  const r = Math.round(color3.r * 255).toString(16).padStart(2, '0')
  const g = Math.round(color3.g * 255).toString(16).padStart(2, '0')
  const b = Math.round(color3.b * 255).toString(16).padStart(2, '0')
  return `#${r}${g}${b}`
}

// 辅助函数：hex string → Color3
function hexToColor3(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  return new Color3(r, g, b)
}

// 切换选择时，优先从 sceneStore 读取，回退到 Babylon.js mesh
watch(selectedObject, (obj) => {
  if (!obj) return

  // 优先从 store 数据读取（持久化后的值）
  if (obj.material) {
    matColor.value = obj.material.color || '#5352ed'
    matMetalness.value = obj.material.metalness ?? 0.3
    matRoughness.value = obj.material.roughness ?? 0.4
    matEmissive.value = obj.material.emissive || '#000000'
    matEmissiveIntensity.value = obj.material.emissiveIntensity ?? 0
    matOpacity.value = obj.material.opacity ?? 1
    matTransparent.value = obj.material.transparent ?? false
    matWireframe.value = obj.material.wireframe ?? false
    matDoubleSided.value = obj.material.doubleSided ?? false
    return
  }

  // 回退：从 Babylon.js mesh 读取
  if (!sceneManager.scene) return
  const mesh = findMeshByObjectId(sceneManager.scene, obj.id)
  if (mesh && mesh.material) {
    const mat = mesh.material
    if (mat instanceof PBRMetallicRoughnessMaterial) {
      matColor.value = color3ToHex(mat.baseColor)
      matMetalness.value = mat.metallic ?? 0.3
      matRoughness.value = mat.roughness ?? 0.4
    } else if (mat.baseColor) {
      matColor.value = color3ToHex(mat.baseColor)
    }
    if (mat.emissiveColor) {
      matEmissive.value = color3ToHex(mat.emissiveColor)
    }
    matOpacity.value = mat.alpha ?? 1
    matWireframe.value = mat.wireframe ?? false
    matDoubleSided.value = mat.backFaceCulling === false
  }
}, { immediate: true })

// 同步所有材质属性到 Babylon.js mesh + 回写 sceneStore
function applyMaterialToMesh() {
  const ids = selectionManager.state.selectedObjectIds
  if (ids.length === 0) return
  const mesh = findMeshByObjectId(sceneManager.scene, ids[0])

  // 构建 store 持久化的 material 数据
  const matData = {
    color: matColor.value,
    metalness: matMetalness.value,
    roughness: matRoughness.value,
    emissive: matEmissive.value,
    emissiveIntensity: matEmissiveIntensity.value,
    opacity: matOpacity.value,
    transparent: matTransparent.value,
    wireframe: matWireframe.value,
    doubleSided: matDoubleSided.value
  }

  // 回写 sceneStore
  sceneStore.updateObject(ids[0], { material: { ...matData } })

  // 同步到 Babylon.js mesh
  if (mesh && mesh.material) {
    const mat = mesh.material
    // PBRMetallicRoughnessMaterial 属性
    if (mat.baseColor) {
      mat.baseColor = hexToColor3(matColor.value)
    }
    if (mat.metallic !== undefined) mat.metallic = matMetalness.value
    if (mat.roughness !== undefined) mat.roughness = matRoughness.value
    if (mat.emissiveColor) {
      const ec = hexToColor3(matEmissive.value)
      mat.emissiveColor = ec.scale(matEmissiveIntensity.value)
    }
    mat.alpha = matOpacity.value
    mat.wireframe = matWireframe.value
    mat.backFaceCulling = !matDoubleSided.value
    if (matTransparent.value) {
      mat.transparencyMode = PBRMetallicRoughnessMaterial.MATERIAL_ALPHABLEND
    } else {
      mat.transparencyMode = PBRMetallicRoughnessMaterial.MATERIAL_OPAQUE
    }
  }
}

// 监听所有材质属性变化
watch(matColor, () => applyMaterialToMesh())
watch(matMetalness, () => applyMaterialToMesh())
watch(matRoughness, () => applyMaterialToMesh())
watch(matEmissive, () => applyMaterialToMesh())
watch(matEmissiveIntensity, () => applyMaterialToMesh())
watch(matOpacity, () => applyMaterialToMesh())
watch(matTransparent, () => applyMaterialToMesh())
watch(matWireframe, () => applyMaterialToMesh())
watch(matDoubleSided, () => applyMaterialToMesh())

// ---- Texture loading helpers (Babylon.js Texture) ----
import { Texture } from '@babylonjs/core'

function loadTexture(slot) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/*'
  input.onchange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    const ids = selectionManager.state.selectedObjectIds
    if (ids.length === 0) return
    const mesh = findMeshByObjectId(sceneManager.scene, ids[0])
    if (mesh && mesh.material) {
      const texture = new Texture(url, sceneManager.scene)
      mesh.material[slot] = texture
    }
    // 回写 store 记录贴图
    const obj = sceneStore.objects.find(o => o.id === ids[0])
    if (obj) {
      const mat = { ...obj.material, [slot + 'Loaded']: true, [slot + 'Url']: url }
      sceneStore.updateObject(ids[0], { material: mat })
    }
  }
  input.click()
}

function removeTexture(slot) {
  const ids = selectionManager.state.selectedObjectIds
  if (ids.length === 0) return
  const mesh = findMeshByObjectId(sceneManager.scene, ids[0])
  if (mesh && mesh.material && mesh.material[slot]) {
    mesh.material[slot].dispose()
    mesh.material[slot] = null
  }
  const obj = sceneStore.objects.find(o => o.id === ids[0])
  if (obj) {
    const mat = { ...obj.material, [slot + 'Loaded']: false, [slot + 'Url']: null }
    sceneStore.updateObject(ids[0], { material: mat })
  }
}

function hasTexture(slot) {
  const ids = selectionManager.state.selectedObjectIds
  if (ids.length === 0) return false
  const mesh = findMeshByObjectId(sceneManager.scene, ids[0])
  return mesh && mesh.material && mesh.material[slot] != null
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

.material-preview-swatch {
  width: 100%;
  height: 32px;
  border-radius: 4px;
  border: 1px solid var(--editor-border);
  margin-bottom: 8px;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.prop-row label {
  min-width: 70px;
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

.texture-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.texture-row label {
  min-width: 70px;
  font-size: 10px;
  color: var(--editor-text-secondary);
}
</style>
