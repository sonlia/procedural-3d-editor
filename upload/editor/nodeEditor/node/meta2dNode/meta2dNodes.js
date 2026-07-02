/**
 * Meta2D 配置节点
 *
 * 这些节点用于配置 meta2d 图元的属性和事件
 * 每个图元类型可以有自己的配置节点
 */
import { nodeMeta } from "../nodeMetea.js";
import { defineAsyncComponent, markRaw } from "vue";
import { uid } from "quasar";

/**
 * Meta2D 基础配置节点
 * 用于配置通用的图元属性（样式、事件等）
 */
export class Meta2dBaseConfig extends nodeMeta {
  constructor() {
    super();

    const defaultId = uid();
    this.properties = {
      id: defaultId,
      penId: "", // 关联的 meta2d 图元 ID
      penType: "", // 图元类型
      penName: "", // 图元名称
      // 样式配置
      color: "#1890ff",
      background: "#ffffff",
      lineWidth: 1,
      // 事件配置
      onClick: false,
      onDblClick: false,
      onMouseEnter: false,
      onMouseLeave: false,
      // 数据绑定
      dataBinding: "",
      remark: "",
    };

    // 删除默认的 order slots（meta2d 节点不需要顺序连接）
    this.inputs.length = 0;
    this.outputs.length = 0;

    // 添加数据输出
    this.addOutput("penId", "string");
    this.addOutput("data", "object");

    // 属性面板
    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./Meta2dBasePanel.vue"))
    );

    this.bgcolor = "#1a5276";
    this.color = "#2e86ab";
  }

  onExecute() {
    // 输出图元 ID 供其他节点使用
    this.setOutputData(0, this.properties.penId);

    // 输出配置数据
    this.setOutputData(1, {
      color: this.properties.color,
      background: this.properties.background,
      lineWidth: this.properties.lineWidth,
      dataBinding: this.properties.dataBinding,
    });
  }

  static get title() {
    return "基础配置";
  }

  static get name() {
    return "BaseConfig";
  }

  static get id() {
    return "meta2d-base-config-001";
  }

  static get treePath() {
    return "meta2d";
  }
}

/**
 * 矩形图元配置节点
 */
export class Meta2dRectConfig extends nodeMeta {
  constructor() {
    super();

    const defaultId = uid();
    this.properties = {
      id: defaultId,
      penId: "",
      penType: "rectangle",
      penName: "",
      // 矩形特有属性
      width: 100,
      height: 100,
      borderRadius: 0,
      // 样式
      color: "#1890ff",
      background: "#ffffff",
      lineWidth: 1,
      // 事件
      onClick: false,
      onDblClick: false,
      remark: "",
    };

    this.inputs.length = 0;
    this.outputs.length = 0;

    this.addOutput("penId", "string");
    this.addOutput("config", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./Meta2dBasePanel.vue"))
    );

    this.bgcolor = "#1a5276";
    this.color = "#2e86ab";
  }

  onExecute() {
    this.setOutputData(0, this.properties.penId);
    this.setOutputData(1, {
      width: this.properties.width,
      height: this.properties.height,
      borderRadius: this.properties.borderRadius,
      color: this.properties.color,
      background: this.properties.background,
      lineWidth: this.properties.lineWidth,
    });
  }

  static get title() {
    return "矩形配置";
  }

  static get name() {
    return "RectConfig";
  }

  static get id() {
    return "meta2d-rect-config-001";
  }

  static get treePath() {
    return "meta2d";
  }
}

/**
 * 圆形图元配置节点
 */
export class Meta2dCircleConfig extends nodeMeta {
  constructor() {
    super();

    const defaultId = uid();
    this.properties = {
      id: defaultId,
      penId: "",
      penType: "circle",
      penName: "",
      // 圆形特有属性
      radius: 40,
      // 样式
      color: "#1890ff",
      background: "#ffffff",
      lineWidth: 1,
      // 事件
      onClick: false,
      remark: "",
    };

    this.inputs.length = 0;
    this.outputs.length = 0;

    this.addOutput("penId", "string");
    this.addOutput("config", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./Meta2dBasePanel.vue"))
    );

    this.bgcolor = "#1a5276";
    this.color = "#2e86ab";
  }

  onExecute() {
    this.setOutputData(0, this.properties.penId);
    this.setOutputData(1, {
      radius: this.properties.radius,
      color: this.properties.color,
      background: this.properties.background,
      lineWidth: this.properties.lineWidth,
    });
  }

  static get title() {
    return "圆形配置";
  }

  static get name() {
    return "CircleConfig";
  }

  static get id() {
    return "meta2d-circle-config-001";
  }

  static get treePath() {
    return "meta2d";
  }
}

/**
 * 文本图元配置节点
 */
export class Meta2dTextConfig extends nodeMeta {
  constructor() {
    super();

    const defaultId = uid();
    this.properties = {
      id: defaultId,
      penId: "",
      penType: "text",
      penName: "",
      // 文本特有属性
      text: "文本",
      fontSize: 14,
      fontFamily: "Arial",
      fontWeight: "normal",
      textAlign: "center",
      // 样式
      color: "#ffffff",
      background: "transparent",
      // 事件
      onClick: false,
      remark: "",
    };

    this.inputs.length = 0;
    this.outputs.length = 0;

    this.addOutput("penId", "string");
    this.addOutput("config", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./Meta2dBasePanel.vue"))
    );

    this.bgcolor = "#1a5276";
    this.color = "#2e86ab";
  }

  onExecute() {
    this.setOutputData(0, this.properties.penId);
    this.setOutputData(1, {
      text: this.properties.text,
      fontSize: this.properties.fontSize,
      fontFamily: this.properties.fontFamily,
      fontWeight: this.properties.fontWeight,
      textAlign: this.properties.textAlign,
      color: this.properties.color,
      background: this.properties.background,
    });
  }

  static get title() {
    return "文本配置";
  }

  static get name() {
    return "TextConfig";
  }

  static get id() {
    return "meta2d-text-config-001";
  }

  static get treePath() {
    return "meta2d";
  }
}

/**
 * 图片图元配置节点
 */
export class Meta2dImageConfig extends nodeMeta {
  constructor() {
    super();

    const defaultId = uid();
    this.properties = {
      id: defaultId,
      penId: "",
      penType: "image",
      penName: "",
      // 图片特有属性
      image: "",
      width: 100,
      height: 100,
      // 事件
      onClick: false,
      remark: "",
    };

    this.inputs.length = 0;
    this.outputs.length = 0;

    this.addOutput("penId", "string");
    this.addOutput("config", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./Meta2dBasePanel.vue"))
    );

    this.bgcolor = "#1a5276";
    this.color = "#2e86ab";
  }

  onExecute() {
    this.setOutputData(0, this.properties.penId);
    this.setOutputData(1, {
      image: this.properties.image,
      width: this.properties.width,
      height: this.properties.height,
    });
  }

  static get title() {
    return "图片配置";
  }

  static get name() {
    return "ImageConfig";
  }

  static get id() {
    return "meta2d-image-config-001";
  }

  static get treePath() {
    return "meta2d";
  }
}

/**
 * 形状图元配置节点（三角形、菱形、五边形等）
 */
export class Meta2dShapeConfig extends nodeMeta {
  constructor() {
    super();

    const defaultId = uid();
    this.properties = {
      id: defaultId,
      penId: "",
      penType: "shape",
      penName: "",
      // 形状属性
      width: 100,
      height: 100,
      // 样式
      color: "#1890ff",
      background: "#ffffff",
      lineWidth: 1,
      // 事件
      onClick: false,
      remark: "",
    };

    this.inputs.length = 0;
    this.outputs.length = 0;

    this.addOutput("penId", "string");
    this.addOutput("config", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./Meta2dBasePanel.vue"))
    );

    this.bgcolor = "#1a5276";
    this.color = "#2e86ab";
  }

  onExecute() {
    this.setOutputData(0, this.properties.penId);
    this.setOutputData(1, {
      width: this.properties.width,
      height: this.properties.height,
      color: this.properties.color,
      background: this.properties.background,
      lineWidth: this.properties.lineWidth,
    });
  }

  static get title() {
    return "形状配置";
  }

  static get name() {
    return "ShapeConfig";
  }

  static get id() {
    return "meta2d-shape-config-001";
  }

  static get treePath() {
    return "meta2d";
  }
}

/**
 * 箭头图元配置节点
 */
export class Meta2dArrowConfig extends nodeMeta {
  constructor() {
    super();

    const defaultId = uid();
    this.properties = {
      id: defaultId,
      penId: "",
      penType: "arrow",
      penName: "",
      // 箭头属性
      width: 100,
      height: 50,
      // 样式
      color: "#1890ff",
      background: "#ffffff",
      lineWidth: 1,
      // 事件
      onClick: false,
      remark: "",
    };

    this.inputs.length = 0;
    this.outputs.length = 0;

    this.addOutput("penId", "string");
    this.addOutput("config", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./Meta2dBasePanel.vue"))
    );

    this.bgcolor = "#1a5276";
    this.color = "#2e86ab";
  }

  onExecute() {
    this.setOutputData(0, this.properties.penId);
    this.setOutputData(1, {
      width: this.properties.width,
      height: this.properties.height,
      color: this.properties.color,
      background: this.properties.background,
      lineWidth: this.properties.lineWidth,
    });
  }

  static get title() {
    return "箭头配置";
  }

  static get name() {
    return "ArrowConfig";
  }

  static get id() {
    return "meta2d-arrow-config-001";
  }

  static get treePath() {
    return "meta2d";
  }
}

/**
 * 连线图元配置节点
 */
export class Meta2dLineConfig extends nodeMeta {
  constructor() {
    super();

    const defaultId = uid();
    this.properties = {
      id: defaultId,
      penId: "",
      penType: "line",
      penName: "",
      // 连线属性
      lineWidth: 2,
      lineDash: [],
      // 样式
      color: "#1890ff",
      // 箭头
      fromArrow: "",
      toArrow: "triangleSolid",
      // 事件
      onClick: false,
      remark: "",
    };

    this.inputs.length = 0;
    this.outputs.length = 0;

    this.addOutput("penId", "string");
    this.addOutput("config", "object");

    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./Meta2dBasePanel.vue"))
    );

    this.bgcolor = "#1a5276";
    this.color = "#2e86ab";
  }

  onExecute() {
    this.setOutputData(0, this.properties.penId);
    this.setOutputData(1, {
      lineWidth: this.properties.lineWidth,
      lineDash: this.properties.lineDash,
      color: this.properties.color,
      fromArrow: this.properties.fromArrow,
      toArrow: this.properties.toArrow,
    });
  }

  static get title() {
    return "连线配置";
  }

  static get name() {
    return "LineConfig";
  }

  static get id() {
    return "meta2d-line-config-001";
  }

  static get treePath() {
    return "meta2d";
  }
}
