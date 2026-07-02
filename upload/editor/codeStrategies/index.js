import { currentFileType } from "../../leftWidget/folder/useFileTree.js";
import { useProjectStore } from "src/stores/projectMange.js";

const strategies = {};

function getCurrentFileType() {
  const backendType = getBackendCurrentFileType();
  if (backendType?.codeStrategy) {
    return backendType;
  }
  const taskType = getTaskCurrentFileType();
  if (taskType) {
    return taskType;
  }
  return currentFileType.value || backendType;
}

function getTaskCurrentFileType() {
  const project = useProjectStore();
  if (project.activeEditorScope !== "tasks") return null;
  return { codeStrategy: null };
}

function getBackendCurrentFileType() {
  const project = useProjectStore();
  const currentSelect = project.getCurrentSelect();
  const node = (project.getBackendTreeData() || []).find(
    (item) => item.id === currentSelect,
  );
  if (!node) return null;

  const backendTemplates = {
    serviceGraph: { codeStrategy: "backendService" },
    serviceCode: { codeStrategy: "backendService" },
    functionGraph: { codeStrategy: "backendFunction" },
    functionCode: { codeStrategy: "backendFunction" },
  };
  return backendTemplates[node.templateType] || null;
}

function registerStrategy(name, strategy) {
  strategies[name] = strategy;
}

function getStrategy(name) {
  const strategy = strategies[name];
  if (!strategy) {
    console.warn(`[codeStrategy] strategy "${name}" is not registered`);
    return null;
  }
  return strategy;
}

export { getStrategy as getCodeStrategy };

import vueComponent from "./vueComponent.js";
registerStrategy("vueComponent", vueComponent);

import piniaStore from "./piniaStore/index.js";
registerStrategy("piniaStore", piniaStore);

import routerConfig from "./routerConfig/index.js";
registerStrategy("routerConfig", routerConfig);

import backendService from "./backendService/index.js";
registerStrategy("backendService", backendService);

import backendFunction from "./backendFunction/index.js";
registerStrategy("backendFunction", backendFunction);

import meta2dComponent from "./meta2dComponent/index.js";
registerStrategy("meta2dComponent", meta2dComponent);

export default {
  afterStep() {
    const fileType = getCurrentFileType();
    const strategyName = fileType?.codeStrategy;

    if (!strategyName) {
      return { jsCode: "", vNodeCode: "[]" };
    }

    const strategy = getStrategy(strategyName);
    if (!strategy?.afterStep) {
      console.warn(
        `[codeStrategy] strategy "${strategyName}" does not implement afterStep`,
      );
      return { jsCode: "", vNodeCode: "[]" };
    }

    return strategy.afterStep();
  },

  compile(code, rootPath, baseUrl) {
    const fileType = getCurrentFileType();
    const strategyName = fileType?.codeStrategy;

    if (!strategyName) {
      console.warn("[codeStrategy] current file has no codeStrategy");
      return Promise.resolve(code);
    }

    const strategy = getStrategy(strategyName);
    if (!strategy?.compile) {
      console.warn(
        `[codeStrategy] strategy "${strategyName}" does not implement compile`,
      );
      return Promise.resolve(code);
    }

    return strategy.compile(code, rootPath, baseUrl);
  },

  generatePreviewScript(code, options) {
    const fileType = getCurrentFileType();
    const strategyName = fileType?.codeStrategy;

    if (!strategyName) {
      return "";
    }

    const strategy = getStrategy(strategyName);
    if (!strategy?.generatePreviewScript) {
      console.warn(
        `[codeStrategy] strategy "${strategyName}" does not implement generatePreviewScript`,
      );
      return "";
    }

    return strategy.generatePreviewScript(code, options);
  },

  generateSFC(options) {
    const fileType = getCurrentFileType();
    const strategyName = fileType?.codeStrategy;

    if (!strategyName) {
      console.warn("[codeStrategy] current file has no codeStrategy");
      return "";
    }

    const strategy = getStrategy(strategyName);
    if (!strategy?.generateSFC) {
      console.warn(
        `[codeStrategy] strategy "${strategyName}" does not implement generateSFC`,
      );
      return "";
    }

    return strategy.generateSFC(options);
  },

  generateJS(options) {
    const fileType = getCurrentFileType();
    const strategyName = fileType?.codeStrategy;

    if (!strategyName) {
      console.warn("[codeStrategy] current file has no codeStrategy");
      return "";
    }

    const strategy = getStrategy(strategyName);
    if (!strategy?.generateJS) {
      if (strategy?.generateSFC) {
        return strategy.generateSFC(options);
      }
      console.warn(
        `[codeStrategy] strategy "${strategyName}" does not implement generateJS`,
      );
      return "";
    }

    return strategy.generateJS(options);
  },

  hasDragEditor() {
    const fileType = getCurrentFileType();
    const strategyName = fileType?.codeStrategy;

    if (!strategyName) return false;

    const strategy = getStrategy(strategyName);
    return strategy?.hasDragEditor ?? false;
  },

  getType() {
    const fileType = getCurrentFileType();
    const strategyName = fileType?.codeStrategy;

    if (!strategyName) return null;

    const strategy = getStrategy(strategyName);
    return strategy?.type ?? null;
  },
};
