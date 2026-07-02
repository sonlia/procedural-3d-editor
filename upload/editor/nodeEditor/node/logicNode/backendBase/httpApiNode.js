import { Subgraph } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";
import { buildBackendRoute } from "./routeCodegen.js";
import {
  buildFetchFunction,
  safeFuncNameFromPath,
} from "./fetchCodegen.js";

/**
 * HTTP API 节点 - 前后端一体化请求节点
 * 外层生成前端 async 函数 + ref 定义
 * 内部子图编排后端路由处理逻辑
 */
export class HttpApiNode extends Subgraph {
  constructor() {
    super();

    this.categories = "backend";

    this.properties = {
      method: "POST",
      routePath: "",
      autoRoute: true,
      execMode: "manual", // manual | auto
      passIn: [],
      passOut: [],
      remark: "",
      notifyOnSuccess: false,  // SSE 通知：成功时也提示（默认关闭，失败始终通知）
    };

    // 节点颜色 - 区别于 BackendFunction 的深蓝，用深青色
    this.bgcolor = "#1a3a3a";
    this.color = "#2d6a6a";

    // 固定输出 slot：error, status, loading
    this.addOutput("error", "string", { id: uid(), isFixed: true });
    this.addOutput("status", "number", { id: uid(), isFixed: true });
    this.addOutput("loading", "boolean", { id: uid(), isFixed: true });

    this.uiPanel = defineAsyncComponent(
      () => import("./httpApiPanel.vue")
    );
  }

  /**
   * Subgraph 机制添加 GraphInput → 父节点 addInput 时注入 valueMode:'label'
   * 子图代码经 HTTP 跑在后端 handler 内,destructure 出 slot.name,
   * 所以子图内 GraphInput 必须拿 slot.name(label),否则引用错误变量名
   *
   * output 端不标 label:节点 onExecute 自己 setOutputData 写 `${funcName}_${name}.value`
   * 字符串供前端下游 ref 引用;标 label 会被 prototype wrapper 覆盖成裸 name 丢掉 `.value`
   */
  onSubgraphNewInput(name, type, options) {
    super.onSubgraphNewInput(name, type, {
      ...(options || {}),
      valueMode: "label",
    });
  }

  /**
   * 反序列化兼容:老数据 input slot 不带 valueMode,加载后默认 'value' → 后端找不到变量
   * 给所有 input data slot 补 'label'(orderSlot 跳过);output 不动
   */
  onConfigure(o) {
    super.onConfigure?.(o);
    if (!Array.isArray(this.inputs)) return;
    for (const slot of this.inputs) {
      if (!slot?.name) continue;
      if (slot.valueMode) continue;
      if (slot.type === "orderSlot") continue;
      slot.valueMode = "label";
    }
  }

  /**
   * 生成安全的函数名（从路由路径派生）
   */
  _getFuncName() {
    return safeFuncNameFromPath(this._getRoutePath(), "api_unnamed");
  }

  /**
   * 获取路由路径（自动或手动）
   */
  _getRoutePath() {
    if (!this.properties.autoRoute && this.properties.routePath) {
      return this.properties.routePath;
    }
    // 自动生成：/api/auto/{节点id前8位}
    const shortId = (this.id || "unknown").substring(0, 8);
    return `/api/auto/${shortId}`;
  }

  onExecute() {
    super.onExecute();

    const method = (this.properties.method || "POST").toUpperCase();
    const routePath = this._getRoutePath();
    const funcName = this._getFuncName();
    const passInParams = this.properties.passIn || [];
    const passOutParams = this.properties.passOut || [];

    // 更新节点标题显示
    this.title = `${method} ${routePath}`;

    const paramNames = passInParams.map((p) => p.name);

    // GET 用 querystring(运行时模板字面量),其他 method 用 JSON body
    const isGet = method === "GET";
    let queryParamsExpr = null;
    let bodyJsonExpr = null;
    if (isGet && paramNames.length > 0) {
      queryParamsExpr = paramNames
        .map((n) => `\${${n}}=\${encodeURIComponent(${n})}`)
        .join("&");
    } else if (!isGet) {
      bodyJsonExpr =
        paramNames.length > 0
          ? `JSON.stringify({ ${paramNames.join(", ")} })`
          : "undefined";
    }

    // execMode='auto' 时,onMounted 调用要把 wire 真值传入异步函数。
    // passIn slot 标 valueMode:'label',this.getInputData 返回 label,所以直读 link.data。
    let onMountedCallArgs = "";
    if (this.properties.execMode === "auto") {
      const inputValues = paramNames.map((name) => {
        const slotIdx = this.findInputSlot(name);
        if (slotIdx < 0) return "undefined";
        const linkId = this.inputs[slotIdx]?.link;
        const val =
          linkId != null ? this.graph?.links?.[linkId]?.data : undefined;
        return val || "undefined";
      });
      onMountedCallArgs = inputValues.join(", ");
    }

    const responseRefs = passOutParams.map((p) => ({
      refName: `${funcName}_${p.name}`,
      jsonKey: p.name,
    }));
    const errorRef = `${funcName}_error`;
    const statusRef = `${funcName}_status`;
    const loadingRef = `${funcName}_loading`;

    // fetchMode='simple':res.json() 直返,catch 只接住网络错误(原 HttpApi 行为)。
    // 升级到 robust 模式(吞 4xx/5xx + 非 JSON 错误响应)是独立改动,本次不涉及。
    const { jsCode, jsRefLines, importStr } = buildFetchFunction({
      funcName,
      method,
      routePath,
      params: paramNames,
      bodyJsonExpr,
      queryParamsExpr,
      responseRefs,
      loadingRef,
      errorRef,
      statusRef,
      fetchMode: "simple",
      errorHandling: "errorRef",
      exec: {
        mode: this.properties.execMode === "auto" ? "auto" : "manual",
        watchDeps: [],
        immediateOnAuto: false,
        // HttpApi 的 manual 模式不追加调用语句,函数定义后由用户在其他节点显式调用
        appendManualCall: false,
        callArgs: onMountedCallArgs,
      },
    });
    // HttpApi 不单独消费 jsRefLines(assembler 对 isBackendRouteNode 只读 jsCode);
    // 把 ref 行 prefix 到 jsCode 中,保持现行 setup 顶层声明顺序。
    this.jsCode = jsRefLines + "\n\n" + jsCode;
    this.importStr = importStr;

    // 前端输出 slot:下游拿到字符串后拼到代码里,带 `.value` 才能取真值。
    for (const p of passOutParams) {
      const idx = this.findOutputSlot(p.name);
      if (idx >= 0) {
        this.setOutputData(idx, `${funcName}_${p.name}.value`);
      }
    }
    const errorIdx = this.findOutputSlot("error");
    if (errorIdx >= 0) this.setOutputData(errorIdx, `${errorRef}.value`);
    const statusIdx = this.findOutputSlot("status");
    if (statusIdx >= 0) this.setOutputData(statusIdx, `${statusRef}.value`);
    const loadingIdx = this.findOutputSlot("loading");
    if (loadingIdx >= 0) this.setOutputData(loadingIdx, `${loadingRef}.value`);

    // --- 后端代码生成 ---
    const successNotifyStmt = this.properties.notifyOnSuccess
      ? `notifyClient('success', '${method} ${routePath} 请求成功')`
      : null;

    // prefixSse=false:HttpApi 历史上没带 registerSseNotifyRoute 前缀。
    //   errorHandling='reply500' 仍触发 notifyClient('error', ...) 在路由 catch 里,
    //   helper 会自动把 sse/notify import 加入返回的 imports 数组。
    const { code, imports } = buildBackendRoute({
      method,
      path: routePath,
      paramNames,
      paramSource: isGet ? "query" : "body",
      returnNames: passOutParams.map((p) => p.name),
      body: `__SUBGRAPH_${this.id}__`,
      errorHandling: "reply500",
      successNotify: successNotifyStmt,
      remark: this.properties.remark,
      prefixSse: false,
      includeKnexImport: false,
    });
    this.bgJsCode = code;
    this.bgImportStr = imports.join("\n");
  }

  static get title() { return "Service"; }
  static get id() { return "http-api-node-001"; }
  static get treePath() { return "Backend"; }
}
