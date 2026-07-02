/**
 * CTE 链(WITH / WITH RECURSIVE)生成
 *
 * 节点提供 cte1..cte10 input slot,各自从上游 wire 拿到 `{alias, builder, recursive}` 对象。
 * 每个已连接的 cte slot 拼一行 `.with('alias', builder)`(或 `.withRecursive(...)`)。
 *
 * 字面 1:1 复刻自 TableNode._generateCteChain。
 */

/**
 * @param {object} props
 * @param {object} ctx - 含 findInputSlot / isInputConnected / getInputData
 * @returns {string}
 */
export function buildCteChain(props, ctx) {
  const count = Math.max(0, Math.min(10, props.cteCount || 0));
  if (count === 0) return "";
  let chain = "";
  for (let i = 1; i <= count; i++) {
    const idx = ctx.findInputSlot(`cte${i}`);
    if (idx < 0 || !ctx.isInputConnected(idx)) continue;
    const cteData = ctx.getInputData(idx);
    if (!cteData || !cteData.alias || !cteData.builder) continue;
    const method = cteData.recursive ? "withRecursive" : "with";
    chain += `\n  .${method}('${cteData.alias}', ${cteData.builder})`;
  }
  return chain;
}
