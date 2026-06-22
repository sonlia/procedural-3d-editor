import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import emitter, { ANIMATION_EVENTS } from '../core/eventBus.js'

export const useTimelineStore = defineStore('timeline', () => {
  const isPlaying = ref(false)
  const isPaused = ref(false)
  const currentFrame = ref(0)
  const startFrame = ref(0)
  const endFrame = ref(250)
  const fps = ref(30)
  const loopMode = ref('loop') // 'once' | 'loop' | 'pingpong'
  const playDirection = ref(1) // 1 = forward, -1 = backward (for pingpong)
  const tracks = ref([])
  const selectedTrackId = ref(null)

  const totalFrames = computed(() => endFrame.value - startFrame.value)
  const currentTime = computed(() => currentFrame.value / fps.value)
  const duration = computed(() => totalFrames.value / fps.value)

  function play() {
    isPlaying.value = true
    isPaused.value = false
    playDirection.value = 1
  }

  function pause() {
    isPlaying.value = false
    isPaused.value = true
  }

  function stop() {
    isPlaying.value = false
    isPaused.value = false
    currentFrame.value = startFrame.value
  }

  function setFrame(frame) {
    currentFrame.value = Math.max(startFrame.value, Math.min(endFrame.value, frame))
    emitter.emit(ANIMATION_EVENTS.TIMELINE_FRAME_CHANGED, { frame: currentFrame.value })
  }

  function nextFrame() {
    if (loopMode.value === 'pingpong') {
      currentFrame.value += playDirection.value
      if (currentFrame.value >= endFrame.value) {
        playDirection.value = -1
        currentFrame.value = endFrame.value
      } else if (currentFrame.value <= startFrame.value) {
        playDirection.value = 1
        currentFrame.value = startFrame.value
      }
    } else if (currentFrame.value < endFrame.value) {
      currentFrame.value++
    } else if (loopMode.value === 'loop') {
      currentFrame.value = startFrame.value
      playDirection.value = 1
    }
    emitter.emit(ANIMATION_EVENTS.TIMELINE_FRAME_CHANGED, { frame: currentFrame.value })
  }

  function prevFrame() {
    if (currentFrame.value > startFrame.value) {
      currentFrame.value--
    } else if (loopMode.value === 'loop') {
      currentFrame.value = endFrame.value
    }
    emitter.emit(ANIMATION_EVENTS.TIMELINE_FRAME_CHANGED, { frame: currentFrame.value })
  }

  function goToEnd() {
    currentFrame.value = endFrame.value
    emitter.emit(ANIMATION_EVENTS.TIMELINE_FRAME_CHANGED, { frame: currentFrame.value })
  }

  function goToStart() {
    currentFrame.value = startFrame.value
    emitter.emit(ANIMATION_EVENTS.TIMELINE_FRAME_CHANGED, { frame: currentFrame.value })
  }

  function addTrack(trackData) {
    const track = {
      id: `track_${Date.now()}`,
      name: trackData.name || 'New Track',
      type: trackData.type || 'transform',
      targetNodeId: trackData.targetNodeId || null,
      targetProperty: trackData.targetProperty || null,
      keyframes: trackData.keyframes || [],
      visible: true,
      locked: false,
      muted: false,
      color: trackData.color || '#5352ed'
    }
    tracks.value.push(track)
    emitter.emit(ANIMATION_EVENTS.TRACK_ADDED, { track })
    return track
  }

  function removeTrack(id) {
    tracks.value = tracks.value.filter(t => t.id !== id)
    if (selectedTrackId.value === id) selectedTrackId.value = null
    emitter.emit(ANIMATION_EVENTS.TRACK_REMOVED, { id })
  }

  function selectTrack(id) {
    selectedTrackId.value = id
  }

  function setLoopMode(mode) {
    loopMode.value = mode
  }

  function setFPS(val) {
    fps.value = val
  }

  // ========================================
  // 关键帧 CRUD 操作
  // ========================================

  /** 在指定轨道添加关键帧 */
  function addKeyframe(trackId, frame, value) {
    const track = tracks.value.find(t => t.id === trackId)
    if (!track) return null
    // 如果该帧已有关键帧，更新其值
    const existing = track.keyframes.find(kf => kf.frame === frame)
    if (existing) {
      existing.value = value
      emitter.emit(ANIMATION_EVENTS.KEYFRAME_UPDATED, { trackId, frame, value })
      return existing
    }
    const kf = { frame, value, easing: 'linear' }
    track.keyframes.push(kf)
    track.keyframes.sort((a, b) => a.frame - b.frame)
    emitter.emit(ANIMATION_EVENTS.KEYFRAME_ADDED, { trackId, keyframe: kf })
    return kf
  }

  /** 删除指定轨道上指定帧的关键帧 */
  function removeKeyframe(trackId, frame) {
    const track = tracks.value.find(t => t.id === trackId)
    if (!track) return
    track.keyframes = track.keyframes.filter(kf => kf.frame !== frame)
    emitter.emit(ANIMATION_EVENTS.KEYFRAME_REMOVED, { trackId, frame })
  }

  /** 移动关键帧到新帧位置 */
  function moveKeyframe(trackId, oldFrame, newFrame) {
    const track = tracks.value.find(t => t.id === trackId)
    if (!track) return
    const kf = track.keyframes.find(kf => kf.frame === oldFrame)
    if (!kf) return
    // 检查目标帧是否已有关键帧
    const conflict = track.keyframes.find(kf => kf.frame === newFrame)
    if (conflict) return false
    kf.frame = newFrame
    track.keyframes.sort((a, b) => a.frame - b.frame)
    emitter.emit(ANIMATION_EVENTS.KEYFRAME_UPDATED, { trackId, frame: newFrame, value: kf.value })
    return true
  }

  /** 更新关键帧值 */
  function updateKeyframeValue(trackId, frame, value) {
    const track = tracks.value.find(t => t.id === trackId)
    if (!track) return
    const kf = track.keyframes.find(kf => kf.frame === frame)
    if (kf) {
      kf.value = value
      emitter.emit(ANIMATION_EVENTS.KEYFRAME_UPDATED, { trackId, frame, value })
    }
  }

  // ========================================
  // 动画评估引擎 — 插值计算当前帧的属性值
  // ========================================

  /**
   * 在两个关键帧之间进行线性插值
   */
  function interpolateKeyframes(keyframes, frame) {
    if (!keyframes || keyframes.length === 0) return null
    if (keyframes.length === 1) return keyframes[0].value

    // 在第一帧之前
    if (frame <= keyframes[0].frame) return keyframes[0].value
    // 在最后一帧之后
    if (frame >= keyframes[keyframes.length - 1].frame) return keyframes[keyframes.length - 1].value

    // 找到 frame 所在的两个相邻关键帧
    for (let i = 0; i < keyframes.length - 1; i++) {
      const kf0 = keyframes[i]
      const kf1 = keyframes[i + 1]
      if (frame >= kf0.frame && frame <= kf1.frame) {
        const span = kf1.frame - kf0.frame
        const alpha = span > 0 ? (frame - kf0.frame) / span : 0

        // 根据缓动类型计算
        const easing = kf1.easing || 'linear'
        let t = alpha
        switch (easing) {
          case 'ease_in': t = alpha * alpha; break
          case 'ease_out': t = 1 - (1 - alpha) * (1 - alpha); break
          case 'ease_in_out': t = alpha < 0.5 ? 2 * alpha * alpha : 1 - Math.pow(-2 * alpha + 2, 2) / 2; break
          case 'step': t = alpha < 0.5 ? 0 : 1; break
          default: t = alpha // linear
        }

        return kf0.value + (kf1.value - kf0.value) * t
      }
    }
    return null
  }

  /**
   * 评估所有轨道在当前帧的值，返回需要应用到场景对象的更新数据
   * 返回格式: Map<targetProperty, value>
   */
  function evaluateAnimation() {
    const result = new Map()
    const frame = currentFrame.value

    for (const track of tracks.value) {
      if (!track.visible || track.muted) continue
      if (!track.targetProperty) continue
      if (!track.keyframes || track.keyframes.length === 0) continue

      const value = interpolateKeyframes(track.keyframes, frame)
      if (value !== null) {
        result.set(track.targetProperty, { value, trackId: track.id, trackType: track.type })
      }
    }

    return result
  }

  return {
    isPlaying,
    isPaused,
    currentFrame,
    startFrame,
    endFrame,
    fps,
    loopMode,
    tracks,
    selectedTrackId,
    totalFrames,
    currentTime,
    duration,
    play,
    pause,
    stop,
    setFrame,
    nextFrame,
    prevFrame,
    goToEnd,
    goToStart,
    addTrack,
    removeTrack,
    selectTrack,
    setLoopMode,
    setFPS,
    addKeyframe,
    removeKeyframe,
    moveKeyframe,
    updateKeyframeValue,
    evaluateAnimation,
    interpolateKeyframes
  }
})
