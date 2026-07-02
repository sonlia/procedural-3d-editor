import { nodeMeta } from "../../../nodeMetea.js";
import { defineAsyncComponent } from "vue";

const OPERATIONS = new Set([
  "get",
  "set",
  "del",
  "exists",
  "expire",
  "ttl",
  "hget",
  "hset",
  "hgetall",
  "lpush",
  "rpush",
  "lrange",
  "sadd",
  "smembers",
  "zadd",
  "zrange",
  "call",
]);

export class RedisNode extends nodeMeta {
  constructor() {
    super();

    this.categories = "backend";
    this.bgcolor = "#4a1f1f";
    this.color = "#b54040";

    this.properties = {
      redisDbId: "",
      dbIndex: 0,
      operation: "get",
      key: { value: "", isSlot: false, slotId: "redis_key" },
      value: { value: "", isSlot: false, slotId: "redis_value" },
      field: { value: "", isSlot: false, slotId: "redis_field" },
      score: { value: "", isSlot: false, slotId: "redis_score" },
      ttl: { value: "", isSlot: false, slotId: "redis_ttl" },
      start: { value: "0", isSlot: false, slotId: "redis_start" },
      stop: { value: "-1", isSlot: false, slotId: "redis_stop" },
      command: { value: "", isSlot: false, slotId: "redis_command" },
      args: { value: "[]", isSlot: false, slotId: "redis_args" },
    };

    this.addOutput("result", "string");
    this.uiPanel = defineAsyncComponent(() => import("./redisNodePanel.vue"));
  }

  onConfigure(o) {
    super.onConfigure?.(o);
    if (!this.properties) return;
    for (const name of [
      "key",
      "value",
      "field",
      "score",
      "ttl",
      "start",
      "stop",
      "command",
      "args",
    ]) {
      if (!this.properties[name] || typeof this.properties[name] !== "object") {
        this.properties[name] = { value: "", isSlot: false, slotId: `redis_${name}` };
      }
      if (!this.properties[name].slotId) {
        this.properties[name].slotId = `redis_${name}`;
      }
    }
    if (!OPERATIONS.has(this.properties.operation)) {
      this.properties.operation = "get";
    }
    if (typeof this.properties.redisDbId !== "string") {
      this.properties.redisDbId = "";
    }
    if (!Number.isInteger(Number(this.properties.dbIndex))) {
      this.properties.dbIndex = 0;
    }
    this.updateInputSlots();
  }

  _getShortId() {
    return String(this.id).slice(0, 8);
  }

  _toStringLiteral(value) {
    return JSON.stringify(String(value ?? ""));
  }

  _toNumberLiteral(value, fallback = "0") {
    const s = String(value ?? "").trim();
    return /^-?\d+(\.\d+)?$/.test(s) ? s : fallback;
  }

  _toArrayExpression(value) {
    const s = String(value ?? "").trim();
    if (!s) return "[]";
    return s.startsWith("[") ? s : `[${s}]`;
  }

  _paramExpr(name, kind = "string", fallback = "") {
    const config = this.properties[name];
    if (!config) return kind === "array" ? "[]" : this._toStringLiteral(fallback);

    if (config.isSlot) {
      const slotIdx = this.findInputSlot(config.slotId);
      if (slotIdx >= 0 && this.isInputConnected(slotIdx)) {
        const value = this.getInputData(slotIdx);
        if (value != null && value !== "") return value;
      }
      return kind === "array" ? "[]" : kind === "number" ? fallback || "0" : this._toStringLiteral(fallback);
    }

    if (kind === "number") return this._toNumberLiteral(config.value, fallback || "0");
    if (kind === "array") return this._toArrayExpression(config.value);
    return this._toStringLiteral(config.value ?? fallback);
  }

  _requiredParams(operation) {
    switch (operation) {
      case "set":
        return ["key", "value", "ttl"];
      case "hget":
        return ["key", "field"];
      case "hset":
        return ["key", "field", "value"];
      case "lpush":
      case "rpush":
      case "sadd":
        return ["key", "value"];
      case "lrange":
      case "zrange":
        return ["key", "start", "stop"];
      case "zadd":
        return ["key", "score", "value"];
      case "expire":
        return ["key", "ttl"];
      case "call":
        return ["command", "args"];
      case "get":
      case "del":
      case "exists":
      case "ttl":
      case "hgetall":
      case "smembers":
      default:
        return ["key"];
    }
  }

  updateInputSlots() {
    const wanted = new Set();
    for (const name of this._requiredParams(this.properties.operation)) {
      const config = this.properties[name];
      if (config?.isSlot) wanted.add(config.slotId);
    }

    for (let i = (this.inputs?.length || 0) - 1; i >= 0; i--) {
      const input = this.inputs[i];
      if (input.type === "orderSlot") continue;
      if (!wanted.has(input.name) && !wanted.has(input.id)) {
        this.removeInput(i);
      }
    }

    const existing = new Set((this.inputs || []).map((s) => s?.name).filter(Boolean));
    for (const slotName of wanted) {
      if (!existing.has(slotName)) {
        this.addInput(slotName, "string", { id: slotName });
      }
    }

    this.setSize?.(this.computeSize());
    this.setDirtyCanvas?.(true, true);
  }

  _buildRedisCall(operation, clientVar) {
    const key = this._paramExpr("key");
    const value = this._paramExpr("value");
    const field = this._paramExpr("field");
    const score = this._paramExpr("score", "number", "0");
    const ttl = this._paramExpr("ttl", "number", "0");
    const start = this._paramExpr("start", "number", "0");
    const stop = this._paramExpr("stop", "number", "-1");

    switch (operation) {
      case "get":
        return `${clientVar}.get(${key})`;
      case "set":
        return this.properties.ttl?.value || this.properties.ttl?.isSlot
          ? `${clientVar}.set(${key}, ${value}, "EX", ${ttl})`
          : `${clientVar}.set(${key}, ${value})`;
      case "del":
        return `${clientVar}.del(${key})`;
      case "exists":
        return `${clientVar}.exists(${key})`;
      case "expire":
        return `${clientVar}.expire(${key}, ${ttl})`;
      case "ttl":
        return `${clientVar}.ttl(${key})`;
      case "hget":
        return `${clientVar}.hget(${key}, ${field})`;
      case "hset":
        return `${clientVar}.hset(${key}, ${field}, ${value})`;
      case "hgetall":
        return `${clientVar}.hgetall(${key})`;
      case "lpush":
        return `${clientVar}.lpush(${key}, ${value})`;
      case "rpush":
        return `${clientVar}.rpush(${key}, ${value})`;
      case "lrange":
        return `${clientVar}.lrange(${key}, ${start}, ${stop})`;
      case "sadd":
        return `${clientVar}.sadd(${key}, ${value})`;
      case "smembers":
        return `${clientVar}.smembers(${key})`;
      case "zadd":
        return `${clientVar}.zadd(${key}, ${score}, ${value})`;
      case "zrange":
        return `${clientVar}.zrange(${key}, ${start}, ${stop})`;
      case "call": {
        const command = this._paramExpr("command");
        const args = this._paramExpr("args", "array");
        return `${clientVar}.call(${command}, ...${args})`;
      }
      default:
        return `${clientVar}.get(${key})`;
    }
  }

  onExecute() {
    this._lastResultVar = null;
    const operation = OPERATIONS.has(this.properties.operation)
      ? this.properties.operation
      : "get";
    const resultVar = `redis_${operation}_${this._getShortId()}_result`;
    const clientVar = `redis_${this._getShortId()}_client`;
    const dbIndex = Number.isInteger(Number(this.properties.dbIndex))
      ? Number(this.properties.dbIndex)
      : 0;

    this.bgJsCode = `const ${clientVar} = getRedis(${dbIndex})\nconst ${resultVar} = await ${this._buildRedisCall(operation, clientVar)}`;
    this.bgImportStr = "import { getRedis } from '{{BG_ROOT}}/redis/client.js'";
    this.setOutputData(this.findOutputSlot("result"), resultVar);
    this._lastResultVar = resultVar;
  }

  static get title() {
    return "Redis";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "redis-node-001";
  }

  static get treePath() {
    return "Backend";
  }
}
