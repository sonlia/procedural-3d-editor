/**
 * 字段启用集合 / Returning 解析
 *
 * collectEnabledFields(props, ctx)
 *   — 把 props.fields(enabled=true)整理成 `{fieldName: value | __INC__N | upstreamVar}`。
 *   isSlot 时优先按 slot.id 命中,未连线时跳过该字段(代替老 fallback 行为)。
 *   ctx 需:resolveNodeName / findInputSlotById / findInputSlot / isInputConnected / getInputData
 *
 * parseReturningFields(props, ctx)
 *   — `${source}::${fieldId}` 数组 → { mainFieldNames, relReturnMap }
 *   ctx 需:resolveNodeName
 *
 * 字面 1:1 复刻自 TableNode._collectEnabledFields / _parseReturningFields。
 */

export function collectEnabledFields(props, ctx) {
  const fields = {};
  for (const [fieldId, config] of Object.entries(props.fields)) {
    if (!config.enabled) continue;
    const fieldName = ctx.resolveNodeName(fieldId);
    if (!fieldName) {
      console.warn('[TableNode] 字段跳过: dbTree 找不到字段 ID', fieldId);
      continue;
    }

    // P0-8: increment/decrement 模式(仅 UPDATE 路径有效)
    if (config.valueMode === "increment" || config.valueMode === "decrement") {
      const amountStr = (config.value === undefined || config.value === "")
        ? "1"
        : String(config.value);
      const marker = config.valueMode === "increment" ? "__INC__" : "__DEC__";
      fields[fieldName] = `${marker}${amountStr}`;
      continue;
    }

    if (config.isSlot) {
      // 优先用 slot.id===fieldId 匹配, 比 name 稳健 (避免字段重命名时 slot.name 滞后)
      let slotIdx = ctx.findInputSlotById(fieldId);
      if (slotIdx < 0) slotIdx = ctx.findInputSlot(fieldName);
      if (slotIdx < 0) {
        console.warn(`[TableNode] 字段 "${fieldName}" isSlot=true 但 slot 未创建, 跳过`);
        continue;
      }
      if (!ctx.isInputConnected(slotIdx)) {
        console.warn(`[TableNode] 字段 "${fieldName}" slot 未连 wire, 跳过`);
        continue;
      }
      const upstreamVar = ctx.getInputData(slotIdx);
      if (upstreamVar == null || upstreamVar === "") {
        console.warn(`[TableNode] 字段 "${fieldName}" wire 已连但 getInputData 返回 falsy:`, upstreamVar);
        continue;
      }
      fields[fieldName] = upstreamVar;
    } else if (config.value !== undefined && config.value !== "") {
      fields[fieldName] = config.value;
    }
  }
  return fields;
}

/**
 * 解析 returningFields(`${source}::${fieldId}` 数组)
 *
 * @returns {{mainFieldNames: string[], relReturnMap: Map<string, string[]>}}
 *   - mainFieldNames:主表字段名数组(供主表 .returning 用)
 *   - relReturnMap:关联表 returning 配置(仅 INSERT 用)
 */
export function parseReturningFields(props, ctx) {
  const mainFieldNames = [];
  const relReturnMap = new Map();
  for (const entry of props.returningFields || []) {
    if (typeof entry !== "string" || !entry.includes("::")) continue;
    const sepIdx = entry.indexOf("::");
    const source = entry.slice(0, sepIdx);
    const fieldId = entry.slice(sepIdx + 2);
    const name = ctx.resolveNodeName(fieldId);
    if (!name) continue;
    if (source === "main") {
      mainFieldNames.push(name);
    } else {
      if (!relReturnMap.has(source)) relReturnMap.set(source, []);
      relReturnMap.get(source).push(name);
    }
  }
  return { mainFieldNames, relReturnMap };
}
