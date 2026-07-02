/**
 * dbCodegen — 纯 SQL/knex 代码生成模块
 *
 * 设计目标:把 TableNode/BackendCrudNode 的 _generate* 方法搬到独立纯模块,
 * 让 SQL/knex 代码生成脱离 LiteGraph(`this.inputs/outputs/getInputData`)与
 * Pinia(`useProjectStore`)耦合,从而:
 *   1. 编辑器外可被项目运行时直接调用(传 plain config + 注入 ctx)
 *   2. 单测易写(纯函数,字符串进字符串出)
 *   3. 与节点适配层职责分离(节点只负责 slot/properties 编排,纯库只负责字符串拼装)
 *
 * ── ctx 协议 ────────────────────────────────────────────────────────────────
 *
 * 由节点适配层在 onExecute 头部一次性构造,作为第二个参数传入纯模块。
 * 字段:
 *   ref: 'knex' | 'trx'                            事务模式下传 'trx',否则 'knex'
 *   resolveNodeName(nodeId): string | null         dbTree 查名(代替 _resolveNodeName)
 *   hasUniqueConstraint(tableId, ids): boolean     UPSERT/相关写入唯一约束判定
 *   getSlotValue(slotId): any                      读 slot 上游 wire 数据(已含 connected 守卫)
 *   findInputSlot(name): number                    Slot index 查找
 *   isInputConnected(idx): boolean                 Slot 连线状态
 *   getInputData(idx): any                         Slot 上游数据(label 名或运行时值,按 valueMode)
 *
 * 节点适配层提供 `_buildCodegenCtx()` 一次性产出 ctx,把 LiteGraph this 端口包成 plain 函数。
 *
 * ── 阶段进展 ────────────────────────────────────────────────────────────────
 * Phase 3.A:骨架 + 6 个低耦合纯函数(orderBy/lock/limit/offset/cte/aggregateFilter/havingLeafLine)
 * Phase 3.B:where + having 主体
 * Phase 3.C:collectEnabledFields / parseReturningFields / buildRelTree / buildRelatedJoins
 * Phase 3.D:generateSelect/Insert/Update/Upsert/Delete + Batch(SELECT + 5 大写操作)
 * Phase 3.E:RelatedInserts/Upserts/Updates + DerivedTable
 * Phase 3.F:onExecute 全切 + 删 24 个薄壳;纯库内部直 import(insert/update/upsert → related)
 *
 * 适配层(tableNode.js)只剩 _buildCodegenCtx 桥 + 3 个 LiteGraph 端口透传方法
 * (_findJoinCondition / _getBatchInputVar / _getRelNodeValue)。
 */

export { buildOrderByLine, buildLockClause, buildLimitOffset } from "./orderLimitLock.js";
export { buildCteChain } from "./cte.js";
export { buildAggregateFilter } from "./aggregates.js";
export { buildHaving, buildHavingInner, buildHavingLeafLine } from "./having.js";
export { buildWhere, buildWhereInner } from "./where.js";
export { buildRelTree, buildRelatedJoins } from "./joins.js";
export { collectEnabledFields, parseReturningFields } from "./returning.js";
export { buildSelect, buildSelectCount } from "./select.js";
export { buildInsert, buildBatchInsert } from "./insert.js";
export { buildUpdate, buildBatchUpdate } from "./update.js";
export { buildUpsert, buildUpsertOnConflict, buildUpsertTransaction } from "./upsert.js";
export { buildDelete } from "./delete.js";
export { buildRelatedInserts, buildRelatedUpserts, buildRelatedUpdates } from "./related.js";
export { buildDerivedTable } from "./derivedTable.js";
