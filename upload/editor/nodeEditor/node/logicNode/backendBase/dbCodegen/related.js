/**
 * 关联表级联 INSERT / UPSERT / UPDATE 代码生成
 *
 * 三个 build* 函数字面 1:1 复刻自 TableNode._generateRelatedInserts /
 * _generateRelatedUpserts / _generateRelatedUpdates。
 *
 * 与 INSERT/UPSERT/UPDATE 主流程的协作:
 *   - buildInsert  → ctx.generateRelatedInserts → buildRelatedInserts
 *   - buildUpsert  → ctx.generateRelatedUpserts → buildRelatedUpserts
 *   - buildUpdate  → ctx.generateRelatedUpdates → buildRelatedUpdates
 * 调用方仍走 ctx 桥(由 tableNode 适配层提供),纯库内部直接调本文件函数。
 *
 * ctx 需:ref / resolveNodeName / getShortId / findJoinCondition(buildRelTree 用)/
 *         getRelNodeValue(slot 模式 → 上游变量名,static 模式 → 静态值,未连返回 null)
 *
 * buildRelatedInserts 返回 { lines, valVar, relReturnEntries }(对齐主表 INSERT 的响应组装协议)
 * buildRelatedUpserts / buildRelatedUpdates 直接返回 string[]
 */

import { buildRelTree } from "./joins.js";
import { buildWhere } from "./where.js";

export function buildRelatedInserts(props, tableName, ctx, relReturnMap = new Map()) {
  const ref = ctx.ref;
  const relNodes = buildRelTree(tableName, props, ctx);
  if (relNodes.length === 0) {
    return { lines: [], valVar: null, relReturnEntries: [] };
  }

  // 兼容老 returningField.source===linkId 的单字段语义
  const retField = props.returningField || { source: "", fieldId: "" };
  const legacyTargetLinkId =
    retField.source && retField.source !== "main" ? retField.source : null;
  const legacyTargetReturningName =
    legacyTargetLinkId && retField.fieldId
      ? ctx.resolveNodeName(retField.fieldId)
      : null;

  const lines = [];
  let valVar = null;
  const relReturnEntries = [];

  for (const node of relNodes) {
    if (!node.joinCondition) continue;

    const fkField = node.joinCondition.targetField;
    const parentIdVar = `${node.parentSafeName}_id`;
    const insertObj = { [fkField]: parentIdVar };

    if (node.selectedFieldName && node.selectedFieldName !== fkField) {
      const value = ctx.getRelNodeValue(node);
      if (value !== null) {
        insertObj[node.selectedFieldName] = value;
      }
    }

    const fieldsStr = Object.entries(insertObj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    const hasChildren = node.children.some((c) => c.joinCondition);
    const newReturnNames = relReturnMap.get(node.linkId) || [];
    const isLegacyTarget =
      legacyTargetLinkId === node.linkId && !!legacyTargetReturningName;
    const needsResultVar =
      hasChildren || isLegacyTarget || newReturnNames.length > 0;

    if (needsResultVar) {
      const returningSet = new Set(["id"]);
      for (const n of newReturnNames) returningSet.add(n);
      if (isLegacyTarget) returningSet.add(legacyTargetReturningName);
      const returningArg =
        returningSet.size === 1
          ? `'id'`
          : `[${[...returningSet].map((n) => `'${n}'`).join(", ")}]`;
      lines.push(
        `const ${node.safeName}_result = await ${ref}('${node.tableName}').insert({ ${fieldsStr} }).returning(${returningArg})`,
      );
      lines.push(`const ${node.safeName}_id = ${node.safeName}_result[0].id`);

      // 新版多字段:每个字段加入 relReturnEntries,响应键 = alias_field 防主表重名
      if (newReturnNames.length > 0) {
        const cfg = props.relatedFields?.[node.linkId] || {};
        const aliasRaw = (cfg.alias || node.tableName || "rel").trim();
        const alias =
          aliasRaw.replace(/[^a-zA-Z0-9_]/g, "_") || "rel";
        for (const fieldName of newReturnNames) {
          relReturnEntries.push({
            responseKey: `${alias}_${fieldName}`,
            sourceExpr: `${node.safeName}_result[0]?.['${fieldName}']`,
          });
        }
      }

      if (isLegacyTarget) {
        lines.push(
          `const ${node.safeName}_val = ${node.safeName}_result[0]?.['${legacyTargetReturningName}'] ?? null`,
        );
        valVar = `${node.safeName}_val`;
      }
    } else {
      lines.push(
        `await ${ref}('${node.tableName}').insert({ ${fieldsStr} })`,
      );
    }
  }

  return { lines, valVar, relReturnEntries };
}

export function buildRelatedUpserts(props, tableName, ctx) {
  const ref = ctx.ref;
  const relNodes = buildRelTree(tableName, props, ctx);
  if (relNodes.length === 0) return [];

  const lines = [];

  for (const node of relNodes) {
    if (!node.joinCondition) continue;

    const fkField = node.joinCondition.targetField;
    const parentIdVar = `${node.parentSafeName}_id`;

    // 业务字段(可选): selectedFieldName 不与 FK 字段冲突,且 value 非空
    const businessFields = {};
    if (node.selectedFieldName && node.selectedFieldName !== fkField) {
      const value = ctx.getRelNodeValue(node);
      if (value !== null) {
        businessFields[node.selectedFieldName] = value;
      }
    }

    const insertObj = { [fkField]: parentIdVar, ...businessFields };
    const insertStr = Object.entries(insertObj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    const updateStr = Object.entries(businessFields)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");

    lines.push(
      `const ${node.safeName}_existing = await ${ref}('${node.tableName}').where('${fkField}', ${parentIdVar}).select('id')`
    );
    lines.push(`let ${node.safeName}_id`);
    lines.push(`if (${node.safeName}_existing.length > 0) {`);
    lines.push(`  ${node.safeName}_id = ${node.safeName}_existing[0].id`);
    if (updateStr) {
      lines.push(
        `  await ${ref}('${node.tableName}').where('${fkField}', ${parentIdVar}).update({ ${updateStr} })`
      );
    }
    lines.push(`} else {`);
    lines.push(
      `  const ${node.safeName}_inserted = await ${ref}('${node.tableName}').insert({ ${insertStr} }).returning('id')`
    );
    lines.push(`  ${node.safeName}_id = ${node.safeName}_inserted[0].id`);
    lines.push(`}`);
  }

  return lines;
}

export function buildRelatedUpdates(props, tableName, ctx) {
  const ref = ctx.ref;
  const relNodes = buildRelTree(tableName, props, ctx);
  if (relNodes.length === 0) return [];

  const validNodes = relNodes.filter((n) => n.joinCondition);
  if (validNodes.length === 0) return [];

  // 至少有一个 RelNode 需要 UPDATE 业务字段才执行
  const hasAnyUpdate = validNodes.some(
    (n) =>
      n.selectedFieldName &&
      n.selectedFieldName !== n.joinCondition.targetField &&
      n.valueMode !== "none"
  );
  if (!hasAnyUpdate) return [];

  const lines = [];
  const mainSafeName = `${tableName.replace(/[^a-zA-Z0-9_]/g, "_")}_${ctx.getShortId()}`;
  const whereCode = buildWhere(props, ctx);

  // 1) 收集主表 ids
  // 主表 PK 字段从根级 RelNode 的 joinCondition.sourceField 推断(它是父表中参与 JOIN 的字段)
  const rootNodes = validNodes.filter((n) => !n.parentLinkId);
  const mainPkField = rootNodes[0]?.joinCondition?.sourceField || "id";
  lines.push(
    `const ${mainSafeName}_ids = (await ${ref}('${tableName}').select('${mainPkField}')${whereCode}).map(r => r.${mainPkField})`
  );

  // 2) 按 depth 升序: 收集各层子表 ids(供下一层 anchor 使用)
  for (const node of validNodes) {
    const hasChildren = node.children.some((c) => c.joinCondition);
    if (!hasChildren) continue;
    const fkField = node.joinCondition.targetField;
    const parentIdsVar = `${node.parentSafeName}_ids`;
    // 子级 PK 字段: 取 children 第一个有效 child 的 joinCondition.sourceField(此 node 的 PK 字段)
    const childPkField =
      node.children.find((c) => c.joinCondition)?.joinCondition?.sourceField || "id";
    lines.push(
      `const ${node.safeName}_ids = (await ${ref}('${node.tableName}').select('${childPkField}').whereIn('${fkField}', ${parentIdsVar})).map(r => r.${childPkField})`
    );
  }

  // 3) 各层关联表 UPDATE
  for (const node of validNodes) {
    if (!node.selectedFieldName) continue;
    const fkField = node.joinCondition.targetField;
    if (node.selectedFieldName === fkField) continue;
    const value = ctx.getRelNodeValue(node);
    if (value === null) continue;

    const parentIdsVar = `${node.parentSafeName}_ids`;
    lines.push(
      `await ${ref}('${node.tableName}').whereIn('${fkField}', ${parentIdsVar}).update({ ${node.selectedFieldName}: ${value} })`
    );
  }

  return lines;
}
