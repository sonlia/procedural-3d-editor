/**
 * 派生表(FROM subquery)代码生成
 *
 * 把上游 table output 当派生表(两种来源):
 *  - tableNode builder 模式输出的未 await knex query builder 字符串 → (sub).as('sub')
 *  - rawSQL subquery 模式输出的 knex.raw(...) 片段(Raw 无 .as())→ knex.raw('(?) as sub', [frag])
 * 生成 `await knex.select(...).from(<派生表>).where(...).orderBy(...).limit(...)`,
 * 一次 SQL round-trip 完成嵌套查询(SQL 标准的 FROM 派生表语义,非 WHERE IN)。
 *
 * 仅 SELECT 两种 result mode(rows / count)进入此分支;
 * UPDATE/DELETE/INSERT/UPSERT 不入(派生表是只读的)。
 *
 * 字面 1:1 复刻自 TableNode._generateDerivedTableCode。
 *
 * ctx 需:ref / resolveNodeName + buildWhere/buildOrderByLine/buildLimitOffset 间接依赖
 */

import { buildWhere } from "./where.js";
import { buildOrderByLine, buildLimitOffset } from "./orderLimitLock.js";

export function buildDerivedTable(props, subqueryCode, varName, ctx) {
  if (props.crudType !== "select") {
    return `// tableNameSlot 仅支持 SELECT,当前 crudType=${props.crudType}`;
  }

  const ref = ctx.ref;
  const mode = props.result?.mode || "rows";

  // 派生表的列名 = 子查询输出列名;通常下游 props.fields(基于自己 tableId)的字段
  // 与子查询输出列同名(因为大多场景是同一张表),所以直接复用 fieldId→name 解析。
  const enabledFieldNames = Object.entries(props.fields || {})
    .filter(([, c]) => c.enabled)
    .map(([fieldId]) => ctx.resolveNodeName(fieldId))
    .filter(Boolean);

  let code = `await ${ref}`;
  if (mode === "count") {
    // count(*) 不加 .select
  } else if (enabledFieldNames.length > 0) {
    code += `\n  .select([${enabledFieldNames.map((f) => `'${f}'`).join(", ")}])`;
  }
  // 否则默认 SELECT *(派生表全列)

  // FROM 派生表别名(子查询片段不自带别名,在此包):
  //  - builder 字符串:QueryBuilder 有 .as(),直接 (sub).as('sub')
  //  - knex.raw(...) 片段:Raw 无 .as(),把片段作绑定传入 knex.raw('(?) as sub', [frag]),
  //    knex 会把 Raw 绑定内联成 SQL 并合并其 bindings(括号 + as 别名在外层 raw 里补)
  const isRawFragment = /^\s*(?:knex|trx)\.raw\b/.test(subqueryCode);
  const fromArg = isRawFragment
    ? `${ref}.raw('(?) as sub', [${subqueryCode}])`
    : `(${subqueryCode}).as('sub')`;
  code += `\n  .from(${fromArg})`;

  // WHERE — 派生表列名无需前缀
  code += buildWhere(props, ctx);

  // ORDER BY (P0-7: nulls first/last)
  for (const ob of props.orderBy || []) {
    const obField = ob.fieldId ? ctx.resolveNodeName(ob.fieldId) : ob.field;
    if (obField) {
      code += buildOrderByLine(obField, ob);
    }
  }

  // DISTINCT
  if (props.distinct?.enabled) {
    code += `\n  .distinct()`;
  }

  let finalCode;
  if (mode === "count") {
    code += `\n  .count('* as total')`;
    code += `\n  .first()`;
    finalCode = `const ${varName} = Number((${code})?.total ?? 0)`;
  } else {
    // rows
    code += buildLimitOffset(props, ctx);
    finalCode = `const ${varName} = ${code}`;
  }

  if (props.notifyOnSuccess) {
    finalCode += `\nnotifyClient('success', '派生表查询成功')`;
  }

  return finalCode;
}
