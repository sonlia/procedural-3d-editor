/**
 * Meta2D 统一节点
 *
 * 设计思路：
 * - 将图形、事件、动效整合为 3 个下拉式节点
 * - 每个节点通过下拉选择切换具体类型
 * - 节点之间通过 pen_ref / signal / object 端口连接
 */
import { nodeMeta } from "../nodeMetea.js";
import { defineAsyncComponent, markRaw } from "vue";
import { uid } from "quasar";
import { LiteGraph } from "../../editor.js";
import {
  shapeTypes,
  triggerTypes,
  behaviorTypes,
  animateTypeOptions,
  presetFrames,
  META2D_EVENT_ACTIONS,
} from "../../../meta2dEditor/data/nodeDefinitions.js";

// ==================== 统一节点基类 ====================
class Meta2dUnifiedBase extends nodeMeta {
  constructor() {
    super();
    // 清空默认输入/输出（orderIn / orderOut）
    this.inputs.length = 0;
    this.outputs.length = 0;

    this.categories = "meta2d-unified";
  }

  static get treePath() {
    return "meta2d/统一";
  }
}

// ==================== 图形节点 ====================
export class ShapeNode extends Meta2dUnifiedBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      shapeType: "square",
      width: 100,
      height: 100,
      text: "正方形",
      color: "#1890ff",
      background: "#2d2d2d",
    };

    // 输出端口：pen 引用
    this.addOutput("pen", "pen_ref");

    this.bgcolor = "#1a5276";
    this.color = "#2e86ab";

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/ShapeNodePanel.vue"))
    );
  }

  onExecute() {
    const shape = shapeTypes.find(
      (s) => s.value === this.properties.shapeType
    );

    const penData = shape
      ? { ...shape.penData }
      : { name: "square", text: "正方形", width: 100, height: 100 };

    // 用节点属性覆盖 penData 中的可编辑字段
    penData.width = this.properties.width;
    penData.height = this.properties.height;
    if (this.properties.text) penData.text = this.properties.text;
    if (this.properties.color) penData.color = this.properties.color;
    if (this.properties.background) penData.background = this.properties.background;

    this.setOutputData(0, { type: "pen_ref", penData });
  }

  static get title() {
    return "图形节点";
  }
  static get id() {
    return "meta2d-unified-shape";
  }
  static get treePath() {
    return "meta2d/统一";
  }
}

// ==================== 事件节点 ====================

/** behavior 字符串 → META2D_EVENT_ACTIONS 数字映射 */
const BEHAVIOR_ACTION_MAP = {
  link: META2D_EVENT_ACTIONS.Link,
  setValue: META2D_EVENT_ACTIONS.SetProps,
  startAnimate: META2D_EVENT_ACTIONS.StartAnimate,
  pauseAnimate: META2D_EVENT_ACTIONS.PauseAnimate,
  stopAnimate: META2D_EVENT_ACTIONS.StopAnimate,
  javascript: META2D_EVENT_ACTIONS.JS,
  globalFn: META2D_EVENT_ACTIONS.GlobalFn,
  emit: META2D_EVENT_ACTIONS.Emit,
  startVideo: META2D_EVENT_ACTIONS.StartVideo,
  pauseVideo: META2D_EVENT_ACTIONS.PauseVideo,
  stopVideo: META2D_EVENT_ACTIONS.StopVideo,
};

export class EventNode extends Meta2dUnifiedBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      trigger: "click",
      behavior: "link",
      url: "",
      target: "_blank",
      propsJson: "",
      targetId: "",
      jsCode: "",
      fnName: "",
      targetTag: "",
      messageName: "",
      whereFnJs: "",
      whereType: "",
    };

    // 输入端口
    this.addInput("pen", "pen_ref");

    // 输出端口
    this.addOutput("trigger", "signal", { shape: LiteGraph.ARROW_SHAPE });
    this.addOutput("event", "object");

    this.bgcolor = "#2d5a3d";
    this.color = "#3a7a4d";

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/EventNodePanel.vue"))
    );
  }

  onExecute() {
    const { trigger, behavior } = this.properties;
    const action = BEHAVIOR_ACTION_MAP[behavior] ?? 0;

    // 根据 behavior 类型取对应的 value
    let value = "";
    switch (behavior) {
      case "link":
        value = this.properties.url;
        break;
      case "setValue":
        value = this.properties.targetId;
        break;
      case "javascript":
        value = this.properties.jsCode;
        break;
      case "globalFn":
        value = this.properties.fnName;
        break;
      case "emit":
        value = this.properties.messageName;
        break;
      default:
        // startAnimate / pauseAnimate / stopAnimate / startVideo / pauseVideo / stopVideo
        value = this.properties.targetTag;
        break;
    }

    const eventConfig = {
      name: trigger,
      action,
      value,
    };

    // link 行为附带 target 参数
    if (behavior === "link") {
      eventConfig.params = this.properties.target;
    }

    // setValue 行为附带属性 JSON 参数
    if (behavior === "setValue") {
      eventConfig.params = this.properties.propsJson;
    }

    // 附带触发条件
    if (this.properties.whereFnJs) {
      eventConfig.where = {
        type: this.properties.whereType,
        fnJs: this.properties.whereFnJs,
      };
    }

    // 输出信号
    this.setOutputData(0, { type: "trigger", eventType: trigger });
    // 输出事件配置
    this.setOutputData(1, eventConfig);
  }

  static get title() {
    return "事件节点";
  }
  static get id() {
    return "meta2d-unified-event";
  }
  static get treePath() {
    return "meta2d/统一";
  }
}

// ==================== 动效节点 ====================
export class AnimateNode extends Meta2dUnifiedBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      animateType: "rotate",
      duration: 1000,
      loopCount: 0,
      autoPlay: false,
      frames: JSON.stringify([{ duration: 1000, rotate: 360 }]),
    };

    // 输入端口
    this.addInput("pen", "pen_ref");
    this.addInput("trigger", "signal", { shape: LiteGraph.ARROW_SHAPE });

    // 输出端口
    this.addOutput("done", "signal", { shape: LiteGraph.ARROW_SHAPE });
    this.addOutput("config", "object");

    this.bgcolor = "#2d3d5a";
    this.color = "#3a4d7a";

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/AnimateNodePanel.vue"))
    );
  }

  onExecute() {
    let parsedFrames = [];
    try {
      parsedFrames = JSON.parse(this.properties.frames);
    } catch {
      parsedFrames = [];
    }

    const config = {
      animateType: this.properties.animateType,
      animateDuration: this.properties.duration,
      animateCycle: this.properties.loopCount,
      autoPlay: this.properties.autoPlay,
      frames: parsedFrames,
    };

    // 输出完成信号
    this.setOutputData(0, { type: "signal", done: true });
    // 输出动画配置
    this.setOutputData(1, config);
  }

  static get title() {
    return "动效节点";
  }
  static get id() {
    return "meta2d-unified-animate";
  }
  static get treePath() {
    return "meta2d/统一";
  }
}
