import { uiNodeMeta } from "../../nodeMetea.js";
import { generateLayoutNodeVnode } from "./layoutControls/flexCodeGen.js";

/**
 * Layout 节点专用基类 — 只覆写 `_buildLayoutVnode` hook,把 flex/grid 嵌套 div
 * VNode 的生成内聚到 layout 模块。基类 uiNodeMeta.genCode() 负责:
 *   - propsEntries 收集(class / style / __editorStyle / __editorBehavior 等)
 *   - 老 gridConfig 数据迁移(委托给 flexCodeGen.migrateLegacyGridLayout)
 *   - 容器 grid CSS 生成(委托给 flexCodeGen.applyGridContainerStyleToProps)
 *   - 外层 wrappers(v-if / v-show / Transition / KeepAlive / Teleport)
 *
 * Layout 节点要做的特化只剩一件事:用 generateLayoutNodeVnode 替换标准 createNode 调用。
 *
 * 当前由 `htmlBase/index.js` 在 createDynamicClass 时,根据 config.meta.isLayoutNode
 * 选择本基类(其它 UI 节点仍用 uiNodeMeta)。
 */
export class LayoutNodeMeta extends uiNodeMeta {
  _buildLayoutVnode(propsEntries, nodeId, tag, copyP) {
    const { setupCode, vnodeExpr } = generateLayoutNodeVnode({ copyP, nodeId, tag, propsEntries });
    // setupCode 含 __CHILDREN__ 占位符,assembler 在 layout 分支同步替换后由
    // vueComponent._assemble 推到 logicLines(setup 顶层 const 声明)
    this.layoutSetupCode = setupCode;
    return vnodeExpr;
  }
}
