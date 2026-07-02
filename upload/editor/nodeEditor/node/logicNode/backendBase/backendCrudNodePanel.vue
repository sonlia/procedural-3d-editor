<script setup>
import { computed } from "vue";
import { uid } from "quasar";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";
import { useProjectStore } from "src/stores/projectMange.js";
import { useDbRelations } from "./hooks/useDbRelations.js";

const props = defineModel();
const node = computed(() => props.value);
const properties = computed(() => props.value?.properties || {});
const projectStore = useProjectStore();

const flatDbTree = computed(
  () => projectStore.currentProject?.database?.dbTree || [],
);
const tableIdRef = computed(() => properties.value.tableId || "");
const { getRelationsForTable, availableJoinFields } =
  useDbRelations(tableIdRef);

const dbConnectionList = computed(() =>
  flatDbTree.value
    .filter((n) => n.type === "dbbase")
    .map((n) => ({ label: n.name, value: n.id })),
);

const isSelect = computed(() => properties.value.crudType === "select");
const isInsert = computed(() => properties.value.crudType === "insert");
const isUpdate = computed(() => properties.value.crudType === "update");
const isUpsert = computed(() => properties.value.crudType === "upsert");
const isDelete = computed(() => properties.value.crudType === "delete");
const isWrite = computed(() =>
  ["insert", "update", "upsert"].includes(properties.value.crudType),
);

function getDescendantIds(parentId) {
  const ids = new Set();
  const queue = [parentId];
  while (queue.length > 0) {
    const pid = queue.shift();
    for (const n of flatDbTree.value) {
      if (n.pId === pid && !ids.has(n.id)) {
        ids.add(n.id);
        queue.push(n.id);
      }
    }
  }
  return ids;
}

const tableList = computed(() => {
  const dbId = properties.value.dbConnectionId;
  if (!dbId) return [];
  const descendants = getDescendantIds(dbId);
  return flatDbTree.value
    .filter((n) => n.type === "table" && descendants.has(n.id))
    .map((n) => ({ label: n.name, value: n.id }));
});

const currentTableFields = computed(() =>
  getFieldsForTable(properties.value.tableId),
);
const fieldOptions = computed(() =>
  currentTableFields.value.map((f) => ({ label: f.name, value: f.id })),
);
const enabledFieldOptions = computed(() =>
  currentTableFields.value
    .filter((f) => properties.value.fields?.[f.id]?.enabled)
    .map((f) => ({ label: f.name, value: f.id })),
);
const fieldNameOptions = computed(() =>
  currentTableFields.value.map((f) => ({ label: f.name, value: f.name })),
);

function resolveNodeName(nodeId) {
  return flatDbTree.value.find((n) => n.id === nodeId)?.name || "";
}

function getFieldsForTable(tableId) {
  if (!tableId) return [];
  return flatDbTree.value.filter(
    (n) => n.type === "field" && n.pId === tableId,
  );
}

function updateField(path, value, after) {
  if (!properties.value) return;
  set(properties.value, path, value);
  after?.();
  node.value?.onExecute?.();
  node.value?.graph?.setDirtyCanvas?.(true, true);
}

function onTableSelect(tableId) {
  updateField("tableId", tableId);
  const nextFields = {};
  for (const field of getFieldsForTable(tableId)) {
    nextFields[field.id] = properties.value.fields?.[field.id] || {
      enabled: false,
    };
  }
  updateField("fields", nextFields, () => node.value?.updateFieldSlots?.());
  updateField("relatedFields", {});
  updateField("returningFields", []);
}

function onCrudTypeChange(type) {
  updateField("crudType", type, () => {
    node.value?.updateFieldSlots?.();
    node.value?._syncFieldOutputSlots?.();
  });
  if (type !== "upsert") updateField("conflictFields", []);
}

// 切换 result.mode 后立即同步字段 output slot(first ↔ 其他模式互转)
function onResultModeChange(mode) {
  updateField("result.mode", mode, () => {
    node.value?._syncFieldOutputSlots?.();
  });
}

function setFieldEnabled(fieldId, enabled) {
  const current = properties.value.fields?.[fieldId] || {};
  const next = { ...current, enabled };
  if (enabled && isWrite.value) {
    next.isSlot ??= false;
    next.value ??= "";
    next.valueMode ??= "static";
  }
  updateField(`fields.${fieldId}`, next, () => {
    node.value?.updateFieldSlots?.();
    node.value?._syncFieldOutputSlots?.();
  });
  // UPSERT 的 conflictFields 必须是 enabled 字段:disable 时同步清掉,避免
  // `.onConflict([disabledField])` 引用 .insert 对象里不存在的列触发 PG 报错。
  if (!enabled) {
    const cf = properties.value.conflictFields || [];
    if (cf.includes(fieldId)) {
      updateField("conflictFields", cf.filter((id) => id !== fieldId));
    }
  }
}

function updateFieldConfig(fieldId, key, value) {
  updateField(`fields.${fieldId}.${key}`, value, () =>
    node.value?.updateFieldSlots?.(),
  );
}

function addWhere() {
  const item = {
    fieldId: currentTableFields.value[0]?.id || "",
    operator: "=",
    value: "",
    isSlot: false,
    negated: false,
    valueMode: "value",
    logic: (properties.value.where || []).length
      ? properties.value.whereLogic || "and"
      : "and",
    groupKey: "",
    slotId: `where_${uid().replace(/-/g, "")}`,
  };
  updateField("where", [...(properties.value.where || []), item], () =>
    node.value?.updateWhereSlots?.(),
  );
}

function updateWhere(index, key, value) {
  updateField(`where.${index}.${key}`, value, () =>
    node.value?.updateWhereSlots?.(),
  );
}

function removeWhere(index) {
  const next = [...(properties.value.where || [])];
  next.splice(index, 1);
  updateField("where", next, () => node.value?.updateWhereSlots?.());
}

function isNoFieldWhereOp(op) {
  return op === "exists" || op === "notExists" || op === "raw";
}

function addOrderBy() {
  updateField("orderBy", [
    ...(properties.value.orderBy || []),
    {
      fieldId: currentTableFields.value[0]?.id || "",
      direction: "asc",
      nullsPosition: "",
    },
  ]);
}

function removeOrderBy(index) {
  const next = [...(properties.value.orderBy || [])];
  next.splice(index, 1);
  updateField("orderBy", next);
}

function buildAggregateAlias(func, fieldId) {
  const fieldName = resolveNodeName(fieldId);
  return func && fieldName ? `${func}_${fieldName}` : "";
}

function addAggregate() {
  const fieldId = currentTableFields.value[0]?.id || "";
  updateField("aggregates", [
    ...(properties.value.aggregates || []),
    {
      func: "sum",
      fieldId,
      alias: buildAggregateAlias("sum", fieldId),
      distinct: false,
      filterWhere: [],
    },
  ]);
}

function updateAggregate(index, key, value) {
  updateField(`aggregates.${index}.${key}`, value);
  const agg = properties.value.aggregates?.[index];
  if (agg && (key === "func" || key === "fieldId")) {
    updateField(
      `aggregates.${index}.alias`,
      buildAggregateAlias(agg.func, agg.fieldId),
    );
  }
}

function removeAggregate(index) {
  const next = [...(properties.value.aggregates || [])];
  next.splice(index, 1);
  updateField("aggregates", next);
}

// 聚合 filterWhere(P2-4):FUNC(field) FILTER (WHERE cond1 AND cond2) — PG 专属
// 复用 where 项 schema 的子集(fieldId/operator/value/isSlot/slotId),不支持嵌套
function addAggFilter(aggIndex) {
  const agg = properties.value.aggregates?.[aggIndex];
  if (!agg) return;
  const next = [...(agg.filterWhere || [])];
  next.push({
    fieldId: currentTableFields.value[0]?.id || "",
    operator: "=",
    value: "",
    isSlot: false,
    slotId: `aggfw_${uid().replace(/-/g, "")}`,
  });
  updateField(`aggregates.${aggIndex}.filterWhere`, next);
}

function updateAggFilter(aggIndex, fwIndex, key, value) {
  updateField(
    `aggregates.${aggIndex}.filterWhere.${fwIndex}.${key}`,
    value,
  );
}

function removeAggFilter(aggIndex, fwIndex) {
  const agg = properties.value.aggregates?.[aggIndex];
  if (!agg) return;
  const next = [...(agg.filterWhere || [])];
  next.splice(fwIndex, 1);
  updateField(`aggregates.${aggIndex}.filterWhere`, next);
}

// HAVING — 聚合别名下拉来源
const havingFieldOptions = computed(() =>
  (properties.value.aggregates || properties.value.groupBy?.aggregates || [])
    .map(
      (agg) =>
        agg.alias || `${agg.func}_${resolveNodeName(agg.fieldId) || agg.fieldId}`,
    )
    .filter(Boolean),
);

function isHavingNoFieldOp(op) {
  return op === "havingExists" || op === "havingNotExists" || op === "raw";
}

// relatedFields[linkId] 的默认 cfg。caller 自己 spread + 覆盖差异字段后 updateField 一次,
// 避免「mutate properties + 调 onExecute + setDirtyCanvas」两套写路径并存(updateField
// 内部已含 set + after + onExecute + setDirtyCanvas)。
function defaultRelatedConfig(targetTableId) {
  return {
    targetTableId: targetTableId || "",
    joinType: "left",
    viaFieldName: "",
    viaTargetField: "id",
    parentLinkId: null,
    selectedFieldId: null,
    fields: {},
    alias: "",
    isSlot: false,
    value: "",
  };
}

// Returning 仅主表字段:`returningFields` 数组项为 `main::${fieldId}`。
// 历史关联表 returning 数据(`linkId::fieldId`)在 BackendCrudNode.onConfigure 迁移时过滤丢弃。

// 把 `main::fieldId` 解析为人可读 label,用于 chips 显示。
// 兼容历史 `linkId::fieldId`:UI 已不可达,但显示时回退到关联表名,防止旧存档崩溃。
function returningEntryLabel(entry) {
  if (typeof entry !== "string" || !entry.includes("::")) return entry;
  const sepIdx = entry.indexOf("::");
  const source = entry.slice(0, sepIdx);
  const fieldId = entry.slice(sepIdx + 2);
  const fieldName = resolveNodeName(fieldId) || fieldId;
  if (source === "main") {
    const mainName = resolveNodeName(properties.value.tableId) || "主表";
    return `${mainName}.${fieldName}`;
  }
  const cfg = properties.value.relatedFields?.[source];
  const tableName = cfg ? resolveNodeName(cfg.targetTableId) : "rel";
  return `${tableName || "rel"}.${fieldName}`;
}

function isReturningChecked(source, fieldId) {
  return (properties.value.returningFields || []).includes(`${source}::${fieldId}`);
}

function toggleReturning(source, fieldId, checked) {
  const key = `${source}::${fieldId}`;
  const current = properties.value.returningFields || [];
  const next = checked
    ? current.includes(key) ? current : [...current, key]
    : current.filter((e) => e !== key);
  updateField("returningFields", next);
}

function removeReturningField(entry) {
  const arr = (properties.value.returningFields || []).filter((e) => e !== entry);
  updateField("returningFields", arr);
}

function addRelatedTable(item) {
  const linkId = uid();
  const cfg = {
    ...defaultRelatedConfig(item.targetTableId),
    viaFieldName: item.fieldName,
    parentLinkId: null,
  };
  updateField(`relatedFields.${linkId}`, cfg, () =>
    node.value?.updateFieldSlots?.(),
  );
}

function removeRelatedTable(linkId) {
  const removedLinkIds = new Set();
  const collect = (id) => {
    removedLinkIds.add(id);
    for (const [childId, cfg] of Object.entries(
      properties.value.relatedFields || {},
    )) {
      if (cfg.parentLinkId === id) collect(childId);
    }
  };
  collect(linkId);
  const nextRelated = { ...(properties.value.relatedFields || {}) };
  for (const id of removedLinkIds) delete nextRelated[id];

  // returningFields 里以已删 linkId 为 source 的条目要同步清掉,
  // 否则后端 _generateRelatedInserts 找不到对应 _buildRelTree 节点,relReturnEntries 静默丢失
  const oldReturning = properties.value.returningFields || [];
  const survived = oldReturning.filter((entry) => {
    if (typeof entry !== "string" || !entry.includes("::")) return true;
    const src = entry.slice(0, entry.indexOf("::"));
    return !removedLinkIds.has(src);
  });

  updateField("relatedFields", nextRelated, () =>
    node.value?.updateFieldSlots?.(),
  );
  if (survived.length !== oldReturning.length) {
    updateField("returningFields", survived);
  }
}

function getFieldRelation(tableName, fieldName) {
  return getRelationsForTable(tableName).find((rel) => {
    if (rel.direction !== "outgoing") return false;
    const cond = rel.conditions?.[0];
    return cond?.sourceFieldName === fieldName;
  });
}

function expandCascadeFromTree(parentLinkId, fieldName) {
  const parentConfig = properties.value.relatedFields?.[parentLinkId];
  if (!parentConfig) return;
  const parentTableName = resolveNodeName(parentConfig.targetTableId);
  const rel = getFieldRelation(parentTableName, fieldName);
  if (!rel) return;
  const linkId = uid();
  const cfg = {
    ...defaultRelatedConfig(rel.tableId),
    viaFieldName: rel.conditions?.[0]?.sourceFieldName || "",
    parentLinkId,
  };
  updateField(`relatedFields.${linkId}`, cfg);
}

// Returning 树:主表 FK 展开。parentLinkId=null,与 Fields 卡片共享 relatedFields 存储
function expandReturningCascadeFromMain(fieldName) {
  const mainTableName = resolveNodeName(properties.value.tableId);
  if (!mainTableName) return;
  const rel = getFieldRelation(mainTableName, fieldName);
  if (!rel) return;
  const linkId = uid();
  const cfg = {
    ...defaultRelatedConfig(rel.tableId),
    viaFieldName: rel.conditions?.[0]?.sourceFieldName || "",
    parentLinkId: null,
  };
  updateField(`relatedFields.${linkId}`, cfg);
}

// Returning 树:主表 + 已在 relatedFields 配置的级联子表(按 parentLinkId 递归)。
// source='main' 或 linkId,与 returningFields entry 的 `${source}::${fieldId}` 对齐。
//
// buildFieldTreeNode 是 returning 树 / relation 字段树共用的递归构造器,差异由 opts 注入:
//   - tableKey(source) → 根 table 节点 key
//   - makeFieldNode(field, source, isFK, hasCascade) → field 节点形态(key/label/linkId/source 等)
// children 递归条件统一:`relatedFields[childId].parentLinkId === parentLinkId` 且 viaFieldName 匹配该字段。
function buildFieldTreeNode({ tableId, tableName, source, parentLinkId, opts }) {
  const fields = getFieldsForTable(tableId);
  return {
    key: opts.tableKey(source),
    header: "table",
    label: tableName,
    children: fields.map((field) => {
      const isFK = !!getFieldRelation(tableName, field.name);
      const childEntry = Object.entries(
        properties.value.relatedFields || {},
      ).find(
        ([, cfg]) =>
          (cfg.parentLinkId || null) === parentLinkId &&
          cfg.viaFieldName === field.name,
      );
      const fieldNode = opts.makeFieldNode(field, source, isFK, !!childEntry);
      if (childEntry) {
        const [childLinkId, childCfg] = childEntry;
        const childTableName = resolveNodeName(childCfg.targetTableId);
        if (childTableName) {
          fieldNode.children = [
            buildFieldTreeNode({
              tableId: childCfg.targetTableId,
              tableName: childTableName,
              source: childLinkId,
              parentLinkId: childLinkId,
              opts,
            }),
          ];
        }
      }
      return fieldNode;
    }),
  };
}

const returningTreeOpts = {
  tableKey: (source) => `rt_table_${source}`,
  makeFieldNode: (field, source, isFK, hasCascade) => ({
    key: `rt_field_${source}_${field.id}`,
    header: "field",
    source,
    fieldId: field.id,
    fieldName: field.name,
    isFK,
    hasCascade,
  }),
};

const relationTreeOpts = {
  tableKey: (linkId) => `table_${linkId}`,
  makeFieldNode: (field, linkId, isFK, hasCascade) => ({
    key: `${linkId}_${field.id}`,
    header: "field",
    label: field.name,
    fieldId: field.id,
    fieldName: field.name,
    linkId,
    isFK,
    hasCascade,
  }),
};

function buildReturningTableNode(source, tableId, tableName) {
  return buildFieldTreeNode({
    tableId,
    tableName,
    source,
    parentLinkId: source === "main" ? null : source,
    opts: returningTreeOpts,
  });
}

const returningTree = computed(() => {
  if (!properties.value.tableId) return [];
  const mainTableName = resolveNodeName(properties.value.tableId);
  if (!mainTableName) return [];
  return [buildReturningTableNode("main", properties.value.tableId, mainTableName)];
});

function hasCascadeChild(linkId, fieldName) {
  return Object.values(properties.value.relatedFields || {}).some(
    (cfg) => cfg.parentLinkId === linkId && cfg.viaFieldName === fieldName,
  );
}

function buildRelationTree(linkId) {
  const config = properties.value.relatedFields?.[linkId];
  if (!config) return [];
  const tableName = resolveNodeName(config.targetTableId);
  if (!tableName) return [];
  return [
    buildFieldTreeNode({
      tableId: config.targetTableId,
      tableName,
      source: linkId,
      parentLinkId: linkId,
      opts: relationTreeOpts,
    }),
  ];
}

function selectRelField(linkId, fieldId) {
  const config = properties.value.relatedFields?.[linkId];
  if (!config) return;
  const fieldName = resolveNodeName(fieldId);
  const nextCfg = {
    ...config,
    selectedFieldId: fieldId,
    fields: { [fieldId]: { enabled: true } },
    alias: fieldName || "",
  };
  if (isWrite.value) {
    nextCfg.isSlot ??= false;
    nextCfg.value ??= "";
  }
  updateField(`relatedFields.${linkId}`, nextCfg, () =>
    node.value?.updateFieldSlots?.(),
  );
}

function findActiveLinkId(linkId) {
  const config = properties.value.relatedFields?.[linkId];
  if (config?.selectedFieldId) return linkId;
  const queue = [linkId];
  while (queue.length) {
    const current = queue.shift();
    for (const [childId, child] of Object.entries(
      properties.value.relatedFields || {},
    )) {
      if (child.parentLinkId !== current) continue;
      if (child.selectedFieldId) return childId;
      queue.push(childId);
    }
  }
  return null;
}

function relDisplayText(linkId, config) {
  const tableName = resolveNodeName(config.targetTableId) || "table";
  const viaSrc = config.viaFieldName || "?";
  const viaTgt = getEffectiveTargetField(config);
  return `${viaSrc} -> ${tableName}.${viaTgt}`;
}

function getEffectiveTargetField(config) {
  if (!config?.targetTableId) return "id";
  const targetTableName = resolveNodeName(config.targetTableId);
  if (!targetTableName) return config.viaTargetField || "id";
  let parentTableName;
  if (config.parentLinkId) {
    const parentCfg = properties.value.relatedFields?.[config.parentLinkId];
    parentTableName = parentCfg?.targetTableId
      ? resolveNodeName(parentCfg.targetTableId)
      : "";
  } else {
    parentTableName = resolveNodeName(properties.value.tableId);
  }
  if (!parentTableName) return config.viaTargetField || "id";
  const rel = getRelationsForTable(parentTableName).find(
    (r) => r.tableName === targetTableName,
  );
  const cond = rel?.conditions?.[0];
  if (cond) {
    return rel.direction === "outgoing"
      ? cond.targetFieldName
      : cond.sourceFieldName;
  }
  return config.viaTargetField || "id";
}

function selectedFieldNameOf(linkId) {
  const activeLinkId = findActiveLinkId(linkId);
  if (!activeLinkId) return "";
  const active = properties.value.relatedFields?.[activeLinkId];
  return resolveNodeName(active?.selectedFieldId) || "";
}

function updateRelAlias(linkId, alias) {
  updateField(`relatedFields.${linkId}.alias`, alias, () =>
    node.value?.updateFieldSlots?.(),
  );
}

function toggleRelSlotMode(linkId, isSlot) {
  updateField(`relatedFields.${linkId}.isSlot`, isSlot, () =>
    node.value?.updateFieldSlots?.(),
  );
}

function updateRelValue(linkId, value) {
  updateField(`relatedFields.${linkId}.value`, value, () =>
    node.value?.updateFieldSlots?.(),
  );
}

const rootRelations = computed(() =>
  Object.entries(properties.value.relatedFields || {})
    .filter(([, cfg]) => !cfg.parentLinkId)
    .map(([linkId, cfg]) => ({ linkId, ...cfg })),
);

// ─── 批量模式 ───
function onBatchModeToggle(val) {
  updateField("batchMode.enabled", val);
  if (val && !properties.value.batchDataSlot) {
    updateField("batchDataSlot", true);
    node.value?.updateBatchSlot?.();
  }
  if (!val) {
    updateField("batchDataSlot", false);
    updateField("fieldMapping", {});
    node.value?.updateBatchSlot?.();
    node.value?.updateFieldSlots?.();
  }
}

function onBatchDataSlotToggle(val) {
  updateField("batchDataSlot", val);
  node.value?.updateBatchSlot?.();
}

function addFieldMapping() {
  const mapping = { ...(properties.value.fieldMapping || {}) };
  const tempKey = `prop_${uid().slice(0, 6)}`;
  mapping[tempKey] = "";
  updateField("fieldMapping", mapping);
}

function updateMappingKey(oldKey, newKey) {
  if (oldKey === newKey || !newKey) return;
  const mapping = { ...(properties.value.fieldMapping || {}) };
  const value = mapping[oldKey];
  delete mapping[oldKey];
  mapping[newKey] = value;
  updateField("fieldMapping", mapping);
}

function updateMappingValue(key, fieldName) {
  updateField(`fieldMapping.${key}`, fieldName);
}

function removeMappingEntry(key) {
  const mapping = { ...(properties.value.fieldMapping || {}) };
  delete mapping[key];
  updateField("fieldMapping", mapping);
}

function autoGenerateMapping() {
  const mapping = {};
  for (const [fieldId, config] of Object.entries(
    properties.value.fields || {},
  )) {
    if (!config.enabled) continue;
    const fieldName = resolveNodeName(fieldId);
    if (fieldName) mapping[fieldName] = fieldName;
  }
  updateField("fieldMapping", mapping);
}

// ─── 选项常量 ───
const crudTypeOptions = ["select", "insert", "update", "delete", "upsert"];
const execModeOptions = [
  { label: "manual", value: "manual" },
  { label: "auto", value: "auto" },
];
const resultModeOptions = [
  { label: "多行", value: "rows" },
  { label: "首行", value: "first" },
  { label: "总行数", value: "count" },
];
const whereOperatorOptions = [
  { label: "=", value: "=" },
  { label: "!=", value: "!=" },
  { label: ">", value: ">" },
  { label: ">=", value: ">=" },
  { label: "<", value: "<" },
  { label: "<=", value: "<=" },
  { label: "LIKE", value: "like" },
  { label: "ILIKE", value: "ilike" },
  { label: "IN", value: "in" },
  { label: "NOT IN", value: "not in" },
  { label: "BETWEEN", value: "between" },
  { label: "NOT BETWEEN", value: "not between" },
  { label: "IS NULL", value: "is null" },
  { label: "IS NOT NULL", value: "is not null" },
  { label: "EXISTS (子查询)", value: "exists" },
  { label: "NOT EXISTS", value: "notExists" },
  { label: "RAW", value: "raw" },
];
const havingOperatorOptions = [
  { label: "=", value: "=" },
  { label: "!=", value: "!=" },
  { label: ">", value: ">" },
  { label: ">=", value: ">=" },
  { label: "<", value: "<" },
  { label: "<=", value: "<=" },
  { label: "IN", value: "in" },
  { label: "NOT IN", value: "not in" },
  { label: "BETWEEN", value: "between" },
  { label: "NOT BETWEEN", value: "not between" },
  { label: "IS NULL", value: "is null" },
  { label: "IS NOT NULL", value: "is not null" },
  { label: "HAVING EXISTS", value: "havingExists" },
  { label: "HAVING NOT EXISTS", value: "havingNotExists" },
  { label: "RAW", value: "raw" },
];
const whereLogicOptions = [
  { label: "AND", value: "and" },
  { label: "OR", value: "or" },
];
const whereGroupOptions = [
  { label: "无括号", value: "" },
  { label: "括号 A", value: "A" },
  { label: "括号 B", value: "B" },
  { label: "括号 C", value: "C" },
];
const aggregateFuncOptions = ["sum", "count", "avg", "min", "max"];
const directionOptions = [
  { label: "ASC", value: "asc" },
  { label: "DESC", value: "desc" },
];
const nullsPositionOptions = [
  { label: "NULLS 默认", value: "" },
  { label: "NULLS FIRST", value: "first" },
  { label: "NULLS LAST", value: "last" },
];
const failStrategyOptions = [
  { label: "整体回滚", value: "rollback" },
  { label: "跳过失败项", value: "skip" },
  { label: "收集错误继续", value: "collect" },
];
const conflictActionOptions = [
  { label: "MERGE (更新冲突行)", value: "merge" },
  { label: "IGNORE (DO NOTHING)", value: "ignore" },
];
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div v-if="properties" class="column q-pa-sm q-gutter-y-sm">
      <!-- ─── Route 卡片 ─── -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm q-gutter-y-sm">
          <div class="text-caption text-grey-5">Route</div>
          <q-select dense dark outlined :model-value="properties.dbConnectionId"
            @update:model-value="(val) => updateField('dbConnectionId', val)" :options="dbConnectionList"
            label="DB Connection" emit-value map-options />
          <div class="row q-gutter-xs">
            <q-toggle dense dark :model-value="properties.autoRoute !== false"
              @update:model-value="(val) => updateField('autoRoute', val)" label="Auto route" />
            <q-input dense dark outlined :model-value="properties.routePath" class="col"
              @update:model-value="(val) => updateField('routePath', val || '')" :disable="properties.autoRoute"
              placeholder="/api/your/path" label="POST route" />
          </div>
          <q-select dense dark outlined :model-value="properties.execMode || 'manual'"
            @update:model-value="(val) => updateField('execMode', val)" :options="execModeOptions" emit-value
            map-options label="Exec" />
        </q-card-section>
      </q-card>

      <!-- ─── CRUD 卡片 ─── -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm q-gutter-y-sm">
          <div class="text-caption text-grey-5">CRUD</div>
          <q-select dense dark outlined :model-value="properties.tableId" @update:model-value="onTableSelect"
            :options="tableList" label="Table" emit-value map-options />
          <q-select dense dark outlined :model-value="properties.crudType" @update:model-value="onCrudTypeChange"
            :options="crudTypeOptions" label="Operation" />
          <q-select v-if="isUpsert" dense dark outlined multiple :model-value="properties.conflictFields || []"
            @update:model-value="
              (val) => updateField('conflictFields', val || [])
            " :options="enabledFieldOptions" label="Conflict fields" emit-value map-options />
          <q-select v-if="isUpsert" dense dark outlined :model-value="properties.conflictAction || 'merge'"
            @update:model-value="(val) => updateField('conflictAction', val)" :options="conflictActionOptions"
            emit-value map-options label="冲突动作" />
        </q-card-section>
      </q-card>

      <!-- ─── Returning(INSERT/UPSERT/UPDATE/DELETE 主表字段多选,点 + 弹字段列表) ─── -->
      <q-card v-if="(isInsert || isUpsert || isUpdate || isDelete) && properties.tableId" dark flat bordered>
        <q-card-section class="q-pa-sm q-gutter-y-sm">
          <div class="row items-center justify-between">
            <div class="text-caption text-grey-5">
              Returning(勾选要返回的字段{{ isUpsert ? ',留空默认 id' : '' }})
            </div>
            <q-btn-dropdown dense flat color="cyan" icon="add" content-class="bg-dark">
              <q-card v-if="isInsert" dark flat style="min-width: 320px; max-height: 420px; overflow: auto">
                <q-card-section class="q-pa-sm">
                  <q-tree :nodes="returningTree" node-key="key" dark dense  >
                    <template #header-table="{ node: tn }">
                      <span class="text-caption text-grey-5">{{ tn.label }}</span>
                    </template>
                    <template #header-field="{ node: tn }">
                      <div class="row items-center no-wrap full-width q-py-xs">
                        <q-checkbox dense dark :model-value="isReturningChecked(tn.source, tn.fieldId)"
                          @update:model-value="(val) => toggleReturning(tn.source, tn.fieldId, val)" />
                        <span class="q-ml-xs" :class="tn.isFK ? 'text-cyan' : 'text-grey-3'">
                          {{ tn.fieldName }}
                        </span>
                        <q-space />
                        <q-btn v-if="tn.isFK && !tn.hasCascade" dense flat size="sm" icon="account_tree" @click.stop="tn.source === 'main'
                          ? expandReturningCascadeFromMain(tn.fieldName)
                          : expandCascadeFromTree(tn.source, tn.fieldName)" />
                      </div>
                    </template>
                  </q-tree>
                </q-card-section>
              </q-card>
              <q-list v-else dense dark style="min-width: 220px; max-height: 380px; overflow: auto">
                <q-item v-for="field in currentTableFields" :key="field.id" tag="label" clickable dense>
                  <q-item-section side>
                    <q-checkbox dense dark :model-value="isReturningChecked('main', field.id)"
                      @update:model-value="(val) => toggleReturning('main', field.id, val)" />
                  </q-item-section>
                  <q-item-section>{{ field.name }}</q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </div>
          <div v-if="(properties.returningFields || []).length === 0" class="text-caption text-grey-7">
            未选择字段{{ isUpsert ? '(默认 id)' : '' }}
          </div>
          <div v-else class="column q-gutter-y-xs">
            <div v-for="entry in properties.returningFields" :key="entry"
              class="row items-center q-gutter-xs q-pa-xs rounded-borders"
              style="border: 1px solid rgba(255, 255, 255, 0.14)">
              <span class="col text-body2 text-grey-3 ellipsis">{{ returningEntryLabel(entry) }}</span>
              <q-btn dense flat color="negative" icon="close" @click="removeReturningField(entry)" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- ─── 输出形态(SELECT) ─── -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm q-gutter-y-sm">
          <div class="text-caption text-grey-5">输出形态 (result.mode)</div>
          <q-btn-toggle :model-value="properties.result?.mode || 'rows'" @update:model-value="onResultModeChange"
            :options="resultModeOptions" dense dark unelevated toggle-color="primary" class="full-width" spread />
          <div v-if="properties.result?.mode === 'count'" class="text-caption text-grey-6">
            输出 number,忽略字段选择与 LIMIT。
          </div>
          <div v-else-if="properties.result?.mode === 'first'" class="text-caption text-grey-6">
            输出首行对象,无数据时为 null。
          </div>
          <div v-else class="text-caption text-grey-6">
            输出数组;配聚合(无 GROUP BY)产 1 行,配 GROUP BY 每组 1 行。
          </div>
        </q-card-section>
      </q-card>

      <!-- ─── Fields(列勾选 / INSERT-UPDATE 值) ─── -->
      <q-card v-if="properties.tableId" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between q-mb-xs">
            <div class="text-caption text-grey-5">{{ isDelete ? 'Cascade(级联删除子表)' : 'Fields' }}</div>
            <q-btn-dropdown dense flat color="cyan" icon="add" :disable="availableJoinFields.length === 0"
              content-class="bg-dark">
              <q-list dense dark>
                <q-item v-for="item in availableJoinFields" :key="`${item.targetTableId}_${item.fieldName}`" clickable
                  v-close-popup @click="addRelatedTable(item)">
                  <q-item-section>
                    <q-item-label>{{ item.fieldName }} ->
                      {{ item.targetTableName }}</q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
            </q-btn-dropdown>
          </div>

          <template v-if="!isDelete && !properties.batchMode?.enabled">
            <div v-for="field in currentTableFields" :key="field.id" class="row items-center q-gutter-xs q-mb-xs">
              <q-checkbox dense dark :model-value="!!properties.fields?.[field.id]?.enabled"
                @update:model-value="(val) => setFieldEnabled(field.id, val)" :label="field.name" />
              <q-toggle v-if="isWrite && properties.fields?.[field.id]?.enabled" dense dark
                :model-value="!!properties.fields?.[field.id]?.isSlot"
                @update:model-value="(val) => updateFieldConfig(field.id, 'isSlot', val)" />
              <q-input v-if="isWrite && properties.fields?.[field.id]?.enabled" dense dark outlined class="col"
                :model-value="properties.fields?.[field.id]?.value"
                @update:model-value="(val) => updateFieldConfig(field.id, 'value', val)"
                :disable="!!properties.fields?.[field.id]?.isSlot"
                :placeholder="`value for ${field.name}`" />
            </div>
          </template>
          <div v-if="properties.batchMode?.enabled" class="text-caption text-grey-7 q-pa-xs">
            批量模式下字段值来自下方 fieldMapping,本卡片字段值禁用
          </div>

          <div v-for="rel in rootRelations" :key="rel.linkId" class="q-mt-sm q-pa-xs rounded-borders"
            style="border: 1px solid rgba(255, 255, 255, 0.14)">
            <div class="row items-center q-gutter-xs">
              <q-btn dense flat color="cyan" icon="account_tree">
                <q-menu dark class="bg-dark">
                  <q-card dark flat style="min-width: 260px">
                    <q-card-section class="q-pa-sm">
                      <q-tree :nodes="buildRelationTree(rel.linkId)" node-key="key" dark dense>
                        <template #header-table="{ node: treeNode }">
                          <span class="text-caption text-grey-5">{{
                            treeNode.label
                          }}</span>
                        </template>
                        <template #header-field="{ node: treeNode }">
                          <div class="row items-center no-wrap q-pa-xs rounded-borders" :class="[
                            treeNode.isFK || !isDelete
                              ? 'cursor-pointer'
                              : 'cursor-not-allowed',
                            {
                              'bg-cyan-9':
                                properties.relatedFields[treeNode.linkId]
                                  ?.selectedFieldId === treeNode.fieldId,
                            },
                          ]" @click="
                            treeNode.isFK
                              ? !hasCascadeChild(
                                treeNode.linkId,
                                treeNode.fieldName,
                              ) &&
                              expandCascadeFromTree(
                                treeNode.linkId,
                                treeNode.fieldName,
                              )
                              : isDelete
                                ? null
                                : selectRelField(
                                  treeNode.linkId,
                                  treeNode.fieldId,
                                )
                            " v-close-popup="!treeNode.isFK && !isDelete">
                            <span :class="treeNode.isFK
                              ? 'text-cyan'
                              : (isDelete ? 'text-grey-7' : 'text-grey-3')
                              ">{{ treeNode.fieldName }}</span>
                          </div>
                        </template>
                      </q-tree>
                    </q-card-section>
                  </q-card>
                </q-menu>
              </q-btn>
              <span class="col text-body2 text-grey-3 ellipsis">{{
                relDisplayText(rel.linkId, rel)
              }}</span>
              <q-btn dense flat color="negative" icon="close" @click="removeRelatedTable(rel.linkId)" />
            </div>
            <div v-if="findActiveLinkId(rel.linkId) && !isDelete" class="row items-center q-gutter-xs q-mt-xs">
              <q-input v-if="isSelect" dense dark outlined class="col"
                :model-value="properties.relatedFields[findActiveLinkId(rel.linkId)]?.alias || selectedFieldNameOf(rel.linkId)"
                @update:model-value="(val) => updateRelAlias(findActiveLinkId(rel.linkId), val)" placeholder="alias" />
              <template v-else>
                <span class="col text-body2 text-grey-5 ellipsis">{{ selectedFieldNameOf(rel.linkId) }}</span>
                <template v-if="isWrite">
                  <q-toggle dense dark :model-value="!!properties.relatedFields[findActiveLinkId(rel.linkId)]?.isSlot"
                    @update:model-value="(val) => toggleRelSlotMode(findActiveLinkId(rel.linkId), val)" />
                  <q-input dense dark outlined style="width: 100px"
                    :model-value="properties.relatedFields[findActiveLinkId(rel.linkId)]?.value || ''"
                    @update:model-value="(val) => updateRelValue(findActiveLinkId(rel.linkId), val)"
                    :disable="properties.relatedFields[findActiveLinkId(rel.linkId)]?.isSlot" placeholder="value" />
                </template>
              </template>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- ─── WHERE ─── -->
      <q-card v-if="isSelect || isUpdate || isDelete || isUpsert" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between q-mb-xs">
            <div class="text-caption text-grey-5">WHERE</div>
            <q-btn dense flat color="primary" icon="add" @click="addWhere" />
          </div>
          <q-card v-for="(w, index) in properties.where || []" :key="w.slotId" dark flat bordered
            class="where-item-card q-mb-sm">
            <q-card-section class="q-pa-sm">
              <div class="row items-center q-gutter-xs q-mb-xs">
                <q-select v-if="index > 0" dense dark outlined class="where-logic-select"
                  :model-value="w.logic || properties.whereLogic || 'and'" @update:model-value="
                    (val) => updateWhere(index, 'logic', val)
                  " :options="whereLogicOptions" emit-value map-options label="Logic" />
                <q-select dense dark outlined class="where-group-select" :model-value="w.groupKey || ''"
                  @update:model-value="(val) => updateWhere(index, 'groupKey', val || '')" :options="whereGroupOptions"
                  emit-value map-options label="括号" />
                <q-toggle dense dark :model-value="!!w.negated"
                  @update:model-value="(val) => updateWhere(index, 'negated', val)" label="NOT" />
              </div>
              <div class="row q-gutter-xs">
                <q-select v-if="!isNoFieldWhereOp(w.operator)" dense dark outlined class="col" :model-value="w.fieldId"
                  @update:model-value="(val) => updateWhere(index, 'fieldId', val)" :options="fieldOptions" emit-value
                  map-options label="Field" />
                <div v-else class="col text-caption text-grey-6 q-py-sm">
                  {{ w.operator }} 不需要字段,直接填 builder/raw
                </div>
                <q-select dense dark outlined class="col-4" :model-value="w.operator" @update:model-value="
                  (val) => updateWhere(index, 'operator', val)
                " :options="whereOperatorOptions" emit-value map-options label="Op" />
                <q-btn dense flat color="negative" icon="close" @click="removeWhere(index)" />
              </div>
              <div class="row q-gutter-xs q-mt-xs">
                <q-toggle dense dark :model-value="w.isSlot"
                  @update:model-value="(val) => updateWhere(index, 'isSlot', val)" />
                <q-input v-if="!w.isSlot" dense dark outlined class="col" :model-value="w.value"
                  @update:model-value="(val) => updateWhere(index, 'value', val)"
                  :placeholder="isNoFieldWhereOp(w.operator) ? '建议 isSlot 接 builder/raw' : '值'" label="Value" />
                <q-input v-else dense dark outlined class="col" :model-value="w.slotId"
                  @update:model-value="(val) => updateWhere(index, 'slotId', val)" label="Slot name" />
              </div>
            </q-card-section>
          </q-card>
        </q-card-section>
      </q-card>

      <!-- ─── ORDER BY ─── -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between q-mb-xs">
            <div class="text-caption text-grey-5">ORDER BY</div>
            <q-btn dense flat color="primary" icon="add" @click="addOrderBy" />
          </div>
          <div v-for="(ob, index) in properties.orderBy || []" :key="index" class="row q-gutter-xs q-mb-xs">
            <q-select dense dark outlined class="col" :model-value="ob.fieldId" @update:model-value="
              (val) => updateField(`orderBy.${index}.fieldId`, val)
            " :options="fieldOptions" emit-value map-options label="Field" />
            <q-select dense dark outlined style="width: 90px" :model-value="ob.direction || 'asc'" @update:model-value="
              (val) => updateField(`orderBy.${index}.direction`, val)
            " :options="directionOptions" emit-value map-options label="Direction" />
            <q-select dense dark outlined style="width: 130px" :model-value="ob.nullsPosition || ''"
              @update:model-value="(val) => updateField(`orderBy.${index}.nullsPosition`, val || '')"
              :options="nullsPositionOptions" emit-value map-options label="NULLS" />
            <q-btn dense flat color="negative" icon="close" @click="removeOrderBy(index)" />
          </div>
        </q-card-section>
      </q-card>

      <!-- ─── LIMIT / OFFSET ─── -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm q-gutter-y-sm">
          <div class="text-caption text-grey-5">LIMIT / OFFSET</div>
          <div class="row q-gutter-xs">
            <q-toggle dense dark :model-value="properties.limit?.isSlot" @update:model-value="
              (val) =>
                updateField('limit.isSlot', val, () =>
                  node?.updateWhereSlots?.(),
                )
            " label="limit slot" />
            <q-input dense dark outlined class="col" :model-value="properties.limit?.value"
              @update:model-value="(val) => updateField('limit.value', val)" :disable="properties.limit?.isSlot"
              label="Limit" />
          </div>
          <div class="row q-gutter-xs">
            <q-toggle dense dark :model-value="properties.offset?.isSlot" @update:model-value="
              (val) =>
                updateField('offset.isSlot', val, () =>
                  node?.updateWhereSlots?.(),
                )
            " label="offset slot" />
            <q-input dense dark outlined class="col" :model-value="properties.offset?.value"
              @update:model-value="(val) => updateField('offset.value', val)" :disable="properties.offset?.isSlot"
              label="Offset" />
          </div>
        </q-card-section>
      </q-card>

      <!-- ─── GROUP BY(SELECT) ─── -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm q-gutter-y-sm">
          <div class="row items-center justify-between">
            <div>
              <div class="text-caption text-grey-5">GROUP BY</div>
              <div class="text-caption text-grey-7">按字段拆分聚合结果</div>
            </div>
            <q-toggle dense dark :model-value="properties.groupBy?.enabled"
              @update:model-value="(val) => updateField('groupBy.enabled', val)" />
          </div>
          <q-select v-if="properties.groupBy?.enabled" dense dark outlined multiple
            :model-value="properties.groupBy?.fieldIds || []"
            @update:model-value="(val) => updateField('groupBy.fieldIds', val)" :options="fieldOptions" emit-value
            map-options label="Group fields" />
        </q-card-section>
      </q-card>

      <!-- ─── 聚合函数(SELECT,脱壳:整表聚合 / 分组聚合 都用) ─── -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between q-mb-sm">
            <div class="text-caption text-grey-5">聚合函数</div>
            <q-btn dense flat color="primary" icon="add" @click="addAggregate" />
          </div>
          <div v-if="!(properties.aggregates || []).length" class="aggregate-empty text-caption text-grey-7">
            未配置聚合;配置后输出多行数组,无 GROUP BY 出 1 行,有 GROUP BY 每组 1 行。
          </div>
          <div v-for="(agg, index) in properties.aggregates || []" :key="index" class="aggregate-item q-mb-sm">
            <div class="row items-center q-gutter-xs">
              <q-select dense dark outlined class="col-3 aggregate-func" :model-value="agg.func"
                @update:model-value="(val) => updateAggregate(index, 'func', val)" :options="aggregateFuncOptions"
                label="Func" />
              <q-select dense dark outlined class="col" :model-value="agg.fieldId"
                @update:model-value="(val) => updateAggregate(index, 'fieldId', val)" :options="fieldOptions" emit-value
                map-options label="Field" />
              <q-btn dense flat color="negative" icon="close" @click="removeAggregate(index)" />
            </div>
            <div class="row items-center q-gutter-xs q-mt-xs">
              <q-input dense dark outlined class="col" :model-value="agg.alias"
                @update:model-value="(val) => updateField(`aggregates.${index}.alias`, val)" placeholder="别名"
                debounce="300" />
              <q-toggle dense dark :model-value="!!agg.distinct"
                @update:model-value="(val) => updateField(`aggregates.${index}.distinct`, val)" label="DISTINCT" />
            </div>

            <!-- 聚合 filterWhere(P2-4,PG only) -->
            <div class="q-mt-sm q-pa-xs rounded-borders" style="border: 1px dashed rgba(255,255,255,0.1)">
              <div class="row items-center justify-between q-mb-xs">
                <div class="text-caption text-grey-7">FILTER (WHERE ...) — PG only</div>
                <q-btn dense flat color="primary" icon="add" size="sm" @click="addAggFilter(index)" />
              </div>
              <div v-for="(fw, fwIdx) in agg.filterWhere || []" :key="fwIdx"
                class="row q-gutter-xs q-mb-xs items-center">
                <q-select dense dark outlined style="width: 110px" :model-value="fw.fieldId"
                  @update:model-value="(val) => updateAggFilter(index, fwIdx, 'fieldId', val)" :options="fieldOptions"
                  emit-value map-options label="Field" />
                <q-select dense dark outlined style="width: 90px" :model-value="fw.operator"
                  @update:model-value="(val) => updateAggFilter(index, fwIdx, 'operator', val)"
                  :options="whereOperatorOptions" emit-value map-options label="Op" />
                <q-toggle dense dark :model-value="!!fw.isSlot"
                  @update:model-value="(val) => updateAggFilter(index, fwIdx, 'isSlot', val)" />
                <q-input dense dark outlined class="col" :model-value="fw.value"
                  @update:model-value="(val) => updateAggFilter(index, fwIdx, 'value', val)" :disable="fw.isSlot"
                  placeholder="值" />
                <q-btn dense flat color="negative" icon="close" size="sm" @click="removeAggFilter(index, fwIdx)" />
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- ─── HAVING(GROUP BY 启用时) ─── -->
      <q-card v-if="isSelect && properties.groupBy?.enabled" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between q-mb-xs">
            <div class="text-caption text-grey-5">HAVING</div>
            <q-toggle dense dark :model-value="properties.having?.enabled"
              @update:model-value="(val) => updateField('having.enabled', val)" />
          </div>
          <template v-if="properties.having?.enabled">
            <div class="row q-gutter-xs items-center">
              <q-select dense dark outlined style="width: 110px" :model-value="properties.having?.field || ''"
                @update:model-value="(val) => updateField('having.field', val)" :options="havingFieldOptions" emit-value
                label="聚合别名" :disable="isHavingNoFieldOp(properties.having?.operator)" />
              <q-select dense dark outlined style="width: 130px" :model-value="properties.having?.operator || '>'"
                @update:model-value="(val) => updateField('having.operator', val)" :options="havingOperatorOptions"
                emit-value map-options label="运算符" />
              <q-toggle dense dark :model-value="!!properties.having?.isSlot"
                @update:model-value="(val) => updateField('having.isSlot', val)" />
              <q-input dense dark outlined class="col" :model-value="properties.having?.value"
                @update:model-value="(val) => updateField('having.value', val)" :disable="properties.having?.isSlot"
                :placeholder="isHavingNoFieldOp(properties.having?.operator) ? '建议 isSlot 接 builder/raw' : '值'" />
            </div>
            <div class="text-caption text-grey-7 q-mt-xs">
              多条件 / 嵌套 group 节点代码已支持
              (<code class="bg-grey-9 q-px-xs">having.conditions</code> +
              <code class="bg-grey-9 q-px-xs">type='group'</code> children),Panel 多条件 UI 待补,可手动编辑数据。
            </div>
          </template>
        </q-card-section>
      </q-card>

      <!-- ─── DISTINCT(SELECT) ─── -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between">
            <div class="text-caption text-grey-5">DISTINCT</div>
            <q-toggle dense dark :model-value="!!properties.distinct?.enabled"
              @update:model-value="(val) => updateField('distinct.enabled', val)" />
          </div>
          <div v-if="properties.distinct?.enabled" class="row items-center q-gutter-xs q-mt-sm">
            <div class="text-caption text-grey-6" style="width: 110px">DISTINCT ON</div>
            <q-select dense dark outlined multiple use-chips class="col"
              :model-value="properties.distinct?.onFields || []"
              @update:model-value="(val) => updateField('distinct.onFields', val || [])" :options="fieldOptions"
              emit-value map-options placeholder="留空走普通 DISTINCT;选字段走 PG distinctOn" />
          </div>
        </q-card-section>
      </q-card>

      <!-- ─── 批量写入(INSERT / UPDATE) ─── -->
      <q-card v-if="(isInsert || isUpdate) && properties.tableId" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">批量操作</div>
          <q-toggle :model-value="!!properties.batchMode?.enabled" @update:model-value="onBatchModeToggle" dense dark
            label="批量模式" />
          <template v-if="properties.batchMode?.enabled">
            <q-toggle :model-value="!!properties.batchDataSlot" @update:model-value="onBatchDataSlotToggle" dense dark
              label="数据输入 Slot" class="q-ml-md" />
            <q-input v-if="!properties.batchDataSlot" :model-value="properties.batchStaticData"
              @update:model-value="(val) => updateField('batchStaticData', val)" dense dark outlined type="textarea"
              placeholder='[{"name":"a","age":20},{"name":"b","age":25}]' :rows="3" debounce="300" class="q-mt-xs" />
            <div class="row items-center q-mt-sm q-mb-xs">
              <div class="text-caption text-grey-6">属性 → 字段映射</div>
              <q-space />
              <q-btn dense flat icon="auto_fix_high" color="primary" size="sm" @click="autoGenerateMapping"
                title="自动生成映射(属性名=字段名)" />
              <q-btn dense flat icon="add" color="primary" size="sm" @click="addFieldMapping" />
            </div>
            <div v-for="(targetField, srcProp) in (properties.fieldMapping || {})" :key="srcProp"
              class="row items-center q-gutter-xs q-mb-xs">
              <q-input dense dark outlined :model-value="srcProp" @change="(val) => updateMappingKey(srcProp, val)"
                placeholder="属性名" style="width: 100px" />
              <q-icon name="arrow_forward" size="xs" color="grey-6" />
              <q-select dense dark outlined :model-value="targetField"
                @update:model-value="(val) => updateMappingValue(srcProp, val)" :options="fieldNameOptions" emit-value
                map-options label="字段" style="width: 140px" />
              <q-btn dense flat icon="close" color="negative" size="sm" @click="removeMappingEntry(srcProp)" />
            </div>
            <q-select :model-value="properties.batchMode?.failStrategy || 'rollback'"
              @update:model-value="(val) => updateField('batchMode.failStrategy', val)" :options="failStrategyOptions"
              dense dark outlined label="失败策略" emit-value map-options class="q-mt-sm" />
          </template>
        </q-card-section>
      </q-card>

    </div>
  </BasePropertyPanel>
</template>

<style scoped>
.aggregate-item {
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.035);
}

.aggregate-item:last-child {
  margin-bottom: 0;
}

.aggregate-empty {
  padding: 8px;
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
}

.aggregate-func {
  min-width: 82px;
}

.where-item-card {
  background: rgba(255, 255, 255, 0.025);
  border-color: rgba(255, 255, 255, 0.12);
}

.where-logic-select {
  width: 88px;
}

.where-group-select {
  width: 112px;
}
</style>
