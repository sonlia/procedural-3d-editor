/**
 * Meta2D 动画节点
 *
 * 设计思路：
 * - AnimateConfig：配置动画参数（类型、时长、循环等）
 * - StartAnimate / PauseAnimate / StopAnimate：作为事件行为节点
 * - AnimateFrames：自定义关键帧
 */
import { nodeMeta } from "../nodeMetea.js";
import { defineAsyncComponent, markRaw } from "vue";
import { uid } from "quasar";
import { LiteGraph } from "../../editor.js";
import { META2D_EVENT_ACTIONS } from "./meta2dEventNodes.js";

// ==================== 基础动画节点类 ====================
class Meta2dAnimateBase extends nodeMeta {
  constructor() {
    super();
    this.inputs.length = 0;
    this.outputs.length = 0;

    this.bgcolor = "#2d3d5a";
    this.color = "#3a4d7a";
    this.categories = "meta2d-animate";
  }

  static get treePath() {
    return "meta2d/动画";
  }
}

// ==================== 动画配置节点 ====================
export class AnimateConfig extends Meta2dAnimateBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      animateType: "bounce", // bounce | rotate | flash | tip | moveX | moveY | fadeOut | fadeIn | custom
      duration: 1000,
      animateCycle: 0, // 0 = 无限
      autoPlay: false,
      // 自定义帧数据 (animateType=custom 时使用)
      customFrames: "[]",
    };

    // 输入：可从其他节点获取配置
    this.addInput("duration", "number");
    this.addInput("animateCycle", "number");
    this.addInput("customFrames", "string");

    // 输出：动画配置对象
    this.addOutput("config", "object");
    this.addOutput("animateType", "string");
    this.addOutput("duration", "number");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/AnimateConfigPanel.vue"))
    );
  }

  onExecute() {
    // 从输入槽获取覆盖值
    const duration = this.getInputData(0) ?? this.properties.duration;
    const animateCycle = this.getInputData(1) ?? this.properties.animateCycle;
    const customFrames = this.getInputData(2) || this.properties.customFrames;

    const config = {
      animateType: this.properties.animateType,
      animateDuration: duration,
      animateCycle: animateCycle,
      autoPlay: this.properties.autoPlay,
    };

    // 如果是自定义帧类型，附加帧数据
    if (this.properties.animateType === "custom") {
      try {
        config.frames = JSON.parse(customFrames);
      } catch {
        config.frames = [];
      }
    }

    this.setOutputData(0, config);
    this.setOutputData(1, this.properties.animateType);
    this.setOutputData(2, duration);
    this.jsCode = JSON.stringify(config);
  }

  static get title() {
    return "动画配置";
  }
  static get id() {
    return "meta2d-animate-config";
  }
  static get treePath() {
    return "meta2d/动画";
  }
}

// ==================== 行为节点：StartAnimate ====================
export class StartAnimate extends Meta2dAnimateBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      targetTag: "", // 目标图元 tag/id，空表示当前 pen
    };

    this.addInput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addInput("targetTag", "string");

    this.addOutput("event", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/AnimateActionPanel.vue"))
    );
  }

  onExecute() {
    const trigger = this.getInputData(0);
    const eventType = trigger?.eventType || "click";
    const targetTag = this.getInputData(1) || this.properties.targetTag;

    const eventConfig = {
      name: eventType,
      action: META2D_EVENT_ACTIONS.StartAnimate,
      value: targetTag,
    };

    this.setOutputData(0, eventConfig);
    this.jsCode = JSON.stringify(eventConfig);
  }

  static get title() {
    return "开始动画";
  }
  static get id() {
    return "meta2d-animate-start";
  }
  static get treePath() {
    return "meta2d/动画/控制";
  }
}

// ==================== 行为节点：PauseAnimate ====================
export class PauseAnimate extends Meta2dAnimateBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      targetTag: "",
    };

    this.addInput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addInput("targetTag", "string");

    this.addOutput("event", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/AnimateActionPanel.vue"))
    );
  }

  onExecute() {
    const trigger = this.getInputData(0);
    const eventType = trigger?.eventType || "click";
    const targetTag = this.getInputData(1) || this.properties.targetTag;

    const eventConfig = {
      name: eventType,
      action: META2D_EVENT_ACTIONS.PauseAnimate,
      value: targetTag,
    };

    this.setOutputData(0, eventConfig);
    this.jsCode = JSON.stringify(eventConfig);
  }

  static get title() {
    return "暂停动画";
  }
  static get id() {
    return "meta2d-animate-pause";
  }
  static get treePath() {
    return "meta2d/动画/控制";
  }
}

// ==================== 行为节点：StopAnimate ====================
export class StopAnimate extends Meta2dAnimateBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      targetTag: "",
    };

    this.addInput("trigger", "trigger", { shape: LiteGraph.ARROW_SHAPE });
    this.addInput("targetTag", "string");

    this.addOutput("event", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/AnimateActionPanel.vue"))
    );
  }

  onExecute() {
    const trigger = this.getInputData(0);
    const eventType = trigger?.eventType || "click";
    const targetTag = this.getInputData(1) || this.properties.targetTag;

    const eventConfig = {
      name: eventType,
      action: META2D_EVENT_ACTIONS.StopAnimate,
      value: targetTag,
    };

    this.setOutputData(0, eventConfig);
    this.jsCode = JSON.stringify(eventConfig);
  }

  static get title() {
    return "停止动画";
  }
  static get id() {
    return "meta2d-animate-stop";
  }
  static get treePath() {
    return "meta2d/动画/控制";
  }
}

// ==================== 关键帧节点 ====================
export class AnimateFrames extends Meta2dAnimateBase {
  constructor() {
    super();

    this.properties = {
      id: uid(),
      frames: JSON.stringify([
        { duration: 300, y: 10 },
      ]),
    };

    // 输出关键帧数组
    this.addOutput("frames", "string");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./panels/AnimateFramesPanel.vue"))
    );
  }

  onExecute() {
    this.setOutputData(0, this.properties.frames);
  }

  static get title() {
    return "关键帧";
  }
  static get id() {
    return "meta2d-animate-frames";
  }
  static get treePath() {
    return "meta2d/动画";
  }
}
