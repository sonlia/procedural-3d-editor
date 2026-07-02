// 解析 PG 函数签名 → { inputs:[{name,type}], outputs:[{name,type}] }
// 入参:pg_get_function_arguments 结果(signatureArgs)+ pg_get_function_result 结果(returnType)

// 括号感知的顶层逗号切分,避免 numeric(10,2) / TABLE(...) 被切断
function splitTopLevel(s) {
  const parts = [];
  let depth = 0;
  let cur = "";
  for (const ch of s) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      parts.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur.trim()) parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// 拆 "name type" —— name 为首 token,type 为其余(可多词,如 double precision)
function splitNameType(token, fallbackName) {
  const t = token.trim();
  const sp = t.indexOf(" ");
  if (sp === -1) return { name: fallbackName, type: t };
  return { name: t.slice(0, sp), type: t.slice(sp + 1).trim() };
}

const ARG_MODES = ["IN", "OUT", "INOUT", "VARIADIC"];

function parseArg(token, idx) {
  let t = token.trim().replace(/\s+default\s+[\s\S]*$/i, "").trim(); // 去掉 DEFAULT ...
  let mode = "IN";
  const sp = t.indexOf(" ");
  if (sp !== -1 && ARG_MODES.includes(t.slice(0, sp).toUpperCase())) {
    mode = t.slice(0, sp).toUpperCase();
    t = t.slice(sp + 1).trim();
  }
  const { name, type } = splitNameType(t, `arg${idx + 1}`);
  return { name, type, mode };
}

export function parseSignature(signatureArgs, returnType) {
  const inputs = [];
  const outputs = [];

  for (const [i, tok] of splitTopLevel(signatureArgs || "").entries()) {
    const a = parseArg(tok, i);
    if (a.mode === "IN" || a.mode === "INOUT" || a.mode === "VARIADIC")
      inputs.push({ name: a.name, type: a.type });
    if (a.mode === "OUT" || a.mode === "INOUT")
      outputs.push({ name: a.name, type: a.type });
  }

  const rt = (returnType || "").trim();
  if (rt && !/^void$/i.test(rt)) {
    const tableMatch = rt.match(/^TABLE\s*\(([\s\S]*)\)$/i);
    if (tableMatch) {
      splitTopLevel(tableMatch[1]).forEach((col, i) => {
        outputs.push(splitNameType(col, `col${i + 1}`));
      });
    } else if (outputs.length === 0) {
      // SETOF x / 标量 x → 单 output(仅当无 OUT 参数时,避免与 OUT 重复)
      outputs.push({ name: "return", type: rt.replace(/^setof\s+/i, "") });
    }
  }

  return { inputs, outputs };
}
