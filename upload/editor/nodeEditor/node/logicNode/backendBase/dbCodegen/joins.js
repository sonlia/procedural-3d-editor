/**
 * JOIN 树 / JOIN 子句生成
 *
 * buildRelTree(mainTableName, props, ctx)
 *   — 把 props.relatedFields(树状,key=linkId)解析为按 depth 升序的 RelNode 数组。
 *   每节点预算 joinCondition / alias / slotName / valueMode / children。
 *   ctx 需:resolveNodeName / getShortId / findJoinCondition
 *
 * buildRelatedJoins(props, tableName, ctx)
 *   — 把 RelNode 数组拼成 `.leftJoin(...) / .join(...) / .crossJoin(...)` 链。
 *   ctx 同上(buildRelTree 内部调)。
 *
 * 字面 1:1 复刻自 TableNode._buildRelTree / _generateRelatedJoins。
 */

/**
 * @param {string} mainTableName 主表名(用于根级 joinCondition 解析)
 * @param {object} props - 节点 properties(读 props.relatedFields)
 * @param {object} ctx - 含 resolveNodeName / getShortId / findJoinCondition
 * @returns {Array<RelNode>}
 */
export function buildRelTree(mainTableName, props, ctx) {
  const relatedFields = props.relatedFields || {};
  const shortId = ctx.getShortId();
  const mainSafeName = mainTableName
    ? `${mainTableName.replace(/[^a-zA-Z0-9_]/g, "_")}_${shortId}`
    : "";
  const nodes = [];
  const nodeByLinkId = {};

  // 按 parentLinkId 链路计算 depth(根级 = 1)
  const computeDepth = (linkId) => {
    let depth = 1;
    let cur = relatedFields[linkId]?.parentLinkId;
    const visited = new Set([linkId]);
    while (cur && !visited.has(cur)) {
      visited.add(cur);
      depth++;
      cur = relatedFields[cur]?.parentLinkId;
    }
    return depth;
  };

  for (const [linkId, config] of Object.entries(relatedFields)) {
    // 仅处理树状格式,跳过遗留链式格式(panel onMounted 已迁移,这里只兜底)
    if (config?.path || config?.targetFieldName) continue;
    if (!config?.targetTableId) continue;

    const tableName = ctx.resolveNodeName(config.targetTableId);
    if (!tableName) continue;

    const selectedFieldId = config.selectedFieldId || null;
    const selectedFieldName = selectedFieldId
      ? ctx.resolveNodeName(selectedFieldId)
      : null;

    const safeName = `${tableName.replace(/[^a-zA-Z0-9_]/g, "_")}_${shortId}`;

    // 别名: 优先用 panel 设置的 alias,否则用 ownerTable_field(SELECT 字段别名)
    // SLOT 命名也走这个别名,确保 addInput / findInputSlot 一致
    let alias = config.alias;
    if (!alias && selectedFieldName) {
      alias = `${tableName}_${selectedFieldName}`;
    }
    if (!alias) {
      alias = `${tableName}_${linkId.slice(0, 6)}`;
    }

    // 字段值模式: isSlot=true → slot; 有 value → static; 否则 none
    let valueMode = "none";
    if (config.isSlot) {
      valueMode = "slot";
    } else if (config.value !== undefined && config.value !== "") {
      valueMode = "static";
    }

    nodes.push({
      linkId,
      parentLinkId: config.parentLinkId || null,
      depth: computeDepth(linkId),
      tableName,
      tableId: config.targetTableId,
      joinType: config.joinType || "left",
      viaFieldName: config.viaFieldName || "",
      selectedFieldName,
      selectedFieldId,
      alias,
      valueMode,
      staticValue: valueMode === "static" ? config.value : "",
      slotName: alias, // slot 名 = alias,统一来源
      safeName,
      parentSafeName: "", // 下面 link 阶段填
      joinCondition: null, // 下面 link 阶段填
      children: [],
    });
    nodeByLinkId[linkId] = nodes[nodes.length - 1];
  }

  // 计算 parentSafeName / joinCondition / children
  // joinCondition 优先来自 dbDragEditor 的连接线(ctx.findJoinCondition);
  // 找不到时降级到 relatedFields config 自带的 viaFieldName + viaTargetField,
  // 让用户在没画连接线的场景下也能配级联。
  for (const node of nodes) {
    let parentTableName;
    if (node.parentLinkId) {
      const parent = nodeByLinkId[node.parentLinkId];
      if (!parent) continue;
      parent.children.push(node);
      parentTableName = parent.tableName;
      node.parentSafeName = parent.safeName;
    } else {
      parentTableName = mainTableName;
      node.parentSafeName = mainSafeName;
    }
    if (parentTableName) {
      node.joinCondition = ctx.findJoinCondition(parentTableName, node.tableName);
      if (!node.joinCondition) {
        const config = relatedFields[node.linkId];
        const viaSource = config?.viaFieldName;
        const viaTarget = config?.viaTargetField || "id";
        if (viaSource) {
          node.joinCondition = { sourceField: viaSource, targetField: viaTarget };
        }
      }
    }
  }

  // 合并重复 RelNode:同 parent + 同 targetTableId 视为同一关联节点
  // 修复用户重复添加 [+关联] 导致同表生成多条 INSERT/JOIN 的 bug
  const groupKey = (n) => `${n.parentLinkId || "__root__"}_${n.tableId}`;
  const groupMap = new Map();
  const finalNodes = [];
  for (const node of nodes) {
    const k = groupKey(node);
    if (groupMap.has(k)) {
      const main = groupMap.get(k);
      // 副节点的 children 转移到主节点,parentLinkId/parentSafeName 重指向主节点
      for (const child of node.children) {
        child.parentLinkId = main.linkId;
        child.parentSafeName = main.safeName;
        main.children.push(child);
      }
      // 业务字段合并:主节点优先,主节点为空时取副节点的
      if (!main.selectedFieldName && node.selectedFieldName) {
        main.selectedFieldName = node.selectedFieldName;
        main.selectedFieldId = node.selectedFieldId;
        main.alias = node.alias;
        main.valueMode = node.valueMode;
        main.staticValue = node.staticValue;
        main.slotName = node.slotName;
      }
    } else {
      groupMap.set(k, node);
      finalNodes.push(node);
    }
  }

  // 按 depth 升序排序,保证 INSERT/UPDATE 时父级先于子级处理
  finalNodes.sort((a, b) => a.depth - b.depth);

  return finalNodes;
}

/**
 * 把 RelNode 数组拼成 JOIN 链 + SELECT 字段列表
 *
 * @returns {{joinCode: string, selectFields: string[]}}
 */
export function buildRelatedJoins(props, tableName, ctx) {
  const relNodes = buildRelTree(tableName, props, ctx);
  if (relNodes.length === 0) return { joinCode: "", selectFields: [] };

  const joins = [];
  const selectFields = [];
  let aliasCounter = 2;

  // buildRelTree 已按 depth 升序,遍历时 parent.tableAlias 必定先于 child 赋值
  for (const node of relNodes) {
    if (!node.joinCondition) continue;

    const alias = `t${aliasCounter++}`;
    node.tableAlias = alias;

    const parentAlias = node.parentLinkId
      ? relNodes.find((n) => n.linkId === node.parentLinkId)?.tableAlias || "t1"
      : "t1";

    // P2-3: crossJoin 加入
    const knexMethod =
      node.joinType === "inner" ? "join"
        : node.joinType === "right" ? "rightJoin"
        : node.joinType === "full" ? "fullOuterJoin"
        : node.joinType === "cross" ? "crossJoin"
        : "leftJoin";

    // P2-2: 多列 ON(viaFields: [{source, target}, ...])
    // 兼容旧字段 viaFieldName(单字段);新字段 viaFields 优先
    const viaFields = Array.isArray(node.viaFields) ? node.viaFields : null;
    const hasMultiOn = viaFields && viaFields.length > 1;

    if (node.joinType === "cross") {
      // crossJoin 不需要 ON
      joins.push(`.${knexMethod}('${node.tableName} as ${alias}')`);
    } else if (hasMultiOn) {
      // 多列 ON 用 callback 形式拼 this.on(...).andOn(...)
      const onParts = viaFields.map((vf, i) => {
        const m = i === 0 ? "on" : "andOn";
        return `this.${m}('${parentAlias}.${vf.source}', '=', '${alias}.${vf.target}')`;
      });
      joins.push(
        `.${knexMethod}('${node.tableName} as ${alias}', function() { ${onParts.join("; ")} })`
      );
    } else {
      joins.push(
        `.${knexMethod}('${node.tableName} as ${alias}', '${parentAlias}.${node.joinCondition.sourceField}', '=', '${alias}.${node.joinCondition.targetField}')`
      );
    }

    if (node.selectedFieldName) {
      selectFields.push(`'${alias}.${node.selectedFieldName} as ${node.alias}'`);
    }
  }

  return { joinCode: joins.join("\n  "), selectFields };
}
