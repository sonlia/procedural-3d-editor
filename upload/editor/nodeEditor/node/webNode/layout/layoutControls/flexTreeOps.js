/**
 * flexTree 纯函数工具集
 *
 * flexTree 结构：
 *   leaf : { type:'leaf', id, size:{mode,value?} }
 *   split: { type:'split', direction:'row'|'column', size, children:[child0, child1, ...] }
 *
 * size.mode: 'col'(1-12) | 'px' | 'percent' | 'auto'
 *
 * split 节点的 children 长度 ≥2(N-ary)。
 * 所有操作均返回新树（immutable），由调用方写回 properties.flexTree。
 */

/** 生成短随机 id（用于新建叶子） */
export function makeLeafId() {
  return `leaf-${Math.random().toString(36).slice(2, 8)}`;
}

/** 创建一个叶子节点 */
export function createLeaf(id = makeLeafId(), size = { mode: "col", value: 6 }) {
  return { type: "leaf", id, size, styleClass: {} };
}

/** 创建初始 flexTree：单根叶子，size.mode='grow' 撑满父级 */
export function createEmptyTree(initialLeafId = makeLeafId()) {
  return { type: "leaf", id: initialLeafId, size: { mode: "grow" }, styleClass: {} };
}

/** 遍历所有叶子，回调 (leaf) */
export function walkLeaves(tree, cb) {
  if (!tree) return;
  if (tree.type === "leaf") {
    cb(tree);
    return;
  }
  for (const child of tree.children) walkLeaves(child, cb);
}

/** 收集所有叶子的 id */
export function collectLeafIds(tree) {
  const out = [];
  walkLeaves(tree, (leaf) => out.push(leaf.id));
  return out;
}

/** 根据 id 查找叶子节点引用 */
export function getLeafById(tree, leafId) {
  if (!tree) return null;
  if (tree.type === "leaf") return tree.id === leafId ? tree : null;
  for (const child of tree.children) {
    const found = getLeafById(child, leafId);
    if (found) return found;
  }
  return null;
}

/** 查找叶子在树中的索引路径 [0,1,0] 形式；找不到返回 null */
export function findLeafPath(tree, leafId, path = []) {
  if (!tree) return null;
  if (tree.type === "leaf") return tree.id === leafId ? path : null;
  for (let i = 0; i < tree.children.length; i++) {
    const result = findLeafPath(tree.children[i], leafId, [...path, i]);
    if (result) return result;
  }
  return null;
}

/**
 * 拆分叶子：当前 leaf 变成 split，原 leaf 作为子0，新建叶子作为子1
 * 新 split 继承原 leaf 的 size（外部占比不变）
 * 两个新叶子内部默认 col-6 / col-6
 *
 * @returns {object} 新树（不可变操作）+ 新生成的叶子 id（通过返回值的 _newLeafId 字段）
 */
export function splitLeaf(tree, leafId, direction, opts = {}) {
  const newLeafId = opts.newLeafId || makeLeafId();
  const result = { _newLeafId: newLeafId };

  function recurse(node) {
    if (node.type === "leaf" && node.id === leafId) {
      return {
        type: "split",
        direction,
        size: node.size, // 继承原 leaf 的占比
        children: [
          { type: "leaf", id: leafId, size: { mode: "col", value: 6 }, styleClass: node.styleClass || {} },
          { type: "leaf", id: newLeafId, size: { mode: "col", value: 6 }, styleClass: {} },
        ],
      };
    }
    if (node.type === "split") {
      return { ...node, children: node.children.map(recurse) };
    }
    return node;
  }

  result.tree = recurse(tree);
  return result;
}

/**
 * 删除叶子：从父 split 的 children 中 splice;父 split 剩 1 个 child 时塌缩为该 child(继承父 size)
 *
 * @returns 新树；若试图删除根唯一叶子返回原树(保留至少一个叶子)
 */
export function removeLeaf(tree, leafId) {
  if (!tree) return tree;
  if (tree.type === "leaf" && tree.id === leafId) return tree; // 根叶不可删
  if (tree.type === "leaf") return tree;

  // 直接子是 leaf 且匹配:splice 删除
  const idx = tree.children.findIndex((c) => c.type === "leaf" && c.id === leafId);
  if (idx !== -1) {
    const next = tree.children.filter((_, i) => i !== idx);
    if (next.length === 1) return { ...next[0], size: tree.size }; // 塌缩,继承父 size
    return { ...tree, children: next };
  }
  // 递归到深层
  return { ...tree, children: tree.children.map((c) => removeLeaf(c, leafId)) };
}

/**
 * 更新某 split 节点中相邻两个 child 的 size(用于分隔条拖动)
 * splitPath 定位 split,childIndex 指向相邻两 child 中的左/上者,只重分配该 child 与其右/下邻居
 *
 * @param tree 根树
 * @param splitPath 路径([] 表示根)
 * @param childIndex 相邻分隔条左/上侧 child 的索引(0..children.length-2)
 * @param newRatio 0..1,a 在 a+b 局部和中的占比;col 双侧时离散到整数;其他模式转为百分比
 */
export function updateSplitRatio(tree, splitPath, childIndex, newRatio) {
  const clamped = Math.max(0.01, Math.min(0.99, newRatio));
  function applyAt(node, depth) {
    if (depth === splitPath.length) {
      if (node.type !== "split") return node;
      if (childIndex < 0 || childIndex >= node.children.length - 1) return node;
      const a = node.children[childIndex];
      const b = node.children[childIndex + 1];
      const aCol = a.size?.mode === "col";
      const bCol = b.size?.mode === "col";
      if (aCol && bCol) {
        // 保持 a+b 总占比不变,按 clamped 在两者间重分
        const sum = (a.size.value || 0) + (b.size.value || 0);
        if (sum < 2) return node;
        const av = Math.max(1, Math.min(sum - 1, Math.round(clamped * sum)));
        const children = [...node.children];
        children[childIndex] = { ...a, size: { mode: "col", value: av } };
        children[childIndex + 1] = { ...b, size: { mode: "col", value: sum - av } };
        return { ...node, children };
      }
      // 自由模式:把 a 改为百分比;b 与其他 child 保持原 size
      let newA = a;
      if (a.size?.mode === "col" || a.size?.mode === "percent" || a.size?.mode === "auto") {
        newA = { ...a, size: { mode: "percent", value: +(clamped * 100).toFixed(2) } };
      }
      const children = [...node.children];
      children[childIndex] = newA;
      return { ...node, children };
    }
    if (node.type !== "split") return node;
    const next = [...node.children];
    next[splitPath[depth]] = applyAt(node.children[splitPath[depth]], depth + 1);
    return { ...node, children: next };
  }
  return applyAt(tree, 0);
}

/**
 * 修改叶子（或 split）的 size.mode
 * 切换时根据旧 size 推算合理默认值
 */
export function setNodeSizeMode(tree, nodePath, newMode) {
  function applyAt(node, depth) {
    if (depth === nodePath.length) {
      const old = node.size || {};
      let size;
      if (newMode === "col") size = { mode: "col", value: old.mode === "col" ? old.value : 6 };
      else if (newMode === "px") size = { mode: "px", value: old.mode === "px" ? old.value : 200 };
      else if (newMode === "percent") size = { mode: "percent", value: old.mode === "percent" ? old.value : 50 };
      else if (newMode === "shrink") size = { mode: "shrink" };
      else size = { mode: "grow" };
      return { ...node, size };
    }
    if (node.type !== "split") return node;
    const next = [...node.children];
    next[nodePath[depth]] = applyAt(node.children[nodePath[depth]], depth + 1);
    return { ...node, children: next };
  }
  return applyAt(tree, 0);
}

/**
 * 修改叶子(或 split)的 size.value
 */
export function setNodeSizeValue(tree, nodePath, newValue) {
  function applyAt(node, depth) {
    if (depth === nodePath.length) {
      if (!node.size || node.size.mode === "auto") return node;
      let v = newValue;
      if (node.size.mode === "col") v = Math.max(1, Math.min(12, Math.round(+v) || 1));
      else v = Math.max(0, +v || 0);
      return { ...node, size: { ...node.size, value: v } };
    }
    if (node.type !== "split") return node;
    const next = [...node.children];
    next[nodePath[depth]] = applyAt(node.children[nodePath[depth]], depth + 1);
    return { ...node, children: next };
  }
  return applyAt(tree, 0);
}

/** 内部:按 path 取节点;path=[] 返回根 */
function getNodeAtPath(tree, path) {
  let node = tree;
  for (const i of path) {
    if (node?.type !== "split") return null;
    node = node.children[i];
  }
  return node;
}

/**
 * 在 anchor leaf 旁某一侧插入新 leaf(N-ary sibling 插入)
 *
 * 算法:沿 anchor 的祖先链自下而上找第一个 direction 匹配 side 的 split,
 *   在 anchor 所属那条 child 的左/上(before)或右/下(after)splice 进新 leaf。
 *   若整条祖先链都没有匹配方向的 split,则对根整体外包一层。
 *
 * @param tree 根树
 * @param anchorId anchor leaf 的 id
 * @param side 'top'|'bottom'|'left'|'right'
 * @param opts { newLeafId? }
 * @returns { tree, newLeafId } 或 null(anchor 不存在时 anchorId 视为根级外包,不会返回 null)
 */
export function insertSiblingOf(tree, anchorId, side, opts = {}) {
  const newLeafId = opts.newLeafId || makeLeafId();
  const newLeaf = createLeaf(newLeafId, { mode: "col", value: 6 });
  const wantDir = side === "left" || side === "right" ? "row" : "column";
  const insertBefore = side === "left" || side === "top";

  const path = findLeafPath(tree, anchorId);
  if (!path) {
    // anchor 不存在:对整树外包
    return wrapTreeWithLeaf(tree, side, newLeaf, newLeafId);
  }

  // 从最近父开始向上找方向匹配的祖先 split
  for (let depth = path.length - 1; depth >= 0; depth--) {
    const splitPath = path.slice(0, depth);
    const splitNode = getNodeAtPath(tree, splitPath);
    if (splitNode?.type === "split" && splitNode.direction === wantDir) {
      const insertIdx = insertBefore ? path[depth] : path[depth] + 1;
      return {
        tree: insertChildAt(tree, splitPath, insertIdx, newLeaf),
        newLeafId,
      };
    }
  }
  // 整条祖先链都不匹配方向:对根整体外包
  return wrapTreeWithLeaf(tree, side, newLeaf, newLeafId);
}

/** 内部:在 splitPath 指向的 split 的 children[insertIdx] 位置 splice 进 newChild */
function insertChildAt(tree, splitPath, insertIdx, newChild) {
  function recurse(node, depth) {
    if (depth === splitPath.length) {
      if (node.type !== "split") return node;
      const children = [...node.children];
      children.splice(insertIdx, 0, newChild);
      return { ...node, children };
    }
    if (node.type !== "split") return node;
    const next = [...node.children];
    next[splitPath[depth]] = recurse(node.children[splitPath[depth]], depth + 1);
    return { ...node, children: next };
  }
  return recurse(tree, 0);
}

/** 内部:对整棵 tree 外包一层指定方向 split,新 leaf 放在指定 side */
function wrapTreeWithLeaf(tree, side, newLeaf, newLeafId) {
  const direction = side === "left" || side === "right" ? "row" : "column";
  // 外包后:原 tree 和 newLeaf 各占 col-6;外层 split 继承原 tree.size(通常 auto)
  const inner = { ...tree, size: { mode: "col", value: 6 } };
  const sized = { ...newLeaf, size: { mode: "col", value: 6 } };
  const children = side === "left" || side === "top" ? [sized, inner] : [inner, sized];
  return {
    tree: {
      type: "split",
      direction,
      size: tree.size || { mode: "auto" },
      children,
    },
    newLeafId: newLeafId || newLeaf.id,
  };
}

/**
 * 检查给定 leaf 集合是否可合并为一个 leaf
 *
 * 可合并条件(矩形约束):
 *   1. 至少 2 个 leaf,id 全部存在于树中
 *   2. 所有 leaf 在 LCA(最近公共祖先 split)下的 child 索引集合连续
 *   3. 这些 child 子树的所有 leaves 都在选中集合里(无"部分合")
 *
 * @returns { lcaPath, childIndices }(childIndices 已排序连续)或 null
 */
export function canMergeLeaves(tree, leafIds) {
  if (!Array.isArray(leafIds) || leafIds.length < 2) return null;
  const paths = leafIds.map((id) => findLeafPath(tree, id));
  if (paths.some((p) => p == null)) return null;

  // 求 LCA path:共同前缀
  let lcaLen = 0;
  outer: for (let i = 0; i < paths[0].length; i++) {
    const v = paths[0][i];
    for (let j = 1; j < paths.length; j++) {
      if (paths[j][i] !== v) break outer;
    }
    lcaLen = i + 1;
  }
  const lcaPath = paths[0].slice(0, lcaLen);
  const lcaNode = getNodeAtPath(tree, lcaPath);
  if (!lcaNode || lcaNode.type !== "split") return null;

  // 每个 path 在 LCA 下一级的 child 索引
  const indexSet = new Set();
  for (const p of paths) {
    if (p.length <= lcaLen) return null;
    indexSet.add(p[lcaLen]);
  }
  const childIndices = [...indexSet].sort((a, b) => a - b);

  // 连续性
  for (let i = 1; i < childIndices.length; i++) {
    if (childIndices[i] !== childIndices[i - 1] + 1) return null;
  }
  // 覆盖性:每个选中 child 子树的所有 leaves 都在 leafIds 里
  const leafSet = new Set(leafIds);
  for (const idx of childIndices) {
    const subLeaves = collectLeafIds(lcaNode.children[idx]);
    for (const lid of subLeaves) {
      if (!leafSet.has(lid)) return null;
    }
  }
  return { lcaPath, childIndices };
}

/**
 * 合并多个 leaf 为一个新 leaf
 *
 * 实现:canMergeLeaves 通过后,在 LCA.children 上 splice 替换为新 leaf;
 *   若 LCA 合并后只剩 1 个 child,塌缩为该 child(继承 LCA 的 size,即沿用原占比)。
 *
 * @returns { tree, newLeafId } 或 null(不可合并)
 */
export function mergeLeaves(tree, leafIds, opts = {}) {
  const check = canMergeLeaves(tree, leafIds);
  if (!check) return null;
  const newLeafId = opts.newLeafId || makeLeafId();
  const { lcaPath, childIndices } = check;
  const startIdx = childIndices[0];
  const count = childIndices.length;

  function recurse(node, depth) {
    if (depth === lcaPath.length) {
      // node 即 LCA
      const firstChild = node.children[startIdx];
      const newLeaf = createLeaf(newLeafId, firstChild.size || { mode: "col", value: 6 });
      const next = [...node.children];
      next.splice(startIdx, count, newLeaf);
      if (next.length === 1) return { ...next[0], size: node.size };
      return { ...node, children: next };
    }
    if (node.type !== "split") return node;
    const nextChildren = [...node.children];
    nextChildren[lcaPath[depth]] = recurse(node.children[lcaPath[depth]], depth + 1);
    return { ...node, children: nextChildren };
  }
  return { tree: recurse(tree, 0), newLeafId };
}

/**
 * size 转 CSS flex 字符串(允许 shrink:0 1 X% — 兄弟比例 >100% 时按比例压缩、不溢出;
 * 调用方需保证 leaf 有 min-w/h 兜底防止过分塌陷)。
 *
 *   col      -> "0 1 X%" (X = value/12*100, 保留 3 位小数)
 *   px       -> "0 1 Xpx"
 *   percent  -> "0 1 X%"
 *   auto / null / undefined -> "1 1 0"
 *
 * codegen(flexCodeGen) 与可视化预览(FlexSplitView)共用本函数,行为完全一致。
 */
export function sizeToFlex(size) {
  if (!size) return "1 1 0";
  if (size.mode === "grow" || size.mode === "auto") return "1 1 0";
  if (size.mode === "shrink") return "0 0 auto";
  if (size.mode === "col") {
    const pct = (Number(size.value) / 12) * 100;
    return `0 1 ${pct.toFixed(3)}%`;
  }
  if (size.mode === "px") return `0 1 ${Number(size.value)}px`;
  if (size.mode === "percent") return `0 1 ${Number(size.value)}%`;
  return "1 1 0";
}

/**
 * 把 size 转成 CSS style 对象（包含可能的 minWidth/minHeight 在调用方拼接）
 */
export function sizeToStyle(size) {
  return { flex: sizeToFlex(size) };
}

/**
 * 把老格式 leaf 迁移到新 size mode 体系(就地修改,返回是否有改动)。
 *
 * 迁移规则(顺序敏感,先处理 mode='auto',再处理 colSize/colShrink):
 *   1) size.mode === 'auto' → size = { mode:'grow' }
 *   2) styleClass.colSize === 'col-grow' → size = { mode:'grow' },删 colSize
 *   3) styleClass.colSize === 'col-auto' 或 styleClass.colShrink === 'col-shrink'
 *      → size = { mode:'shrink' },删两键(colSize 优先)
 *   4) styleClass.colSize 匹配 /^col-(\d+)$/ → size = { mode:'col', value:N },删 colSize
 *   5) 兜底:任何残留 colShrink 一律删
 *
 * 幂等:迁移过的数据再跑无副作用。
 */
export function migrateLegacyLeafFlex(tree) {
  let changed = false;
  walkLeaves(tree, (leaf) => {
    // 1) 老 size.mode='auto' → 'grow'
    if (leaf.size?.mode === "auto") {
      leaf.size = { mode: "grow" };
      changed = true;
    }
    const sc = leaf.styleClass;
    if (!sc) return;

    // 2/3/4) colSize 分支(优先于 colShrink)
    if (sc.colSize === "col-grow") {
      leaf.size = { mode: "grow" };
      delete sc.colSize;
      changed = true;
    } else if (sc.colSize === "col-auto") {
      leaf.size = { mode: "shrink" };
      delete sc.colSize;
      changed = true;
    } else if (typeof sc.colSize === "string") {
      const m = sc.colSize.match(/^col-(\d+)$/);
      if (m) {
        leaf.size = { mode: "col", value: Number(m[1]) };
        delete sc.colSize;
        changed = true;
      }
    } else if (sc.colShrink === "col-shrink") {
      leaf.size = { mode: "shrink" };
      changed = true;
    }

    // 5) 兜底:任何残留 colShrink 都删除
    if (sc.colShrink !== undefined) {
      delete sc.colShrink;
      changed = true;
    }
  });
  return changed;
}
