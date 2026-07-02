/**
 * 前端 fetch wrapper codegen
 *
 * 统一 BackendCrudNode / HttpApiNode / DatabaseSubgraph 三类路由级后端节点
 * 生成前端 fetch 调用代码的逻辑。
 *
 * 输出三件套(对齐 vueComponent assembler):
 *   - jsCode:fetch 函数定义 / bare async 块 + 触发语句(watch/onMounted/直接调用)
 *   - jsRefLines:顶层 ref 声明(响应 ref / loading / error / status)
 *   - importStr:`import { ref[, watch][, onMounted] } from "vue"`
 *
 * 参数维度:
 *   - funcName=null → bare 块(DbSubgraph 在 subgraph 流内嵌);
 *     funcName=string → 包装成 `const ${funcName} = async (params) => { ... }`
 *   - fetchMode='robust' → text + JSON.parse + !ok throw(BackendCrud/DbSubgraph;
 *     能捕获 4xx/5xx + 非 JSON 错误响应);
 *     fetchMode='simple' → res.json() 直返(HttpApi 现行为,errorRef 只接住网络错误)
 *   - errorHandling='notify' / 'errorRef' / 'none' 三选
 *   - exec(仅 funcName 非 null 有效):mode/watchDeps/immediateOnAuto/appendManualCall
 *     组合驱动 watch+immediate / watch / onMounted / 直接调用
 */

function buildFetchOptionsExpr({ method, bodyJsonExpr }) {
  const m = method.toUpperCase();
  if (m === "GET") return "";
  if (!bodyJsonExpr) return `, { method: '${m}' }`;
  return `, {\n    method: '${m}',\n    headers: { 'Content-Type': 'application/json' },\n    body: ${bodyJsonExpr}\n  }`;
}

function buildFetchUrlExpr({ method, routePath, queryParamsExpr }) {
  if (method.toUpperCase() === "GET" && queryParamsExpr) {
    return `\`${routePath}?${queryParamsExpr}\``;
  }
  return `'${routePath}'`;
}

function buildResponseAssignLines({ responseRefs, jsonVar, indent }) {
  const pad = " ".repeat(indent);
  return responseRefs
    .map(({ refName, jsonKey }) => {
      // jsonKey='*' 或 null/undefined → 整 __json 赋给 ref
      if (jsonKey === "*" || jsonKey == null) {
        return `${pad}${refName}.value = ${jsonVar}`;
      }
      // 与现有 BackendCrud/DbSubgraph/HttpApi 字面输出对齐:用直接 `.field` 访问,
      // 不加 `?.` 链路(响应已被 JSON.parse 保证至少是 {});非标识符 key 退到 [].
      const accessor = /^[a-zA-Z_$][\w$]*$/.test(jsonKey)
        ? `.${jsonKey}`
        : `[${JSON.stringify(jsonKey)}]`;
      return `${pad}${refName}.value = ${jsonVar}${accessor}`;
    })
    .join("\n");
}

/**
 * fetchOpts 模板自带 4 sp / 2 sp 的内层缩进(基于 0 sp 起点)。
 * 嵌入到 wrap 包裹的 try 块(内层从 4 sp 起)时,内部行要再加 2 sp。
 * 嵌入到 bare 块(内层从 2 sp 起)时不需要额外加。
 *
 * indentDelta = bodyIndent - 2,刚好等于要补的缩进量。
 */
function indentFetchOpts(fetchOpts, indentDelta) {
  if (indentDelta <= 0) return fetchOpts;
  const extra = " ".repeat(indentDelta);
  return fetchOpts.replace(/\n/g, `\n${extra}`);
}

function buildRobustFetchTry({
  method,
  routePath,
  queryParamsExpr,
  bodyJsonExpr,
  responseRefs,
  errorFallbackMessage,
  bodyIndent,
}) {
  const pad = " ".repeat(bodyIndent);
  const fetchUrl = buildFetchUrlExpr({ method, routePath, queryParamsExpr });
  const fetchOpts = indentFetchOpts(
    buildFetchOptionsExpr({ method, bodyJsonExpr }),
    bodyIndent - 2,
  );
  const assignLines = buildResponseAssignLines({
    responseRefs,
    jsonVar: "__json",
    indent: bodyIndent,
  });
  return [
    `${pad}const __res = await fetch(${fetchUrl}${fetchOpts})`,
    `${pad}const __text = await __res.text()`,
    `${pad}let __json = {}`,
    `${pad}if (__text) {`,
    `${pad}  try { __json = JSON.parse(__text) } catch { if (!__res.ok) throw new Error(__text) }`,
    `${pad}}`,
    `${pad}if (!__res.ok) throw new Error(__json?.error || __json?.message || __text || '${errorFallbackMessage}: ' + __res.status)`,
    assignLines,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildSimpleFetchTry({
  method,
  routePath,
  queryParamsExpr,
  bodyJsonExpr,
  responseRefs,
  statusRef,
  bodyIndent,
}) {
  const pad = " ".repeat(bodyIndent);
  const fetchUrl = buildFetchUrlExpr({ method, routePath, queryParamsExpr });
  const fetchOpts = indentFetchOpts(
    buildFetchOptionsExpr({ method, bodyJsonExpr }),
    bodyIndent - 2,
  );
  const lines = [
    `${pad}const res = await fetch(${fetchUrl}${fetchOpts})`,
    `${pad}const json = await res.json()`,
  ];
  if (statusRef) lines.push(`${pad}${statusRef}.value = res.status`);
  const assignLines = buildResponseAssignLines({
    responseRefs,
    jsonVar: "json",
    indent: bodyIndent,
  });
  if (assignLines) lines.push(assignLines);
  return lines.join("\n");
}

function buildCatchBlock({ errorHandling, errorRef, errorFallbackMessage, bodyIndent }) {
  const pad = " ".repeat(bodyIndent);
  if (errorHandling === "errorRef" && errorRef) {
    return [
      `${pad}} catch (e) {`,
      `${pad}  ${errorRef}.value = e`,
    ].join("\n");
  }
  if (errorHandling === "notify") {
    return [
      `${pad}} catch (__error) {`,
      `${pad}  if (typeof Notify !== 'undefined' && Notify?.create) {`,
      `${pad}    Notify.create({`,
      `${pad}      type: 'negative',`,
      `${pad}      message: __error?.message || '${errorFallbackMessage}',`,
      `${pad}      position: 'top',`,
      `${pad}      timeout: 3000,`,
      `${pad}    })`,
      `${pad}  } else {`,
      `${pad}    console.error(__error)`,
      `${pad}  }`,
    ].join("\n");
  }
  return `${pad}} catch (__error) {\n${pad}  console.error(__error)`;
}

/**
 * 主入口
 *
 * @param {object} opts
 * @param {string|null} opts.funcName
 * @param {string} [opts.method='POST']
 * @param {string} opts.routePath
 * @param {string[]} [opts.params=[]] - 函数签名形参名(funcName 非 null 时使用)
 * @param {string|null} [opts.bodyJsonExpr] - body 表达式(如 `JSON.stringify({ in0, in1 })`);null = 无 body
 * @param {string|null} [opts.queryParamsExpr] - GET 的 querystring 表达式(模板字符串内层),如 "${a}=${encodeURIComponent(a)}&${b}=${encodeURIComponent(b)}"
 * @param {Array<{refName: string, jsonKey: string}>} [opts.responseRefs=[]] - 响应字段 → ref 赋值;jsonKey='*' 表示整 __json 赋给 ref
 * @param {string|null} [opts.loadingRef] - 进入/退出时切 true/false(放 finally)
 * @param {string|null} [opts.errorRef] - 进入清 null;catch 写入(errorHandling='errorRef' 时)
 * @param {string|null} [opts.statusRef] - res.status 赋值(fetchMode='simple' 才有)
 * @param {Array<{refName: string, initial?: string}>} [opts.declareRefs=[]] - jsRefLines 声明(响应/loading/error/status 等)。默认从 responseRefs/loadingRef/errorRef/statusRef 推导
 * @param {'robust'|'simple'} [opts.fetchMode='robust']
 * @param {'notify'|'errorRef'|'none'} [opts.errorHandling='notify']
 * @param {string} [opts.errorFallbackMessage='Request failed']
 * @param {object|null} [opts.exec] - 触发配置,仅 funcName 非 null 时生效
 * @param {'manual'|'auto'} opts.exec.mode
 * @param {string[]} opts.exec.watchDeps - wire 上游变量名
 * @param {boolean} [opts.exec.immediateOnAuto=true]
 * @param {boolean} [opts.exec.appendManualCall=true]
 * @param {string} opts.exec.callArgs - 调用实参(BackendCrud:wire 真值;HttpApi:passIn 真值)
 *
 * @returns {{jsCode: string, jsRefLines: string, importStr: string}}
 */
export function buildFetchFunction(opts) {
  const {
    funcName = null,
    method = "POST",
    routePath,
    params = [],
    bodyJsonExpr = null,
    queryParamsExpr = null,
    responseRefs = [],
    loadingRef = null,
    errorRef = null,
    statusRef = null,
    declareRefs = null,
    fetchMode = "robust",
    errorHandling = "notify",
    errorFallbackMessage = "Request failed",
    exec = null,
  } = opts;

  const isBare = funcName == null;
  const bodyIndent = isBare ? 2 : 4;

  // body: optional loading/error pre-toggle → try { fetch+assign } catch { ... } [finally { loading=false }]
  const preStmts = [];
  if (loadingRef && !isBare) preStmts.push(`${" ".repeat(bodyIndent - 2)}${loadingRef}.value = true`);
  else if (loadingRef && isBare) preStmts.push(`${loadingRef}.value = true`);
  if (errorRef && errorHandling === "errorRef" && !isBare) {
    preStmts.push(`${" ".repeat(bodyIndent - 2)}${errorRef}.value = null`);
  }

  const tryHead = `${" ".repeat(bodyIndent - 2)}try {`;
  const fetchTry =
    fetchMode === "simple"
      ? buildSimpleFetchTry({
          method,
          routePath,
          queryParamsExpr,
          bodyJsonExpr,
          responseRefs,
          statusRef,
          bodyIndent,
        })
      : buildRobustFetchTry({
          method,
          routePath,
          queryParamsExpr,
          bodyJsonExpr,
          responseRefs,
          errorFallbackMessage,
          bodyIndent,
        });
  const catchBlock = buildCatchBlock({
    errorHandling,
    errorRef,
    errorFallbackMessage,
    bodyIndent: bodyIndent - 2,
  });
  let finallyBlock = "";
  if (loadingRef) {
    const pad = " ".repeat(bodyIndent - 2);
    finallyBlock = `\n${pad}} finally {\n${pad}  ${loadingRef}.value = false`;
  }
  const tryBlock = [tryHead, fetchTry, catchBlock + finallyBlock, `${" ".repeat(bodyIndent - 2)}}`].join("\n");

  const body = [preStmts.join("\n"), tryBlock].filter(Boolean).join("\n");

  // jsCode:bare 直接是 body;wrapped 包成 const funcName = async (...) => { body }
  let jsCode;
  if (isBare) {
    jsCode = body;
  } else {
    const sig = params.join(", ");
    jsCode = `const ${funcName} = async (${sig}) => {\n${body}\n}`;
  }

  // exec trigger code(仅 wrapped 模式)
  const extraImports = [];
  if (!isBare && exec) {
    const isAuto = exec.mode === "auto";
    const watchDeps = Array.isArray(exec.watchDeps) ? exec.watchDeps : [];
    const callArgs = exec.callArgs || "";
    if (watchDeps.length > 0) {
      const depGetters = watchDeps.map((d) => `() => ${d}`).join(", ");
      const watchOpts = isAuto && exec.immediateOnAuto !== false ? ", { immediate: true }" : "";
      jsCode += `\nwatch([${depGetters}], async () => {\n  await ${funcName}(${callArgs})\n}${watchOpts})`;
      extraImports.push("watch");
    } else if (isAuto) {
      jsCode += `\nonMounted(async () => {\n  await ${funcName}(${callArgs})\n})`;
      extraImports.push("onMounted");
    }
    if (!isAuto && exec.appendManualCall !== false) {
      jsCode += `\nawait ${funcName}(${callArgs})`;
    }
  }

  // jsRefLines
  let refDecls;
  if (Array.isArray(declareRefs)) {
    refDecls = declareRefs;
  } else {
    refDecls = [];
    for (const r of responseRefs) {
      if (r.refName) refDecls.push({ refName: r.refName, initial: r.initial ?? "null" });
    }
    if (loadingRef) refDecls.push({ refName: loadingRef, initial: "false" });
    if (errorRef) refDecls.push({ refName: errorRef, initial: "null" });
    if (statusRef) refDecls.push({ refName: statusRef, initial: "0" });
  }
  const jsRefLines = refDecls
    .map((r) => `const ${r.refName} = ref(${r.initial ?? "null"})`)
    .join("\n");

  const importStr = `import { ref${extraImports.length ? ", " + extraImports.join(", ") : ""} } from "vue"`;

  return { jsCode, jsRefLines, importStr };
}

/**
 * 路由路径 → 安全标识符函数名
 * /api/user/login → apiUserLogin
 * 数字开头加 'api_' 前缀;非法字符替换为 _
 *
 * @param {string} routePath
 * @param {string} fallback - 派生名为空时的兜底(如 `apiCrud_${shortId}`)
 * @returns {string}
 */
export function safeFuncNameFromPath(routePath, fallback = "api_unnamed") {
  let name = String(routePath || "")
    .replace(/^\//, "")
    .split("/")
    .map((part, idx) =>
      idx === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1),
    )
    .join("")
    .replace(/[^a-zA-Z0-9_$]/g, "_");
  if (/^[0-9]/.test(name)) name = `api_${name}`;
  return name || fallback;
}
