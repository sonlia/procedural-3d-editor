import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { useProjectStore } from "src/stores/projectMange.js";

/**
 * TreeQueryNode - tree data query codegen node for DatabaseSubgraph.
 *
 * The node generates backend knex code only. It follows the DbSubgraph protocol:
 * child wires carry variable-name strings, bgJsCode is collected into the backend
 * route body, and the result output exposes a variable name for GraphOutput.
 */
export class TreeQueryNode extends nodeMeta {
  constructor() {
    super();

    this.categories = "backend";
    this.bgcolor = "#4a1a2a";
    this.color = "#7a2d4a";

    this.properties = {
      tableId: "",
      idFieldId: "",
      parentFieldId: "",
      root: {
        mode: "slot", // slot | static | roots
        value: "",
        slotId: "rootId",
      },
      direction: "descendants", // descendants | ancestors | children
      includeRoot: true,
      maxDepth: { value: "10", isSlot: false, slotId: "maxDepth" },
      fields: {}, // { fieldId: { enabled: true } }. id/parent fields are always included.
      rootWhere: [], // Conditions applied to root rows.
      nodeWhere: [], // Conditions applied while loading children/parents.
      rootLimit: { value: "", isSlot: false, slotId: "rootLimit" },
      totalLimit: { value: "", isSlot: false, slotId: "totalLimit" },
      orderBy: [], // [{ fieldId, direction }]
      outputMode: "flat", // flat | nested
      cycleGuard: true,
    };

    this.addInput("rootId", "string", { id: "rootId" });
    this.addOutput("result", "string");

    this.uiPanel = defineAsyncComponent(() => import("./treeQueryNodePanel.vue"));
  }

  onConfigure(o) {
    super.onConfigure?.(o);
    const props = this.properties || {};
    props.root ||= { mode: "slot", value: "", slotId: "rootId" };
    props.root.mode ||= "slot";
    props.root.slotId ||= "rootId";
    props.maxDepth ||= { value: "10", isSlot: false, slotId: "maxDepth" };
    props.fields ||= {};
    props.rootWhere ||= [];
    props.nodeWhere ||= [];
    props.rootLimit ||= { value: "", isSlot: false, slotId: "rootLimit" };
    props.totalLimit ||= { value: "", isSlot: false, slotId: "totalLimit" };
    props.orderBy ||= [];
    props.outputMode ||= "flat";
    props.direction ||= "descendants";
    props.includeRoot = props.includeRoot !== false;
    props.cycleGuard = props.cycleGuard !== false;
    this.syncInputSlots();
  }

  _getShortId() {
    return String(this.id).slice(0, 8);
  }

  _resolveNodeName(nodeId) {
    const projectStore = useProjectStore();
    const dbTree = projectStore.currentProject?.database?.dbTree || [];
    return dbTree.find((n) => n.id === nodeId)?.name ?? null;
  }

  _getKnexRef() {
    const parent = this.graph?._subgraph_node;
    if (parent?.properties?.transaction) return "trx";
    return "knex";
  }

  _safeName(name) {
    return String(name || "tree").replace(/[^a-zA-Z0-9_]/g, "_") || "tree";
  }

  _jsString(value) {
    return JSON.stringify(String(value ?? ""));
  }

  _field(fieldId) {
    return this._resolveNodeName(fieldId) || "";
  }

  _getSlotValue(slotName) {
    const idx = this.findInputSlot(slotName);
    if (idx >= 0 && this.isInputConnected(idx)) {
      const value = this.getInputData(idx);
      if (value != null && value !== "") return value;
    }
    return null;
  }

  _rootExpr() {
    const root = this.properties.root || {};
    if (root.mode === "roots") return "null";
    if (root.mode === "static") return JSON.stringify(root.value ?? "");
    return this._getSlotValue(root.slotId || "rootId") || root.slotId || "rootId";
  }

  _maxDepthExpr() {
    const maxDepth = this.properties.maxDepth || {};
    if (maxDepth.isSlot) {
      return this._getSlotValue(maxDepth.slotId || "maxDepth") || maxDepth.slotId || "maxDepth";
    }
    const raw = String(maxDepth.value ?? "").trim();
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : "10";
  }

  _limitExpr(config) {
    if (!config) return "";
    if (config.isSlot) {
      return this._getSlotValue(config.slotId) || config.slotId || "";
    }
    const raw = String(config.value ?? "").trim();
    if (!raw) return "";
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : "";
  }

  _valueExpr(value) {
    const raw = String(value ?? "").trim();
    if (raw === "") return "''";
    if (raw === "null" || raw === "true" || raw === "false") return raw;
    if (/^-?\d+(\.\d+)?$/.test(raw)) return raw;
    if ((raw.startsWith("[") && raw.endsWith("]")) || (raw.startsWith("{") && raw.endsWith("}"))) {
      return raw;
    }
    return JSON.stringify(value ?? "");
  }

  _selectedFieldNames(idField, parentField) {
    const names = [];
    for (const [fieldId, config] of Object.entries(this.properties.fields || {})) {
      if (!config?.enabled) continue;
      const name = this._field(fieldId);
      if (name && !names.includes(name)) names.push(name);
    }
    for (const required of [idField, parentField]) {
      if (required && !names.includes(required)) names.unshift(required);
    }
    return names;
  }

  _selectChain(idField, parentField, indent = "  ", alias = "") {
    const names = this._selectedFieldNames(idField, parentField);
    if (names.length === 0) return "";
    const fields = names.map((name) => this._jsString(alias ? `${alias}.${name}` : name)).join(", ");
    return `\n${indent}.select([${fields}])`;
  }

  _selectArgs(idField, parentField, alias = "") {
    const names = this._selectedFieldNames(idField, parentField);
    if (names.length === 0) return "'*'";
    return `[${names.map((name) => this._jsString(alias ? `${alias}.${name}` : name)).join(", ")}]`;
  }

  _whereChain(conditions, indent = "  ", alias = "") {
    const lines = [];
    for (const condition of conditions || []) {
      const fieldName = this._field(condition.fieldId);
      if (!fieldName) continue;
      const column = alias ? `${alias}.${fieldName}` : fieldName;
      const op = condition.operator || "=";
      const value = condition.isSlot
        ? this._getSlotValue(condition.slotId) || condition.slotId
        : this._valueExpr(condition.value);
      if (op === "is null") {
        lines.push(`${indent}.whereNull(${this._jsString(column)})`);
      } else if (op === "is not null") {
        lines.push(`${indent}.whereNotNull(${this._jsString(column)})`);
      } else if (op === "in") {
        lines.push(`${indent}.whereIn(${this._jsString(column)}, ${value})`);
      } else if (op === "not in") {
        lines.push(`${indent}.whereNotIn(${this._jsString(column)}, ${value})`);
      } else if (op === "between") {
        lines.push(`${indent}.whereBetween(${this._jsString(column)}, ${value})`);
      } else if (op === "not between") {
        lines.push(`${indent}.whereNotBetween(${this._jsString(column)}, ${value})`);
      } else {
        lines.push(`${indent}.where(${this._jsString(column)}, ${this._jsString(op)}, ${value})`);
      }
    }
    return lines.length ? `\n${lines.join("\n")}` : "";
  }

  _limitChain(config, indent = "  ") {
    const expr = this._limitExpr(config);
    return expr ? `\n${indent}.limit(Number(${expr}) || undefined)` : "";
  }

  _orderRowsExpr(rowsVar) {
    const parts = [];
    parts.push("{ field: 'depth', direction: 'asc' }");
    for (const item of this.properties.orderBy || []) {
      const field = this._field(item.fieldId);
      if (!field) continue;
      const dir = item.direction === "desc" ? "desc" : "asc";
      parts.push(`{ field: ${this._jsString(field)}, direction: ${this._jsString(dir)} }`);
    }
    if (parts.length === 0) return rowsVar;
    return `${rowsVar}.sort((a, b) => {
  for (const item of [${parts.join(", ")}]) {
    const av = a[item.field]
    const bv = b[item.field]
    if (av === bv) continue
    if (av == null) return 1
    if (bv == null) return -1
    return item.direction === 'desc' ? (av < bv ? 1 : -1) : (av > bv ? 1 : -1)
  }
  return 0
})`;
  }

  _buildNestedExpr(rowsVar, idField, parentField) {
    return `(() => {
  const nodeMap = new Map()
  const roots = []
  for (const row of ${rowsVar}) nodeMap.set(row[${this._jsString(idField)}], { ...row, children: [] })
  for (const row of ${rowsVar}) {
    const item = nodeMap.get(row[${this._jsString(idField)}])
    const parent = nodeMap.get(row[${this._jsString(parentField)}])
    if (parent) parent.children.push(item)
    else roots.push(item)
  }
  return roots
})()`;
  }

  _buildOrderChain(indent = "    ") {
    const lines = [];
    for (const item of this.properties.orderBy || []) {
      const field = this._field(item.fieldId);
      if (!field) continue;
      const dir = item.direction === "desc" ? "desc" : "asc";
      lines.push(`${indent}.orderBy(${this._jsString(field)}, ${this._jsString(dir)})`);
    }
    return lines.join("\n");
  }

  _buildRecursiveQuery({ tableName, idField, parentField, rootExpr, maxDepthExpr, rowsVar }) {
    const ref = this._getKnexRef();
    const direction = this.properties.direction || "descendants";
    const rootMode = this.properties.root?.mode || "slot";
    const includeRoot = this.properties.includeRoot !== false;
    const orderChain = this._buildOrderChain("  ");

    if (rootMode === "roots" && direction !== "descendants") {
      return `const ${rowsVar} = await ${ref}(${this._jsString(tableName)})${this._selectChain(idField, parentField)}
  .whereNull(${this._jsString(parentField)})${this._whereChain(this.properties.rootWhere)}${this._limitChain(this.properties.rootLimit)}${orderChain ? `\n${orderChain}` : ""}
const ${rowsVar}_ordered = ${rowsVar}`;
    }

    if (direction === "children") {
      return `const ${rowsVar} = await ${ref}(${this._jsString(tableName)})${this._selectChain(idField, parentField)}
  .where(${this._jsString(parentField)}, ${rootExpr})${this._whereChain(this.properties.nodeWhere)}${this._limitChain(this.properties.rootLimit)}${orderChain ? `\n${orderChain}` : ""}
const ${rowsVar}_ordered = ${rowsVar}`;
    }

    const joinLeft = direction === "ancestors" ? `m.${idField}` : `m.${parentField}`;
    const joinRight = direction === "ancestors" ? `tree.${parentField}` : `tree.${idField}`;
    const filterRoot = includeRoot
      ? ""
      : rootMode === "roots"
        ? `\nconst ${rowsVar}_filtered = ${rowsVar}.filter((row) => row[${this._jsString(parentField)}] != null)`
        : `\nconst ${rowsVar}_filtered = ${rowsVar}.filter((row) => row[${this._jsString(idField)}] !== ${rootExpr})`;
    const finalRows = includeRoot ? rowsVar : `${rowsVar}_filtered`;
    const orderedExpr = this._orderRowsExpr(finalRows);

    const baseWhere = rootMode === "roots"
      ? `.whereNull(${this._jsString(parentField)})${this._whereChain(this.properties.rootWhere, "      ")}${this._limitChain(this.properties.rootLimit, "      ")}`
      : `.where(${this._jsString(idField)}, ${rootExpr})${this._whereChain(this.properties.rootWhere, "      ")}`;

    return `const ${rowsVar} = await ${ref}
  .withRecursive('tree', (qb) => {
    qb.select(${this._selectArgs(idField, parentField)}, ${ref}.raw('0 as depth'))
      .from(${this._jsString(tableName)})
      ${baseWhere}
      .unionAll((qb) => {
        qb.select(${this._selectArgs(idField, parentField, "m")}, ${ref}.raw('tree.depth + 1 as depth'))
          .from({ m: ${this._jsString(tableName)} })
          .join('tree', ${this._jsString(joinLeft)}, ${this._jsString(joinRight)})
          ${this._whereChain(this.properties.nodeWhere, "          ", "m")}
          .where('tree.depth', '<', Number(${maxDepthExpr}) || 10)
      })
  })
  .select('*')
  .from('tree')${filterRoot}
const ${rowsVar}_ordered = ${orderedExpr}`;
  }

  syncInputSlots() {
    const wanted = new Set();
    const root = this.properties.root || {};
    if ((root.mode || "slot") === "slot") wanted.add(root.slotId || "rootId");
    const maxDepth = this.properties.maxDepth || {};
    if (maxDepth.isSlot) wanted.add(maxDepth.slotId || "maxDepth");
    for (const limit of [this.properties.rootLimit, this.properties.totalLimit]) {
      if (limit?.isSlot) wanted.add(limit.slotId);
    }
    for (const condition of [
      ...(this.properties.rootWhere || []),
      ...(this.properties.nodeWhere || []),
    ]) {
      if (condition?.isSlot) wanted.add(condition.slotId);
    }

    for (let i = (this.inputs?.length || 0) - 1; i >= 0; i--) {
      const input = this.inputs[i];
      if (!input || input.type === "orderSlot") continue;
      if (!wanted.has(input.name)) this.removeInput(i);
    }

    const have = new Set((this.inputs || []).map((s) => s?.name).filter(Boolean));
    for (const name of wanted) {
      if (!have.has(name)) this.addInput(name, "string", { id: name });
    }
    this.setSize(this.computeSize());
    this.setDirtyCanvas(true, true);
  }

  onExecute() {
    const props = this.properties || {};
    const tableName = this._resolveNodeName(props.tableId);
    const idField = this._field(props.idFieldId);
    const parentField = this._field(props.parentFieldId);
    const shortId = this._getShortId();
    const safeName = this._safeName(tableName);
    const resultVar = `db_tree_${safeName}_${shortId}_result`;
    const rowsVar = `db_tree_${safeName}_${shortId}_rows`;

    if (!tableName || !idField || !parentField) {
      this.bgJsCode = "// TreeQuery: table/idField/parentField is not configured";
      this.bgImportStr = "";
      this.setOutputData(this.findOutputSlot("result"), resultVar);
      return;
    }

    const args = {
      tableName,
      idField,
      parentField,
      rootExpr: this._rootExpr(),
      maxDepthExpr: this._maxDepthExpr(),
      rowsVar,
    };

    let code = this._buildRecursiveQuery(args);

    const sourceRows = code.includes(`${rowsVar}_ordered`) ? `${rowsVar}_ordered` : rowsVar;
    if ((props.outputMode || "flat") === "nested") {
      const limitedRows = this._limitExpr(props.totalLimit)
        ? `${sourceRows}.slice(0, Number(${this._limitExpr(props.totalLimit)}) || ${sourceRows}.length)`
        : sourceRows;
      code += `\nconst ${resultVar} = ${this._buildNestedExpr(limitedRows, idField, parentField)}`;
    } else {
      const totalLimit = this._limitExpr(props.totalLimit);
      code += totalLimit
        ? `\nconst ${resultVar} = ${sourceRows}.slice(0, Number(${totalLimit}) || ${sourceRows}.length)`
        : `\nconst ${resultVar} = ${sourceRows}`;
    }

    this.bgJsCode = code;
    this.bgImportStr = "import knex from '{{BG_ROOT}}/db/knex.js'";
    this.setOutputData(this.findOutputSlot("result"), resultVar);
    this._lastResultVar = resultVar;
  }

  static get title() {
    return "Tree Query";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "tree-query-node-001";
  }

  static get treePath() {
    return "Backend/Database";
  }
}
