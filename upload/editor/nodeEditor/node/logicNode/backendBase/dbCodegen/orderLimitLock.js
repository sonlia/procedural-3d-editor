/**
 * ORDER BY / LIMIT / OFFSET / 行锁 子句生成
 *
 * 三个函数都是 SELECT 链尾的"后缀拼装",字面 1:1 复刻自 TableNode 原方法
 * (_orderByLine / _generateLockClause / _generateLimitOffset),迁出时保留每个空格
 * 与换行,确保字符串字节回归 0 diff。
 */

/**
 * ORDER BY 单行
 *
 * 输出形如 `\n  .orderBy('field', 'asc')` 或
 * `\n  .orderBy({ column: 'field', order: 'asc', nulls: 'first' })`。
 *
 * @param {string} qualifiedName - 字段名(可能含表别名前缀 t1.name)
 * @param {{direction?: string, nullsPosition?: string}} ob
 * @returns {string}
 */
export function buildOrderByLine(qualifiedName, ob) {
  const direction = (ob.direction || "asc").toLowerCase();
  const nulls = (ob.nullsPosition || "").toLowerCase();
  if (nulls === "first" || nulls === "last") {
    // 用 object 形式调用 knex.orderBy({column, order, nulls})
    return `\n  .orderBy({ column: '${qualifiedName}', order: '${direction}', nulls: '${nulls}' })`;
  }
  return `\n  .orderBy('${qualifiedName}', '${direction}')`;
}

/**
 * SELECT 行锁(forUpdate/forShare)+ modifier(skipLocked/noWait)
 *
 * 仅事务环境下生效(ctx.ref === 'trx'),无事务时返回空串避免 PG 报错。
 *
 * @param {object} props
 * @param {object} ctx - 至少含 ctx.ref
 * @returns {string}
 */
export function buildLockClause(props, ctx) {
  const mode = props.lockMode || "none";
  if (mode === "none") return "";
  if (ctx.ref !== "trx") return "";
  let chain = "";
  if (mode === "forUpdate") chain = `\n  .forUpdate()`;
  else if (mode === "forShare") chain = `\n  .forShare()`;
  else return "";

  const modifier = props.lockModifier || "none";
  if (modifier === "skipLocked") chain += `\n  .skipLocked()`;
  else if (modifier === "noWait") chain += `\n  .noWait()`;
  return chain;
}

/**
 * LIMIT / OFFSET 链
 *
 * limit.isSlot=true 时 ctx.getSlotValue(slotId) 读 wire,否则用 props.limit.value。
 *
 * @param {object} props
 * @param {object} ctx - 至少含 ctx.getSlotValue
 * @returns {string}
 */
export function buildLimitOffset(props, ctx) {
  let code = "";

  const limitVal = props.limit.isSlot
    ? ctx.getSlotValue(props.limit.slotId)
    : props.limit.value;
  if (limitVal) code += `\n  .limit(${limitVal})`;

  const offsetVal = props.offset.isSlot
    ? ctx.getSlotValue(props.offset.slotId)
    : props.offset.value;
  if (offsetVal) code += `\n  .offset(${offsetVal})`;

  return code;
}
