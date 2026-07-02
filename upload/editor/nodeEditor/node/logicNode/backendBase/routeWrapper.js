/**
 * 路由壳模板 helper
 *
 * 集中产出 fastify.${method}(...) 路由包装代码，避免模板字符串散落在多处。
 *
 * 调用方：
 * - HttpApiNode（errorHandling='reply500'）— 路由级节点自产路由壳
 * - functionBlockSplitter（errorHandling='rethrow'）— FunctionBlock 含后端节点时自动拆分路由
 * - 未来扩展的路由级节点
 */

/**
 * 构建 fastify 路由包装代码
 *
 * @param {object} options
 * @param {string} options.method - HTTP method ('POST' | 'GET' | 'PUT' | 'DELETE'...)
 * @param {string} options.path - 路由路径
 * @param {string[]} [options.paramNames=[]] - 入参名称数组，用于解构 request.body / request.query
 * @param {'body'|'query'} [options.paramSource] - 入参来源；不传则 GET 默认 query，其他默认 body
 * @param {string[]} [options.returnNames=[]] - 出参名称数组，用于 return { ... }
 * @param {string} [options.body=''] - 路由内层代码（节点产物或 splitter 拼装结果）
 * @param {'reply500'|'rethrow'|'none'} [options.errorHandling='rethrow']
 *   - 'reply500'：HttpApi 模式，包 try/catch + reply.status(500) + 失败通知（带 _notified 防重）
 *   - 'rethrow'：FunctionBlock 模式，错误冒泡到 fastify（fastify 自动 500）
 *   - 'none'：等价于 rethrow，语义留作未来扩展
 * @param {string|null} [options.successNotify=null] - 成功通知语句（已含 notifyClient(...)），插入 body 之后
 * @param {string} [options.remark=''] - 备注，生成 /* ... *\/ 注释
 * @returns {string} 完整 fastify.${method}('${path}', async (request, reply) => { ... })
 */
export function buildRouteWrapper({
  method = "POST",
  path,
  paramNames = [],
  paramSource,
  returnNames = [],
  body = "",
  errorHandling = "rethrow",
  successNotify = null,
  remark = "",
}) {
  const methodLower = method.toLowerCase();
  const methodUpper = method.toUpperCase();
  const source = paramSource || (methodUpper === "GET" ? "query" : "body");

  const destructure =
    paramNames.length > 0
      ? `const { ${paramNames.join(", ")} } = request.${source}`
      : "";

  const returnStmt =
    returnNames.length > 0
      ? `return { ${returnNames.join(", ")} }`
      : "return {}";

  const remarkLine = remark ? `  /* ${remark} */` : "";

  const lines = [];

  if (errorHandling === "reply500") {
    if (remarkLine) lines.push(remarkLine);
    lines.push("  try {");
    if (destructure) lines.push(`    ${destructure}`);
    if (body) lines.push(`    ${body}`);
    if (successNotify) lines.push(`    ${successNotify}`);
    lines.push(`    ${returnStmt}`);
    lines.push("  } catch (e) {");
    lines.push("    if (!e._notified) {");
    lines.push(
      `      notifyClient('error', '${methodUpper} ${path} 请求失败: ' + e.message)`,
    );
    lines.push("    }");
    lines.push("    reply.status(500).send({ error: e.message })");
    lines.push("  }");
  } else {
    if (remarkLine) lines.push(remarkLine);
    if (destructure) lines.push(`  ${destructure}`);
    if (body) lines.push(`  ${body}`);
    if (successNotify) lines.push(`  ${successNotify}`);
    lines.push(`  ${returnStmt}`);
  }

  return `fastify.${methodLower}('${path}', async (request, reply) => {
${lines.join("\n")}
})`;
}
