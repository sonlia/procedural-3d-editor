/**
 * INSERT / BatchInsert 代码生成
 *
 * buildInsert 返回 {code, multiLine, valVar?}:
 *   - multiLine:_isMultiLineCode 应设的值(级联 / returning 多字段时为 true)
 *   - valVar:_insertValVar 应设的值(用于 onExecute 包路由/响应表达式)
 * buildBatchInsert 返回纯字符串。
 *
 * 字面 1:1 复刻自 TableNode._generateInsert / _generateBatchInsert,字符串字节对齐。
 *
 * ctx 需:ref / resolveNodeName / getShortId /
 *         collectEnabledFields(经 returning.js) / parseReturningFields /
 *         getBatchInputVar +
 *         buildRelatedInserts 间接依赖的 getRelNodeValue / findJoinCondition
 */

import { collectEnabledFields, parseReturningFields } from "./returning.js";
import { buildRelatedInserts } from "./related.js";

export function buildInsert(props, tableName, ctx) {
  const ref = ctx.ref;
  const insertFields = collectEnabledFields(props, ctx);

  const fieldsStr = Object.entries(insertFields)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  // 解析新格式 returningFields(`source::fieldId`):
  //  - mainFieldNames: 主表字段名
  //  - relReturnMap: 关联表 linkId → 字段名[]
  // 旧 props.returningField(单字段对象)兼容路径:仅在新数组完全空时启用,
  //   主要服务于 DatabaseSubgraph 内 TableNode(panel 还没升级)。
  const { mainFieldNames, relReturnMap } = parseReturningFields(props, ctx);
  const retField = props.returningField || { source: "", fieldId: "" };
  const hasNewReturning =
    mainFieldNames.length > 0 || relReturnMap.size > 0;
  const legacyMainName =
    !hasNewReturning && retField.source === "main" && retField.fieldId
      ? ctx.resolveNodeName(retField.fieldId)
      : null;

  const relatedResult = buildRelatedInserts(props, tableName, ctx, relReturnMap);
  const relatedLines = relatedResult?.lines || [];
  const relatedValVar = relatedResult?.valVar || null;
  const relReturnEntries = relatedResult?.relReturnEntries || [];

  const safeName = `${tableName.replace(/[^a-zA-Z0-9_]/g, "_")}_${ctx.getShortId()}`;

  if (relatedLines.length > 0) {
    // 主表 + 级联场景
    const returningSet = new Set(["id"]);
    for (const n of mainFieldNames) returningSet.add(n);
    if (legacyMainName) returningSet.add(legacyMainName);
    const returningArg =
      returningSet.size === 1
        ? `'id'`
        : `[${[...returningSet].map((n) => `'${n}'`).join(", ")}]`;
    let code = `const ${safeName}_result = await ${ref}('${tableName}').insert({ ${fieldsStr} }).returning(${returningArg})`;
    code += `\nconst ${safeName}_id = ${safeName}_result[0].id`;
    code += `\n${relatedLines.join("\n")}`;

    let valVar = null;
    if (hasNewReturning) {
      // 组装平铺响应对象:主表字段直接展开,关联字段加 alias_ 前缀(在 _generateRelatedInserts 里已经算好)
      const responseParts = [];
      for (const name of mainFieldNames) {
        responseParts.push(`${name}: ${safeName}_result[0]?.['${name}']`);
      }
      for (const entry of relReturnEntries) {
        responseParts.push(`${entry.responseKey}: ${entry.sourceExpr}`);
      }
      code += `\nconst ${safeName}_response = { ${responseParts.join(", ")} }`;
      valVar = `${safeName}_response`;
    } else if (legacyMainName) {
      code += `\nconst ${safeName}_main_val = ${safeName}_result[0]?.['${legacyMainName}'] ?? null`;
      valVar = `${safeName}_main_val`;
    } else if (relatedValVar) {
      valVar = relatedValVar;
    }
    return { code, multiLine: true, valVar };
  }

  if (mainFieldNames.length > 0) {
    // 无级联,纯主表多字段:.returning([...]) → 响应单行对象 result[0]
    const retStr = mainFieldNames.map((n) => `'${n}'`).join(", ");
    const code = `const ${safeName}_result = await ${ref}('${tableName}').insert({ ${fieldsStr} }).returning([${retStr}])`;
    return { code, multiLine: true, valVar: `${safeName}_result[0]` };
  }

  if (legacyMainName) {
    // 兼容旧 returningField 单字段:标量响应
    let code = `const ${safeName}_result = await ${ref}('${tableName}').insert({ ${fieldsStr} }).returning(['${legacyMainName}'])`;
    code += `\nconst ${safeName}_val = ${safeName}_result[0]?.['${legacyMainName}'] ?? null`;
    return { code, multiLine: true, valVar: `${safeName}_val` };
  }

  return {
    code: `await ${ref}('${tableName}').insert({ ${fieldsStr} })`,
    multiLine: false,
    valVar: null,
  };
}

export function buildBatchInsert(props, tableName, ctx) {
  const ref = ctx.ref;
  const mapping = props.fieldMapping || {};

  // 生成映射代码
  const mapCode = Object.entries(mapping)
    .filter(([_, targetField]) => targetField) // 过滤掉未映射的
    .map(([srcProp, targetField]) => `${targetField}: item.${srcProp}`)
    .join(", ");

  // 获取 batchInput 变量名
  const batchVar = ctx.getBatchInputVar();

  switch (props.batchMode.failStrategy) {
    case "rollback":
      // P0-14: 用 knex.batchInsert 原生 API 替换原 .insert(mappedData)
      // 注意 batchInsert 不支持 trx 替换链(返回 builder),需要 .transacting(trx) 处理
      return `const mappedData = ${batchVar}.map(item => ({ ${mapCode} }))\nawait knex.batchInsert('${tableName}', mappedData, 1000)${ref === "trx" ? ".transacting(trx)" : ""}`;

    case "skip":
      return `const results = { success: [], failed: [] }\nfor (const item of ${batchVar}) {\n  try {\n    await ${ref}('${tableName}').insert({ ${mapCode} })\n    results.success.push(item)\n  } catch (error) {\n    results.failed.push({ data: item, error: error.message })\n  }\n}`;

    case "collect":
      return `const results = { success: 0, failed: 0, errors: [] }\nfor (const [index, item] of ${batchVar}.entries()) {\n  try {\n    await ${ref}('${tableName}').insert({ ${mapCode} })\n    results.success++\n  } catch (error) {\n    results.failed++\n    results.errors.push({ index, data: item, error: error.message })\n  }\n}`;

    default:
      return `await ${ref}('${tableName}').insert(${batchVar})`;
  }
}
