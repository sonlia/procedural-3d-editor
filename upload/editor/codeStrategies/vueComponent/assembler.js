/**
 * UI 树组装模块
 *
 * 负责将 dragEditor schema 和节点代码组装成 VNode 渲染树
 */

/**
 * 从代码中提取 __gridLayout 数据(如果存在)
 */
function extractGridLayout(code) {
  const match = code.match(/__gridLayout:\s*(\[[\s\S]*?\])(?=\s*[,}])/)
  if (!match) return null
  try {
    return JSON.parse(match[1])
  } catch {
    return null
  }
}

/**
 * 移除代码中的 __gridLayout 属性(预览运行时不需要)
 */
function removeGridLayoutMeta(code) {
  return code.replace(/,?\s*__gridLayout:\s*\[[\s\S]*?\](?=\s*[,}])/, '')
}

/**
 * 检测代码是否标记为 Layout 节点(__layoutNode: "flex" | "grid")
 */
function extractLayoutNode(code) {
  const match = code.match(/__layoutNode:\s*"(flex|grid)"/)
  return match ? match[1] : null
}

/**
 * 将子节点代码数组用 CSS grid 定位 div 包裹
 */
function assembleGridChildren(children, gridLayout, uiCodeMap, targetToLoopMap, layoutSetupMap) {
  if (!children?.length) return "[]"

  const codes = []
  for (const child of children) {
    const childCode = assembleUITree([child], uiCodeMap, targetToLoopMap, layoutSetupMap)
    const innerCode = childCode.slice(1, -1)
    if (!innerCode) continue

    const layoutItem = gridLayout.find(g => g.i === child.id)
    const x = layoutItem?.x ?? 0
    const y = layoutItem?.y ?? 0
    const w = layoutItem?.w ?? 6
    const h = layoutItem?.h ?? 2

    const style = `grid-column: ${x + 1} / span ${w}; grid-row: ${y + 1} / span ${h}`
    codes.push(`h("div", { key: "${child.id}", style: "${style}" }, [${innerCode}])`)
  }

  return `[${codes.join(", ")}]`
}

/**
 * 将 schema 和节点代码组装为 VNode 代码字符串
 *
 * @param {Array} schema - dragEditor schema
 * @param {Map} uiCodeMap - 节点 id → vnode 表达式
 * @param {Map} targetToLoopMap - target id → UILoop id
 * @param {Map} [layoutSetupMap] - Layout 节点 id → setup 顶层 const(含 __CHILDREN__ 占位符);
 *   本函数在 layout 分支把占位符同步替换到 setup 段并写回 map,调用方推到 logicLines
 */
export function assembleUITree(schema, uiCodeMap, targetToLoopMap, layoutSetupMap) {
  if (!schema?.length) return "[]";

  const codes = [];

  for (const item of schema) {
    let code = uiCodeMap.get(item.id);

    if (!code) {
      // schema 节点在 graph 中没有对应节点(如布局指定后自动注入的包装节点)
      if (item.children) {
        let childItems;
        if (Array.isArray(item.children)) {
          childItems = item.children;
        } else {
          childItems = Object.values(item.children).flat().filter(Boolean);
        }
        if (childItems.length > 0) {
          const childResult = assembleUITree(childItems, uiCodeMap, targetToLoopMap, layoutSetupMap);
          if (childResult !== "[]") {
            codes.push(childResult.slice(1, -1));
          }
        }
      }
      continue;
    }

    // ===== Layout 节点:vnodeExpr(uiCodeMap)与 setupCode(layoutSetupMap)两段产出,
    // 内部 __CHILDREN_<id>_<slotName>__ 占位符需要同时替换到两段。
    // setupCode 替换后由 vueComponent._assemble 推到 logicLines(setup 顶层 const)。
    const layoutMode = extractLayoutNode(code)
    if (layoutMode) {
      let setupCode = layoutSetupMap?.get(item.id);
      if (item.children && typeof item.children === "object" && !Array.isArray(item.children)) {
        for (const [slotName, children] of Object.entries(item.children)) {
          if (slotName.startsWith("_")) continue;
          const childCode = children?.length
            ? assembleUITree(children, uiCodeMap, targetToLoopMap, layoutSetupMap)
            : "[]";
          const placeholder = `__CHILDREN_${item.id}_${slotName}__`;
          code = code.replaceAll(placeholder, childCode);
          if (setupCode) {
            setupCode = setupCode.replaceAll(placeholder, childCode);
          }
        }
      }
      // 兜底清理:被 LayoutPanel 删除但 schema.children 尚未同步的孤儿 leaf 占位符
      code = code.replace(/__CHILDREN_[^_]+_[\w-]+__/g, "[]");
      if (setupCode) {
        setupCode = setupCode.replace(/__CHILDREN_[^_]+_[\w-]+__/g, "[]");
        layoutSetupMap.set(item.id, setupCode);
      }

      // UILoop 包装
      const loopId = targetToLoopMap.get(item.id);
      if (loopId) {
        const loopCode = uiCodeMap.get(loopId);
        if (loopCode) {
          code = loopCode.replaceAll(`__LOOP_BODY_${loopId}__`, code);
        }
      }
      codes.push(code);
      continue;
    }

    // 检测 Grid 模式节点(通过 __gridLayout 标记)
    const gridLayout = extractGridLayout(code)
    if (gridLayout) {
      code = removeGridLayoutMeta(code)
    }

    // 处理子节点
    if (item.children) {
      if (Array.isArray(item.children)) {
        if (gridLayout) {
          const childCode = assembleGridChildren(item.children, gridLayout, uiCodeMap, targetToLoopMap, layoutSetupMap)
          code = code.replaceAll(`__CHILDREN_${item.id}_default__`, childCode)
        } else {
          const childCode = assembleUITree(
            item.children,
            uiCodeMap,
            targetToLoopMap,
            layoutSetupMap,
          );
          code = code.replaceAll(`__CHILDREN_${item.id}_default__`, childCode);
        }
      } else {
        for (const [slotName, children] of Object.entries(item.children)) {
          if (gridLayout && slotName === "default") {
            const childCode = children?.length
              ? assembleGridChildren(children, gridLayout, uiCodeMap, targetToLoopMap, layoutSetupMap)
              : "[]"
            code = code.replaceAll(
              `__CHILDREN_${item.id}_${slotName}__`,
              childCode,
            )
          } else {
            const childCode = children?.length
              ? assembleUITree(children, uiCodeMap, targetToLoopMap, layoutSetupMap)
              : "[]";
            code = code.replaceAll(
              `__CHILDREN_${item.id}_${slotName}__`,
              childCode,
            );
          }
        }
      }
    }

    code = code.replace(/__CHILDREN_[^_]+_[\w-]+__/g, "[]");

    const loopId = targetToLoopMap.get(item.id);
    if (loopId) {
      const loopCode = uiCodeMap.get(loopId);
      if (loopCode) {
        code = loopCode.replaceAll(`__LOOP_BODY_${loopId}__`, code);
      }
    }

    codes.push(code);
  }

  return `[${codes.join(", ")}]`;
}

export default {
  assembleUITree,
};
