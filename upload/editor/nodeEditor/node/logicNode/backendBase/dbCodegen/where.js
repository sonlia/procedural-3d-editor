/**
 * WHERE 子句生成
 *
 * buildWhere(props, ctx, tableAlias)        — 入口,3 条执行路径:
 *   - 无嵌套 group:走 groupKey segment 拼装 + `.where(function(){...})` 包裹分组
 *   - 含嵌套 group:走 buildWhereInner 递归路径
 *   - (旧扁平 dead path 保留至 Phase 3.F 删,见函数末尾)
 * buildWhereInner(conditions, useOrOuter, ctx, tableAlias) — 嵌套递归,内部自调
 *
 * 字面 1:1 复刻自 TableNode._generateWhere / _generateWhereInner,字符串字节对齐。
 *
 * ctx 需要:resolveNodeName(id) / getSlotValue(slotId)
 */

/**
 * 嵌套 WHERE 内层递归生成
 * 节点:`type === 'group'` 表示一个嵌套分组,含 children + logic
 * 普通 condition 节点:复用单条件逻辑
 *
 * @returns {string[]} 不带 \n 前缀的 `.where*(...)` 片段数组
 */
export function buildWhereInner(conditions, useOrOuter, ctx, tableAlias) {
  const prefix = tableAlias ? `${tableAlias}.` : "";
  const lines = [];
  let isFirst = true;
  for (const w of conditions) {
    if (!w) continue;

    // 分支 1:嵌套 group(P2-1)
    if (w.type === "group" && Array.isArray(w.children) && w.children.length > 0) {
      const childLogic = w.logic || "and";
      const useOrInner =
        !isFirst &&
        ((w.joinLogic || (useOrOuter ? "or" : "and")) === "or");
      isFirst = false;
      const childLines = buildWhereInner(w.children, childLogic === "or", ctx, tableAlias);
      if (!childLines) continue;
      // 用 callback 形式包裹:.where(function() { this.where(...) ... })
      const callbackBody = childLines
        .map((l) => `this${l};`)
        .join(" ");
      const method = useOrInner ? "orWhere" : "where";
      lines.push(`.${method}(function() { ${callbackBody} })`);
      continue;
    }

    // 分支 2:无字段名 operator(exists/notExists/raw),value 是 builder 或 raw 表达式
    if (w.operator === "exists" || w.operator === "notExists" || w.operator === "raw") {
      const val2 = w.isSlot ? ctx.getSlotValue(w.slotId) : w.value;
      if (val2 == null || val2 === "") continue;
      const useOr2 =
        !isFirst &&
        ((w.logic || (useOrOuter ? "or" : "and")) === "or");
      isFirst = false;
      if (w.operator === "raw") {
        const fn = useOr2 ? "orWhere" : "where";
        lines.push(`.${fn}(${val2})`);
      } else {
        const wantsExists = (w.operator === "exists") !== !!w.negated;
        const base = wantsExists ? "whereExists" : "whereNotExists";
        const fn = useOr2 ? "or" + base[0].toUpperCase() + base.slice(1) : base;
        lines.push(`.${fn}(${val2})`);
      }
      continue;
    }

    // 分支 3:普通 condition
    const wFieldName = w.fieldId ? ctx.resolveNodeName(w.fieldId) : w.field;
    if (!wFieldName) continue;
    const qualifiedName = `${prefix}${wFieldName}`;
    const val = w.isSlot ? ctx.getSlotValue(w.slotId) : w.value;
    if (val === null && w.operator !== "is null" && w.operator !== "is not null") continue;
    const useOr =
      !isFirst &&
      ((w.logic || (useOrOuter ? "or" : "and")) === "or");
    isFirst = false;

    const negated = !!w.negated;
    const isColumnMode = w.valueMode === "column";

    const m = (base) =>
      useOr ? "or" + base[0].toUpperCase() + base.slice(1) : base;
    const mNot = (base) => {
      const baseNot = base.replace(/^where/, "whereNot");
      return useOr ? "or" + baseNot[0].toUpperCase() + baseNot.slice(1) : baseNot;
    };

    let line = "";
    if (w.operator === "is null") {
      const fn = negated ? m("whereNotNull") : m("whereNull");
      line = `.${fn}('${qualifiedName}')`;
    } else if (w.operator === "is not null") {
      const fn = negated ? m("whereNull") : m("whereNotNull");
      line = `.${fn}('${qualifiedName}')`;
    } else if (w.operator === "in") {
      const fn = negated ? mNot("whereIn") : m("whereIn");
      line = `.${fn}('${qualifiedName}', ${val})`;
    } else if (w.operator === "not in") {
      const fn = negated ? m("whereIn") : mNot("whereIn");
      line = `.${fn}('${qualifiedName}', ${val})`;
    } else if (w.operator === "between") {
      const fn = negated ? mNot("whereBetween") : m("whereBetween");
      line = `.${fn}('${qualifiedName}', ${val})`;
    } else if (w.operator === "not between") {
      const fn = negated ? m("whereBetween") : mNot("whereBetween");
      line = `.${fn}('${qualifiedName}', ${val})`;
    } else if (w.operator === "like") {
      const op = negated ? "not like" : "like";
      line = `.${m("where")}('${qualifiedName}', '${op}', ${val})`;
    } else if (w.operator === "ilike") {
      const op = negated ? "not ilike" : "ilike";
      line = `.${m("where")}('${qualifiedName}', '${op}', ${val})`;
    } else {
      if (isColumnMode) {
        const otherCol = `${prefix}${val}`;
        if (negated) {
          line = `.${m("whereNot")}('${qualifiedName}', '${w.operator}', knex.ref('${otherCol}'))`;
        } else {
          const fn = m("where") === "where" ? "whereColumn" : "orWhereColumn";
          line = `.${fn}('${qualifiedName}', '${w.operator}', '${otherCol}')`;
        }
      } else {
        const fn = negated ? m("whereNot") : m("where");
        line = `.${fn}('${qualifiedName}', '${w.operator}', ${val})`;
      }
    }
    lines.push(line);
  }
  return lines;
}

/**
 * WHERE 主入口
 *
 * @param {object} props - 节点 properties(含 where, whereLogic)
 * @param {object} ctx - 含 resolveNodeName / getSlotValue
 * @param {string} [tableAlias] - JOIN 场景下的别名(如 't1')
 * @returns {string} 形如 `\n  .where('a', '=', 1)\n  .orWhere(...)`,无条件返回 ""
 */
export function buildWhere(props, ctx, tableAlias) {
  const conditions = Array.isArray(props.where) ? props.where : [];
  if (conditions.length === 0) return "";

  const hasLegacyGroup = conditions.some(
    (w) => w?.type === "group" && Array.isArray(w.children) && w.children.length > 0,
  );
  if (!hasLegacyGroup) {
    const prefix = tableAlias ? `${tableAlias}.` : "";
    const defaultLogic = props.whereLogic || "and";

    const buildLeafLine = (w, useOr) => {
      if (!w) return null;

      if (w.operator === "exists" || w.operator === "notExists" || w.operator === "raw") {
        const val0 = w.isSlot ? ctx.getSlotValue(w.slotId) : w.value;
        if (val0 == null || val0 === "") return null;
        if (w.operator === "raw") {
          return `.${useOr ? "orWhere" : "where"}(${val0})`;
        }
        const wantsExists = (w.operator === "exists") !== !!w.negated;
        const base = wantsExists ? "whereExists" : "whereNotExists";
        const fn = useOr ? "or" + base[0].toUpperCase() + base.slice(1) : base;
        return `.${fn}(${val0})`;
      }

      const wFieldName = w.fieldId ? ctx.resolveNodeName(w.fieldId) : w.field;
      if (!wFieldName) return null;

      const qualifiedName = `${prefix}${wFieldName}`;
      const val = w.isSlot ? ctx.getSlotValue(w.slotId) : w.value;
      if (val === null && w.operator !== "is null" && w.operator !== "is not null") return null;

      const isColumnMode = w.valueMode === "column";
      const negated = !!w.negated;
      const m = (base) => (useOr ? "or" + base[0].toUpperCase() + base.slice(1) : base);
      const mNot = (base) => {
        const baseNot = base.replace(/^where/, "whereNot");
        return useOr ? "or" + baseNot[0].toUpperCase() + baseNot.slice(1) : baseNot;
      };

      if (w.operator === "is null") {
        const fn = negated ? m("whereNotNull") : m("whereNull");
        return `.${fn}('${qualifiedName}')`;
      }
      if (w.operator === "is not null") {
        const fn = negated ? m("whereNull") : m("whereNotNull");
        return `.${fn}('${qualifiedName}')`;
      }
      if (w.operator === "in") {
        const fn = negated ? mNot("whereIn") : m("whereIn");
        return `.${fn}('${qualifiedName}', ${val})`;
      }
      if (w.operator === "not in") {
        const fn = negated ? m("whereIn") : mNot("whereIn");
        return `.${fn}('${qualifiedName}', ${val})`;
      }
      if (w.operator === "between") {
        const fn = negated ? mNot("whereBetween") : m("whereBetween");
        return `.${fn}('${qualifiedName}', ${val})`;
      }
      if (w.operator === "not between") {
        const fn = negated ? m("whereBetween") : mNot("whereBetween");
        return `.${fn}('${qualifiedName}', ${val})`;
      }
      if (w.operator === "like") {
        if (isColumnMode) {
          return `.${m("where")}(knex.raw('?? ${negated ? "NOT " : ""}LIKE ??', ['${qualifiedName}', '${val}']))`;
        }
        const op = negated ? "not like" : "like";
        return `.${m("where")}('${qualifiedName}', '${op}', ${val})`;
      }
      if (w.operator === "ilike") {
        if (isColumnMode) {
          return `.${m("where")}(knex.raw('?? ${negated ? "NOT " : ""}ILIKE ??', ['${qualifiedName}', '${val}']))`;
        }
        const op = negated ? "not ilike" : "ilike";
        return `.${m("where")}('${qualifiedName}', '${op}', ${val})`;
      }

      if (isColumnMode) {
        const otherCol = `${prefix}${val}`;
        if (negated) {
          return `.${m("whereNot")}('${qualifiedName}', '${w.operator}', knex.ref('${otherCol}'))`;
        }
        const fn = m("where") === "where" ? "whereColumn" : "orWhereColumn";
        return `.${fn}('${qualifiedName}', '${w.operator}', '${otherCol}')`;
      }

      const fn = negated ? m("whereNot") : m("where");
      return `.${fn}('${qualifiedName}', '${w.operator}', ${val})`;
    };

    const segments = [];
    for (const w of conditions) {
      if (!w) continue;
      const groupKey = w.groupKey || "";
      if (groupKey) {
        const last = segments[segments.length - 1];
        if (last?.groupKey === groupKey) {
          last.items.push(w);
        } else {
          segments.push({ grouped: true, groupKey, items: [w] });
        }
      } else {
        segments.push({ grouped: false, items: [w] });
      }
    }

    const renderSegment = (segment, isFirstSegment) => {
      if (!segment?.items?.length) return "";
      const connectorLogic = segment.items[0]?.logic || defaultLogic;

      if (!segment.grouped) {
        const line = buildLeafLine(segment.items[0], !isFirstSegment && connectorLogic === "or");
        return line || "";
      }

      const innerLines = [];
      let isFirstInGroup = true;
      for (const w of segment.items) {
        const useOr = !isFirstInGroup && ((w.logic || defaultLogic) === "or");
        const line = buildLeafLine(w, useOr);
        if (!line) continue;
        innerLines.push(line);
        isFirstInGroup = false;
      }
      if (!innerLines.length) return "";
      const method = !isFirstSegment && connectorLogic === "or" ? "orWhere" : "where";
      return `.${method}(function() { ${innerLines.map((l) => `this${l};`).join(" ")} })`;
    };

    const lines = [];
    let isFirstSegment = true;
    for (const segment of segments) {
      const line = renderSegment(segment, isFirstSegment);
      if (!line) continue;
      lines.push(line);
      isFirstSegment = false;
    }
    return lines.map((l) => `\n  ${l}`).join("");
  }

  // P2-1: 检测是否有嵌套 group 项,若有则走递归路径
  const hasGroup = (props.where || []).some(
    (w) => w?.type === "group" && Array.isArray(w.children) && w.children.length > 0,
  );
  if (hasGroup) {
    const logic = props.whereLogic || "and";
    const lines = buildWhereInner(
      props.where || [],
      logic === "or",
      ctx,
      tableAlias,
    );
    return lines.map((l) => `\n  ${l}`).join("");
  }

  // 旧扁平路径(保留至 Phase 3.F 清理)— hasLegacyGroup=false 与 hasGroup=false
  // 同义,前面 !hasLegacyGroup 分支已 return,理论上不可达;保留以保证字节迁移等价。
  let code = "";
  const logic = props.whereLogic || "and";
  const prefix = tableAlias ? `${tableAlias}.` : "";

  let isFirst = true;
  for (let i = 0; i < props.where.length; i++) {
    const w = props.where[i];

    if (w.operator === "exists" || w.operator === "notExists" || w.operator === "raw") {
      const val0 = w.isSlot ? ctx.getSlotValue(w.slotId) : w.value;
      if (val0 == null || val0 === "") continue;
      const useOr0 = !isFirst && logic === "or";
      isFirst = false;
      if (w.operator === "raw") {
        const fn = useOr0 ? "orWhere" : "where";
        code += `\n  .${fn}(${val0})`;
      } else {
        const wantsExists = (w.operator === "exists") !== !!w.negated;
        const base = wantsExists ? "whereExists" : "whereNotExists";
        const fn = useOr0 ? "or" + base[0].toUpperCase() + base.slice(1) : base;
        code += `\n  .${fn}(${val0})`;
      }
      continue;
    }

    const wFieldName = w.fieldId
      ? ctx.resolveNodeName(w.fieldId)
      : w.field;

    if (!wFieldName) continue;

    const qualifiedName = `${prefix}${wFieldName}`;

    const val = w.isSlot
      ? ctx.getSlotValue(w.slotId)
      : w.value;

    if (val === null) continue;

    const useOr = !isFirst && logic === "or";
    isFirst = false;

    const isColumnMode = w.valueMode === "column";
    const negated = !!w.negated;

    const m = (base) => {
      const orPrefix = useOr ? "or" + base[0].toUpperCase() + base.slice(1) : base;
      return orPrefix;
    };
    const mNot = (base) => {
      const baseNot = base.replace(/^where/, "whereNot");
      return useOr ? "or" + baseNot[0].toUpperCase() + baseNot.slice(1) : baseNot;
    };

    let line = "";
    if (w.operator === "is null") {
      const fn = negated ? m("whereNotNull") : m("whereNull");
      line = `.${fn}('${qualifiedName}')`;
    } else if (w.operator === "is not null") {
      const fn = negated ? m("whereNull") : m("whereNotNull");
      line = `.${fn}('${qualifiedName}')`;
    } else if (w.operator === "in") {
      const fn = negated ? mNot("whereIn") : m("whereIn");
      line = `.${fn}('${qualifiedName}', ${val})`;
    } else if (w.operator === "not in") {
      const fn = negated ? m("whereIn") : mNot("whereIn");
      line = `.${fn}('${qualifiedName}', ${val})`;
    } else if (w.operator === "between") {
      const fn = negated ? mNot("whereBetween") : m("whereBetween");
      line = `.${fn}('${qualifiedName}', ${val})`;
    } else if (w.operator === "not between") {
      const fn = negated ? m("whereBetween") : mNot("whereBetween");
      line = `.${fn}('${qualifiedName}', ${val})`;
    } else if (w.operator === "like") {
      if (isColumnMode) {
        line = `.${m("where")}(knex.raw('?? ${negated ? "NOT " : ""}LIKE ??', ['${qualifiedName}', '${val}']))`;
      } else {
        const op = negated ? "not like" : "like";
        line = `.${m("where")}('${qualifiedName}', '${op}', ${val})`;
      }
    } else if (w.operator === "ilike") {
      if (isColumnMode) {
        line = `.${m("where")}(knex.raw('?? ${negated ? "NOT " : ""}ILIKE ??', ['${qualifiedName}', '${val}']))`;
      } else {
        const op = negated ? "not ilike" : "ilike";
        line = `.${m("where")}('${qualifiedName}', '${op}', ${val})`;
      }
    } else {
      if (isColumnMode) {
        const otherCol = `${prefix}${val}`;
        const fn = negated ? m("whereNot") : m("where");
        line = `.${fn === "where" ? "whereColumn" : fn === "orWhere" ? "orWhereColumn" : fn === "whereNot" ? "whereNot" : "orWhereNot"}('${qualifiedName}', '${w.operator}', '${otherCol}')`;
        if (negated) {
          line = `.${m("whereNot")}('${qualifiedName}', '${w.operator}', knex.ref('${otherCol}'))`;
        }
      } else {
        const fn = negated ? m("whereNot") : m("where");
        line = `.${fn}('${qualifiedName}', '${w.operator}', ${val})`;
      }
    }

    code += `\n  ${line}`;
  }

  return code;
}
