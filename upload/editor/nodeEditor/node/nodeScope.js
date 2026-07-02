// 节点场景过滤工具:category 派生 + scope/parent 匹配。
// category 是节点场景过滤的语义主轴,由 treePath 顶段映射而来(treePath 已是 static,类上可读)。

// treePath 顶段 → 语义 category
const TREEPATH_CATEGORY = {
  ui: "ui",
  JavaScript: "logic",
  Vue: "vue",
  Hooks: "hooks",
  Pinia: "pinia",
  Backend: "backend",
  meta2d: "meta2d",
  graph: "graph", // 内部基建(GraphInput/Output),默认不进任何场景
  tree: "tree", // 文件树节点自成一类,按需经 includeTreePaths 纳入
  default: "logic",
};

export function categoryOfTreePath(treePath) {
  const top = String(treePath || "").split("/")[0];
  return TREEPATH_CATEGORY[top] || "logic";
}

// 判断注册节点类是否落入 scope。scope 为 null/undefined 时全部通过(兜底,保持旧行为)。
export function matchNodeScope(nodeClass, scope) {
  if (!scope) return true;
  const treePath = nodeClass?.treePath || "";
  if (scope.includeTreePaths?.some((p) => treePath.startsWith(p))) return true;
  if (scope.excludeTreePaths?.some((p) => treePath.startsWith(p))) return false;
  if (scope.categories?.length) {
    // 读节点显式声明的 categories(static,见 nodeMetea.js 基类/createDynamicClass);派生作兜底
    const cat = nodeClass?.categories || categoryOfTreePath(treePath);
    return scope.categories.includes(cat);
  }
  return false;
}

// parentMustBe 依赖过滤:有约束的节点只在 parentTag 命中时通过。
export function matchParent(nodeClass, parentTag) {
  const mustBe = nodeClass?.parentMustBe || [];
  if (!mustBe.length) return true; // 无约束,任意位置可加
  if (!parentTag) return false; // 有约束但无父上下文 → 不显示
  return mustBe.includes(parentTag);
}
