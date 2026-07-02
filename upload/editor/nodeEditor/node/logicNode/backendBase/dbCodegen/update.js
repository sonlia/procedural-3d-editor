/**
 * UPDATE / BatchUpdate 代码生成
 *
 * buildUpdate 返回 {code, multiLine}。
 * buildBatchUpdate 返回纯字符串。
 *
 * 字面 1:1 复刻自 TableNode._generateUpdate / _generateBatchUpdate。
 *
 * ctx 需:ref / resolveNodeName / getShortId / collectEnabledFields(经 returning.js) /
 *         parseReturningFields / getBatchInputVar +
 *         buildRelatedUpdates 间接依赖的 getRelNodeValue / findJoinCondition +
 *         buildWhere 间接依赖的 getSlotValue
 */

import { collectEnabledFields, parseReturningFields } from "./returning.js";
import { buildWhere } from "./where.js";
import { buildRelatedUpdates } from "./related.js";

export function buildUpdate(props, tableName, ctx) {
  const ref = ctx.ref;
  const updateFields = collectEnabledFields(props, ctx);

  // P0-8: 提取 increment/decrement 字段(由 _collectEnabledFields 标记 _incOp 形式)
  // _collectEnabledFields 改造后:对 valueMode='increment' 字段返回特殊形式 {_incOp:'inc', amount: '1'}
  // 实际我们简化为约定:value 形如 "__INC__1" / "__DEC__1" 字面被识别
  const incCalls = [];
  const decCalls = [];
  const setFields = {};
  for (const [k, v] of Object.entries(updateFields)) {
    const sv = String(v ?? "");
    const mInc = sv.match(/^__INC__(.*)$/);
    const mDec = sv.match(/^__DEC__(.*)$/);
    if (mInc) {
      incCalls.push({ field: k, amount: mInc[1] || "1" });
    } else if (mDec) {
      decCalls.push({ field: k, amount: mDec[1] || "1" });
    } else {
      setFields[k] = v;
    }
  }

  const fieldsStr = Object.entries(setFields)
    .map(([k, v]) => `${k}: ${v}`)
    .join(", ");

  let mainCode = `await ${ref}('${tableName}')`;
  mainCode += buildWhere(props, ctx);
  if (fieldsStr) {
    mainCode += `\n  .update({ ${fieldsStr} })`;
  }
  for (const inc of incCalls) {
    mainCode += `\n  .increment('${inc.field}', ${inc.amount})`;
  }
  for (const dec of decCalls) {
    mainCode += `\n  .decrement('${dec.field}', ${dec.amount})`;
  }
  // 防御:整个 UPDATE 没有任何 set/inc/dec(用户配错),仍保留 update 调用避免空链
  if (!fieldsStr && incCalls.length === 0 && decCalls.length === 0) {
    mainCode += `\n  .update({ })`;
  }

  // P0-6: returning 字段(UPDATE 只取主表字段)
  const retFieldNames = parseReturningFields(props, ctx).mainFieldNames;
  if (retFieldNames.length > 0) {
    const retStr = retFieldNames.map((f) => `'${f}'`).join(", ");
    mainCode += `\n  .returning([${retStr}])`;
  }

  // 关联表级联 UPDATE: lines 包含 ids 收集 + 各层 UPDATE,必须 prepend 到主表 UPDATE 之前
  // (ids 在主表 UPDATE 之前收集,否则 WHERE 可能被主表 UPDATE 改变)
  const relatedUpdates = buildRelatedUpdates(props, tableName, ctx);
  if (relatedUpdates.length > 0) {
    // 主表 update 在级联多行模式下要包成 const ${safeName}_${shortId}_result,
    // 跟 TableNode.onExecute 中 _isMultiLineCode 路径的 resultVar 命名对齐,
    // 否则下游 route wrapper 的 `return ${resultVar}` 会引用未声明变量(ReferenceError)。
    const safeName = `${tableName.replace(/[^a-zA-Z0-9_]/g, "_")}_${ctx.getShortId()}`;
    return {
      code: `${relatedUpdates.join("\n")}\nconst ${safeName}_result = ${mainCode}`,
      multiLine: true,
    };
  }
  return { code: mainCode, multiLine: false };
}

export function buildBatchUpdate(props, tableName, ctx) {
  const ref = ctx.ref;
  const mapping = props.fieldMapping || {};

  // 批量更新需要 WHERE 条件来定位记录
  // 使用 WHERE 中的第一个条件字段作为 key
  const whereField = props.where[0]?.fieldId
    ? ctx.resolveNodeName(props.where[0].fieldId)
    : null;

  // 找到 whereField 对应的映射属性名
  let whereSrcProp = null;
  if (whereField) {
    for (const [srcProp, targetField] of Object.entries(mapping)) {
      if (targetField === whereField) {
        whereSrcProp = srcProp;
        break;
      }
    }
  }

  // 生成不包含 WHERE key 的 SET 映射
  const setCode = Object.entries(mapping)
    .filter(
      ([srcProp, targetField]) =>
        targetField && targetField !== whereField,
    )
    .map(([srcProp, targetField]) => `${targetField}: item.${srcProp}`)
    .join(", ");

  const batchVar = ctx.getBatchInputVar();

  // 根据是否有可定位的 WHERE key 来生成不同的代码
  const whereClause = whereSrcProp
    ? `.where('${whereField}', '=', item.${whereSrcProp})`
    : buildWhere(props, ctx);

  switch (props.batchMode.failStrategy) {
    case "rollback":
      return `for (const item of ${batchVar}) {\n  await ${ref}('${tableName}')${whereClause}\n    .update({ ${setCode} })\n}`;

    case "skip":
      return `const results = { success: [], failed: [] }\nfor (const item of ${batchVar}) {\n  try {\n    await ${ref}('${tableName}')${whereClause}\n      .update({ ${setCode} })\n    results.success.push(item)\n  } catch (error) {\n    results.failed.push({ data: item, error: error.message })\n  }\n}`;

    case "collect":
      return `const results = { success: 0, failed: 0, errors: [] }\nfor (const [index, item] of ${batchVar}.entries()) {\n  try {\n    await ${ref}('${tableName}')${whereClause}\n      .update({ ${setCode} })\n    results.success++\n  } catch (error) {\n    results.failed++\n    results.errors.push({ index, data: item, error: error.message })\n  }\n}`;

    default:
      return `for (const item of ${batchVar}) {\n  await ${ref}('${tableName}')${whereClause}\n    .update({ ${setCode} })\n}`;
  }
}
