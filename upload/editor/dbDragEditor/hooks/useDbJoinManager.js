/**
 * JOIN 类型常量与工具
 *
 * JOIN type 存储在 target 表节点的 properties.joinTypes 中
 * key = input slot ID，value = join type
 * 连接关系从 LiteGraph links 实时获取，不做冗余存储
 */

// JOIN 类型常量
export const JOIN_TYPES = {
  INNER: "inner",
  LEFT: "left",
  RIGHT: "right",
  FULL: "full",
};

// JOIN 类型显示信息
export const JOIN_TYPE_INFO = {
  [JOIN_TYPES.INNER]: { label: "INNER JOIN", color: "#4CAF50" },
  [JOIN_TYPES.LEFT]: { label: "LEFT JOIN", color: "#2196F3" },
  [JOIN_TYPES.RIGHT]: { label: "RIGHT JOIN", color: "#FF9800" },
  [JOIN_TYPES.FULL]: { label: "FULL JOIN", color: "#9C27B0" },
};

// JOIN 类型选项列表（供 q-select 使用）
export const JOIN_TYPE_OPTIONS = Object.entries(JOIN_TYPE_INFO).map(
  ([value, info]) => ({ value, label: info.label })
);

// 默认 JOIN 类型
export const DEFAULT_JOIN_TYPE = JOIN_TYPES.LEFT;

/**
 * 从序列化的 graphData 中解析所有连接关系
 * 供逻辑节点编辑器等外部系统读取 DB 编辑器的连接数据
 *
 * @param {Object} graphData - graphIns.serialize() 的结果
 * @returns {Array<{ sourceTableName, targetTableName, sourceFieldName, targetFieldName, joinType }>}
 */
export function parseGraphConnections(graphData) {
  if (!graphData) return [];
  const nodes = graphData.nodes || [];
  const links = graphData.links || [];

  const nodeMap = {};
  for (const n of nodes) nodeMap[n.id] = n;

  const result = [];
  for (const link of links) {
    // 序列化 link 格式: [id, origin_id, origin_slot, target_id, target_slot, type]
    const [, originId, originSlot, targetId, targetSlot] = link;
    const srcNode = nodeMap[originId];
    const tgtNode = nodeMap[targetId];
    if (!srcNode || !tgtNode) continue;

    const srcField = srcNode.outputs?.[originSlot];
    const tgtField = tgtNode.inputs?.[targetSlot];
    if (!srcField || !tgtField) continue;

    const joinType = tgtNode.properties?.joinTypes?.[tgtField.id] || DEFAULT_JOIN_TYPE;

    result.push({
      sourceTableName: srcNode.title,
      targetTableName: tgtNode.title,
      sourceFieldName: srcField.name,
      targetFieldName: tgtField.name,
      joinType,
    });
  }
  return result;
}
