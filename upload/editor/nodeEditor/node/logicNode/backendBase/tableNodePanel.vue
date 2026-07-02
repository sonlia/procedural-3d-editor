<script setup>
import { computed, watch, onMounted, ref } from "vue";
import { uid } from "quasar";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";
import { useProjectStore } from "src/stores/projectMange.js";
import { useDbRelations } from "./hooks/useDbRelations.js";

// 1. 数据绑定（与 dbSubgraphPanel 相同的 defineModel 模式）
const props = defineModel();
const node = computed(() => props.value);
const properties = computed(() => props.value?.properties || {});

// 代码预览：交给 BasePropertyPanel 的 :code-content
const generatedCodePreview = computed(
  () => props.value?.bgJsCode || props.value?.jsCode || "// 暂无生成的代码"
);

const projectStore = useProjectStore();

// CRUD 类型辅助（控制配置区可见性）
const isSelect = computed(() => properties.value.crudType === 'select');
const isInsertOrUpdate = computed(() => ['insert', 'update', 'upsert'].includes(properties.value.crudType));
const isUpsert = computed(() => properties.value.crudType === 'upsert');

// 分区 2 头部文案：随 select 输出形态变化
const fieldsHeaderLabel = computed(() => {
  if (properties.value.crudType === 'delete') return 'Cascade（级联删除子表）';
  if (!isSelect.value) return '设置字段';
  const mode = properties.value.result?.mode || 'rows';
  if (mode === 'count') return '输出字段（count 模式忽略）';
  return '输出字段';
});

// 更新属性并触发重新生成
function updateField(key, value) {
  if (!properties.value) return;
  set(properties.value, key, value);
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

// ─── 数据库连接（从父 DatabaseSubgraph 继承） ───

const flatDbTree = computed(() => projectStore.currentProject?.database?.dbTree || []);

// 获取父 DatabaseSubgraph 的 dbConnectionId
const parentDbConnectionId = computed(() => {
  const parent = node.value?.graph?._subgraph_node;
  return parent?.properties?.dbConnectionId || "";
});

// 同步父节点的 dbConnectionId 到当前节点属性（仅用于内部引用）
watch(parentDbConnectionId, (newId) => {
  if (newId && properties.value.dbConnectionId !== newId) {
    updateField("dbConnectionId", newId);
  }
}, { immediate: true });

// 获取指定节点的所有后代 ID（递归，处理 folder 中间层）
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

// ID -> 名称解析
const resolveNodeName = (nodeId) =>
  flatDbTree.value.find(n => n.id === nodeId)?.name ?? null;

const currentTableFields = computed(() => {
  const tId = properties.value.tableId;
  if (!tId) return [];
  return flatDbTree.value.filter(n => n.type === "field" && n.pId === tId);
});

// 仅包含当前表字段的 fields（过滤掉可能混入的关联表字段）
const localFields = computed(() => {
  const tableFieldIds = new Set(currentTableFields.value.map(f => f.id));
  const result = {};
  for (const [fieldId, config] of Object.entries(properties.value.fields || {})) {
    if (tableFieldIds.has(fieldId)) {
      result[fieldId] = config;
    }
  }
  return result;
});

const fieldNameMap = computed(() => {
  const map = {};
  for (const fieldId of Object.keys(properties.value.fields || {})) {
    map[fieldId] = resolveNodeName(fieldId);
  }
  return map;
});

const fieldOptionList = computed(() =>
  Object.entries(properties.value.fields || {})
    .map(([fieldId]) => ({
      label: resolveNodeName(fieldId) || fieldId,
      value: fieldId,
    }))
    .filter(opt => opt.label)
);

const conflictFieldOptions = computed(() =>
  Object.entries(properties.value.fields || {})
    .filter(([, config]) => config.enabled)
    .map(([fieldId]) => ({
      label: resolveNodeName(fieldId) || fieldId,
      value: fieldId,
    }))
    .filter(opt => opt.label)
);

// ─── 表选择（使用父节点的 dbConnectionId） ───

const tableList = computed(() => {
  const dbId = parentDbConnectionId.value;
  if (!dbId) return [];

  const descendants = getDescendantIds(dbId);
  return flatDbTree.value
    .filter(n => n.type === "table" && descendants.has(n.id))
    .map(n => ({ label: n.name, value: n.id }));
});

// 选择表后，自动加载该表的字段列表
function onTableSelect(tableId) {
  updateField("tableId", tableId);

  const fieldNodes = flatDbTree.value.filter(n => n.type === "field" && n.pId === tableId);

  const newFields = {};
  for (const f of fieldNodes) {
    newFields[f.id] = properties.value.fields?.[f.id] || { enabled: false };
  }
  updateField("fields", newFields);

  // 切换表时清空关联配置
  updateField("relatedFields", {});
  updateField("joins", []);
}

// ─── 表名 Slot Toggle（子查询输入） ───

function onTableNameSlotToggle(val) {
  updateField("tableNameSlot", val);
  // 调用节点方法同步 slot（方法可能尚未实现，使用可选链）
  node.value?.updateTableNameSlot?.();
}

// ─── CRUD 类型 ───

const crudTypeOptions = [
  { label: "SELECT", value: "select" },
  { label: "INSERT", value: "insert" },
  { label: "UPDATE", value: "update" },
  { label: "DELETE", value: "delete" },
  { label: "UPSERT", value: "upsert" },
];

function onCrudTypeChange(type) {
  updateField("crudType", type);
  if (type !== 'upsert') {
    updateField("conflictFields", []);
  }
  // 切换到 SELECT/DELETE 时，清理关联字段中 INSERT/UPDATE 专用属性
  if (type === 'select' || type === 'delete') {
    for (const config of Object.values(properties.value.relatedFields || {})) {
      delete config.isSlot;
      delete config.value;
    }
  }
  // 切换 CRUD 类型时更新字段 slot
  props.value?.updateFieldSlots?.();
}

// ─── 字段列表 ───

// ─── 关联表字段（useDbRelations） ───

const tableIdRef = computed(() => properties.value?.tableId || "");
const { relatedTables, currentTableName, dbNode, getRelationsForTable, availableJoinFields } = useDbRelations(tableIdRef);

// ─── 关联配置（FK 字段内联展开 tree） ───

// 初始化/获取关联表配置
function getOrInitRelatedConfig(linkId, targetTableId) {
  if (!properties.value.relatedFields[linkId]) {
    properties.value.relatedFields[linkId] = {
      targetTableId: targetTableId || "",
      joinType: "left",
      viaFieldName: "",
      parentLinkId: null,
      selectedFieldId: null,
      fields: {},
    };
  }
  return properties.value.relatedFields[linkId];
}

// 当前表中哪些 fieldId 是 FK 字段（有 JOIN 关系）
const fkFieldSet = computed(() => {
  const set = new Set();
  for (const jf of availableJoinFields.value) {
    const fieldId = Object.keys(properties.value.fields || {}).find(
      id => fieldNameMap.value[id] === jf.fieldName
    );
    if (fieldId) set.add(fieldId);
  }
  return set;
});

// fieldId → 活跃关联配置（仅根级已添加关联的 FK 字段，跳过级联子层）
const fieldToRelation = computed(() => {
  const map = {};
  for (const [linkId, config] of Object.entries(properties.value.relatedFields || {})) {
    if (!config.targetTableId) continue;
    // 仅匹配根级关联（无 parentLinkId 的），级联子层的 viaFieldName 指向关联表字段而非当前表
    if (config.parentLinkId) continue;
    const fieldId = Object.keys(properties.value.fields || {}).find(
      id => fieldNameMap.value[id] === config.viaFieldName
    );
    if (!fieldId) continue;
    map[fieldId] = {
      linkId,
      targetTableId: config.targetTableId,
      targetTableName: resolveNodeName(config.targetTableId),
      config,
    };
  }
  return map;
});

// 添加关联（从 [+添加关联] 下拉选择）
function addRelatedTable(item) {
  const key = uid();
  const config = getOrInitRelatedConfig(key, item.targetTableId);
  config.viaFieldName = item.fieldName;
  config.parentLinkId = null;
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

// 移除关联（递归删除子级联）
function removeRelatedTable(linkId) {
  function removeRecursive(id) {
    for (const [childId, cfg] of Object.entries(properties.value.relatedFields || {})) {
      if (cfg.parentLinkId === id) removeRecursive(childId);
    }
    delete properties.value.relatedFields[id];
  }
  removeRecursive(linkId);
  node.value?.updateFieldSlots?.();
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

// 单选关联表字段（跨级联层级单选）
function selectRelField(linkId, fieldId) {
  const config = properties.value.relatedFields[linkId];
  if (!config) return;

  // 找到根 linkId（向上遍历 parentLinkId）
  let rootLinkId = linkId;
  let pid = config.parentLinkId;
  while (pid) {
    rootLinkId = pid;
    pid = properties.value.relatedFields[pid]?.parentLinkId;
  }

  // 清除同一棵级联树中所有 config 的选择（BFS）
  const queue = [rootLinkId];
  const visited = new Set();
  while (queue.length > 0) {
    const cur = queue.shift();
    if (visited.has(cur)) continue;
    visited.add(cur);
    const cfg = properties.value.relatedFields[cur];
    if (cfg) {
      cfg.selectedFieldId = null;
      cfg.fields = {};
    }
    for (const [childId, childCfg] of Object.entries(properties.value.relatedFields || {})) {
      if (childCfg.parentLinkId === cur) queue.push(childId);
    }
  }

  // 设置当前选择
  config.fields[fieldId] = { enabled: true };
  config.selectedFieldId = fieldId;

  // 设置默认别名：ownerTableName_fieldName
  const fieldNode = flatDbTree.value.find(n => n.id === fieldId);
  const fieldName = fieldNode?.name || '';
  const ownerTableName = fieldNode ? resolveNodeName(fieldNode.pId) : '';
  if (!config.alias && fieldName && ownerTableName) {
    config.alias = `${ownerTableName}_${fieldName}`;
  }

  // INSERT/UPDATE/UPSERT 模式下初始化 isSlot 和 value 默认值
  if (isInsertOrUpdate.value) {
    if (config.isSlot === undefined) config.isSlot = false;
    if (config.value === undefined) config.value = "";
  }

  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
  node.value?.updateFieldSlots?.();
}

// 更新关联别名
function updateRelAlias(linkId, alias) {
  const config = properties.value.relatedFields[linkId];
  if (!config) return;
  config.alias = alias;
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
  node.value?.updateFieldSlots?.();
}

function toggleRelSlotMode(linkId, isSlot) {
  const config = properties.value.relatedFields[linkId];
  if (!config) return;
  config.isSlot = isSlot;
  props.value?.updateFieldSlots?.();
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function updateRelValue(linkId, value) {
  const config = properties.value.relatedFields[linkId];
  if (!config) return;
  config.value = value;
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

// 检查某表的某字段是否为 FK（仅 outgoing 方向，即本表外键指向其他表）
function getFieldRelation(tableName, fieldName) {
  const rels = getRelationsForTable(tableName);
  return rels.find(r => {
    if (r.direction !== 'outgoing') return false;
    const cond = r.conditions[0];
    if (!cond) return false;
    return cond.sourceFieldName === fieldName;
  }) || null;
}

// 级联展开（从 tree 中点击 FK 字段触发）
function expandCascadeFromTree(parentLinkId, fieldName) {
  const parentConfig = properties.value.relatedFields[parentLinkId];
  if (!parentConfig) return;
  const parentTableName = resolveNodeName(parentConfig.targetTableId);
  if (!parentTableName) return;
  const rel = getFieldRelation(parentTableName, fieldName);
  if (!rel) return;

  const cascadeLinkId = `cascade_${uid()}`;
  const config = getOrInitRelatedConfig(cascadeLinkId, rel.tableId);
  const cond = rel.conditions[0];
  config.viaFieldName = cond?.sourceFieldName || '';
  config.parentLinkId = parentLinkId;
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

// 返回 linkId 对应关联表中作为关联条件的字段名（外键字段，由程序自动处理）
// 例：a.id ↔ b.pid，对于 a→b 的关联，返回 'pid'（b 端的关联字段）
function getJoinFieldOfRelTable(linkId) {
  const config = properties.value.relatedFields?.[linkId];
  if (!config) return null;

  // 父级表名：根级用当前表，级联用父配置的目标表
  let parentTableName;
  if (config.parentLinkId) {
    const parentConfig = properties.value.relatedFields?.[config.parentLinkId];
    if (!parentConfig) return null;
    parentTableName = resolveNodeName(parentConfig.targetTableId);
  } else {
    parentTableName = currentTableName.value;
  }
  if (!parentTableName) return null;

  // 在父级表的所有关联中，匹配 targetTableId + viaFieldName 的那条
  const rels = getRelationsForTable(parentTableName);
  const rel = rels.find(r => {
    if (r.tableId !== config.targetTableId) return false;
    const cond = r.conditions[0];
    if (!cond) return false;
    return r.direction === 'outgoing'
      ? cond.sourceFieldName === config.viaFieldName
      : cond.targetFieldName === config.viaFieldName;
  });
  if (!rel) return null;

  const cond = rel.conditions[0];
  return rel.direction === 'outgoing' ? cond.targetFieldName : cond.sourceFieldName;
}

// 构建 QTree 节点（递归，无限级联）
function buildRelationTree(linkId) {
  const config = properties.value.relatedFields?.[linkId];
  if (!config) return [];
  const tableName = resolveNodeName(config.targetTableId);
  if (!tableName) return [];
  let fields = flatDbTree.value.filter(n => n.type === "field" && n.pId === config.targetTableId);

  // INSERT/UPDATE/UPSERT：隐藏关联表中的外键字段（程序按关联关系自动填充）
  if (isInsertOrUpdate.value) {
    const hideFieldName = getJoinFieldOfRelTable(linkId);
    if (hideFieldName) {
      fields = fields.filter(f => f.name !== hideFieldName);
    }
  }

  const fieldChildren = fields.map(f => {
    const isFK = !!getFieldRelation(tableName, f.name);
    let cascadeChildren = [];
    if (isFK) {
      for (const [id, cfg] of Object.entries(properties.value.relatedFields || {})) {
        if (cfg.parentLinkId === linkId && cfg.viaFieldName === f.name) {
          cascadeChildren = buildRelationTree(id);
          break;
        }
      }
    }
    return {
      key: `${linkId}-${f.id}`,
      header: 'field',
      label: f.name,
      fieldId: f.id,
      fieldName: f.name,
      isFK,
      hasCascade: cascadeChildren.length > 0,
      linkId,
      children: cascadeChildren.length > 0 ? cascadeChildren : undefined,
    };
  });

  return [{
    key: `table-${linkId}`,
    header: 'table',
    label: tableName,
    tableName,
    linkId,
    children: fieldChildren,
  }];
}

// 仅根级关联（parentLinkId 为 null），子级联由 QTree children 递归渲染
const rootRelations = computed(() => {
  return Object.entries(properties.value.relatedFields || {})
    .filter(([, cfg]) => !cfg.parentLinkId)
    .map(([linkId, cfg]) => ({ linkId, ...cfg }));
});

// ─── INSERT RETURNING(单选标量) ───
// 字段树 = 本表节点 + 每个根级关联子树;命中 source/fieldId 后由后端 _generateInsert 生成 returning
const returningTreeOpen = ref(false);

function buildReturningTree() {
  const mainTableId = properties.value?.tableId;
  if (!mainTableId) return [];
  const mainTableName = resolveNodeName(mainTableId);
  if (!mainTableName) return [];

  // 本表字段(过滤 outgoing FK,FK 由级联机制自动填,RETURNING FK 没意义)
  const mainFields = flatDbTree.value.filter(n => n.type === "field" && n.pId === mainTableId);
  const mainFieldChildren = mainFields
    .filter(f => !getFieldRelation(mainTableName, f.name))
    .map(f => ({
      key: `ret-main-${f.id}`,
      header: "field",
      label: f.name,
      fieldId: f.id,
      fieldName: f.name,
      source: "main",
    }));

  const mainNode = {
    key: "ret-table-main",
    header: "table",
    label: mainTableName,
    children: mainFieldChildren,
  };

  // 根级关联(及级联子树)。复用 buildRelationTree 已有的树结构,改 key 前缀避免冲突;
  // 同时把 field 节点附 source=linkId
  const decorate = (nodes) => nodes.map(n => {
    if (n.header === "table") {
      return { ...n, key: `ret-${n.key}`, children: decorate(n.children || []) };
    }
    // field
    return {
      ...n,
      key: `ret-${n.key}`,
      source: n.linkId,
      children: n.children ? decorate(n.children) : undefined,
    };
  });

  const relTrees = rootRelations.value.flatMap(rel => decorate(buildRelationTree(rel.linkId)));

  return [mainNode, ...relTrees];
}

const returningDisplayText = computed(() => {
  const ret = properties.value?.returningField;
  if (!ret?.source || !ret?.fieldId) return "";
  const fieldName = resolveNodeName(ret.fieldId);
  if (!fieldName) return "";
  let ownerTableName = "";
  if (ret.source === "main") {
    ownerTableName = resolveNodeName(properties.value?.tableId) || "";
  } else {
    const cfg = properties.value?.relatedFields?.[ret.source];
    ownerTableName = cfg ? (resolveNodeName(cfg.targetTableId) || "") : "";
  }
  return ownerTableName ? `${ownerTableName}.${fieldName}` : fieldName;
});

function selectReturningField(source, fieldId) {
  if (!properties.value) return;
  if (!properties.value.returningField) {
    properties.value.returningField = { source: "", fieldId: "" };
  }
  properties.value.returningField.source = source;
  properties.value.returningField.fieldId = fieldId;
  returningTreeOpen.value = false;
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

function clearReturningField() {
  if (!properties.value?.returningField) return;
  properties.value.returningField.source = "";
  properties.value.returningField.fieldId = "";
  props.value?.onExecute?.();
  props.value?.graph?.setDirtyCanvas?.(true, true);
}

// 清理无效 returningField:tableId 变化 / 关联被删除 / 字段被删除时重置
watch(
  () => [
    properties.value?.tableId,
    properties.value?.returningField?.source,
    properties.value?.returningField?.fieldId,
    Object.keys(properties.value?.relatedFields || {}).join(","),
  ],
  () => {
    const ret = properties.value?.returningField;
    if (!ret || !ret.source || !ret.fieldId) return;
    if (ret.source === "main") {
      const mainTableId = properties.value?.tableId;
      if (!mainTableId) return clearReturningField();
      const fieldNode = flatDbTree.value.find(n => n.id === ret.fieldId);
      if (!fieldNode || fieldNode.pId !== mainTableId) return clearReturningField();
    } else {
      const cfg = properties.value?.relatedFields?.[ret.source];
      if (!cfg) return clearReturningField();
      const fieldNode = flatDbTree.value.find(n => n.id === ret.fieldId);
      if (!fieldNode || fieldNode.pId !== cfg.targetTableId) return clearReturningField();
    }
  },
);


// ─── 关联编辑 menu ───
const relEditLinkId = ref(null);

// 从根 linkId 向下遍历级联树，找到实际持有 selectedFieldId 的 config 的 linkId
function findActiveLinkId(linkId) {
  const cfg = properties.value.relatedFields[linkId];
  if (cfg?.selectedFieldId) return linkId;
  const queue = [linkId];
  const visited = new Set([linkId]);
  while (queue.length > 0) {
    const cur = queue.shift();
    for (const [childId, childCfg] of Object.entries(properties.value.relatedFields || {})) {
      if (childCfg.parentLinkId === cur && !visited.has(childId)) {
        visited.add(childId);
        if (childCfg.selectedFieldId) return childId;
        queue.push(childId);
      }
    }
  }
  return null;
}

// 关联 list 项的显示文本：遍历级联链找到最终选定的表.字段
function relDisplayText(linkId, cfg) {
  const via = cfg.viaFieldName || '?';

  // 从根向下遍历级联子 config，找到 selectedFieldId
  let finalFieldId = cfg.selectedFieldId;
  if (!finalFieldId) {
    const queue = [linkId];
    const visited = new Set([linkId]);
    outer: while (queue.length > 0) {
      const cur = queue.shift();
      for (const [childId, childCfg] of Object.entries(properties.value.relatedFields || {})) {
        if (childCfg.parentLinkId === cur && !visited.has(childId)) {
          visited.add(childId);
          if (childCfg.selectedFieldId) {
            finalFieldId = childCfg.selectedFieldId;
            break outer;
          }
          queue.push(childId);
        }
      }
    }
  }

  if (!finalFieldId) {
    const targetTable = resolveNodeName(cfg.targetTableId) || '?';
    return `${via} → ${targetTable}`;
  }
  const fieldNode = flatDbTree.value.find(n => n.id === finalFieldId);
  const fieldName = fieldNode?.name || '?';
  const ownerTableName = fieldNode ? resolveNodeName(fieldNode.pId) : '?';
  return `${via} → ${ownerTableName}.${fieldName}`;
}

function getRelFieldEnabled(linkId, fieldId) {
  return properties.value.relatedFields[linkId]?.fields?.[fieldId]?.enabled || false;
}

function setRelFieldEnabled(linkId, fieldId, enabled) {
  const config = properties.value.relatedFields[linkId];
  if (!config) return;
  if (!config.fields[fieldId]) {
    config.fields[fieldId] = {};
  }
  config.fields[fieldId].enabled = enabled;
  if (enabled && isInsertOrUpdate.value) {
    const fc = config.fields[fieldId];
    if (fc.isSlot === undefined) fc.isSlot = false;
    if (fc.value === undefined) fc.value = "";
  }
  node.value?.updateFieldSlots?.();
}

// 关联表字段值更新
function updateRelFieldValue(linkId, fieldId, value) {
  const config = properties.value.relatedFields[linkId];
  if (config?.fields?.[fieldId]) {
    config.fields[fieldId].value = value;
  }
}

// 关联表字段 isSlot 切换
function toggleRelFieldSlotMode(linkId, fieldId, isSlot) {
  const config = properties.value.relatedFields[linkId];
  if (config?.fields?.[fieldId]) {
    config.fields[fieldId].isSlot = isSlot;
  }
  props.value?.updateFieldSlots?.();
}

// 判断字段是否为FK字段（关联条件中的字段）
function isFkField(rel, fieldId) {
  const fieldName = resolveNodeName(fieldId);
  if (!fieldName) return false;
  for (const cond of rel.conditions || []) {
    if (rel.direction === "incoming" && cond.sourceFieldName === fieldName) return true;
    if (rel.direction === "outgoing" && cond.targetFieldName === fieldName) return true;
  }
  return false;
}

function toggleField(fieldId, enabled) {
  updateField(`fields.${fieldId}.enabled`, enabled);
  // INSERT/UPDATE/UPSERT 模式下初始化 isSlot 和 value 默认值
  if (enabled && isInsertOrUpdate.value) {
    const config = properties.value.fields[fieldId];
    if (config && config.isSlot === undefined) updateField(`fields.${fieldId}.isSlot`, false);
    if (config && config.value === undefined) updateField(`fields.${fieldId}.value`, "");
  }
  props.value?.updateFieldSlots?.();
}

// INSERT/UPDATE 字段的 isSlot 切换
function toggleFieldSlotMode(fieldId, isSlot) {
  updateField(`fields.${fieldId}.isSlot`, isSlot);
  props.value?.updateFieldSlots?.();
}

// ─── 级联删除 ───

// 监听当前表的字段变化，自动同步 fields
watch(currentTableFields, (newFields) => {
  const tableId = properties.value.tableId;
  if (!tableId) return;

  const currentFields = properties.value.fields || {};
  const dbTreeFieldIds = new Set(newFields.map(f => f.id));
  const localFieldIds = new Set(Object.keys(currentFields));

  let changed = false;
  const updatedFields = { ...currentFields };

  for (const f of newFields) {
    if (!localFieldIds.has(f.id)) {
      updatedFields[f.id] = { enabled: false };
      changed = true;
    }
  }

  for (const fieldId of localFieldIds) {
    if (!dbTreeFieldIds.has(fieldId)) {
      delete updatedFields[fieldId];
      changed = true;
    }
  }

  if (changed) {
    updateField("fields", updatedFields);

    const where = (properties.value.where || []).filter(w => dbTreeFieldIds.has(w.fieldId) || !w.fieldId);
    updateField("where", where);

    const orderBy = (properties.value.orderBy || []).filter(ob => dbTreeFieldIds.has(ob.fieldId) || !ob.fieldId);
    updateField("orderBy", orderBy);

    if (properties.value.groupBy?.fieldIds) {
      const groupFieldIds = properties.value.groupBy.fieldIds.filter(id => dbTreeFieldIds.has(id));
      updateField("groupBy.fieldIds", groupFieldIds);
    }

    if (properties.value.groupBy?.aggregates) {
      const aggregates = properties.value.groupBy.aggregates.filter(a => dbTreeFieldIds.has(a.fieldId) || !a.fieldId);
      updateField("groupBy.aggregates", aggregates);
    }

    // 清理 having — 检查引用的聚合别名是否仍然存在
    if (properties.value.having?.field) {
      const currentAggAliases = (properties.value.groupBy?.aggregates || [])
        .map(a => a.alias || `${a.func}_${resolveNodeName(a.fieldId) || a.fieldId}`)
        .filter(Boolean);
      if (!currentAggAliases.includes(properties.value.having.field)) {
        updateField("having.field", "");
      }
    }

    props.value?.updateFieldSlots?.();
  }
}, { deep: true });

// 监听 dbTree 变化检测表是否被删除
watch(flatDbTree, () => {
  const tableId = properties.value.tableId;

  // 检查父节点的 dbConnectionId 对应的连接是否仍存在
  const dbId = parentDbConnectionId.value;
  if (dbId && !flatDbTree.value.some(n => n.id === dbId)) {
    // 父节点的连接被删除，清空本节点的表和字段
    updateField("tableId", "");
    updateField("fields", {});
    props.value?.updateFieldSlots?.();
    return;
  }

  if (tableId && !flatDbTree.value.some(n => n.id === tableId)) {
    updateField("tableId", "");
    updateField("fields", {});
    props.value?.updateFieldSlots?.();
  }
});

onMounted(() => {
  // 旧数据迁移：tableName -> tableId, fields name key -> id key
  if (properties.value.tableName && !properties.value.tableId) {
    const tableNode = flatDbTree.value.find(
      n => n.type === "table" && n.name === properties.value.tableName
    );
    if (tableNode) {
      updateField("tableId", tableNode.id);

      // 迁移 fields：name key -> id key
      const oldFields = properties.value.fields || {};
      const newFields = {};
      const fieldNodes = flatDbTree.value.filter(n => n.type === "field" && n.pId === tableNode.id);

      for (const [oldName, config] of Object.entries(oldFields)) {
        const fieldNode = fieldNodes.find(f => f.name === oldName);
        if (fieldNode) {
          newFields[fieldNode.id] = config;
        }
      }
      updateField("fields", newFields);

      // 迁移 where[].field -> where[].fieldId
      const where = (properties.value.where || []).map(w => {
        if (w.field !== undefined && w.fieldId === undefined) {
          const fn = fieldNodes.find(f => f.name === w.field);
          return { ...w, fieldId: fn?.id || "", field: undefined };
        }
        return w;
      });
      updateField("where", where);

      // 迁移 orderBy[].field -> orderBy[].fieldId
      const orderBy = (properties.value.orderBy || []).map(ob => {
        if (ob.field !== undefined && ob.fieldId === undefined) {
          const fn = fieldNodes.find(f => f.name === ob.field);
          return { ...ob, fieldId: fn?.id || "", field: undefined };
        }
        return ob;
      });
      updateField("orderBy", orderBy);

      // 迁移 groupBy.fields -> groupBy.fieldIds
      if (properties.value.groupBy?.fields && !properties.value.groupBy?.fieldIds) {
        const fieldIds = properties.value.groupBy.fields
          .map(name => fieldNodes.find(f => f.name === name)?.id)
          .filter(Boolean);
        updateField("groupBy.fieldIds", fieldIds);
      }

      // 迁移 groupBy.aggregates[].field -> fieldId
      if (properties.value.groupBy?.aggregates) {
        const aggregates = properties.value.groupBy.aggregates.map(a => {
          if (a.field !== undefined && a.fieldId === undefined) {
            const fn = fieldNodes.find(f => f.name === a.field);
            return { ...a, fieldId: fn?.id || "", field: undefined };
          }
          return a;
        });
        updateField("groupBy.aggregates", aggregates);
      }

      // 清理旧字段名
      delete properties.value.tableName;

      props.value?.updateFieldSlots?.();
    }
  }

  // 同步父节点的 dbConnectionId
  if (parentDbConnectionId.value && !properties.value.dbConnectionId) {
    updateField("dbConnectionId", parentDbConnectionId.value);
  }

  // 迁移旧 relatedFields：扁平结构 → 链式结构
  // 旧格式特征:key 是 tableId,cfg 无 path、无 targetTableId(用 key 当 tableId)、有 fields
  // 新格式 cfg 也有 fields(getOrInitRelatedConfig 初始化),但显式带 targetTableId,据此区分
  if (properties.value.relatedFields) {
    const oldRelFields = properties.value.relatedFields;
    const needsMigration = Object.values(oldRelFields).some(
      v => v && !v.path && !v.targetTableId && v.fields
    );
    if (needsMigration) {
      const newRelFields = {};
      for (const [relTableId, config] of Object.entries(oldRelFields)) {
        if (!config) continue;
        // 已是新格式(树状) → 原样保留
        if (config.path || config.targetTableId) {
          newRelFields[relTableId] = config;
          continue;
        }
        const relTableName = resolveNodeName(relTableId);
        if (!relTableName) continue;

        const selectedFieldId = config.selectedFieldId;
        const enabledFields = Object.entries(config.fields || {}).filter(([_, fc]) => fc.enabled);

        if (selectedFieldId) {
          const fieldName = resolveNodeName(selectedFieldId);
          newRelFields[uid()] = {
            path: [{ tableId: relTableId, tableName: relTableName, viaFieldName: config.viaFieldName || "", joinType: config.joinType || "left" }],
            targetFieldId: selectedFieldId,
            targetFieldName: fieldName || "",
            targetTableId: relTableId,
          };
        } else if (enabledFields.length > 0) {
          for (const [fieldId, fc] of enabledFields) {
            const fieldName = resolveNodeName(fieldId);
            newRelFields[uid()] = {
              path: [{ tableId: relTableId, tableName: relTableName, viaFieldName: config.viaFieldName || "", joinType: config.joinType || "left" }],
              targetFieldId: fieldId,
              targetFieldName: fieldName || "",
              targetTableId: relTableId,
            };
          }
        }
      }
      updateField("relatedFields", newRelFields);
      props.value?.updateFieldSlots?.();
    }
  }
});

// ─── WHERE 条件 ───

const operatorOptions = [
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
  { label: '>', value: '>' },
  { label: '<', value: '<' },
  { label: '>=', value: '>=' },
  { label: '<=', value: '<=' },
  { label: 'LIKE', value: 'like' },
  // P0-1: 新增 ilike(大小写不敏感)
  { label: 'ILIKE (大小写不敏感)', value: 'ilike' },
  { label: 'IN', value: 'in' },
  { label: 'NOT IN', value: 'not in' },
  { label: 'BETWEEN', value: 'between' },
  // P0-1: 新增 not between
  { label: 'NOT BETWEEN', value: 'not between' },
  { label: 'IS NULL', value: 'is null' },
  { label: 'IS NOT NULL', value: 'is not null' },
];

// having 单条件 / 多条件的 operator 列表(与 where 大体对齐,但 exists 系列用 havingExists/havingNotExists 区别名)
const havingOperatorOptions = [
  { label: '=', value: '=' },
  { label: '!=', value: '!=' },
  { label: '>', value: '>' },
  { label: '<', value: '<' },
  { label: '>=', value: '>=' },
  { label: '<=', value: '<=' },
  { label: 'LIKE', value: 'like' },
  { label: 'ILIKE (大小写不敏感)', value: 'ilike' },
  { label: 'IN', value: 'in' },
  { label: 'NOT IN', value: 'not in' },
  { label: 'BETWEEN', value: 'between' },
  { label: 'NOT BETWEEN', value: 'not between' },
  { label: 'IS NULL', value: 'is null' },
  { label: 'IS NOT NULL', value: 'is not null' },
  { label: 'HAVING EXISTS (子查询)', value: 'havingExists' },
  { label: 'HAVING NOT EXISTS', value: 'havingNotExists' },
  { label: 'RAW (任意 knex.raw 表达式)', value: 'raw' },
];

function isHavingNoFieldOp(op) {
  return op === 'havingExists' || op === 'havingNotExists' || op === 'raw';
}

// CTE 链:增减 cteCount + 触发 node 同步 input slot
function adjustCteCount(delta) {
  const cur = properties.value.cteCount || 0;
  const next = Math.max(0, Math.min(10, cur + delta));
  if (next === cur) return;
  updateField('cteCount', next);
  props.value?.updateCtesSlots?.();
}

function addWhereCondition() {
  const where = [...(properties.value.where || [])];
  where.push({ fieldId: '', operator: '=', value: '', isSlot: false, slotId: `where_${uid()}` });
  updateField('where', where);
}

function removeWhereCondition(index) {
  const w = properties.value.where[index];
  if (w.isSlot) {
    const slotIdx = props.value?.inputs?.findIndex(s => s.name === w.slotId || s.id === w.slotId);
    if (slotIdx >= 0) props.value?.removeInput(slotIdx);
  }
  const where = [...properties.value.where];
  where.splice(index, 1);
  updateField('where', where);
}

function toggleWhereSlot(index, isSlot) {
  updateField(`where.${index}.isSlot`, isSlot);
  props.value?.updateWhereSlots?.();
}

// ─── ORDER BY ───

function addOrderBy() {
  const orderBy = [...(properties.value.orderBy || [])];
  orderBy.push({ fieldId: '', direction: 'asc' });
  updateField('orderBy', orderBy);
}

function removeOrderBy(index) {
  const orderBy = [...properties.value.orderBy];
  orderBy.splice(index, 1);
  updateField('orderBy', orderBy);
}

// ─── LIMIT / OFFSET ───

function toggleLimitSlot(key, isSlot) {
  updateField(`${key}.isSlot`, isSlot);
  props.value?.updateWhereSlots?.();
}

// ─── GROUP BY / 聚合 ───

const aggFuncOptions = [
  { label: 'COUNT', value: 'count' },
  { label: 'SUM', value: 'sum' },
  { label: 'AVG', value: 'avg' },
  { label: 'MIN', value: 'min' },
  { label: 'MAX', value: 'max' },
];

const havingFieldOptions = computed(() =>
  (properties.value.groupBy?.aggregates || [])
    .map(agg => agg.alias || `${agg.func}_${resolveNodeName(agg.fieldId) || agg.fieldId}`)
    .filter(Boolean)
);

function addAggregate() {
  // P0-12: 写到顶层 aggregates,不再写 groupBy.aggregates
  const aggregates = [...(properties.value.aggregates || properties.value.groupBy?.aggregates || [])];
  aggregates.push({ func: 'count', fieldId: '', alias: '', distinct: false });
  updateField('aggregates', aggregates);
}

function removeAggregate(index) {
  const aggregates = [...(properties.value.aggregates || [])];
  aggregates.splice(index, 1);
  updateField('aggregates', aggregates);
}

function updateAggField(index, val) {
  updateField(`aggregates.${index}.fieldId`, val);
  const agg = (properties.value.aggregates || [])[index];
  const fieldName = resolveNodeName(val);
  if (agg && !agg.alias && agg.func && fieldName) {
    updateField(`aggregates.${index}.alias`, `${agg.func}_${fieldName}`);
  }
}

// ─── 批量模式 ───

const failStrategyOptions = [
  { label: "整体回滚", value: "rollback" },
  { label: "跳过失败项", value: "skip" },
  { label: "收集错误继续", value: "collect" },
];

// 字段名选项列表（用于批量映射的目标字段）
const fieldNameOptions = computed(() =>
  Object.entries(properties.value.fields || {})
    .map(([fieldId]) => {
      const name = resolveNodeName(fieldId);
      return name ? { label: name, value: name } : null;
    })
    .filter(Boolean)
);

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
    props.value?.updateFieldSlots?.();
  }
}

function onBatchDataSlotToggle(val) {
  updateField("batchDataSlot", val);
  node.value?.updateBatchSlot?.();
}

// 添加一个新的映射条目
function addFieldMapping() {
  const mapping = { ...(properties.value.fieldMapping || {}) };
  const tempKey = `prop_${uid().slice(0, 6)}`;
  mapping[tempKey] = "";
  updateField("fieldMapping", mapping);
}

// 更新映射的属性名
function updateMappingKey(oldKey, newKey) {
  if (oldKey === newKey || !newKey) return;
  const mapping = { ...(properties.value.fieldMapping || {}) };
  const value = mapping[oldKey];
  delete mapping[oldKey];
  mapping[newKey] = value;
  updateField("fieldMapping", mapping);
}

// 更新映射的目标字段
function updateMappingValue(key, fieldName) {
  updateField(`fieldMapping.${key}`, fieldName);
}

// 删除映射条目
function removeMappingEntry(key) {
  const mapping = { ...(properties.value.fieldMapping || {}) };
  delete mapping[key];
  updateField("fieldMapping", mapping);
}

// 解析：自动根据当前表字段生成映射（属性名=字段名）
function autoGenerateMapping() {
  const mapping = {};
  for (const [fieldId, config] of Object.entries(properties.value.fields || {})) {
    if (!config.enabled) continue;
    const fieldName = resolveNodeName(fieldId);
    if (fieldName) {
      mapping[fieldName] = fieldName;
    }
  }
  updateField("fieldMapping", mapping);
}

// ─── 验证 ───

// upsert 冲突字段是否在 DB 端有唯一约束(供 UI 提示 + 后端代码生成自动决策同源)
const upsertHasConstraint = computed(() => {
  const p = properties.value;
  if (p.crudType !== 'upsert') return false;
  if (!p.tableId || !p.conflictFields?.length) return false;
  return node.value?._hasUniqueConstraint?.(p.tableId, p.conflictFields) || false;
});

const validationErrors = computed(() => {
  const errs = [];
  const p = properties.value;

  if (!p.tableId && !p.tableNameSlot) errs.push('请选择数据库表或开启子查询输入');
  if (!parentDbConnectionId.value) errs.push('父节点未选择数据库连接');

  if (p.crudType === 'select') {
    const hasEnabled = Object.values(p.fields || {}).some(f => f.enabled);
    if (!hasEnabled && !p.tableNameSlot) errs.push('请至少选择一个字段');
  }

  if (p.crudType === 'upsert') {
    const hasEnabled = Object.values(p.fields || {}).some(f => f.enabled);
    if (!hasEnabled) errs.push('请至少选择一个字段');
    if (!p.conflictFields || p.conflictFields.length === 0) errs.push('请选择冲突字段');
  }

  if ((p.crudType === 'delete' || p.crudType === 'update') && (!p.where || p.where.length === 0)) {
    errs.push(`危险：无 WHERE 条件的 ${p.crudType.toUpperCase()}`);
  }

  if (p.having?.enabled && !p.groupBy?.enabled) {
    errs.push('HAVING 需要配合 GROUP BY 使用');
  }

  return errs;
});

// 非阻断性提示：用户可以继续保存,但需要意识到生成代码的副作用
const validationWarnings = computed(() => {
  const warns = [];
  const p = properties.value;

  if (p.crudType !== 'upsert') return warns;
  if (!p.conflictFields?.length) return warns;

  if (!upsertHasConstraint.value) {
    warns.push('冲突字段在 DB 端无唯一约束/主键,将使用"先查后改"策略。高并发下两个请求可能都进入 INSERT 分支造成重复;建议在 dbDragEditor 给字段加 PK 或 unique index');
  }

  const hasRelated = Object.keys(p.relatedFields || {}).length > 0;
  if (hasRelated) {
    warns.push('子表按 FK 走幂等 upsert(查 FK + UPDATE/INSERT)。一对多关系下默认只更新第一条命中记录');
  }

  return warns;
});
</script>

<template>
  <BasePropertyPanel v-model="props" :code-content="generatedCodePreview">
    <div v-if="properties" class="column q-pa-sm q-gutter-y-sm">
      <!-- 数据库连接来源提示（来自父 DatabaseSubgraph） -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">数据库连接</div>
          <div class="text-body2 text-grey-4">
            <q-icon name="link" size="sm" class="q-mr-xs" />
            {{ parentDbConnectionId ? '已继承父节点连接' : '父节点未配置连接' }}
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 1：查询配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">查询配置</div>

          <!-- 表名选择 + 子查询 toggle -->
          <div class="row items-center q-mb-xs">
            <q-select v-if="!properties.tableNameSlot" dense dark outlined :model-value="properties.tableId"
              @update:model-value="onTableSelect" :options="tableList" label="数据库表" emit-value map-options
              class="col" />
            <div v-else class="col text-body2 text-grey-4 q-pa-xs">
              <q-icon name="input" size="sm" class="q-mr-xs" />
              通过 slot 接收上游 Table 节点的查询
            </div>

            <q-toggle v-model="properties.tableNameSlot" dense dark size="sm" label="子查询输入" class="q-ml-sm"
              @update:model-value="onTableNameSlotToggle" />
          </div>

          <q-select dense dark outlined :model-value="properties.crudType" @update:model-value="onCrudTypeChange"
            :options="crudTypeOptions" label="操作类型" emit-value map-options />

          <!-- UPSERT：策略自动判定指示 -->
          <div v-if="isUpsert && properties.conflictFields?.length"
            class="row items-center q-mt-xs q-pa-xs rounded-borders"
            :class="upsertHasConstraint ? 'bg-positive text-white' : 'bg-orange-9 text-white'">
            <q-icon :name="upsertHasConstraint ? 'verified' : 'warning'" size="xs" class="q-mr-xs" />
            <span class="text-caption">
              {{ upsertHasConstraint ? '冲突字段有唯一约束 → ON CONFLICT' : '冲突字段无唯一约束 → 先查后改' }}
            </span>
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 2:字段列表(DELETE 模式下退化为级联子表选择,只显示关联区) -->
      <q-card v-if="properties.tableId" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">
            {{ fieldsHeaderLabel }}
          </div>

          <!-- UPSERT：字段选择 -->
          <q-select v-if="isUpsert"
            dense dark outlined multiple
            :model-value="properties.conflictFields"
            @update:model-value="val => updateField('conflictFields', val)"
            :options="conflictFieldOptions"
            emit-value map-options
            label="冲突字段"
            class="q-mb-xs"
          />

          <!-- 输出字段行(DELETE 不勾主表字段) -->
          <template v-if="properties.crudType !== 'delete'">
            <div v-for="(config, fieldId) in localFields" :key="fieldId" class="row items-center q-mb-xs">
              <q-checkbox dense dark :model-value="config.enabled" @update:model-value="val => toggleField(fieldId, val)"
                size="sm" />
              <span class="text-body2 q-mx-sm" style="min-width: 80px;">{{ fieldNameMap[fieldId] || fieldId }}</span>

              <!-- INSERT/UPDATE：isSlot + 值（非批量） -->
              <template v-if="isInsertOrUpdate && config.enabled && !properties.batchMode.enabled">
                <q-toggle dense dark size="sm" :model-value="config.isSlot"
                  @update:model-value="val => toggleFieldSlotMode(fieldId, val)" label="Slot" />
                <q-input dense dark outlined :model-value="config.value"
                  @update:model-value="val => updateField(`fields.${fieldId}.value`, val)" :disable="config.isSlot"
                  placeholder="值" style="width: 90px;" debounce="200" />
              </template>
              <q-space />
            </div>
          </template>

          <!-- ─── 分割线 + 关联字段区 ─── -->
          <template v-if="properties.tableId && !properties.batchMode?.enabled">
            <div class="row items-center q-mt-sm q-mb-xs">
              <q-separator dark class="col" />
              <span class="text-caption text-grey-6 q-mx-sm">关联</span>
              <q-separator dark class="col" />
              <q-btn-dropdown flat dense dark icon="add" color="cyan" size="sm" class="q-ml-xs"
                :disable="availableJoinFields.length === 0" content-class="bg-dark"
                @mousedown.stop @click.stop>
                <q-list dense dark>
                  <q-item v-for="item in availableJoinFields" :key="`${item.targetTableId}_${item.fieldName}`" clickable v-close-popup
                    @click="addRelatedTable(item)">
                    <q-item-section>
                      <q-item-label>{{ item.fieldName }} → {{ item.targetTableName }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </q-list>
              </q-btn-dropdown>
            </div>

            <!-- 关联 list -->
            <div v-for="rel in rootRelations" :key="rel.linkId"
              class="column q-mb-xs q-pa-xs rounded-borders"
              style="border: 1px solid rgba(255,255,255,0.1);">
              <div class="row items-center cursor-pointer">
                <q-icon name="link" size="xs" color="cyan" class="q-mr-xs" />
                <span class="text-body2 text-grey-3 col ellipsis">{{ relDisplayText(rel.linkId, rel) }}</span>
                <!-- 输入框群体:外层 wrapper 拦截所有 pointer/键盘事件,
                     防止 input 内拖动越界触发上方 q-btn-dropdown / 同行 q-menu -->
                <div v-if="findActiveLinkId(rel.linkId) && (isSelect || isInsertOrUpdate)"
                  class="row items-center q-gutter-x-xs"
                  @click.stop @mousedown.stop @mouseup.stop
                  @keydown.stop @keyup.stop @keypress.stop>
                  <q-input v-if="isSelect" dense dark outlined
                    :model-value="properties.relatedFields[findActiveLinkId(rel.linkId)]?.alias || ''"
                    @update:model-value="val => updateRelAlias(findActiveLinkId(rel.linkId), val)"
                    placeholder="别名" style="width: 90px; font-size: 12px;" debounce="300"
                    @keydown.enter.prevent.stop @keyup.enter.prevent.stop />
                  <template v-if="isInsertOrUpdate">
                    <q-toggle dense dark size="sm"
                      :model-value="properties.relatedFields[findActiveLinkId(rel.linkId)]?.isSlot || false"
                      @update:model-value="val => toggleRelSlotMode(findActiveLinkId(rel.linkId), val)"
                      label="Slot" />
                    <q-input dense dark outlined
                      :model-value="properties.relatedFields[findActiveLinkId(rel.linkId)]?.value || ''"
                      @update:model-value="val => updateRelValue(findActiveLinkId(rel.linkId), val)"
                      :disable="properties.relatedFields[findActiveLinkId(rel.linkId)]?.isSlot"
                      placeholder="值" style="width: 90px; font-size: 12px;" debounce="200"
                      @keydown.enter.prevent.stop @keyup.enter.prevent.stop />
                  </template>
                </div>
                <q-btn flat dense icon="close" size="xs" color="negative"
                  @click.stop="removeRelatedTable(rel.linkId)" />

              <!-- 点击 item 弹出 menu -->
              <q-menu dark class="bg-dark" @before-show="relEditLinkId = rel.linkId">
                <q-card flat dark style="min-width: 220px;">
                  <q-card-section class="q-pa-sm">
                    <div class="text-caption text-grey-5 q-mb-xs">选择关联字段</div>
                    <q-tree v-if="relEditLinkId === rel.linkId"
                      :nodes="buildRelationTree(rel.linkId)" node-key="key"
                      dark dense default-expand-all>
                      <template #header-table="{ node }">
                        <div class="row items-center full-width no-wrap">
                          <span class="text-caption text-grey-5">{{ node.tableName }}</span>
                        </div>
                      </template>

                      <template #header-field="{ node }">
                        <div class="row items-center no-wrap q-pa-xs rounded-borders"
                          :class="[
                            node.isFK || properties.crudType !== 'delete'
                              ? 'cursor-pointer'
                              : 'cursor-not-allowed',
                            {
                              'bg-cyan-9':
                                !node.isFK &&
                                properties.relatedFields[node.linkId]?.selectedFieldId === node.fieldId,
                            },
                          ]"
                          @click="node.isFK
                            ? (!node.hasCascade && expandCascadeFromTree(node.linkId, node.fieldName))
                            : (properties.crudType === 'delete'
                                ? null
                                : selectRelField(node.linkId, node.fieldId))"
                          v-close-popup="!node.isFK && properties.crudType !== 'delete'">
                          <span class="text-body2" :class="{
                            'text-cyan': node.isFK && !node.hasCascade,
                            'text-cyan-8': node.isFK && node.hasCascade,
                            'text-grey-3': !node.isFK && properties.crudType !== 'delete',
                            'text-grey-7': !node.isFK && properties.crudType === 'delete'
                          }">{{ node.fieldName }}</span>
                        </div>
                      </template>
                    </q-tree>
                  </q-card-section>
                </q-card>
              </q-menu>
              </div>
            </div>
          </template>

          <!-- ─── INSERT RETURNING 字段树(单选标量) ─── -->
          <template v-if="properties.crudType === 'insert' && properties.tableId">
            <div class="row items-center q-mt-sm q-mb-xs">
              <q-separator dark class="col" />
              <span class="text-caption text-grey-6 q-mx-sm">RETURNING(返回单字段)</span>
              <q-separator dark class="col" />
            </div>
            <div class="row items-center q-gutter-x-xs">
              <q-btn-dropdown dense dark flat outline color="cyan" size="sm"
                :label="returningDisplayText || '选择字段'"
                :disable="properties.batchMode?.enabled"
                content-class="bg-dark" class="col"
                v-model="returningTreeOpen">
                <q-card flat dark style="min-width: 240px;">
                  <q-card-section class="q-pa-sm">
                    <q-tree :nodes="buildReturningTree()" node-key="key"
                      dark dense default-expand-all>
                      <template #header-table="{ node }">
                        <div class="row items-center full-width no-wrap">
                          <span class="text-caption text-grey-5">{{ node.label }}</span>
                        </div>
                      </template>
                      <template #header-field="{ node }">
                        <div class="row items-center no-wrap q-pa-xs rounded-borders cursor-pointer"
                          :class="{
                            'bg-cyan-9': properties.returningField?.source === node.source && properties.returningField?.fieldId === node.fieldId
                          }"
                          @click="selectReturningField(node.source, node.fieldId)">
                          <span class="text-body2 text-grey-3">{{ node.fieldName }}</span>
                        </div>
                      </template>
                    </q-tree>
                  </q-card-section>
                </q-card>
              </q-btn-dropdown>
              <q-btn v-if="returningDisplayText" flat dense icon="close" size="xs" color="negative"
                @click="clearReturningField" />
            </div>
            <div v-if="properties.batchMode?.enabled" class="text-caption text-grey-6 q-mt-xs">
              批量模式下 RETURNING 不可用
            </div>
          </template>
        </q-card-section>
      </q-card>

      <!-- 分区 2.5：输出形态（仅 select 显示） -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm q-gutter-y-sm">
          <div class="text-caption text-grey-5">输出形态 (result.mode)</div>
          <q-btn-toggle
            :model-value="properties.result?.mode || 'rows'"
            @update:model-value="val => updateField('result.mode', val)"
            :options="[
              { label: '多行', value: 'rows' },
              { label: '首行', value: 'first' },
              { label: '总行数', value: 'count' }
            ]"
            dense dark unelevated toggle-color="primary" class="full-width"
          />

          <div v-if="properties.result?.mode === 'count'" class="text-caption text-grey-6 q-mt-xs">
            输出 number；忽略字段勾选与 LIMIT
          </div>
          <div v-else-if="properties.result?.mode === 'first'" class="text-caption text-grey-6 q-mt-xs">
            取首行对象,无行时 null;末尾追加 <code class="bg-grey-9 q-px-xs">.first()</code>
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 3：WHERE 条件（INSERT 时隐藏） -->
      <q-card v-if="properties.crudType !== 'insert' && properties.crudType !== 'upsert'" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-mb-xs">
            <div class="text-caption text-grey-5">WHERE 条件</div>
            <q-space />
            <q-select dense dark outlined :model-value="properties.whereLogic"
              @update:model-value="val => updateField('whereLogic', val)"
              :options="[{ label: 'AND', value: 'and' }, { label: 'OR', value: 'or' }]" emit-value map-options
              style="width: 80px;" />
            <q-btn flat dense icon="add" color="primary" @click="addWhereCondition" size="sm" />
          </div>

          <div v-for="(w, index) in properties.where" :key="w.slotId" class="q-mb-sm">
            <div class="row items-center q-gutter-x-xs">
              <!-- 字段选择 -->
              <q-select dense dark outlined :model-value="w.fieldId"
                @update:model-value="val => updateField(`where.${index}.fieldId`, val)" :options="fieldOptionList"
                emit-value map-options style="width: 100px;" label="字段" />

              <!-- 运算符 -->
              <q-select dense dark outlined :model-value="w.operator"
                @update:model-value="val => updateField(`where.${index}.operator`, val)" :options="operatorOptions"
                emit-value map-options style="width: 90px;" label="运算符" />

              <!-- P0-2: 取反 toggle -->
              <q-toggle dense dark :model-value="!!w.negated"
                @update:model-value="val => updateField(`where.${index}.negated`, val)"
                size="sm" label="NOT" />

              <!-- isSlot toggle + 值输入 -->
              <q-toggle dense dark :model-value="w.isSlot" @update:model-value="val => toggleWhereSlot(index, val)"
                size="sm" label="Slot" />
              <q-input dense dark outlined :model-value="w.value"
                @update:model-value="val => updateField(`where.${index}.value`, val)" :disable="w.isSlot"
                placeholder="值"
                style="width: 80px;" debounce="200" />

              <!-- 删除 -->
              <q-btn flat dense icon="close" color="negative" @click="removeWhereCondition(index)" size="sm" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 4：ORDER BY（仅 SELECT） -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-mb-xs">
            <div class="text-caption text-grey-5">ORDER BY</div>
            <q-space />
            <q-btn flat dense icon="add" color="primary" @click="addOrderBy" size="sm" />
          </div>

          <div v-for="(ob, index) in properties.orderBy" :key="index" class="row items-center q-gutter-x-xs q-mb-xs">
            <q-select dense dark outlined :model-value="ob.fieldId"
              @update:model-value="val => updateField(`orderBy.${index}.fieldId`, val)" :options="fieldOptionList"
              emit-value map-options style="width: 120px;" />
            <q-select dense dark outlined :model-value="ob.direction"
              @update:model-value="val => updateField(`orderBy.${index}.direction`, val)"
              :options="[{ label: 'ASC', value: 'asc' }, { label: 'DESC', value: 'desc' }]" emit-value map-options
              style="width: 80px;" />
            <!-- P0-7: NULLS first/last -->
            <q-select dense dark outlined :model-value="ob.nullsPosition || 'default'"
              @update:model-value="val => updateField(`orderBy.${index}.nullsPosition`, val === 'default' ? '' : val)"
              :options="[
                { label: 'NULLS 默认', value: 'default' },
                { label: 'NULLS FIRST', value: 'first' },
                { label: 'NULLS LAST', value: 'last' }
              ]" emit-value map-options style="width: 120px;" />
            <q-btn flat dense icon="close" color="negative" @click="removeOrderBy(index)" size="sm" />
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 5：LIMIT / OFFSET（仅 SELECT） -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">LIMIT / OFFSET</div>

          <div class="row items-center q-gutter-x-xs q-mb-xs">
            <q-toggle dense dark size="sm" :model-value="properties.limit?.isSlot"
              @update:model-value="val => toggleLimitSlot('limit', val)" label="Limit" />
            <q-input dense dark outlined :model-value="properties.limit?.value"
              @update:model-value="val => updateField('limit.value', val)" :disable="properties.limit?.isSlot"
              type="number" style="width: 80px;" />
          </div>

          <div class="row items-center q-gutter-x-xs">
            <q-toggle dense dark size="sm" :model-value="properties.offset?.isSlot"
              @update:model-value="val => toggleLimitSlot('offset', val)" label="Offset" />
            <q-input dense dark outlined :model-value="properties.offset?.value"
              @update:model-value="val => updateField('offset.value', val)" :disable="properties.offset?.isSlot"
              type="number" style="width: 80px;" />
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 5.5：高级选项(P0-5/P0-6/P0-9) -->
      <q-card v-if="properties.crudType === 'select' || properties.crudType === 'update' || properties.crudType === 'delete' || properties.crudType === 'upsert'" dark flat bordered>
        <q-card-section class="q-pa-sm q-gutter-y-sm">
          <div class="text-caption text-grey-5">高级选项</div>

          <!-- P0-9: SELECT 行锁(仅事务环境生效) -->
          <div v-if="properties.crudType === 'select'" class="row items-center q-gutter-x-xs">
            <div class="text-caption text-grey-6" style="width: 110px;">行锁(lockMode)</div>
            <q-select dense dark outlined :model-value="properties.lockMode || 'none'"
              @update:model-value="val => updateField('lockMode', val)"
              :options="[
                { label: '无', value: 'none' },
                { label: 'FOR UPDATE', value: 'forUpdate' },
                { label: 'FOR SHARE', value: 'forShare' }
              ]" emit-value map-options style="width: 160px;" />
            <q-select v-if="(properties.lockMode || 'none') !== 'none'" dense dark outlined
              :model-value="properties.lockModifier || 'none'"
              @update:model-value="val => updateField('lockModifier', val)"
              :options="[
                { label: '阻塞等待', value: 'none' },
                { label: 'SKIP LOCKED', value: 'skipLocked' },
                { label: 'NOWAIT', value: 'noWait' }
              ]" emit-value map-options style="width: 160px;" />
            <span class="text-caption text-grey-7">仅父事务环境生效</span>
          </div>

          <!-- P0-6: UPDATE/DELETE/UPSERT returning(upsert 用此勾选决定 .returning 列,_result 数组每行字段) -->
          <div v-if="['update','delete','upsert'].includes(properties.crudType)" class="row items-center q-gutter-x-xs">
            <div class="text-caption text-grey-6" style="width: 110px;">RETURNING</div>
            <q-select dense dark outlined multiple use-chips
              :model-value="properties.returningFields || []"
              @update:model-value="val => updateField('returningFields', val || [])"
              :options="fieldOptionList" emit-value map-options
              style="min-width: 200px;" placeholder="选择需要返回的字段(upsert 默认 id)" />
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 6：GROUP BY（仅 SELECT） -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-mb-xs">
            <div class="text-caption text-grey-5">GROUP BY</div>
            <q-space />
            <q-toggle dense dark size="sm" :model-value="properties.groupBy?.enabled"
              @update:model-value="val => updateField('groupBy.enabled', val)" />
          </div>

          <template v-if="properties.groupBy?.enabled">
            <!-- 分组字段多选 -->
            <q-select dense dark outlined :model-value="properties.groupBy.fieldIds"
              @update:model-value="val => updateField('groupBy.fieldIds', val)" :options="fieldOptionList" multiple
              emit-value label="分组字段" class="q-mb-xs" />
          </template>
        </q-card-section>
      </q-card>

      <!-- 分区 6.5：聚合(P0-12 解耦 GROUP BY,可独立于 GROUP BY 使用;仅 SELECT 显示) -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-mb-xs">
            <div class="text-caption text-grey-5">聚合函数</div>
            <q-space />
            <q-btn flat dense icon="add" color="primary" @click="addAggregate" label="添加" size="sm" />
          </div>
          <div v-if="!(properties.aggregates || properties.groupBy?.aggregates || []).length"
            class="text-caption text-grey-7">
            无聚合;result.mode='aggregate' 时整表聚合,GROUP BY 启用时分组聚合
          </div>
          <div v-for="(agg, index) in (properties.aggregates || properties.groupBy?.aggregates || [])" :key="index"
            class="row items-center q-gutter-x-xs q-mb-xs">
            <q-select dense dark outlined :model-value="agg.func"
              @update:model-value="val => updateField(`aggregates.${index}.func`, val)"
              :options="aggFuncOptions" emit-value map-options style="width: 80px;" />
            <q-select dense dark outlined :model-value="agg.fieldId"
              @update:model-value="val => updateAggField(index, val)" :options="fieldOptionList" emit-value
              map-options style="width: 100px;" />
            <q-input dense dark borderless :model-value="agg.alias"
              @update:model-value="val => updateField(`aggregates.${index}.alias`, val)" placeholder="别名"
              style="width: 80px;" debounce="300" />
            <!-- P0-11: distinct toggle(仅 count/sum/avg 有效) -->
            <q-toggle dense dark size="sm" :model-value="!!agg.distinct"
              @update:model-value="val => updateField(`aggregates.${index}.distinct`, val)"
              label="DISTINCT" />
            <q-btn flat dense icon="close" color="negative" @click="removeAggregate(index)" size="sm" />
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 7：HAVING -->
      <q-card v-if="properties.groupBy?.enabled" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-mb-xs">
            <div class="text-caption text-grey-5">HAVING</div>
            <q-space />
            <q-toggle dense dark size="sm" :model-value="properties.having?.enabled"
              @update:model-value="val => updateField('having.enabled', val)" />
          </div>

          <template v-if="properties.having?.enabled">
            <div class="row items-center q-gutter-x-xs">
              <q-select dense dark outlined :model-value="properties.having.field"
                @update:model-value="val => updateField('having.field', val)" :options="havingFieldOptions" emit-value
                map-options style="width: 100px;" label="字段"
                :disable="isHavingNoFieldOp(properties.having.operator)" />
              <q-select dense dark outlined :model-value="properties.having.operator"
                @update:model-value="val => updateField('having.operator', val)" :options="havingOperatorOptions" emit-value
                map-options style="width: 90px;" />
              <q-toggle dense dark size="sm" :model-value="properties.having.isSlot"
                @update:model-value="val => { updateField('having.isSlot', val); props.value?.updateWhereSlots?.() }"
                label="Slot" />
              <q-input dense dark outlined :model-value="properties.having.value"
                @update:model-value="val => updateField('having.value', val)" :disable="properties.having.isSlot"
                :placeholder="isHavingNoFieldOp(properties.having.operator) ? '建议 isSlot 接 builder/raw' : '值'"
                style="width: 80px;" />
            </div>
            <div class="text-caption text-grey-7 q-mt-xs">
              多条件 / 嵌套 group(P2-1 having)节点代码已支持(<code class="bg-grey-9 q-px-xs">having.conditions</code> +
              <code class="bg-grey-9 q-px-xs">type='group'</code> children),Panel 多条件 UI 待补,可手动编辑数据。
            </div>
          </template>
        </q-card-section>
      </q-card>

      <!-- 分区 8：DISTINCT（仅 SELECT） -->
      <q-card v-if="isSelect" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center">
            <div class="text-caption text-grey-5">DISTINCT</div>
            <q-space />
            <q-toggle dense dark size="sm" :model-value="properties.distinct?.enabled"
              @update:model-value="val => updateField('distinct.enabled', val)" />
          </div>
          <div v-if="properties.distinct?.enabled" class="q-mt-sm">
            <div class="row items-center q-gutter-x-xs">
              <div class="text-caption text-grey-6" style="width: 110px;">DISTINCT ON</div>
              <q-select dense dark outlined multiple use-chips
                :model-value="properties.distinct?.onFields || []"
                @update:model-value="val => updateField('distinct.onFields', val || [])"
                :options="fieldOptionList" emit-value map-options
                style="min-width: 200px;" placeholder="留空走普通 DISTINCT;选字段走 PG distinctOn"
              />
            </div>
          </div>
        </q-card-section>
      </q-card>


      <!-- 批量操作配置区（仅 INSERT/UPDATE 显示） -->
      <template v-if="properties.crudType === 'insert' || properties.crudType === 'update'">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey-5 q-mb-xs">批量操作</div>

            <!-- 批量模式开关 -->
            <q-toggle :model-value="properties.batchMode.enabled" @update:model-value="onBatchModeToggle" dense dark
              size="sm" label="批量模式" />

            <template v-if="properties.batchMode.enabled">
              <!-- 数据输入 slot 开关 -->
              <q-toggle :model-value="properties.batchDataSlot" @update:model-value="onBatchDataSlotToggle" dense dark
                size="sm" label="数据输入 Slot" class="q-mb-xs" />

              <!-- 静态数据输入（batchDataSlot=false 时显示） -->
              <q-input v-if="!properties.batchDataSlot" :model-value="properties.batchStaticData"
                @update:model-value="val => updateField('batchStaticData', val)" dense dark outlined type="textarea"
                placeholder='[{"name":"a","age":20},{"name":"b","age":25}]' :rows="3" debounce="300" class="q-mb-xs" />

              <!-- 字段映射 -->
              <div class="row items-center q-mb-xs">
                <div class="text-caption text-grey-6">属性 → 字段映射</div>
                <q-space />
                <q-btn flat dense icon="auto_fix_high" color="primary" size="sm" @click="autoGenerateMapping"
                  title="自动生成映射（属性名=字段名）" />
                <q-btn flat dense icon="add" color="primary" size="sm" @click="addFieldMapping" />
              </div>

              <div v-for="(targetField, srcProp) in (properties.fieldMapping || {})" :key="srcProp"
                class="row items-center q-gutter-x-xs q-mb-xs">
                <!-- 源属性名（可编辑） -->
                <q-input dense dark outlined :model-value="srcProp" @change="val => updateMappingKey(srcProp, val)"
                  placeholder="属性名" style="width: 100px;" />

                <q-icon name="arrow_forward" size="xs" color="grey-6" />

                <!-- 目标字段选择 -->
                <q-select dense dark outlined :model-value="targetField"
                  @update:model-value="val => updateMappingValue(srcProp, val)" :options="fieldNameOptions" emit-value
                  map-options label="字段" style="width: 120px;" />

                <q-btn flat dense icon="close" color="negative" size="sm" @click="removeMappingEntry(srcProp)" />
              </div>

              <!-- 失败策略 -->
              <q-select :model-value="properties.batchMode.failStrategy"
                @update:model-value="val => updateField('batchMode.failStrategy', val)" :options="failStrategyOptions"
                dense dark outlined label="失败策略" emit-value map-options class="q-mt-xs" />
            </template>
          </q-card-section>
        </q-card>
      </template>

      <!-- 分区 9：错误提示 -->
      <q-banner v-for="err in validationErrors" :key="err" dense rounded
        class="bg-negative text-white q-mb-xs text-caption">
        {{ err }}
      </q-banner>

      <!-- 分区 9.5：警告提示（不阻断保存,仅提醒副作用） -->
      <q-banner v-for="warn in validationWarnings" :key="warn" dense rounded
        class="bg-orange-9 text-white q-mb-xs text-caption">
        <q-icon name="warning" size="xs" class="q-mr-xs" />
        {{ warn }}
      </q-banner>
    </div>
  </BasePropertyPanel>
</template>
