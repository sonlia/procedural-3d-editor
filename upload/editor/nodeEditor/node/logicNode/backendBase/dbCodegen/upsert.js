/**
 * UPSERT 代码生成 — 含 ON CONFLICT 路径 + 事务路径
 *
 * buildUpsert 是主入口,返回 {code, multiLine}。
 * 内部根据 hasUniqueConstraint(ctx)与可 merge 字段判定:
 *   - 有约束 + 有 merge 字段 → ON CONFLICT(原子,最优)
 *   - 否则 → 事务策略(先查后改)
 *
 * conflictAction='ignore' 走 onConflict().ignore() 路径(无 returning,
 * hasRelated 模式仍要 returning 拿 id,改 merge(conflict 字段) 做空 update)。
 *
 * 字面 1:1 复刻自 TableNode._generateUpsert / _generateUpsertOnConflict /
 * _generateUpsertTransaction。
 *
 * ctx 需:ref / resolveNodeName / getShortId / hasUniqueConstraint /
 *         collectEnabledFields(经 returning.js) / parseReturningFields +
 *         buildRelatedUpserts 间接依赖的 getRelNodeValue / findJoinCondition。
 */

import { collectEnabledFields, parseReturningFields } from "./returning.js";
import { buildRelatedUpserts } from "./related.js";

export function buildUpsert(props, tableName, ctx) {
  const ref = ctx.ref;
  const insertFields = collectEnabledFields(props, ctx);

  const fieldsStr = Object.entries(insertFields)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  const conflictFieldNames = (props.conflictFields || [])
    .map(id => ctx.resolveNodeName(id))
    .filter(Boolean);

  if (conflictFieldNames.length === 0) {
    return { code: `// UPSERT: 请选择冲突字段`, multiLine: false };
  }

  const safeName = `${tableName.replace(/[^a-zA-Z0-9_]/g, "_")}_${ctx.getShortId()}`;

  // 关联表级联:upsert 节点的子表也走"按 FK 查 + UPDATE/INSERT"幂等语义,
  // 不论主表是 UPDATE 命中还是 INSERT 新建,子表结果一致。
  const relatedLines = buildRelatedUpserts(props, tableName, ctx);
  const hasRelated = relatedLines.length > 0;

  const mergeFieldNames = Object.keys(insertFields)
    .filter(name => !conflictFieldNames.includes(name));

  // returningFields: Panel 用户勾选(`source::fieldId` 数组),UPSERT 只取主表字段;
  // 默认 ['id'](外层 _id 推导 + 级联 FK 依赖);
  // hasRelated 强制并入 'id',避免用户只勾业务字段导致级联拿不到主表 id。
  const retFieldNamesRaw = parseReturningFields(props, ctx).mainFieldNames;
  const retFieldNames = retFieldNamesRaw.length === 0
    ? ["id"]
    : (hasRelated && !retFieldNamesRaw.includes("id")
      ? ["id", ...retFieldNamesRaw]
      : retFieldNamesRaw);
  const returningArg = `[${retFieldNames.map((f) => `'${f}'`).join(", ")}]`;

  // 自动决定策略:
  // 1) 有唯一约束 + 有可 merge 字段 → ON CONFLICT(DB 原子保证,最优)
  // 2) 无约束 或 全字段都是冲突字段(无 merge 列,只能 .ignore() 拿不到 returning) → 事务策略
  const hasConstraint = ctx.hasUniqueConstraint(
    props.tableId,
    props.conflictFields || []
  );
  const canUseOnConflict = hasConstraint && mergeFieldNames.length > 0;

  if (canUseOnConflict) {
    // ON CONFLICT 路径:hasRelated 时多行(自带 const ${safeName}_result),
    // 否则单行(由 onExecute 包 const varName)。
    return {
      code: buildUpsertOnConflict(
        props, ref, tableName, fieldsStr, insertFields, conflictFieldNames,
        mergeFieldNames, hasRelated, safeName, relatedLines, returningArg
      ),
      multiLine: hasRelated,
    };
  }

  // 事务路径:两个分支都自带 const ${safeName}_result,统一多行。
  return {
    code: buildUpsertTransaction(
      ref, tableName, fieldsStr, insertFields, conflictFieldNames,
      hasRelated, safeName, relatedLines, returningArg
    ),
    multiLine: true,
  };
}

// ON CONFLICT 策略（冲突字段在 DB 端有唯一约束/PK 且存在非冲突字段可 merge）
// P0-5: 支持 conflictAction='ignore' 走 .onConflict().ignore() 路径
// returningArg 由调用方根据 props.returningFields 解析(默认 ['id'],hasRelated 强制含 id)
export function buildUpsertOnConflict(props, ref, tableName, fieldsStr, insertFields, conflictFieldNames, mergeFieldNames, hasRelated, safeName, relatedLines, returningArg) {
  const conflictStr = conflictFieldNames.map(f => `'${f}'`).join(", ");
  const mergeStr = mergeFieldNames.map(f => `'${f}'`).join(", ");

  // P0-5: ignore 路径(不 merge 现有行,冲突直接跳过)
  const action = props.conflictAction || "merge";
  const isIgnore = action === "ignore";

  if (isIgnore) {
    // .onConflict().ignore() 不支持 returning;hasRelated 模式仍要用 returning 拿 id,改 merge(conflict 字段本身) 做空 update
    if (!hasRelated) {
      return `await ${ref}('${tableName}')\n  .insert({ ${fieldsStr} })\n  .onConflict([${conflictStr}])\n  .ignore()`;
    }
    let code = `const ${safeName}_result = await ${ref}('${tableName}')\n  .insert({ ${fieldsStr} })\n  .onConflict([${conflictStr}])\n  .merge([${conflictStr}])\n  .returning(${returningArg})`;
    code += `\nconst ${safeName}_id = ${safeName}_result[0]?.id`;
    for (const line of relatedLines) code += `\n${line}`;
    return code;
  }

  if (!hasRelated) {
    return `await ${ref}('${tableName}')\n  .insert({ ${fieldsStr} })\n  .onConflict([${conflictStr}])\n  .merge([${mergeStr}])\n  .returning(${returningArg})`;
  }

  // hasRelated: returning 拿 id 后级联子表 upsert
  let code = `const ${safeName}_result = await ${ref}('${tableName}')\n  .insert({ ${fieldsStr} })\n  .onConflict([${conflictStr}])\n  .merge([${mergeStr}])\n  .returning(${returningArg})`;
  code += `\nconst ${safeName}_id = ${safeName}_result[0]?.id`;
  for (const line of relatedLines) {
    code += `\n${line}`;
  }
  return code;
}

// 事务策略（无唯一约束 或 全字段都是冲突字段时,改走"先查后改"路径）
// 两个分支都自带 `const ${safeName}_result = ...`,形态对齐 ON CONFLICT 路径(数组 [{...}])
// - hasRelated=false: 整段包成 const ${safeName}_result = await ref.transaction(...)
//                     内部 returning/select 列 = returningArg
// - hasRelated=true:  先 SELECT(列 = returningArg) 拿主表行 → 存在则 UPDATE(returning) 或回填 _existing
//                     不存在则 INSERT(returning) → ${safeName}_id 从 _result[0]?.id 推导
// returningArg 由调用方根据 props.returningFields 解析;hasRelated=true 时强制含 id
export function buildUpsertTransaction(ref, tableName, fieldsStr, insertFields, conflictFieldNames, hasRelated, safeName, relatedLines, returningArg) {
  const whereEntries = conflictFieldNames.map(f => {
    const val = insertFields[f];
    return val ? `'${f}', ${val}` : null;
  }).filter(Boolean);

  const updateFields = Object.entries(insertFields)
    .filter(([name]) => !conflictFieldNames.includes(name));
  const updateStr = updateFields.map(([k, v]) => `${k}: ${v}`).join(", ");

  const whereCode = whereEntries.map(w => `.where(${w})`).join("");

  if (hasRelated) {
    // _existing 用 returningArg 列;UPDATE 命中分支用 returning 拿新值,空 update 字段时回填 _existing。
    let code = `const _existing = await ${ref}('${tableName}')${whereCode}.select(${returningArg})\n`;
    code += `let ${safeName}_result\n`;
    code += `let ${safeName}_id\n`;
    code += `if (_existing.length > 0) {\n`;
    code += `  ${safeName}_id = _existing[0].id\n`;
    if (updateStr) {
      code += `  ${safeName}_result = await ${ref}('${tableName}')${whereCode}.update({ ${updateStr} }).returning(${returningArg})\n`;
    } else {
      code += `  ${safeName}_result = _existing\n`;
    }
    code += `} else {\n`;
    code += `  ${safeName}_result = await ${ref}('${tableName}').insert({ ${fieldsStr} }).returning(${returningArg})\n`;
    code += `  ${safeName}_id = ${safeName}_result[0]?.id\n`;
    code += `}`;
    for (const line of relatedLines) {
      code += `\n${line}`;
    }
    return code;
  }

  // 单条 upsert: 内层独立事务防止 UPDATE/INSERT 之间被并发请求插入同 key;
  // 外层包 const ${safeName}_result = await ${ref}.transaction(...),让 onExecute 拿到 result 变量。
  let code = `const ${safeName}_result = await ${ref}.transaction(async trx => {\n`;
  code += `  const updated = await trx('${tableName}')${whereCode}\n`;
  code += `    .update({ ${updateStr || fieldsStr} })\n`;
  code += `  if (updated === 0) {\n`;
  code += `    return await trx('${tableName}').insert({ ${fieldsStr} }).returning(${returningArg})\n`;
  code += `  }\n`;
  code += `  return await trx('${tableName}')${whereCode}.select(${returningArg})\n`;
  code += `})`;
  return code;
}
