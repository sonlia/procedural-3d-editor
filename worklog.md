---
Task ID: 1
Agent: Main Agent
Task: 全面诊断 UI 交互问题并修复

Work Log:
- 逐一阅读全部 34 个源文件，识别 29 个 UI 交互问题
- 按 严重程度分为严重(16)、中等(10)、轻微(3) 三级
- 修复所有 16 个严重问题 + 10 个中等问题 + 3 个轻微问题
- 构建验证通过 (npx vite build, 895KB JS, 222KB CSS)

Stage Summary:
- 已修复文件列表：
  1. src/App.vue - 面板切换绑定 View 菜单事件、v-show 控制面板显隐
  2. src/components/viewport/Viewport3D.vue - TransformControls 数据同步、sceneStore→Mesh 双向联动、grid/wireframe toggle、防重复初始化
  3. src/components/menubar/MenuBar.vue - 所有菜单项添加 @click 处理、File/Edit 完整操作（新建/全选/反选/复制/删除）、View 面板切换、Light/DisplayPanel/EmptyNode 添加
  4. src/components/nodes/NodeEditor.vue - 端口拖拽连线、节点删除(Delete键)、右键菜单关闭、拖拽 markDirty、slot hitTest、NodeRegistry 类型兼容
  5. src/components/statusbar/StatusBar.vue - FPS 基于 FRAME_READY 事件测量、正确清理 listener
  6. src/components/nodes/MaterialGraph.vue - 用 ResizeObserver 替代 rAF 循环、手动 roundRect 兼容
  7. src/composables/useKeyboardShortcuts.js - Ctrl 组合键优先处理防冲突、B 键切换底部面板
  8. src/composables/useViewportSync.js - 角度/弧度转换、light 类型支持
  9. src/core/scene/SceneManager.js - 修复 double getDelta() bug

---
Task ID: 2
Agent: Main Agent
Task: 修复严重交互Bug

Work Log:
- App.vue: 添加 @set-view 事件处理、uiState.showRightPanel 绑定到 v-show、暴露 __editorUIState 给快捷键
- Viewport3D.vue: 添加 onTransformChanged 同步到 sceneStore、添加 watch sceneStore→mesh 双向同步、添加 gridVisible/wireframeMode、添加 toggleGrid/toggleWireframe、防重复初始化
- MenuBar.vue: File 菜单 New Project、Edit 菜单 Undo/Redo/Deselect/SelectAll/Invert/Duplicate/Delete、View 面板 Toggle Right/Bottom Panel、Add 菜单 Light/DisplayPanel/EmptyNode
- NodeEditor.vue: 完整的 hitTestSlot/hitTestNode、输出/输入端口连线交互、Delete 键删除节点、拖拽触发 markDirty、click 外部关闭菜单
- StatusBar.vue: 基于 VIEWPORT_EVENTS.FRAME_READY 事件测量 FPS、正确 onUnmounted 清理

Stage Summary:
- 修复了全部 16 个严重 Bug，关键交互链路打通

---
Task ID: 3
Agent: Main Agent
Task: 修复中等交互问题

Work Log:
- Light 菜单项添加 addLight() 处理函数
- Display Panel 菜单项添加 addPanel() 处理函数
- View 菜单 Toggle Right Panel/Bottom Panel 实际绑定
- TransformControls 拖拽数据同步到 sceneStore
- 角度/弧度在 useViewportSync 和 Viewport3D 之间统一
- 节点编辑器右键菜单点击外部关闭
- 快捷键 T/R/S 正确处理优先级

Stage Summary:
- 10 个中等问题全部修复

---
Task ID: 4
Agent: Main Agent
Task: 修复轻微问题

Work Log:
- FPS 测量改用事件驱动（FRAME_READY）替代独立 rAF
- MaterialGraph 用 ResizeObserver 替代 rAF 循环
- MaterialGraph 使用手动 drawRoundedRect 兼容旧浏览器
- SceneManager 修复 double getDelta() bug

Stage Summary:
- 3 个轻微问题全部修复，构建验证通过
---
Task ID: UI交互审查与修复
Agent: main
Task: 检查UI交互侧是否完成，是否有操作交互问题

Work Log:
- 逐一读取15个UI组件 + 9个core模块 + 2个composable，进行全链路交互审查
- 确认所有16个依赖文件存在且接口匹配（1个接口差异：NodeRegistry缺TYPES静态属性，但不影响运行）
- 发现并修复11个交互问题（4个严重 + 4个高优先级 + 3个中等）
- 构建验证通过 (npx vite build ✓)

Stage Summary:
- 修复文件：NodeEditor.vue, useKeyboardShortcuts.js, MenuBar.vue, App.vue, LeftToolbar.vue, eventBus.js, Viewport3D.vue, StatusBar.vue, TimelinePanel.vue
- 新增事件：MESH_EVENTS.MODELING_TOOL_CHANGED（建模工具切换通知）
- 关键架构改进：Viewport3D从v-if双实例改为v-show单实例，避免预览切换时销毁3D场景
