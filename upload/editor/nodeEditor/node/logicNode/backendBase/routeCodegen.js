/**
 * 后端 Fastify 路由 codegen(组合层)
 *
 * 在底层 routeWrapper.buildRouteWrapper 之上加 SSE 前缀 / 事务包裹 / import 拼装,
 * 统一 BackendCrudNode / HttpApiNode / DatabaseSubgraph 三家路由级节点的拼装路径。
 *
 * buildRouteWrapper 是只做 try/catch 壳 + destructure + return 的纯函数,
 * 上层差异(SSE 注册前缀、knex/sse 的 bgImportStr 拼接、事务 wrapping)汇聚到此。
 */

import { buildRouteWrapper } from "./routeWrapper.js";

/**
 * 组装一条完整后端路由代码片段
 *
 * @param {object} opts
 * @param {string} opts.method - 'POST' | 'GET' | ...
 * @param {string} opts.path - 路由路径
 * @param {string[]} [opts.paramNames=[]] - destructure 名(支持 'in0: slotName' 重命名语法)
 * @param {'body'|'query'} [opts.paramSource] - 缺省按 method 推断
 * @param {string[]} [opts.returnNames=[]]
 * @param {string} opts.body - 路由内层代码
 * @param {'reply500'|'rethrow'|'none'} [opts.errorHandling='reply500']
 * @param {string|null} [opts.successNotify=null]
 * @param {string} [opts.remark='']
 *
 * @param {boolean} [opts.prefixSse=true] - 是否前置 `registerSseNotifyRoute(fastify)\n  `
 * @param {boolean} [opts.includeKnexImport=false] - 后端 import 是否带 knex
 * @param {string[]} [opts.extraImports=[]] - 额外完整 import 行
 *
 * @returns {{code: string, imports: string[]}}
 *   - code:可直接赋给 this.bgJsCode
 *   - imports:可 `.join("\n")` 后赋给 this.bgImportStr
 */
export function buildBackendRoute(opts) {
  const {
    method,
    path,
    paramNames = [],
    paramSource,
    returnNames = [],
    body,
    errorHandling = "reply500",
    successNotify = null,
    remark = "",
    prefixSse = true,
    includeKnexImport = false,
    extraImports = [],
  } = opts;

  let code = buildRouteWrapper({
    method,
    path,
    paramNames,
    paramSource,
    returnNames,
    body,
    errorHandling,
    successNotify,
    remark,
  });
  if (prefixSse) {
    code = `registerSseNotifyRoute(fastify)\n  ${code}`;
  }

  // import 顺序:knex(若有)在前,sse/notify 在后,extraImports 收尾。
  // 与现行 3 个节点拼出的 bgImportStr 顺序一致,确保 diff 最小。
  const imports = [];
  if (includeKnexImport) {
    imports.push("import knex from '{{BG_ROOT}}/db/knex.js'");
  }
  // prefixSse 或 errorHandling='reply500' 都触发 sse/notify 引用:
  //  - prefixSse → 直接调 registerSseNotifyRoute
  //  - reply500 → buildRouteWrapper 在 catch 块生成 notifyClient('error', ...)
  if (prefixSse || errorHandling === "reply500") {
    imports.push(
      "import { notifyClient, registerSseNotifyRoute } from '{{BG_ROOT}}/sse/notify.js'",
    );
  }
  for (const ln of extraImports) {
    if (!imports.includes(ln)) imports.push(ln);
  }

  return { code, imports };
}

/**
 * 用 knex.transaction 包裹一段含 knex(...) / knex.xxx 调用的 body
 * 把内部 knex 改写为 trx,把 body 最终结果 const 化到外层 responseVarName
 *
 * ⚠️ 过渡方案:依赖字符串 regex 改写 knex→trx,理论上仍有"代码内字符串字面量含 'knex.'"
 *    的误命中风险(\bknex(?=[(.]) 已尽量收紧,不命中 `'knex_table'` 但仍可能命中 `'... knex.foo ...'`)。
 *    Phase 4 改成 dbCodegen 接收 ref 参数原地产 trx,删除本函数。
 *
 * @param {string} body
 * @param {object} opts
 * @param {string} [opts.responseVarName='data']
 * @param {string} opts.resultExpr - 内部 return 表达式(就是 body 内最终 result 变量名)
 * @returns {string}
 */
export function wrapInKnexTransaction(body, { responseVarName = "data", resultExpr }) {
  const trxBody = body.replace(/\bknex(?=[(.])/g, "trx");
  return `const ${responseVarName} = await knex.transaction(async (trx) => {\n  ${trxBody}\n  return ${resultExpr}\n})`;
}
