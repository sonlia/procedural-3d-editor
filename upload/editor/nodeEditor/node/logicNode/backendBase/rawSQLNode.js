import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";

/**
 * RawSQLNode — 万能逃生口,封装 knex.raw(sql, bindings),给 *Raw 系列做兜底。
 *
 * 必须在 dbSubgraph 容器内运行。继承 nodeMeta(单语句节点,无子图)。
 *
 * 用户在 properties.sql 里写 `SELECT ... WHERE id = {{userId}}`,
 * 节点扫描占位符 → 同步 slotVars + input slot(slot.name = 变量名)
 * → onExecute 把 {{varName}} 替换为 ?,按顺序收集 wire 上游 label name
 * 作为绑定参数 → 产 `await knex.raw('... WHERE id = ?', [in0])`。
 *
 * resultMode(单一"输出"选择器,前三种出值、最后一种出子查询片段):
 *  - 'rows'     (默认) 取 PG knex.raw 返回的 `result.rows`(行数组)
 *  - 'first'    取首行: `result.rows[0] ?? null`
 *  - 'raw'      原样: 不做后处理,直接是 await knex.raw 的返回
 *  - 'subquery' 不执行,产 `knex.raw(sql, [...])` 片段(不带别名),供下游 tableNode 的
 *               where(operator='raw') / whereExists / having 等子查询位嵌入
 *
 * dbSubgraph 协议:
 *  - 子图内 wire 传 label name(in0/out0),所以 this.getInputData(slot) 返回的就是 label
 *  - setOutputData 写裸变量名(同 tableNode),不加 .value
 *  - 不产 jsCode(前端 fetch 由 dbSubgraph 统一负责)
 */
export class RawSQLNode extends nodeMeta {
  constructor() {
    super();

    // 清空默认的 orderIn/orderOut
    this.inputs.length = 0;
    this.outputs.length = 0;

    this.categories = "backend";
    this.bgcolor = "#4a1a2a";
    this.color = "#7a2d4a";

    this.properties = {
      sql: "",
      slotVars: [], // [{ name, id }] —— 由 sql 占位符 parse 同步,只读展示
      testValues: {}, // { [varName]: 测试值 } —— 仅供弹窗"测试"按钮字面替换 {{var}},不进 codegen
      // 单一"输出"选择器:rows|first|raw 执行并出值;subquery 不执行,出 knex.raw 片段供子查询嵌入
      resultMode: "rows",
    };

    this.addOutput("result", "string");

    this.uiPanel = defineAsyncComponent(() => import("./rawSQLNodePanel.vue"));
  }

  _getShortId() {
    return String(this.id).slice(0, 8);
  }

  /**
   * 从 SQL 字符串扫描所有 {{varName}} 占位符,返回去重后的变量名数组(保持出现顺序)。
   */
  _parseSqlVars(sql) {
    if (typeof sql !== "string" || !sql) return [];
    const re = /\{\{(\w+)\}\}/g;
    const seen = new Set();
    const result = [];
    let m;
    while ((m = re.exec(sql)) !== null) {
      const name = m[1];
      if (!seen.has(name)) {
        seen.add(name);
        result.push(name);
      }
    }
    return result;
  }

  /**
   * 同步 SQL 占位符 → slotVars + input slot。
   * 由面板在 sql 改动后调用。
   */
  syncSlotsFromSql() {
    const names = this._parseSqlVars(this.properties.sql);
    const oldSlotVars = this.properties.slotVars || [];
    const oldById = new Map();
    for (const sv of oldSlotVars) {
      if (sv?.name) oldById.set(sv.name, sv);
    }

    // 重建 slotVars(保留旧 id,沿用复用)
    const newSlotVars = names.map((name) => {
      const old = oldById.get(name);
      return { name, id: old?.id || `slot_${name}` };
    });
    this.properties.slotVars = newSlotVars;

    const wantedSet = new Set(names);

    // 从后往前移除非 want 的 input slot
    for (let i = (this.inputs?.length || 0) - 1; i >= 0; i--) {
      const s = this.inputs[i];
      if (!s) continue;
      if (s.type === "orderSlot") continue;
      if (!wantedSet.has(s.name)) {
        this.removeInput(i);
      }
    }

    // 补齐缺失的 input slot
    const haveSet = new Set((this.inputs || []).map((s) => s?.name).filter(Boolean));
    for (const sv of newSlotVars) {
      if (!haveSet.has(sv.name)) {
        this.addInput(sv.name, "string", { id: sv.id });
      }
    }

    this.setSize(this.computeSize());
    this.setDirtyCanvas(true, true);
  }

  /**
   * 重命名一个 SQL 占位符变量(由面板/弹窗的参数列表调用)。
   * 原地改名以保住 input slot 的 id 与连线(不走 remove/add):
   *  - sql 里 {{old}} → {{new}}
   *  - slotVars 项 name(保留 id)
   *  - 对应 input slot name(保留 id + link)
   *  - testValues[old] → [new]
   * 新名非法或已存在同名占位符时跳过。
   */
  renameSqlVar(oldName, newName) {
    if (!oldName || !newName || oldName === newName) return;
    if (!/^\w+$/.test(newName)) return;

    // 已存在同名占位符 → 跳过,避免两个变量塌缩成一个
    const names = this._parseSqlVars(this.properties.sql);
    if (names.includes(newName)) return;

    // 1. sql 占位符替换
    const re = new RegExp(`\\{\\{${oldName}\\}\\}`, "g");
    this.properties.sql = (this.properties.sql || "").replace(
      re,
      `{{${newName}}}`,
    );

    // 2. slotVars 原地改名(保留 id)
    const sv = (this.properties.slotVars || []).find((s) => s.name === oldName);
    if (sv) sv.name = newName;

    // 3. input slot 原地改名(保留 id + link)
    const slot = (this.inputs || []).find((s) => s?.name === oldName);
    if (slot) slot.name = newName;

    // 4. 迁移测试值
    if (!this.properties.testValues) this.properties.testValues = {};
    if (oldName in this.properties.testValues) {
      this.properties.testValues[newName] = this.properties.testValues[oldName];
      delete this.properties.testValues[oldName];
    }

    this.onExecute();
    this.setDirtyCanvas(true, true);
  }

  /**
   * 反序列化兼容:旧项目 load 后 input slot 已存在,但 syncSlotsFromSql 没跑过。
   * 这里检查 slotVars 与 sql 是否一致,不一致时重建一次。
   */
  onConfigure(o) {
    super.onConfigure?.(o);
    // 旧节点反序列化后可能缺 testValues
    if (!this.properties.testValues) this.properties.testValues = {};
    // 旧档迁移:outputMode 已合并进 resultMode('expression' → 'subquery')
    if (this.properties.outputMode === "expression") {
      this.properties.resultMode = "subquery";
    }
    delete this.properties.outputMode;
    const expected = this._parseSqlVars(this.properties?.sql || "");
    const cur = (this.properties?.slotVars || []).map((sv) => sv.name);
    const same =
      expected.length === cur.length &&
      expected.every((n, i) => n === cur[i]);
    if (!same) {
      this.syncSlotsFromSql();
    }
  }

  onExecute() {
    const sql = this.properties.sql || "";
    const mode = this.properties.resultMode || "rows";
    const shortId = this._getShortId();
    const varName = `result_raw_${shortId}`;

    if (!sql.trim()) {
      if (mode === "subquery") {
        this.bgJsCode = "";
        this.bgImportStr = "";
        this.setOutputData(this.findOutputSlot("result"), "");
      } else {
        this.bgJsCode = "// RawSQL: 未配置 SQL";
        this.setOutputData(this.findOutputSlot("result"), varName);
      }
      return;
    }

    // 按占位符顺序收集 wire 上游 label name(若 wire 未连或 getInputData 为 falsy,
    // 退化为变量名本身 —— dbSubgraph 内若用户已通过 GraphInput 暴露同名 passIn,
    // GraphInput 会把 label name 写到 wire 上,这里拿到的就是 in0 之类)
    const names = this._parseSqlVars(sql);
    const bindings = [];
    for (const name of names) {
      const idx = this.findInputSlot(name);
      let bind = null;
      if (idx >= 0 && this.isInputConnected(idx)) {
        const v = this.getInputData(idx);
        if (v != null && v !== "") bind = v;
      }
      // 兜底:wire 未连时直接用占位符的变量名字面(用户在 dbSubgraph passIn 里
      // 取同名 label 时,后端 destructure 后就有这个变量)
      bindings.push(bind || name);
    }

    // 把 {{varName}} 替换为 ?
    const sqlWithMarks = sql.replace(/\{\{\w+\}\}/g, "?");

    // 用单引号字符串字面量包 SQL:转义已存在的反斜杠和单引号 + 换行
    const sqlLiteral = `'${sqlWithMarks
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/\r?\n/g, "\\n")}'`;

    const bindingsLiteral = `[${bindings.join(", ")}]`;

    // subquery 模式:产 raw 表达式片段(不带别名),不 await 不赋值;bgJsCode 留空让 collector 跳过本节点。
    // knex 已由下游消费方(tableNode/dbSubgraph)的 import 链路引入,本节点不重复声明 import。
    // 片段不自带别名,保持通用(可用于 where/whereExists/having);需别名的 from 子查询位由 tableNode 嵌入时负责包。
    if (mode === "subquery") {
      const rawExpr = bindings.length > 0
        ? `knex.raw(${sqlLiteral}, ${bindingsLiteral})`
        : `knex.raw(${sqlLiteral})`;
      this.bgJsCode = "";
      this.bgImportStr = "";
      this.setOutputData(this.findOutputSlot("result"), rawExpr);
      return;
    }

    const rawCall = bindings.length > 0
      ? `await knex.raw(${sqlLiteral}, ${bindingsLiteral})`
      : `await knex.raw(${sqlLiteral})`;

    let finalCode = "";
    if (mode === "raw") {
      finalCode = `const ${varName} = ${rawCall}`;
    } else if (mode === "first") {
      finalCode =
        `const ${varName}_full = ${rawCall}\n` +
        `const ${varName} = ${varName}_full.rows[0] ?? null`;
    } else {
      // rows
      finalCode = `const ${varName} = (${rawCall}).rows`;
    }

    this.bgJsCode = finalCode;
    this.bgImportStr = "import knex from '{{BG_ROOT}}/db/knex.js'";

    // 不产 jsCode:dbSubgraph 自身在 onExecute 末尾会按 passOut 统一生成前端 fetch。
    this.setOutputData(this.findOutputSlot("result"), varName);
    this._lastResultVar = varName;
  }

  static get title() {
    return "RawSQL";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "raw-sql-node-001";
  }

  static get treePath() {
    return "Backend/Database";
  }
}
