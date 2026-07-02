/**
 * 聚合函数 filter 子句生成
 *
 * SQL FILTER (WHERE ...) 语法:把 agg.filterWhere 数组拼成 `field op val AND ...` 表达式,
 * 由 aggregates 主体在 sum/count/avg 等聚合后追加 ` FILTER (WHERE ${parts})`。
 *
 * 字面 1:1 复刻自 TableNode._buildAggregateFilter。
 */

/**
 * @param {{filterWhere?: Array<{fieldId?:string, field?:string, isSlot?:boolean, slotId?:string, value?:any, operator?:string}>}} agg
 * @param {object} ctx - 含 resolveNodeName / getSlotValue
 * @returns {string} 形如 "field1 = '5' AND field2 IS NULL";无条件时返回 ""
 */
export function buildAggregateFilter(agg, ctx) {
  const fw = Array.isArray(agg?.filterWhere) ? agg.filterWhere : [];
  if (fw.length === 0) return "";

  const parts = [];
  for (const c of fw) {
    const fName = c.fieldId ? ctx.resolveNodeName(c.fieldId) : c.field;
    if (!fName) continue;
    const v = c.isSlot ? ctx.getSlotValue(c.slotId) : c.value;
    const op = c.operator || "=";
    if (op === "is null") {
      parts.push(`${fName} IS NULL`);
    } else if (op === "is not null") {
      parts.push(`${fName} IS NOT NULL`);
    } else if (v === null || v === undefined || v === "") {
      continue;
    } else {
      // SQL 字面值:数字/已 quote 字符串/变量名直接放;其他按字符串字面 quote
      const valStr = (typeof v === "string" && /^['"`].*['"`]$/.test(v))
        ? v
        : (typeof v === "string" && /^-?\d+(\.\d+)?$/.test(v.trim()))
          ? v
          : `'${String(v).replace(/'/g, "\\'")}'`;
      parts.push(`${fName} ${op.toUpperCase()} ${valStr}`);
    }
  }
  if (parts.length === 0) return "";
  return parts.join(" AND ");
}
