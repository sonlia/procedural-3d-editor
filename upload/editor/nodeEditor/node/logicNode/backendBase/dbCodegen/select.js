/**
 * SELECT / SELECT COUNT 代码生成
 *
 * 字面 1:1 复刻自 TableNode._generateSelect / _generateSelectCount。
 *
 * ctx 需:ref / resolveNodeName / + buildRelatedJoins / buildWhere / buildHaving 等
 * 内部 helper 依赖的字段(getShortId / findJoinCondition / getSlotValue 等)。
 */

import { buildRelatedJoins } from "./joins.js";
import { buildCteChain } from "./cte.js";
import { buildWhere } from "./where.js";
import { buildOrderByLine, buildLimitOffset, buildLockClause } from "./orderLimitLock.js";
import { buildAggregateFilter } from "./aggregates.js";
import { buildHaving } from "./having.js";

export function buildSelect(props, tableName, ctx) {
  const ref = ctx.ref;

  // JOIN 由 relatedFields 配置驱动
  const { joinCode: relatedJoinCode, selectFields: relatedSelectFields } =
    buildRelatedJoins(props, tableName, ctx);

  const hasAnyJoin = relatedJoinCode.length > 0;

  let code;
  let enabledFields;

  if (hasAnyJoin) {
    // 有 JOIN 时，当前表字段加 t1 前缀和别名
    enabledFields = Object.entries(props.fields)
      .filter(([_, config]) => config.enabled)
      .map(([fieldId, config]) => {
        const fieldName = ctx.resolveNodeName(fieldId);
        if (!fieldName) return null;
        const alias = config.alias || `${tableName}_${fieldName}`;
        return `'t1.${fieldName} as ${alias}'`;
      })
      .filter(Boolean);

    // 加上关联表字段
    enabledFields.push(...relatedSelectFields);

    code = `await ${ref}('${tableName} as t1')`;
    code += buildCteChain(props, ctx);

    if (enabledFields.length > 0) {
      code += `\n  .select([${enabledFields.join(", ")}])`;
    }

    // 关联字段配置驱动的 JOIN
    if (relatedJoinCode) {
      code += `\n  ${relatedJoinCode}`;
    }
  } else {
    // 无 JOIN 时，保持原有逻辑
    enabledFields = Object.entries(props.fields)
      .filter(([_, config]) => config.enabled)
      .map(([fieldId, config]) => {
        const fieldName = ctx.resolveNodeName(fieldId);
        if (!fieldName) return null;
        return `'${fieldName}'`;
      })
      .filter(Boolean);

    code = `await ${ref}('${tableName}')`;
    code += buildCteChain(props, ctx);

    if (enabledFields.length > 0) {
      code += `\n  .select([${enabledFields.join(", ")}])`;
    }
  }

  // WHERE（JOIN 模式下加 t1 前缀避免 ambiguous column）
  code += buildWhere(props, ctx, hasAnyJoin ? "t1" : undefined);

  // ORDER BY
  // ORDER BY (P0-7: nulls first/last)
  for (const ob of props.orderBy) {
    if (ob.fieldId || ob.field) {
      // 兼容旧格式：ob.field（name）和新格式：ob.fieldId（ID）
      const obFieldName = ob.fieldId
        ? ctx.resolveNodeName(ob.fieldId)
        : ob.field; // 旧格式 fallback
      if (obFieldName) {
        const obQualified = hasAnyJoin ? `t1.${obFieldName}` : obFieldName;
        code += buildOrderByLine(obQualified, ob);
      }
    }
  }

  // GROUP BY
  if (
    props.groupBy.enabled &&
    (props.groupBy.fieldIds?.length > 0 || props.groupBy.fields?.length > 0)
  ) {
    const groupByNames = (
      props.groupBy.fieldIds ||
      props.groupBy.fields ||
      []
    )
      .map((id) => ctx.resolveNodeName(id) || id) // 找不到时直接用原值（兼容旧 name）
      .filter(Boolean);
    if (groupByNames.length > 0) {
      const qualifiedGroupBy = hasAnyJoin
        ? groupByNames.map((f) => `'t1.${f}'`)
        : groupByNames.map((f) => `'${f}'`);
      code += `\n  .groupBy([${qualifiedGroupBy.join(", ")}])`;
    }
  }

  // P0-10/P0-11: 聚合函数 — 改用 knex 原生 API,支持 distinct 变体
  // P0-12: 聚合源从顶层 props.aggregates 读取(旧数据已在 onExecute 入口迁移)
  // P2-4: aggregate.filterWhere 支持 `FUNC(field) FILTER (WHERE ...)` (PG)
  const aggregates = Array.isArray(props.aggregates) && props.aggregates.length > 0
    ? props.aggregates
    : (props.groupBy.aggregates || []); // 兜底:迁移逻辑万一未跑

  for (const agg of aggregates) {
    if (!agg.func || (!agg.fieldId && !agg.field)) continue;
    const aggFieldName = agg.fieldId
      ? ctx.resolveNodeName(agg.fieldId)
      : agg.field;
    if (!aggFieldName) continue;

    const qualifiedAggField = hasAnyJoin ? `t1.${aggFieldName}` : aggFieldName;
    const alias = agg.alias || `${agg.func}_${aggFieldName}`;
    const distinct = !!agg.distinct;

    const funcLower = String(agg.func).toLowerCase();

    // P2-4: 聚合 FILTER (WHERE ...) — 仅当用户配置了 filterWhere 时启用
    // FILTER 形式 knex 原生 API 不支持,统一走 raw
    const filterClause = buildAggregateFilter(agg, ctx);
    const hasFilter = !!filterClause;

    if (hasFilter) {
      // 走 raw:`FUNC(DISTINCT? field) FILTER (WHERE cond) as alias`
      const distPrefix = distinct ? "DISTINCT " : "";
      code += `\n  .select(${ref}.raw(\`${agg.func.toUpperCase()}(${distPrefix}${qualifiedAggField}) FILTER (WHERE ${filterClause}) as ${alias}\`))`;
      continue;
    }

    // knex 原生方法支持 object 形式 { alias: 'field' };distinct 变体仅 count/sum/avg
    if (["count", "sum", "avg", "min", "max"].includes(funcLower)) {
      if (distinct && (funcLower === "count" || funcLower === "sum" || funcLower === "avg")) {
        // .countDistinct({ alias: 'field' }) / .sumDistinct(...) / .avgDistinct(...)
        const methodName = funcLower + "Distinct";
        // sumDistinct/avgDistinct 不支持 object 形式,需要 .as(alias) 链
        if (funcLower === "count") {
          code += `\n  .countDistinct({ ${alias}: '${qualifiedAggField}' })`;
        } else {
          code += `\n  .select(${ref}.raw('${funcLower.toUpperCase()}(DISTINCT ??) as ??', ['${qualifiedAggField}', '${alias}']))`;
        }
      } else {
        // 普通聚合用 object 形式
        code += `\n  .${funcLower}({ ${alias}: '${qualifiedAggField}' })`;
      }
    } else {
      // 未知 func 兜底走 raw
      code += `\n  .select(${ref}.raw('${agg.func.toUpperCase()}(${qualifiedAggField}) as ${alias}'))`;
    }
  }

  // HAVING (P0-4: 多条件 + 子操作符,旧单条件向后兼容)
  code += buildHaving(props, ctx);

  // DISTINCT
  if (props.distinct.enabled) {
    const onFields = (props.distinct.onFields || []).filter(Boolean);
    if (onFields.length > 0) {
      // PG only:.distinctOn 接受字段名列表,以 ID 配 Panel 时这里需要解析为名
      // 输入是 fieldId 数组,优先用 _resolveNodeName 解析(失败回退原值)
      const fieldNames = onFields.map((fid) => ctx.resolveNodeName(fid) || fid);
      const fieldsLit = fieldNames.map((n) => `'${n}'`).join(", ");
      code += `\n  .distinctOn(${fieldsLit})`;
    } else {
      code += `\n  .distinct()`;
    }
  }

  // LIMIT / OFFSET
  code += buildLimitOffset(props, ctx);

  // P0-9: 行锁(配合事务)
  code += buildLockClause(props, ctx);

  return code;
}

export function buildSelectCount(props, tableName, ctx) {
  const ref = ctx.ref;
  const { joinCode: relatedJoinCode } = buildRelatedJoins(props, tableName, ctx);
  const hasAnyJoin = relatedJoinCode.length > 0;

  let code = hasAnyJoin
    ? `await ${ref}('${tableName} as t1')`
    : `await ${ref}('${tableName}')`;
  code += buildCteChain(props, ctx);

  if (relatedJoinCode) code += `\n  ${relatedJoinCode}`;
  code += buildWhere(props, ctx, hasAnyJoin ? "t1" : undefined);
  code += `\n  .count('* as total')`;
  code += `\n  .first()`;

  return code;
}
    // joins 显式配置驱动的通用 JOIN
