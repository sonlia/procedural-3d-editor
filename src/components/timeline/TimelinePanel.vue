<template>
  <div class="timeline-panel">
    <!-- Playback Controls -->
    <div class="timeline-controls">
      <q-btn flat dense size="sm" icon="skip_previous" @click="timelineStore.goToStart()" title="Go to Start">
        <q-tooltip>Go to Start</q-tooltip>
      </q-btn>
      <q-btn flat dense size="sm" icon="fast_rewind" @click="timelineStore.prevFrame()" title="Previous Frame">
        <q-tooltip>Previous Frame</q-tooltip>
      </q-btn>
      <q-btn
        flat dense size="sm"
        :icon="timelineStore.isPlaying ? 'pause' : 'play_arrow'"
        :color="timelineStore.isPlaying ? 'yellow-5' : 'green-4'"
        @click="togglePlay"
        title="Play/Pause"
      >
        <q-tooltip>Play / Pause (Space)</q-tooltip>
      </q-btn>
      <q-btn flat dense size="sm" icon="stop" @click="timelineStore.stop()" title="Stop">
        <q-tooltip>Stop</q-tooltip>
      </q-btn>
      <q-btn flat dense size="sm" icon="fast_forward" @click="timelineStore.nextFrame()" title="Next Frame">
        <q-tooltip>Next Frame</q-tooltip>
      </q-btn>
      <q-btn flat dense size="sm" icon="skip_next" @click="timelineStore.goToEnd()" title="Go to End">
        <q-tooltip>Go to End</q-tooltip>
      </q-btn>

      <q-separator vertical dark class="q-mx-sm" />

      <!-- Frame Counter -->
      <div class="frame-counter">
        <span class="frame-current">{{ currentFrameDisplay }}</span>
        <span class="frame-separator">/</span>
        <span class="frame-total">{{ endFrameDisplay }}</span>
      </div>

      <q-separator vertical dark class="q-mx-sm" />

      <!-- FPS -->
      <div class="fps-control">
        <span class="fps-label">FPS:</span>
        <q-input
          :model-value="timelineStore.fps"
          @update:model-value="timelineStore.setFPS(Number($event))"
          type="number"
          dense outlined dark
          style="width: 50px;"
        />
      </div>

      <q-space />

      <!-- Loop Mode -->
      <q-btn flat dense size="sm" :icon="loopIcon" @click="cycleLoopMode" :title="`Loop: ${timelineStore.loopMode}`">
        <q-tooltip>Loop Mode</q-tooltip>
      </q-btn>

      <!-- Auto Key -->
      <q-btn flat dense size="sm" icon="key" :color="autoKey ? 'yellow-5' : 'grey-6'" @click="autoKey = !autoKey" title="Auto Keyframe">
        <q-tooltip>Auto Keyframe: {{ autoKey ? 'ON' : 'OFF' }}</q-tooltip>
      </q-btn>

      <!-- Add Keyframe Button -->
      <q-btn flat dense size="sm" icon="add_box" color="green-4" @click="addKeyframeAtCurrentFrame" title="Add Keyframe at Current Frame">
        <q-tooltip>Add Keyframe (K)</q-tooltip>
      </q-btn>

      <!-- Delete Keyframe Button -->
      <q-btn flat dense size="sm" icon="remove_circle" color="red-4" @click="deleteKeyframeAtCurrentFrame" title="Delete Keyframe at Current Frame">
        <q-tooltip>Delete Keyframe</q-tooltip>
      </q-btn>
    </div>

    <!-- Timeline Body -->
    <div class="timeline-body">
      <!-- Track List (Left) -->
      <div class="track-list">
        <div
          v-for="track in timelineStore.tracks"
          :key="track.id"
          class="track-item"
          :class="{ selected: timelineStore.selectedTrackId === track.id }"
          @click="timelineStore.selectTrack(track.id)"
        >
          <div class="track-color-dot" :style="{ background: track.color }"></div>
          <span class="track-name">{{ track.name }}</span>
          <div class="track-actions">
            <q-icon name="visibility" size="12px" :color="track.visible ? 'grey-3' : 'grey-7'" @click.stop="track.visible = !track.visible" />
            <q-icon name="lock" size="12px" :color="track.locked ? 'yellow-5' : 'grey-7'" @click.stop="track.locked = !track.locked" />
            <q-icon name="close" size="12px" color="red-4" @click.stop="removeTrack(track.id)" title="Delete Track" />
          </div>
        </div>
        <div v-if="timelineStore.tracks.length === 0" class="track-empty">
          <span>No tracks. Add from Node properties or click + button.</span>
        </div>
      </div>

      <!-- Timeline Ruler & Keyframes (Right) -->
      <div
        class="timeline-ruler-area"
        ref="rulerAreaRef"
        @mousedown="onRulerMouseDown"
        @mousemove="onRulerMouseMove"
        @dblclick="onRulerDblClick"
      >
        <!-- Frame Numbers -->
        <div class="timeline-ruler">
          <div
            v-for="mark in rulerMarks"
            :key="mark.frame"
            class="ruler-mark"
            :style="{ left: mark.position + 'px' }"
          >
            <span class="ruler-number">{{ mark.frame }}</span>
            <div class="ruler-tick" :class="{ major: mark.isMajor }"></div>
          </div>
        </div>

        <!-- Playhead -->
        <div class="playhead" :style="{ left: playheadPosition + 'px' }">
          <div class="playhead-head"></div>
          <div class="playhead-line"></div>
        </div>

        <!-- Track Rows with Keyframes -->
        <div
          v-for="track in timelineStore.tracks"
          :key="track.id"
          class="track-row"
          :class="{ selected: timelineStore.selectedTrackId === track.id }"
        >
          <!-- Keyframe diamonds -->
          <div
            v-for="(kf, idx) in track.keyframes"
            :key="idx"
            class="keyframe-diamond"
            :class="{ 'keyframe-selected': selectedKeyframeTrack === track.id && selectedKeyframeFrame === kf.frame }"
            :style="{
              left: frameToPixel(kf.frame) + 'px',
              background: track.color,
              borderColor: track.color
            }"
            :title="`Frame ${kf.frame}: ${typeof kf.value === 'number' ? kf.value.toFixed(2) : kf.value}`"
            @mousedown.stop.prevent="onKeyframeMouseDown($event, track.id, kf.frame)"
            @dblclick.stop.prevent="onKeyframeDblClick(track.id, kf.frame)"
          >
          </div>

          <!-- Track background bar -->
          <div class="track-row-bg"></div>
        </div>

        <!-- Range bar -->
        <div class="range-bar" :style="{ left: '0px', width: totalWidth + 'px' }"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { Color3, PBRMetallicRoughnessMaterial } from '@babylonjs/core'
import { useTimelineStore } from '../../stores/timelineStore'
import { useSceneStore } from '../../stores/sceneStore'
import sceneManager from '../../core/scene/SceneManager.js'

const timelineStore = useTimelineStore()
const sceneStore = useSceneStore()

const rulerAreaRef = ref(null)
const autoKey = ref(true)
const pixelsPerFrame = 4
const animationInterval = ref(null)

// 关键帧拖拽状态
const selectedKeyframeTrack = ref(null)
const selectedKeyframeFrame = ref(null)
const isDraggingKeyframe = ref(false)
const dragStartFrame = ref(0)

const currentFrameDisplay = computed(() => String(timelineStore.currentFrame).padStart(4, '0'))
const endFrameDisplay = computed(() => String(timelineStore.endFrame).padStart(4, '0'))

const totalWidth = computed(() => timelineStore.totalFrames * pixelsPerFrame)

const playheadPosition = computed(() => {
  return (timelineStore.currentFrame - timelineStore.startFrame) * pixelsPerFrame
})

const loopIcon = computed(() => {
  switch (timelineStore.loopMode) {
    case 'once': return 'repeat_one'
    case 'loop': return 'repeat'
    case 'pingpong': return 'swap_horiz'
    default: return 'repeat'
  }
})

const rulerMarks = computed(() => {
  const marks = []
  const step = Math.max(1, Math.floor(50 / pixelsPerFrame))
  for (let f = timelineStore.startFrame; f <= timelineStore.endFrame; f += step) {
    const position = (f - timelineStore.startFrame) * pixelsPerFrame
    marks.push({
      frame: f,
      position,
      isMajor: f % (step * 5) === 0 || f === timelineStore.startFrame
    })
  }
  return marks
})

// 无论通过按钮点击还是键盘快捷键改变 isPlaying 状态，都自动管理动画循环
watch(() => timelineStore.isPlaying, (playing) => {
  if (playing) {
    startAnimationLoop()
  } else {
    stopAnimationLoop()
  }
})

// 监听帧变化，执行动画评估并驱动场景
watch(() => timelineStore.currentFrame, (frame) => {
  evaluateAndApplyAnimation(frame)
})

function togglePlay() {
  if (timelineStore.isPlaying) {
    timelineStore.pause()
  } else {
    timelineStore.play()
  }
}

function startAnimationLoop() {
  const intervalMs = 1000 / timelineStore.fps
  animationInterval.value = setInterval(() => {
    timelineStore.nextFrame()
    if (timelineStore.currentFrame >= timelineStore.endFrame && timelineStore.loopMode === 'once') {
      timelineStore.pause()
      stopAnimationLoop()
    }
  }, intervalMs)
}

function stopAnimationLoop() {
  if (animationInterval.value) {
    clearInterval(animationInterval.value)
    animationInterval.value = null
  }
}

function cycleLoopMode() {
  const modes = ['loop', 'once', 'pingpong']
  const idx = modes.indexOf(timelineStore.loopMode)
  timelineStore.setLoopMode(modes[(idx + 1) % modes.length])
}

function frameToPixel(frame) {
  return (frame - timelineStore.startFrame) * pixelsPerFrame
}

function pixelToFrame(pixel) {
  return Math.round(pixel / pixelsPerFrame) + timelineStore.startFrame
}

function removeTrack(id) {
  timelineStore.removeTrack(id)
}

// ========================================
// 关键帧 CRUD — 添加/删除
// ========================================

/** 在当前帧为选中对象的位置/旋转/缩放添加关键帧 */
function addKeyframeAtCurrentFrame() {
  const obj = sceneStore.objects[0]
  if (!obj) return
  const frame = timelineStore.currentFrame

  const transformProps = [
    { name: 'Position X', prop: 'position.x', value: obj.position.x },
    { name: 'Position Y', prop: 'position.y', value: obj.position.y },
    { name: 'Position Z', prop: 'position.z', value: obj.position.z },
    { name: 'Rotation Y', prop: 'rotation.y', value: obj.rotation.y },
    { name: 'Scale', prop: 'scale', value: obj.scale.x }
  ]

  for (const tp of transformProps) {
    let track = timelineStore.tracks.find(t => t.targetProperty === tp.prop)
    if (!track) {
      track = timelineStore.addTrack({
        name: tp.name,
        type: 'transform',
        targetProperty: tp.prop,
        color: getDefaultTrackColor(tp.prop)
      })
    }
    timelineStore.addKeyframe(track.id, frame, tp.value)
  }
}

/** 在当前帧删除选中轨道的关键帧 */
function deleteKeyframeAtCurrentFrame() {
  if (!selectedKeyframeTrack.value) return
  timelineStore.removeKeyframe(selectedKeyframeTrack.value, timelineStore.currentFrame)
  selectedKeyframeTrack.value = null
  selectedKeyframeFrame.value = null
}

function getDefaultTrackColor(prop) {
  if (prop.startsWith('position')) return '#ff6b6b'
  if (prop.startsWith('rotation')) return '#fcc419'
  if (prop.startsWith('scale')) return '#cc5de8'
  if (prop === 'metalness' || prop === 'roughness') return '#339af0'
  return '#5352ed'
}

// ========================================
// 关键帧拖拽
// ========================================

function onKeyframeMouseDown(e, trackId, frame) {
  if (e.button !== 0) return
  selectedKeyframeTrack.value = trackId
  selectedKeyframeFrame.value = frame
  isDraggingKeyframe.value = true
  dragStartFrame.value = frame

  window.addEventListener('mousemove', onKeyframeDragMove)
  window.addEventListener('mouseup', onKeyframeDragEnd)
}

function onKeyframeDragMove(e) {
  if (!isDraggingKeyframe.value || !rulerAreaRef.value) return
  const rect = rulerAreaRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left + rulerAreaRef.value.scrollLeft
  const newFrame = Math.max(timelineStore.startFrame, Math.min(timelineStore.endFrame, pixelToFrame(x)))
  if (newFrame !== selectedKeyframeFrame.value) {
    timelineStore.moveKeyframe(selectedKeyframeTrack.value, selectedKeyframeFrame.value, newFrame)
    selectedKeyframeFrame.value = newFrame
  }
}

function onKeyframeDragEnd(e) {
  isDraggingKeyframe.value = false
  window.removeEventListener('mousemove', onKeyframeDragMove)
  window.removeEventListener('mouseup', onKeyframeDragEnd)
}

/** 双击关键帧：弹出行内编辑输入 */
function onKeyframeDblClick(trackId, frame) {
  const track = timelineStore.tracks.find(t => t.id === trackId)
  if (!track) return
  const kf = track.keyframes.find(k => k.frame === frame)
  if (!kf) return

  const rulerArea = rulerAreaRef.value
  if (!rulerArea) return

  const existingInput = rulerArea.querySelector('.keyframe-inline-edit')
  if (existingInput) existingInput.remove()

  const input = document.createElement('input')
  input.type = 'number'
  input.className = 'keyframe-inline-edit'
  input.value = typeof kf.value === 'number' ? kf.value.toFixed(3) : kf.value
  input.style.cssText = `
    position: absolute;
    left: ${frameToPixel(frame)}px;
    top: ${getTrackRowTop(trackId)}px;
    width: 60px;
    height: 18px;
    font-size: 10px;
    background: var(--editor-bg-input);
    color: var(--editor-text-primary);
    border: 1px solid var(--editor-accent);
    border-radius: 2px;
    padding: 0 4px;
    z-index: 30;
  `
  rulerArea.appendChild(input)
  input.focus()
  input.select()

  const finishEdit = () => {
    const val = parseFloat(input.value)
    if (!isNaN(val)) {
      timelineStore.updateKeyframeValue(trackId, frame, val)
    }
    input.remove()
  }
  input.addEventListener('blur', finishEdit)
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') finishEdit()
    if (e.key === 'Escape') input.remove()
  })
}

function getTrackRowTop(trackId) {
  const idx = timelineStore.tracks.findIndex(t => t.id === trackId)
  return 20 + idx * 24
}

// ========================================
// 动画评估引擎 — 驱动场景对象 (Babylon.js)
// ========================================

/** 评估当前帧所有轨道的插值，应用到场景中的对象 */
function evaluateAndApplyAnimation(frame) {
  const evaluated = timelineStore.evaluateAnimation()
  if (evaluated.size === 0) return

  const obj = sceneStore.objects[0]
  if (!obj) return

  const updates = {}
  for (const [targetProp, info] of evaluated) {
    updates[targetProp] = info.value
  }

  // 构建 position/rotation/scale 对象
  if (updates['position.x'] !== undefined || updates['position.y'] !== undefined || updates['position.z'] !== undefined) {
    const pos = { ...obj.position }
    if (updates['position.x'] !== undefined) pos.x = updates['position.x']
    if (updates['position.y'] !== undefined) pos.y = updates['position.y']
    if (updates['position.z'] !== undefined) pos.z = updates['position.z']
    sceneStore.updateObject(obj.id, { position: pos })
  }
  if (updates['rotation.x'] !== undefined || updates['rotation.y'] !== undefined || updates['rotation.z'] !== undefined) {
    const rot = { ...obj.rotation }
    if (updates['rotation.x'] !== undefined) rot.x = updates['rotation.x']
    if (updates['rotation.y'] !== undefined) rot.y = updates['rotation.y']
    if (updates['rotation.z'] !== undefined) rot.z = updates['rotation.z']
    sceneStore.updateObject(obj.id, { rotation: rot })
  }
  if (updates['scale'] !== undefined) {
    const s = updates['scale']
    sceneStore.updateObject(obj.id, { scale: { x: s, y: s, z: s } })
  } else if (updates['scale.x'] !== undefined || updates['scale.y'] !== undefined || updates['scale.z'] !== undefined) {
    const scl = { ...obj.scale }
    if (updates['scale.x'] !== undefined) scl.x = updates['scale.x']
    if (updates['scale.y'] !== undefined) scl.y = updates['scale.y']
    if (updates['scale.z'] !== undefined) scl.z = updates['scale.z']
    sceneStore.updateObject(obj.id, { scale: scl })
  }

  // 材质属性更新到 Babylon.js mesh
  if (updates['metalness'] !== undefined || updates['roughness'] !== undefined) {
    const scene = sceneManager.scene
    if (scene) {
      const mesh = scene.meshes.find(m => m.metadata?.objectId === obj.id)
      if (mesh && mesh.material) {
        if (updates['metalness'] !== undefined && mesh.material.metallic !== undefined) {
          mesh.material.metallic = updates['metalness']
        }
        if (updates['roughness'] !== undefined && mesh.material.roughness !== undefined) {
          mesh.material.roughness = updates['roughness']
        }
      }
    }
  }
}

// ========================================
// Auto Key — 变换修改时自动记录关键帧
// ========================================

watch(
  () => sceneStore.objects.map(o => ({
    id: o.id,
    px: o.position?.x, py: o.position?.y, pz: o.position?.z,
    rx: o.rotation?.x, ry: o.rotation?.y, rz: o.rotation?.z,
    sx: o.scale?.x, sy: o.scale?.y, sz: o.scale?.z
  })),
  () => {
    if (!autoKey.value) return
    if (!timelineStore.isPlaying) return
    const obj = sceneStore.objects[0]
    if (!obj) return

    const frame = timelineStore.currentFrame
    const props = [
      { prop: 'position.x', value: obj.position.x, name: 'Position X', color: '#ff6b6b' },
      { prop: 'position.y', value: obj.position.y, name: 'Position Y', color: '#51cf66' },
      { prop: 'position.z', value: obj.position.z, name: 'Position Z', color: '#339af0' },
      { prop: 'rotation.y', value: obj.rotation.y, name: 'Rotation Y', color: '#fcc419' },
      { prop: 'scale', value: obj.scale.x, name: 'Scale', color: '#cc5de8' }
    ]

    for (const p of props) {
      let track = timelineStore.tracks.find(t => t.targetProperty === p.prop)
      if (!track) {
        track = timelineStore.addTrack({
          name: p.name,
          type: 'transform',
          targetProperty: p.prop,
          color: p.color
        })
      }
      timelineStore.addKeyframe(track.id, frame, p.value)
    }
  },
  { deep: true }
)

// ========================================
// 播放头拖拽
// ========================================

function onRulerMouseDown(e) {
  const rect = rulerAreaRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left + (rulerAreaRef.value.scrollLeft || 0)
  const frame = pixelToFrame(x)
  timelineStore.setFrame(frame)
}

function onRulerMouseMove(e) {
  if (e.buttons !== 1) return
  const rect = rulerAreaRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left + (rulerAreaRef.value.scrollLeft || 0)
  const frame = pixelToFrame(x)
  timelineStore.setFrame(frame)
}

/** 双击轨道空白区域添加关键帧 */
function onRulerDblClick(e) {
  const rect = rulerAreaRef.value.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  const frame = pixelToFrame(x)
  const trackIndex = Math.floor((y - 20) / 24)
  if (trackIndex >= 0 && trackIndex < timelineStore.tracks.length) {
    const track = timelineStore.tracks[trackIndex]
    if (track.locked) return
    timelineStore.addKeyframe(track.id, frame, 0)
  }
}

onMounted(() => {
  // Add demo tracks
  timelineStore.addTrack({ name: 'Position X', type: 'transform', targetProperty: 'position.x', color: '#ff6b6b', keyframes: [{ frame: 0, value: 0 }, { frame: 60, value: 3 }, { frame: 120, value: 0 }, { frame: 180, value: -3 }, { frame: 250, value: 0 }] })
  timelineStore.addTrack({ name: 'Position Y', type: 'transform', targetProperty: 'position.y', color: '#51cf66', keyframes: [{ frame: 0, value: 0.5 }, { frame: 100, value: 3 }, { frame: 200, value: 0.5 }] })
  timelineStore.addTrack({ name: 'Rotation Y', type: 'transform', targetProperty: 'rotation.y', color: '#fcc419', keyframes: [{ frame: 0, value: 0 }, { frame: 250, value: 360 }] })
  timelineStore.addTrack({ name: 'Scale', type: 'transform', targetProperty: 'scale', color: '#cc5de8', keyframes: [{ frame: 0, value: 1 }, { frame: 125, value: 1.5 }, { frame: 250, value: 1 }] })
  timelineStore.addTrack({ name: 'Metalness', type: 'material', targetProperty: 'metalness', color: '#339af0', keyframes: [{ frame: 0, value: 0.3 }, { frame: 125, value: 1.0 }, { frame: 250, value: 0.3 }] })
})

onUnmounted(() => {
  stopAnimationLoop()
})
</script>

<style scoped>
.timeline-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  overflow: hidden;
}

/* Controls */
.timeline-controls {
  display: flex;
  align-items: center;
  padding: 4px 8px;
  gap: 2px;
  background: var(--editor-bg-toolbar);
  border-bottom: 1px solid var(--editor-border);
  min-height: 34px;
}

.frame-counter {
  display: flex;
  align-items: baseline;
  gap: 2px;
  padding: 2px 8px;
  background: var(--editor-bg-input);
  border-radius: 3px;
  font-family: monospace;
}

.frame-current {
  font-size: 12px;
  font-weight: 700;
  color: var(--editor-accent-light);
}

.frame-separator {
  font-size: 10px;
  color: var(--editor-text-muted);
  margin: 0 2px;
}

.frame-total {
  font-size: 10px;
  color: var(--editor-text-muted);
}

.fps-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.fps-label {
  font-size: 10px;
  color: var(--editor-text-muted);
}

.fps-control :deep(.q-field__control) {
  height: 22px;
  min-height: 22px;
}

.fps-control :deep(.q-field__native) {
  font-size: 10px;
  padding: 0 4px;
}

/* Body */
.timeline-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Track List */
.track-list {
  width: 160px;
  min-width: 160px;
  border-right: 1px solid var(--editor-border);
  overflow-y: auto;
}

.track-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  height: 24px;
  font-size: 11px;
  color: var(--editor-text-secondary);
  border-bottom: 1px solid var(--editor-border);
  cursor: pointer;
  transition: background 0.1s;
}

.track-item:hover {
  background: var(--editor-bg-hover);
}

.track-item.selected {
  background: var(--editor-bg-active);
  color: var(--editor-text-primary);
}

.track-color-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.track-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.track-item:hover .track-actions {
  opacity: 1;
}

.track-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px 8px;
  font-size: 10px;
  color: var(--editor-text-muted);
  text-align: center;
}

/* Ruler Area */
.timeline-ruler-area {
  flex: 1;
  position: relative;
  overflow-x: auto;
  overflow-y: hidden;
}

.timeline-ruler {
  position: sticky;
  top: 0;
  height: 20px;
  background: var(--editor-bg-toolbar);
  border-bottom: 1px solid var(--editor-border);
  z-index: 10;
}

.ruler-mark {
  position: absolute;
  top: 0;
  height: 100%;
}

.ruler-number {
  position: absolute;
  top: 2px;
  left: 4px;
  font-size: 9px;
  color: var(--editor-text-muted);
  font-family: monospace;
}

.ruler-tick {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 1px;
  height: 8px;
  background: var(--editor-border);
}

.ruler-tick.major {
  height: 14px;
  background: var(--editor-text-muted);
}

/* Playhead */
.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 20;
  pointer-events: none;
}

.playhead-head {
  width: 10px;
  height: 14px;
  background: var(--editor-warn);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
  position: absolute;
  top: 3px;
  left: -5px;
}

.playhead-line {
  width: 1px;
  height: 100%;
  background: var(--editor-warn);
  position: absolute;
  left: 0;
  top: 14px;
}

/* Track Rows */
.track-row {
  position: relative;
  height: 24px;
  border-bottom: 1px solid var(--editor-border);
}

.track-row.selected {
  background: rgba(83, 82, 237, 0.1);
}

.track-row-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.02);
}

/* Keyframe Diamond */
.keyframe-diamond {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%) rotate(45deg);
  width: 8px;
  height: 8px;
  border: 1.5px solid;
  border-radius: 1px;
  cursor: grab;
  z-index: 5;
  transition: transform 0.1s;
}

.keyframe-diamond:hover {
  transform: translate(-50%, -50%) rotate(45deg) scale(1.3);
}

.keyframe-diamond.keyframe-selected {
  transform: translate(-50%, -50%) rotate(45deg) scale(1.5);
  box-shadow: 0 0 4px 1px rgba(83, 82, 237, 0.6);
}

/* Range Bar */
.range-bar {
  position: absolute;
  top: 20px;
  height: calc(100% - 20px);
  background: rgba(83, 82, 237, 0.05);
  pointer-events: none;
}
</style>
