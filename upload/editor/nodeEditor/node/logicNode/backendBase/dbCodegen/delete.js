/**
 * DELETE 代码生成
 *
 * 返回 {code, multiLine}:级联 DELETE 自动多行(ids 收集 + 逐层 .whereIn(...).del())。
 *
 * 字面 1:1 复刻自 TableNode._generateDelete。
 *
 * ctx 需:ref / resolveNodeName / getShortId / buildRelTree(经 joins.js) /
 *         buildWhere(经 where.js)/ parseReturningFields
 */

import { buildRelTree } from "./joins.js";
import { buildWhere } from "./where.js";
import { parseReturningFields } from "./returning.js";

export function buildDelete(props, tableName, ctx) {
  const ref = ctx.ref;
  const relNodes = buildRelTree(tableName, props, ctx);
  const validNodes = relNodes.filter((n) => n.joinCondition);
  const retFieldNames = parseReturningFields(props, ctx).mainFieldNames;
  const retStr =
    retFieldNames.length > 0
      ? retFieldNames.map((f) => `'${f}'`).join(", ")
      : null;

  if (validNodes.length === 0) {
    let code = `await ${ref}('${tableName}')`;
    code += buildWhere(props, ctx);
    code += `\n  .del()`;
    if (retStr) code += `\n  .returning([${retStr}])`;
    return { code, multiLine: false };
  }

  const mainSafeName = `${tableName.replace(/[^a-zA-Z0-9_]/g, "_")}_${ctx.getShortId()}`;
  const whereCode = buildWhere(props, ctx);
  const rootNodes = validNodes.filter((n) => !n.parentLinkId);
  const mainPkField = rootNodes[0]?.joinCondition?.sourceField || "id";

  const lines = [];
  lines.push(
    `const ${mainSafeName}_ids = (await ${ref}('${tableName}').select('${mainPkField}')${whereCode}).map(r => r.${mainPkField})`,
  );

  for (const node of validNodes) {
    const fkField = node.joinCondition.targetField;
    const parentIdsVar = `${node.parentSafeName}_ids`;
    const childPkField =
      node.children.find((c) => c.joinCondition)?.joinCondition?.sourceField ||
      "id";
    lines.push(
      `const ${node.safeName}_ids = (await ${ref}('${node.tableName}').select('${childPkField}').whereIn('${fkField}', ${parentIdsVar})).map(r => r.${childPkField})`,
    );
  }

  const sortedDel = [...validNodes].sort((a, b) => b.depth - a.depth);
  for (const node of sortedDel) {
    const fkField = node.joinCondition.targetField;
    const parentIdsVar = `${node.parentSafeName}_ids`;
    lines.push(
      `await ${ref}('${node.tableName}').whereIn('${fkField}', ${parentIdsVar}).del()`,
    );
  }

  let mainDel = `await ${ref}('${tableName}').whereIn('${mainPkField}', ${mainSafeName}_ids).del()`;
  if (retStr) mainDel += `\n  .returning([${retStr}])`;
  lines.push(`const ${mainSafeName}_result = ${mainDel}`);

  return { code: lines.join("\n"), multiLine: true };
}
