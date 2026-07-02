/**
 * HAVING 子句生成
 *
 * GROUP BY 后的过滤,knex 提供 .having / .havingIn / .havingExists / .havingNull
 * 等多种方法。leaf 节点根据 operator 分派到对应 knex API,主入口 buildHaving 支持
 * 旧单条件、扁平 conditions、嵌套 group 三种数据形态。
 *
 * 全部函数字面 1:1 复刻自 TableNode._generateHaving / _generateHavingInner /
 * _buildHavingLeafLine。
 */

/**
 * HAVING 主入口
 *
 * @param {object} props - 节点 properties(读 props.having)
 * @param {object} ctx - 含 resolveNodeName / getSlotValue
 * @returns {string} 形如 `\n  .having('field', '>', 10)`;未启用或空返回 ""
 */
export function buildHaving(props, ctx) {
  if (!props?.having?.enabled) return "";

  const conds = Array.isArray(props.having.conditions)
    ? props.having.conditions
    : [];

  // 旧数据兼容:单条件路径
  if (conds.length === 0) {
    const h = props.having;
    const field = h.fieldId ? ctx.resolveNodeName(h.fieldId) : h.field;
    if (!field) return "";
    const val = h.isSlot ? ctx.getSlotValue(h.slotId) : h.value;
    if (val === null || val === undefined || val === "") return "";
    return `\n  .having('${field}', '${h.operator || ">"}', ${val})`;
  }

  // 嵌套 group:检测后走递归路径生成 .having(function() { this.having(...) ... })
  const hasGroup = conds.some(
    (h) => h?.type === "group" && Array.isArray(h.children) && h.children.length > 0,
  );
  if (hasGroup) {
    const logic = props.having.logic || "and";
    const lines = buildHavingInner(conds, logic === "or", ctx);
    return lines.map((l) => `\n  ${l}`).join("");
  }

  // 扁平模式
  const logic = props.having.logic || "and";
  let out = "";
  let isFirst = true;
  for (const h of conds) {
    const useOr = !isFirst && logic === "or";
    const line = buildHavingLeafLine(h, useOr, ctx);
    if (!line) continue;
    out += `\n  ${line}`;
    isFirst = false;
  }
  return out;
}

/**
 * having 嵌套递归:支持 type='group' 套 callback;leaf 复用 buildHavingLeafLine
 *
 * @returns {string[]} 不带 \n 前缀的 `.having*(...)` 片段数组
 */
export function buildHavingInner(conditions, useOrOuter, ctx) {
  const lines = [];
  let isFirst = true;
  for (const h of conditions) {
    if (!h) continue;
    if (h.type === "group" && Array.isArray(h.children) && h.children.length > 0) {
      const childLogic = h.logic || "and";
      const useOrInner = !isFirst && (useOrOuter ?? false);
      const childLines = buildHavingInner(h.children, childLogic === "or", ctx);
      if (childLines.length === 0) continue;
      const callbackBody = childLines.map((l) => `this${l};`).join(" ");
      const method = useOrInner ? "orHaving" : "having";
      lines.push(`.${method}(function() { ${callbackBody} })`);
      isFirst = false;
      continue;
    }
    const useOr = !isFirst && (useOrOuter ?? false);
    const line = buildHavingLeafLine(h, useOr, ctx);
    if (!line) continue;
    lines.push(line);
    isFirst = false;
  }
  return lines;
}

/**
 * @param {object} h - having 条件 leaf
 * @param {boolean} useOr - 是否走 or* 前缀(默认 false,顶层 AND;OR 分支递归时为 true)
 * @param {object} ctx - 含 resolveNodeName / getSlotValue
 * @returns {string} 形如 `.having('field', '>', 10)` 或 `.orHavingRaw(...)`
 */
export function buildHavingLeafLine(h, useOr, ctx) {
  if (!h) return "";
  const m = (base) => (useOr ? "or" + base[0].toUpperCase() + base.slice(1) : base);
  const op = h.operator || ">";
  const negated = !!h.negated;

  // 无字段名 operator
  if (op === "havingExists" || op === "havingNotExists" || op === "raw") {
    const v = h.isSlot ? ctx.getSlotValue(h.slotId) : h.value;
    if (v == null || v === "") return "";
    if (op === "raw") return `.${m("havingRaw")}(${v})`;
    // knex 原生 .havingExists / .havingNotExists,value 接 builder 字符串
    const wantsExists = (op === "havingExists") !== negated;
    const base = wantsExists ? "havingExists" : "havingNotExists";
    return `.${m(base)}(${v})`;
  }

  const field = h.fieldId ? ctx.resolveNodeName(h.fieldId) : h.field;
  if (!field) return "";
  const val = h.isSlot ? ctx.getSlotValue(h.slotId) : h.value;

  if (op === "is null") {
    return `.${m(negated ? "havingNotNull" : "havingNull")}('${field}')`;
  }
  if (op === "is not null") {
    return `.${m(negated ? "havingNull" : "havingNotNull")}('${field}')`;
  }
  if (val == null || val === "") return "";

  if (op === "in") {
    return `.${m(negated ? "havingNotIn" : "havingIn")}('${field}', ${val})`;
  }
  if (op === "not in") {
    return `.${m(negated ? "havingIn" : "havingNotIn")}('${field}', ${val})`;
  }
  if (op === "between") {
    return `.${m(negated ? "havingNotBetween" : "havingBetween")}('${field}', ${val})`;
  }
  if (op === "not between") {
    return `.${m(negated ? "havingBetween" : "havingNotBetween")}('${field}', ${val})`;
  }
  if (op === "like" || op === "ilike") {
    // knex 没有 .havingLike/.havingILike,走通用 having + op 字符串(PG 支持 ilike)
    const opStr = negated ? `not ${op}` : op;
    return `.${m("having")}('${field}', '${opStr}', ${val})`;
  }
  // 通用 op(=/!=/>/</...);negated 没有 havingNot,降级 raw
  if (negated) {
    return `.${m("havingRaw")}('NOT (?? ${op} ?)', ['${field}', ${val}])`;
  }
  return `.${m("having")}('${field}', '${op}', ${val})`;
}
