/**
 * 存储过程/函数/定时任务的 SQL 框架拼装与主体拆解 —— 纯函数,无副作用、无依赖。
 *
 * 设计:编辑器只写主体逻辑,框架(CREATE OR REPLACE … AS $$ BEGIN/END $$ / DO 匿名块)
 * 由「节点名 + 语言配置」在保存时自动生成;回读时从库定义里提取主体填回编辑器。
 * 与 procedureSignature.js 同级、同风格(纯函数)。
 */

// 仅 plpgsql 需要 BEGIN/END 包裹;sql 等其它语言裸放 body
function isPlpgsql(language) {
  return (language || "").trim().toLowerCase() === "plpgsql";
}

// body 顶层是否已是一个完整块(DECLARE / BEGIN / <<label>> 开头)—— 是则不再补 BEGIN/END
function startsWithBlock(body) {
  return /^\s*(?:<<\s*\w+\s*>>\s*)?(?:DECLARE|BEGIN)\b/i.test(body || "");
}

// 选一个不与 body 冲突的 dollar-quote tag,避免主体内出现同名标签提前闭合
function pickDollarTag(body, preferred) {
  const text = body || "";
  for (const tag of [preferred, "$body$", "$vsbody$"]) {
    if (tag && !text.includes(tag)) return tag;
  }
  let i = 1;
  while (text.includes(`$vsbody${i}$`)) i += 1;
  return `$vsbody${i}$`;
}

/**
 * 把主体逻辑组装成完整的 CREATE OR REPLACE DDL。
 * @param {object} cfg
 * @param {'PROCEDURE'|'FUNCTION'|string} cfg.kind
 * @param {string} cfg.name        对象名(节点名)
 * @param {string} [cfg.args]      参数串,如 `"a" integer, "b" text`
 * @param {string} [cfg.returnType] 返回类型(仅 FUNCTION),空则 void
 * @param {string} [cfg.language]  plpgsql / sql / …
 * @param {string} [cfg.body]      主体逻辑(BEGIN/END 之间的内容)
 * @returns {string}
 */
export function assembleRoutineDefinition({ kind, name, args = "", returnType = "", language = "plpgsql", body = "" }) {
  const routineKind = String(kind || "FUNCTION").toUpperCase() === "PROCEDURE" ? "PROCEDURE" : "FUNCTION";
  const escapedName = String(name || "").replaceAll('"', '""');
  const lang = (language || "plpgsql").trim();
  const trimmedBody = (body || "").trim();

  // plpgsql 且主体不是整块 → 包 BEGIN/END;其它语言或已是整块 → 裸放
  const wrapped =
    isPlpgsql(lang) && !startsWithBlock(trimmedBody) ? `BEGIN\n${trimmedBody}\nEND;` : trimmedBody;

  const tag = pickDollarTag(wrapped, routineKind === "PROCEDURE" ? "$procedure$" : "$function$");
  const returnsLine =
    routineKind === "FUNCTION" ? `\nRETURNS ${(returnType || "void").trim() || "void"}` : "";

  return `CREATE OR REPLACE ${routineKind} "${escapedName}"(${args})${returnsLine}\nLANGUAGE ${lang}\nAS ${tag}\n${wrapped}\n${tag}`;
}

/**
 * 从库回读的完整定义里提取主体,填回编辑器。
 * plpgsql 规整块 → 剥最外层 BEGIN/END;带顶层 DECLARE(外部已有过程)或抓取失败 → 原样返回。
 * @param {object} cfg
 * @param {string} cfg.definition  pg_get_functiondef 的完整定义
 * @param {string} [cfg.language]
 * @returns {string}
 */
export function extractRoutineBody({ definition, language = "plpgsql" }) {
  const def = (definition || "").trim();
  if (!def) return "";

  // 抓 AS $tag$ … $tag$ 的 dollar-quoted 主体(容错任意 tag,如 PG 回读的 $function$)
  const matched = def.match(/\bAS\s+(\$[A-Za-z0-9_]*\$)([\s\S]*?)\1/i);
  const routineBody = (matched ? matched[2] : def).trim();

  if (!isPlpgsql(language)) return routineBody;

  // 顶层 DECLARE → 保留整块(配合 assemble 的 startsWithBlock 不重复包,往返不丢、不双包)
  if (/^\s*(?:<<\s*\w+\s*>>\s*)?DECLARE\b/i.test(routineBody)) return routineBody;

  // 规整 [<<label>>] BEGIN … END[ label][;] → 剥最外层,返回块内语句($ 锚 + 贪婪回溯保住内层 END IF 等)
  const block = routineBody.match(/^\s*(?:<<\s*\w+\s*>>\s*)?BEGIN\b([\s\S]*)\bEND\s*\w*\s*;?\s*$/i);
  return block ? block[1].trim() : routineBody;
}

/**
 * 定时任务:把主体包成 plpgsql 匿名块(pg_cron command / 立即执行用)。
 * @param {string} body
 * @returns {string}
 */
export function wrapAnonymousBlock(body) {
  const trimmedBody = (body || "").trim();
  const inner = startsWithBlock(trimmedBody) ? trimmedBody : `BEGIN\n${trimmedBody}\nEND;`;
  const tag = pickDollarTag(inner, "$do$");
  return `DO ${tag}\n${inner}\n${tag};`;
}

/**
 * 语言自适应的默认脚手架主体(新建节点用)。
 * @param {object} cfg
 * @param {'PROCEDURE'|'FUNCTION'|string} cfg.kind
 * @param {string} [cfg.language]
 * @returns {string}
 */
export function defaultRoutineBody({ kind, language = "plpgsql" }) {
  const isProc = String(kind || "FUNCTION").toUpperCase() === "PROCEDURE";
  if (!isPlpgsql(language)) return isProc ? "-- 在此编写存储过程逻辑" : "SELECT 1;";
  return isProc ? "-- 在此编写存储过程逻辑" : "-- 在此编写函数逻辑\n-- RETURN ...;";
}
