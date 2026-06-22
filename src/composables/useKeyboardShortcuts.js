/**
 * useKeyboardShortcuts - 全局快捷键 composable
 *
 * 处理：
 * - 编辑模式切换：1-5（顶点/边/面/物体/独立）
 * - 变换模式切换：T/R/S（平移/旋转/缩放）
 * - Esc：退出预览或清除选择
 * - Ctrl+P：切换预览模式
 * - Delete/Backspace：删除选中物体
 * - Ctrl+A：全选物体
 * - Ctrl+Z / Ctrl+Shift+Z：撤销/重做
 * - Space：播放/暂停时间线
 * - N：切换右侧属性面板
 * - B：切换底部面板
 */
import { onMounted, onUnmounted } from 'vue'
import { useEditorStore, EDIT_MODES, APP_MODES } from '../stores/editorStore'
import { useSceneStore } from '../stores/sceneStore'
import { useTimelineStore } from '../stores/timelineStore'
import selectionManager from '../core/editing/SelectionManager.js'

export function useKeyboardShortcuts() {
  const editorStore = useEditorStore()
  const sceneStore = useSceneStore()
  const timelineStore = useTimelineStore()

  function handleKeyDown(e) {
    // 忽略输入框中的按键
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return

    const key = e.key

    // ---- Esc：退出预览/发布 或 清除选择 ----
    if (key === 'Escape') {
      if (editorStore.appMode === APP_MODES.PREVIEW || editorStore.appMode === APP_MODES.PUBLISH) {
        editorStore.setAppMode(APP_MODES.DESIGN)
      } else {
        editorStore.clearSelection()
      }
      return
    }

    // ---- Ctrl 组合键优先处理 ----
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+P：切换预览模式
      if (key === 'p' || key === 'P') {
        e.preventDefault()
        editorStore.setAppMode(
          editorStore.appMode === APP_MODES.DESIGN ? APP_MODES.PREVIEW : APP_MODES.DESIGN
        )
        return
      }

      // Ctrl+A：全选物体
      if (key === 'a' || key === 'A') {
        e.preventDefault()
        if (editorStore.editMode === EDIT_MODES.OBJECT) {
          selectionManager.selectObjects(sceneStore.objects.map(o => o.id))
        }
        return
      }

      // Ctrl+Z：撤销
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault()
        editorStore.undo()
        return
      }

      // Ctrl+Shift+Z / Ctrl+Y：重做
      if ((key === 'z' && e.shiftKey) || (key === 'y' || key === 'Y')) {
        e.preventDefault()
        editorStore.redo()
        return
      }

      return
    }

    // ---- Space：播放/暂停时间线 ----
    if (key === ' ') {
      e.preventDefault()
      if (timelineStore.isPlaying) {
        timelineStore.pause()
      } else {
        timelineStore.play()
      }
      return
    }

    // ---- Delete / Backspace：删除选中物体 ----
    if (key === 'Delete' || key === 'Backspace') {
      if (selectionManager.hasSelection && editorStore.editMode === EDIT_MODES.OBJECT) {
        selectionManager.state.selectedObjectIds.forEach(id => sceneStore.removeObject(id))
        selectionManager.clearSelection()
      }
      return
    }

    // ---- Shift+D：复制选中物体 ----
    if ((key === 'd' || key === 'D') && e.shiftKey) {
      e.preventDefault()
      const ids = [...selectionManager.state.selectedObjectIds]
      for (const id of ids) {
        const obj = sceneStore.objects.find(o => o.id === id)
        if (obj) {
          sceneStore.addObject({
            name: `${obj.name} (copy)`,
            type: obj.type,
            position: { ...obj.position, x: obj.position.x + 1 },
            rotation: { ...obj.rotation },
            scale: { ...obj.scale },
            metadata: { ...obj.metadata }
          })
        }
      }
      return
    }

    // ---- 编辑模式快捷键 (1-5) & 变换模式 (T/R/S) ----
    editorStore.handleEditModeKey(key)

    // T/S/R 已被 handleEditModeKey 处理（translate/rotate/scale），不再额外处理

    // N 键：切换右侧属性面板（与 View 菜单快捷键一致）
    if (key === 'n' || key === 'N') {
      editorStore.toggleRightPanel()
      return
    }

    // B 键：切换底部面板
    if (key === 'b' || key === 'B') {
      editorStore.toggleBottomPanel()
      return
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
}
