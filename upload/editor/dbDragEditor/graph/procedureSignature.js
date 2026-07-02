/**
 * 存储过程/函数签名解析 —— 纯函数,无副作用、无依赖。
 * 输入取自后端 GET /api/db/procedures 的 arguments(identity args)与 return_type。
 */

// 按顶层逗号切分,忽略括号内逗号(如 numeric(10,2))
export function splitTopLevelCommas(str) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

const ARG_MODES = new Set(["IN", "OUT", "INOUT", "VARIADIC"]);

// 解析单个参数段 → { name, type }
function parseArg(seg, index) {
  let tokens = seg.split(/\s+/);
  // 剥离前导模式词(IN/OUT/INOUT/VARIADIC)
  if (tokens.length > 1 && ARG_MODES.has(tokens[0].toUpperCase())) {
    tokens = tokens.slice(1);
  }
  // `name type...`:首词为名,其余拼为类型;单 token 视为无名参数
  if (tokens.length >= 2) {
    return { name: tokens[0], type: tokens.slice(1).join(" ") };
  }
  return { name: `arg${index + 1}`, type: tokens[0] || "any" };
}

/**
 * @param {string} argsStr  identity arguments,如 "a integer, b text"
 * @param {string} returnsStr  返回类型,如 "numeric" / "void";procedure 为空
 * @returns {{ inputs: {name:string,type:string}[], output: {type:string}|null }}
 */
export function parseProcedureSignature(argsStr, returnsStr) {
  const inputs = (argsStr || "").trim()
    ? splitTopLevelCommas(argsStr).map((seg, i) => parseArg(seg, i))
    : [];

  const ret = (returnsStr || "").trim();
  const output = ret && ret.toLowerCase() !== "void" ? { type: ret } : null;

  return { inputs, output };
}
