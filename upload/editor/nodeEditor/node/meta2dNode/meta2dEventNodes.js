/**
 * Meta2D 事件节点
 *
 * 设计思路：
 * - 触发节点（Trigger）：监听 pen 的事件类型（click/enter/leave 等）
 * - 行为节点（Action）：定义事件触发后执行的动作
 * - 动画节点（Animate）：控制图元动画
 *
 * 节点连接后，生成符合 meta2d events 格式的配置
 */
import { nodeMeta } from "../nodeMetea.js";
import { defineAsyncComponent, markRaw } from "vue";
import { uid } from "quasar";
import { LiteGraph } from "../../editor.js";

// ==================== 事件类型常量 ====================
export const META2D_EVENT_TYPES = {
  click: { label: "单击", value: "click" },
  dblclick: { label: "双击", value: "dblclick" },
  enter: { label: "鼠标进入", value: "enter" },
  leave: { label: "鼠标离开", value: "leave" },
  active: { label: "选中", value: "active" },
  inactive: { label: "取消选中", value: "inactive" },
};

// ==================== 行为类型常量（对应 EventAction 枚举）====================
export const META2D_EVENT_ACTIONS = {
  Link: 0,
  SetProps: 1,
  StartAnimate: 2,
  PauseAnimate: 3,
  StopAnimate: 4,
  JS: 5,
  GlobalFn: 6,
  Emit: 7,
  StartVideo: 8,
  PauseVideo: 9,
  StopVideo: 10,
};

// ==================== 基础事件节点类 ====================
class Meta2dEventBase extends nodeMeta {
  constructor() {
    super();
    // 事件节点不需要 orderIn/orderOut
    this.inputs.length = 0;
    this.outputs.length = 0;

    this.bgcolor = "#2d5a3d";
    this.color = "#3a7a4d";
    this.categories = "meta2d-event";
  }

  static get treePath() {
    return "meta2d/事件";
  }
}

// ==================== 触发节点：OnPenClick ====================
export class OnPenClick extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      eventType: "click",
      penId: "", // 绑定的图元 ID（可选，空表示当前选中的 pen）
    };

    // 输出：触发信号
    this.addOutput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addOutput("pen", "object"); // 输出触发的 pen 对象引用
    this.addOutput("eventType", "string");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/EventTriggerPanel.vue"))
    );
  }

  onExecute() {
    this.setOutputData(0, { type: "trigger", eventType: this.properties.eventType });
    this.setOutputData(1, `pen`); // 运行时变量名
    this.setOutputData(2, `"${this.properties.eventType}"`);
  }

  static get title() {
    return "单击事件";
  }
  static get id() {
    return "meta2d-event-click";
  }
  static get treePath() {
    return "meta2d/事件/触发";
  }
}

// ==================== 触发节点：OnPenDblClick ====================
export class OnPenDblClick extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      eventType: "dblclick",
      penId: "",
    };

    this.addOutput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addOutput("pen", "object");
    this.addOutput("eventType", "string");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/EventTriggerPanel.vue"))
    );
  }

  onExecute() {
    this.setOutputData(0, { type: "trigger", eventType: this.properties.eventType });
    this.setOutputData(1, `pen`);
    this.setOutputData(2, `"${this.properties.eventType}"`);
  }

  static get title() {
    return "双击事件";
  }
  static get id() {
    return "meta2d-event-dblclick";
  }
  static get treePath() {
    return "meta2d/事件/触发";
  }
}

// ==================== 触发节点：OnPenEnter ====================
export class OnPenEnter extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      eventType: "enter",
      penId: "",
    };

    this.addOutput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addOutput("pen", "object");
    this.addOutput("eventType", "string");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/EventTriggerPanel.vue"))
    );
  }

  onExecute() {
    this.setOutputData(0, { type: "trigger", eventType: this.properties.eventType });
    this.setOutputData(1, `pen`);
    this.setOutputData(2, `"${this.properties.eventType}"`);
  }

  static get title() {
    return "鼠标进入";
  }
  static get id() {
    return "meta2d-event-enter";
  }
  static get treePath() {
    return "meta2d/事件/触发";
  }
}

// ==================== 触发节点：OnPenLeave ====================
export class OnPenLeave extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      eventType: "leave",
      penId: "",
    };

    this.addOutput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addOutput("pen", "object");
    this.addOutput("eventType", "string");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/EventTriggerPanel.vue"))
    );
  }

  onExecute() {
    this.setOutputData(0, { type: "trigger", eventType: this.properties.eventType });
    this.setOutputData(1, `pen`);
    this.setOutputData(2, `"${this.properties.eventType}"`);
  }

  static get title() {
    return "鼠标离开";
  }
  static get id() {
    return "meta2d-event-leave";
  }
  static get treePath() {
    return "meta2d/事件/触发";
  }
}

// ==================== 触发节点：OnPenActive ====================
export class OnPenActive extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      eventType: "active",
      penId: "",
    };

    this.addOutput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addOutput("pen", "object");
    this.addOutput("eventType", "string");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/EventTriggerPanel.vue"))
    );
  }

  onExecute() {
    this.setOutputData(0, { type: "trigger", eventType: this.properties.eventType });
    this.setOutputData(1, `pen`);
    this.setOutputData(2, `"${this.properties.eventType}"`);
  }

  static get title() {
    return "选中事件";
  }
  static get id() {
    return "meta2d-event-active";
  }
  static get treePath() {
    return "meta2d/事件/触发";
  }
}

// ==================== 触发节点：OnPenInactive ====================
export class OnPenInactive extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      eventType: "inactive",
      penId: "",
    };

    this.addOutput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addOutput("pen", "object");
    this.addOutput("eventType", "string");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/EventTriggerPanel.vue"))
    );
  }

  onExecute() {
    this.setOutputData(0, { type: "trigger", eventType: this.properties.eventType });
    this.setOutputData(1, `pen`);
    this.setOutputData(2, `"${this.properties.eventType}"`);
  }

  static get title() {
    return "取消选中";
  }
  static get id() {
    return "meta2d-event-inactive";
  }
  static get treePath() {
    return "meta2d/事件/触发";
  }
}

// ==================== 行为节点：OpenLink ====================
export class OpenLink extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      url: "",
      target: "_blank", // _blank | _self
    };

    // 输入：触发信号
    this.addInput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addInput("url", "string");

    // 输出：事件配置对象
    this.addOutput("event", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/OpenLinkPanel.vue"))
    );

    this.bgcolor = "#5a2d2d";
    this.color = "#7a3a3a";
  }

  onExecute() {
    // 获取 URL：优先从输入槽获取，否则使用属性
    let url = this.properties.url;
    const urlInput = this.getInputData(1);
    if (urlInput) {
      url = urlInput;
    }

    // 获取触发信号中的事件类型
    const trigger = this.getInputData(0);
    const eventType = trigger?.eventType || "click";

    // 生成事件配置对象
    const eventConfig = {
      name: eventType,
      action: META2D_EVENT_ACTIONS.Link,
      value: url,
      params: this.properties.target,
    };

    this.setOutputData(0, eventConfig);

    // 生成 jsCode（供代码策略使用）
    this.jsCode = `{ name: "${eventType}", action: ${META2D_EVENT_ACTIONS.Link}, value: "${url}", params: "${this.properties.target}" }`;
  }

  static get title() {
    return "打开链接";
  }
  static get id() {
    return "meta2d-action-link";
  }
  static get treePath() {
    return "meta2d/事件/行为";
  }
}

// ==================== 行为节点：SetPenValue ====================
export class SetPenValue extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      targetId: "", // 目标图元 ID/tag，空表示当前 pen
      propsJson: "{}", // 要设置的属性 JSON
    };

    this.addInput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addInput("targetId", "string");
    this.addInput("props", "object");

    this.addOutput("event", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/SetPenValuePanel.vue"))
    );

    this.bgcolor = "#5a2d2d";
    this.color = "#7a3a3a";
  }

  onExecute() {
    const trigger = this.getInputData(0);
    const eventType = trigger?.eventType || "click";

    // 获取目标 ID
    let targetId = this.getInputData(1) || this.properties.targetId;

    // 获取属性
    let propsJson = this.getInputData(2);
    if (!propsJson) {
      propsJson = this.properties.propsJson;
    }

    const eventConfig = {
      name: eventType,
      action: META2D_EVENT_ACTIONS.SetProps,
      value: targetId,
      params: propsJson,
    };

    this.setOutputData(0, eventConfig);
    this.jsCode = JSON.stringify(eventConfig);
  }

  static get title() {
    return "设置属性";
  }
  static get id() {
    return "meta2d-action-setvalue";
  }
  static get treePath() {
    return "meta2d/事件/行为";
  }
}

// ==================== 行为节点：RunJS ====================
export class RunJS extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      code: "// pen, params, context 可用\nconsole.log(pen.id);",
    };

    this.addInput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addInput("code", "string");

    this.addOutput("event", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/RunJSPanel.vue"))
    );

    this.bgcolor = "#5a2d2d";
    this.color = "#7a3a3a";
  }

  onExecute() {
    const trigger = this.getInputData(0);
    const eventType = trigger?.eventType || "click";

    let code = this.getInputData(1) || this.properties.code;

    const eventConfig = {
      name: eventType,
      action: META2D_EVENT_ACTIONS.JS,
      value: code,
    };

    this.setOutputData(0, eventConfig);
    this.jsCode = JSON.stringify(eventConfig);
  }

  static get title() {
    return "执行JS";
  }
  static get id() {
    return "meta2d-action-js";
  }
  static get treePath() {
    return "meta2d/事件/行为";
  }
}

// ==================== 行为节点：CallGlobalFn ====================
export class CallGlobalFn extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      fnName: "myFunction",
    };

    this.addInput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addInput("fnName", "string");

    this.addOutput("event", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/CallGlobalFnPanel.vue"))
    );

    this.bgcolor = "#5a2d2d";
    this.color = "#7a3a3a";
  }

  onExecute() {
    const trigger = this.getInputData(0);
    const eventType = trigger?.eventType || "click";

    const fnName = this.getInputData(1) || this.properties.fnName;

    const eventConfig = {
      name: eventType,
      action: META2D_EVENT_ACTIONS.GlobalFn,
      value: fnName,
    };

    this.setOutputData(0, eventConfig);
    this.jsCode = JSON.stringify(eventConfig);
  }

  static get title() {
    return "调用全局函数";
  }
  static get id() {
    return "meta2d-action-globalfn";
  }
  static get treePath() {
    return "meta2d/事件/行为";
  }
}

// ==================== 行为节点：EmitMessage ====================
export class EmitMessage extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      message: "",
      data: "{}",
    };

    this.addInput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addInput("message", "string");
    this.addInput("data", "object");

    this.addOutput("event", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/EmitMessagePanel.vue"))
    );

    this.bgcolor = "#5a2d2d";
    this.color = "#7a3a3a";
  }

  onExecute() {
    const trigger = this.getInputData(0);
    const eventType = trigger?.eventType || "click";

    const message = this.getInputData(1) || this.properties.message;
    const data = this.getInputData(2) || this.properties.data;

    const eventConfig = {
      name: eventType,
      action: META2D_EVENT_ACTIONS.Emit,
      value: message,
      params: data,
    };

    this.setOutputData(0, eventConfig);
    this.jsCode = JSON.stringify(eventConfig);
  }

  static get title() {
    return "发送消息";
  }
  static get id() {
    return "meta2d-action-emit";
  }
  static get treePath() {
    return "meta2d/事件/行为";
  }
}

// ==================== 条件节点：EventWhere ====================
export class EventWhere extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      type: "custom", // 条件类型
      fnJs: 'return pen.id === "xxx"', // JS 条件表达式
    };

    this.addInput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addInput("fnJs", "string");

    this.addOutput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addOutput("where", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/EventWherePanel.vue"))
    );

    this.bgcolor = "#5a5a2d";
    this.color = "#7a7a3a";
  }

  onExecute() {
    const trigger = this.getInputData(0);
    const fnJs = this.getInputData(1) || this.properties.fnJs;

    // 传递触发信号
    this.setOutputData(0, trigger);

    // 输出条件配置
    const whereConfig = {
      type: this.properties.type,
      fnJs: fnJs,
    };

    this.setOutputData(1, whereConfig);
  }

  static get title() {
    return "触发条件";
  }
  static get id() {
    return "meta2d-event-where";
  }
  static get treePath() {
    return "meta2d/事件/条件";
  }
}

// ==================== 事件聚合节点：EventCollector ====================
/**
 * 将多个事件配置聚合成 events 数组，用于绑定到 pen
 */
export class EventCollector extends Meta2dEventBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
    };

    // 多个事件输入
    this.addInput("event1", "object");
    this.addInput("event2", "object");
    this.addInput("event3", "object");
    this.addInput("event4", "object");

    // 输出聚合后的 events 数组
    this.addOutput("events", "array");

    this.bgcolor = "#2d5a5a";
    this.color = "#3a7a7a";
  }

  onExecute() {
    const events = [];

    for (let i = 0; i < 4; i++) {
      const event = this.getInputData(i);
      if (event && event.name) {
        events.push(event);
      }
    }

    this.setOutputData(0, events);
    this.jsCode = JSON.stringify(events);
  }

  static get title() {
    return "事件聚合";
  }
  static get id() {
    return "meta2d-event-collector";
  }
  static get treePath() {
    return "meta2d/事件";
  }
}
