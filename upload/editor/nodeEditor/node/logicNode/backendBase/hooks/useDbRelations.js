import { computed } from "vue";
import { useProjectStore } from "src/stores/projectMange.js";
import { parseGraphConnections } from "../../../../../dbDragEditor/hooks/useDbJoinManager.js";

/**
 * 获取指定表的所有关联表信息
 * 通过读取数据库节点的序列化 graphData（nodes + links + properties.joinTypes），
 * 解析出当前表与哪些表存在连接关系，并返回关联表的字段列表。
 *
 * @param {Ref<string>} tableId - 当前表在 dbTree 中的节点 ID
 * @returns {{ relatedTables: ComputedRef<Array>, currentTableName: ComputedRef<string>, dbNode: ComputedRef<Object|null> }}
 */
export function useDbRelations(tableId) {
  const projectStore = useProjectStore();

  // 获取 dbTree 扁平数组
  const flatDbTree = computed(
    () => projectStore.currentProject?.database?.dbTree || [],
  );

  // 找到当前表名
  const currentTableName = computed(() => {
    const node = flatDbTree.value.find((n) => n.id === tableId.value);
    return node?.name || "";
  });

  // 找到当前表所属的数据库节点
  const dbNode = computed(() => {
    const tableNode = flatDbTree.value.find((n) => n.id === tableId.value);
    if (!tableNode) return null;

    let parentId = tableNode.pId;
    while (parentId) {
      const parent = flatDbTree.value.find((n) => n.id === parentId);
      if (!parent) break;
      if (parent.type === "dbbase") return parent;
      parentId = parent.pId;
    }
    return null;
  });

  // 从所有 dbbase 节点的序列化 graphData 解析连接关系
  const allConnections = computed(() => {
    const result = [];
    for (const node of flatDbTree.value) {
      if (node.type !== "dbbase") continue;
      const graphData = projectStore.getDbEditorData(node.id, 'graphData');
      result.push(...parseGraphConnections(graphData));
    }
    return result;
  });

  // 获取当前表的所有关联表
  const relatedTables = computed(() => {
    if (!currentTableName.value) return [];

    const result = [];

    for (const conn of allConnections.value) {
      let relatedTableName = null;
      let direction = "";

      if (conn.sourceTableName === currentTableName.value) {
        relatedTableName = conn.targetTableName;
        direction = "outgoing";
      } else if (conn.targetTableName === currentTableName.value) {
        relatedTableName = conn.sourceTableName;
        direction = "incoming";
      }

      if (!relatedTableName) continue;

      const relTableNode = flatDbTree.value.find(
        (n) => n.type === "table" && n.name === relatedTableName,
      );
      if (!relTableNode) continue;

      const relFields = flatDbTree.value.filter(
        (n) => n.type === "field" && n.pId === relTableNode.id,
      );

      result.push({
        tableId: relTableNode.id,
        tableName: relatedTableName,
        direction,
        joinType: conn.joinType,
        conditions: [{
          sourceFieldName: conn.sourceFieldName,
          targetFieldName: conn.targetFieldName,
        }],
        fields: relFields.map((f) => ({ id: f.id, name: f.name })),
      });
    }

    return result;
  });

  // 给定任意表名，返回该表的所有关联关系（用于级联展开）
  function getRelationsForTable(tableName) {
    if (!tableName) return [];

    const result = [];

    for (const conn of allConnections.value) {
      let relatedTableName = null;
      let direction = "";

      if (conn.sourceTableName === tableName) {
        relatedTableName = conn.targetTableName;
        direction = "outgoing";
      } else if (conn.targetTableName === tableName) {
        relatedTableName = conn.sourceTableName;
        direction = "incoming";
      }

      if (!relatedTableName) continue;

      const relTableNode = flatDbTree.value.find(
        (n) => n.type === "table" && n.name === relatedTableName,
      );
      if (!relTableNode) continue;

      const relFields = flatDbTree.value.filter(
        (n) => n.type === "field" && n.pId === relTableNode.id,
      );

      result.push({
        tableId: relTableNode.id,
        tableName: relatedTableName,
        direction,
        joinType: conn.joinType,
        conditions: [{
          sourceFieldName: conn.sourceFieldName,
          targetFieldName: conn.targetFieldName,
        }],
        fields: relFields.map((f) => ({ id: f.id, name: f.name })),
      });
    }

    return result;
  }

  // 当前表的 FK 字段列表，供 [+关联字段] 下拉菜单使用
  const availableJoinFields = computed(() => {
    return relatedTables.value.map((rel) => {
      const cond = rel.conditions[0];
      if (!cond) return null;

      const fieldName =
        rel.direction === "outgoing"
          ? cond.sourceFieldName
          : cond.targetFieldName;

      return {
        fieldName,
        targetTableName: rel.tableName,
        targetTableId: rel.tableId,
        direction: rel.direction,
        conditions: rel.conditions,
        fields: rel.fields,
      };
    }).filter(Boolean);
  });

  return { relatedTables, currentTableName, dbNode, getRelationsForTable, availableJoinFields };
}
