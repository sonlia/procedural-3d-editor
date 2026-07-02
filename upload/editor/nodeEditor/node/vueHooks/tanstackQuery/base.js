import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineUseQuery extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `query_${uid().slice(0, 8)}` },

      // Hook 参数
      queryKey: { id: uid(), isSlot: false, value: "" },
      queryFn: { id: uid(), isSlot: true, value: "" },

      // 选项
      enabled: { id: uid(), isSlot: false, value: "" },
      staleTime: { id: uid(), isSlot: false, value: "" },
      gcTime: { id: uid(), isSlot: false, value: "" },
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,
      retry: { id: uid(), isSlot: false, value: "" },
      retryDelay: { id: uid(), isSlot: false, value: "" },
      placeholderData: { id: uid(), isSlot: false, value: "" },
      initialData: { id: uid(), isSlot: false, value: "" },
    };

    // queryFn 函数 slot
    this.addInput("queryFn", "function", {
      id: this.properties.queryFn.id,
      shape: 5,
      meta: { args: ["context"] },
    });

    this.addOutput("outValue", "string");
    this.addOutput("data", "string");
    this.addOutput("error", "string");
    this.addOutput("isLoading", "string");
    this.addOutput("isFetching", "string");
    this.addOutput("isError", "string");
    this.addOutput("isSuccess", "string");
    this.addOutput("refetch", "string");
    this.uiPanel = defineAsyncComponent(() => import("./useQueryPanel.vue"));
  }

  onExecute() {
    const props = this.properties;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 处理变量名三元组
    let declVar, declPrefix = "";
    if (props.outputVar?.isSlot) {
      declVar = getParamValue(props.outputVar) || `query_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `query_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 queryKey
    const queryKey = getParamValue(props.queryKey);

    // 获取 queryFn
    let queryFnCode = "() => Promise.resolve(null)";
    const queryFnSlot = this.inputs.find((s) => s.id === props.queryFn.id);
    if (queryFnSlot) {
      const queryFnSlotIndex = this.inputs.indexOf(queryFnSlot);
      if (this.isInputConnected(queryFnSlotIndex) && this.inputs[queryFnSlotIndex].link && this.graph) {
        const linkInfo = this.graph.links[this.inputs[queryFnSlotIndex].link];
        if (linkInfo) {
          const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
          if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
            queryFnCode = `__FUNC_${sourceNode.id}__`;
          }
        }
      }
    }

    if (!queryKey) {
      this.jsCode = `// useQuery: queryKey is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      return;
    }

    // 构建选项
    const options = [`queryKey: ${queryKey}`, `queryFn: ${queryFnCode}`];

    const enabled = getParamValue(props.enabled);
    const staleTime = getParamValue(props.staleTime);
    const gcTime = getParamValue(props.gcTime);
    const retry = getParamValue(props.retry);
    const retryDelay = getParamValue(props.retryDelay);
    const placeholderData = getParamValue(props.placeholderData);
    const initialData = getParamValue(props.initialData);

    if (enabled) options.push(`enabled: ${enabled}`);
    if (staleTime) options.push(`staleTime: ${staleTime}`);
    if (gcTime) options.push(`gcTime: ${gcTime}`);
    if (!props.refetchOnWindowFocus) options.push("refetchOnWindowFocus: false");
    if (!props.refetchOnMount) options.push("refetchOnMount: false");
    if (!props.refetchOnReconnect) options.push("refetchOnReconnect: false");
    if (retry) options.push(`retry: ${retry}`);
    if (retryDelay) options.push(`retryDelay: ${retryDelay}`);
    if (placeholderData) options.push(`placeholderData: ${placeholderData}`);
    if (initialData) options.push(`initialData: ${initialData}`);

    // 生成代码
    this.importStr = `import { useQuery } from '@tanstack/vue-query';`;
    this.jsCode = `${declPrefix}${declVar} = useQuery({ ${options.join(", ")} });`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("data"), `${declVar}.data`);
    this.setOutputData(this.findOutputSlot("error"), `${declVar}.error`);
    this.setOutputData(this.findOutputSlot("isLoading"), `${declVar}.isLoading`);
    this.setOutputData(this.findOutputSlot("isFetching"), `${declVar}.isFetching`);
    this.setOutputData(this.findOutputSlot("isError"), `${declVar}.isError`);
    this.setOutputData(this.findOutputSlot("isSuccess"), `${declVar}.isSuccess`);
    this.setOutputData(this.findOutputSlot("refetch"), `${declVar}.refetch`);
  }

  static get id() { return "tanstack-usequery-b4c5d6e7-f8a9-0123-4567-890abcdef012"; }
  static get title() { return "useQuery"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/TanStackQuery"; }
}

export class defineUseMutation extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `mutation_${uid().slice(0, 8)}` },

      // Hook 参数
      mutationKey: { id: uid(), isSlot: false, value: "" },
      mutationFn: { id: uid(), isSlot: true, value: "" },

      // 回调
      onSuccess: { id: uid(), isSlot: true, value: "" },
      onError: { id: uid(), isSlot: true, value: "" },
      onSettled: { id: uid(), isSlot: true, value: "" },
      onMutate: { id: uid(), isSlot: true, value: "" },

      // 选项
      retry: { id: uid(), isSlot: false, value: "" },
      retryDelay: { id: uid(), isSlot: false, value: "" },
    };

    // mutationFn 函数 slot
    this.addInput("mutationFn", "function", {
      id: this.properties.mutationFn.id,
      shape: 5,
      meta: { args: ["variables"] },
    });

    this.addOutput("outValue", "string");
    this.addOutput("mutate", "string");
    this.addOutput("mutateAsync", "string");
    this.addOutput("data", "string");
    this.addOutput("error", "string");
    this.addOutput("isLoading", "string");
    this.addOutput("isError", "string");
    this.addOutput("isSuccess", "string");
    this.addOutput("reset", "string");
    this.uiPanel = defineAsyncComponent(() => import("./useMutationPanel.vue"));
  }

  onExecute() {
    const props = this.properties;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 获取函数连接
    const getFunctionCode = (param, defaultCode = "() => {}") => {
      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex) || !this.inputs[slotIndex].link || !this.graph) return null;

      const linkInfo = this.graph.links[this.inputs[slotIndex].link];
      if (!linkInfo) return null;

      const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
      if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
        return `__FUNC_${sourceNode.id}__`;
      }
      return null;
    };

    // 处理变量名三元组
    let declVar, declPrefix = "";
    if (props.outputVar?.isSlot) {
      declVar = getParamValue(props.outputVar) || `mutation_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `mutation_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 mutationFn
    const mutationFnCode = getFunctionCode(props.mutationFn) || "() => Promise.resolve(null)";

    // 构建选项
    const options = [`mutationFn: ${mutationFnCode}`];

    const mutationKey = getParamValue(props.mutationKey);
    if (mutationKey) options.push(`mutationKey: ${mutationKey}`);

    // 回调函数
    const onSuccess = getFunctionCode(props.onSuccess);
    const onError = getFunctionCode(props.onError);
    const onSettled = getFunctionCode(props.onSettled);
    const onMutate = getFunctionCode(props.onMutate);

    if (onSuccess) options.push(`onSuccess: ${onSuccess}`);
    if (onError) options.push(`onError: ${onError}`);
    if (onSettled) options.push(`onSettled: ${onSettled}`);
    if (onMutate) options.push(`onMutate: ${onMutate}`);

    const retry = getParamValue(props.retry);
    const retryDelay = getParamValue(props.retryDelay);
    if (retry) options.push(`retry: ${retry}`);
    if (retryDelay) options.push(`retryDelay: ${retryDelay}`);

    // 生成代码
    this.importStr = `import { useMutation } from '@tanstack/vue-query';`;
    this.jsCode = `${declPrefix}${declVar} = useMutation({ ${options.join(", ")} });`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("mutate"), `${declVar}.mutate`);
    this.setOutputData(this.findOutputSlot("mutateAsync"), `${declVar}.mutateAsync`);
    this.setOutputData(this.findOutputSlot("data"), `${declVar}.data`);
    this.setOutputData(this.findOutputSlot("error"), `${declVar}.error`);
    this.setOutputData(this.findOutputSlot("isLoading"), `${declVar}.isPending`);
    this.setOutputData(this.findOutputSlot("isError"), `${declVar}.isError`);
    this.setOutputData(this.findOutputSlot("isSuccess"), `${declVar}.isSuccess`);
    this.setOutputData(this.findOutputSlot("reset"), `${declVar}.reset`);
  }

  static get id() { return "tanstack-usemutation-c5d6e7f8-a9b0-1234-5678-901bcdef0123"; }
  static get title() { return "useMutation"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/TanStackQuery"; }
}

export class defineUseInfiniteQuery extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `infiniteQuery_${uid().slice(0, 8)}` },

      // Hook 参数
      queryKey: { id: uid(), isSlot: false, value: "" },
      queryFn: { id: uid(), isSlot: true, value: "" },
      getNextPageParam: { id: uid(), isSlot: true, value: "" },
      getPreviousPageParam: { id: uid(), isSlot: true, value: "" },
      initialPageParam: { id: uid(), isSlot: false, value: "" },

      // 选项
      enabled: { id: uid(), isSlot: false, value: "" },
      staleTime: { id: uid(), isSlot: false, value: "" },
      gcTime: { id: uid(), isSlot: false, value: "" },
      maxPages: { id: uid(), isSlot: false, value: "" },
    };

    // queryFn 函数 slot
    this.addInput("queryFn", "function", {
      id: this.properties.queryFn.id,
      shape: 5,
      meta: { args: ["context"] },
    });

    // getNextPageParam 函数 slot
    this.addInput("getNextPageParam", "function", {
      id: this.properties.getNextPageParam.id,
      shape: 5,
      meta: { args: ["lastPage", "allPages", "lastPageParam", "allPageParams"] },
    });

    this.addOutput("outValue", "string");
    this.addOutput("data", "string");
    this.addOutput("error", "string");
    this.addOutput("isLoading", "string");
    this.addOutput("isFetchingNextPage", "string");
    this.addOutput("hasNextPage", "string");
    this.addOutput("fetchNextPage", "string");
    this.uiPanel = defineAsyncComponent(() => import("./useInfiniteQueryPanel.vue"));
  }

  onExecute() {
    const props = this.properties;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 获取函数连接
    const getFunctionCode = (param) => {
      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex) || !this.inputs[slotIndex].link || !this.graph) return null;

      const linkInfo = this.graph.links[this.inputs[slotIndex].link];
      if (!linkInfo) return null;

      const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
      if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
        return `__FUNC_${sourceNode.id}__`;
      }
      return null;
    };

    // 处理变量名三元组
    let declVar, declPrefix = "";
    if (props.outputVar?.isSlot) {
      declVar = getParamValue(props.outputVar) || `infiniteQuery_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `infiniteQuery_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 queryKey
    const queryKey = getParamValue(props.queryKey);

    // 获取函数
    const queryFnCode = getFunctionCode(props.queryFn) || "() => Promise.resolve({ data: [], nextCursor: null })";
    const getNextPageParamCode = getFunctionCode(props.getNextPageParam) || "(lastPage) => lastPage.nextCursor";

    if (!queryKey) {
      this.jsCode = `// useInfiniteQuery: queryKey is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      return;
    }

    // 构建选项
    const options = [
      `queryKey: ${queryKey}`,
      `queryFn: ${queryFnCode}`,
      `getNextPageParam: ${getNextPageParamCode}`,
    ];

    const initialPageParam = getParamValue(props.initialPageParam);
    if (initialPageParam) {
      options.push(`initialPageParam: ${initialPageParam}`);
    } else {
      options.push(`initialPageParam: 0`);
    }

    const getPreviousPageParamCode = getFunctionCode(props.getPreviousPageParam);
    if (getPreviousPageParamCode) options.push(`getPreviousPageParam: ${getPreviousPageParamCode}`);

    const enabled = getParamValue(props.enabled);
    const staleTime = getParamValue(props.staleTime);
    const gcTime = getParamValue(props.gcTime);
    const maxPages = getParamValue(props.maxPages);

    if (enabled) options.push(`enabled: ${enabled}`);
    if (staleTime) options.push(`staleTime: ${staleTime}`);
    if (gcTime) options.push(`gcTime: ${gcTime}`);
    if (maxPages) options.push(`maxPages: ${maxPages}`);

    // 生成代码
    this.importStr = `import { useInfiniteQuery } from '@tanstack/vue-query';`;
    this.jsCode = `${declPrefix}${declVar} = useInfiniteQuery({ ${options.join(", ")} });`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("data"), `${declVar}.data`);
    this.setOutputData(this.findOutputSlot("error"), `${declVar}.error`);
    this.setOutputData(this.findOutputSlot("isLoading"), `${declVar}.isLoading`);
    this.setOutputData(this.findOutputSlot("isFetchingNextPage"), `${declVar}.isFetchingNextPage`);
    this.setOutputData(this.findOutputSlot("hasNextPage"), `${declVar}.hasNextPage`);
    this.setOutputData(this.findOutputSlot("fetchNextPage"), `${declVar}.fetchNextPage`);
  }

  static get id() { return "tanstack-useinfinitequery-d6e7f8a9-b0c1-2345-6789-012cdef01234"; }
  static get title() { return "useInfiniteQuery"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/TanStackQuery"; }
}

export class defineUseQueryClient extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `queryClient_${uid().slice(0, 8)}` },
    };

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./queryClientPanel.vue"));
  }

  onExecute() {
    const props = this.properties;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 处理变量名三元组
    let declVar, declPrefix = "";
    if (props.outputVar?.isSlot) {
      declVar = getParamValue(props.outputVar) || `queryClient_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `queryClient_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 生成代码
    this.importStr = `import { useQueryClient } from '@tanstack/vue-query';`;
    this.jsCode = `${declPrefix}${declVar} = useQueryClient();`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get id() { return "tanstack-usequeryclient-e7f8a9b0-c1d2-3456-7890-123def012345"; }
  static get title() { return "useQueryClient"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/TanStackQuery"; }
}

export class defineUseQueries extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `queries_${uid().slice(0, 8)}` },

      // Hook 参数
      queries: { id: uid(), isSlot: true, value: "" },
      combine: { id: uid(), isSlot: true, value: "" },
    };

    // queries slot
    this.addInput("queries", "string", { id: this.properties.queries.id });

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./queryClientPanel.vue"));
  }

  onExecute() {
    const props = this.properties;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 获取函数连接
    const getFunctionCode = (param) => {
      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex) || !this.inputs[slotIndex].link || !this.graph) return null;

      const linkInfo = this.graph.links[this.inputs[slotIndex].link];
      if (!linkInfo) return null;

      const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
      if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
        return `__FUNC_${sourceNode.id}__`;
      }
      return null;
    };

    // 处理变量名三元组
    let declVar, declPrefix = "";
    if (props.outputVar?.isSlot) {
      declVar = getParamValue(props.outputVar) || `queries_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `queries_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 queries 配置
    const queries = getParamValue(props.queries);

    if (!queries) {
      this.jsCode = `// useQueries: queries is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      return;
    }

    // 构建选项
    const options = [`queries: ${queries}`];

    const combineCode = getFunctionCode(props.combine);
    if (combineCode) options.push(`combine: ${combineCode}`);

    // 生成代码
    this.importStr = `import { useQueries } from '@tanstack/vue-query';`;
    this.jsCode = `${declPrefix}${declVar} = useQueries({ ${options.join(", ")} });`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get id() { return "tanstack-usequeries-f8a9b0c1-d2e3-4567-8901-234ef0123456"; }
  static get title() { return "useQueries"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/TanStackQuery"; }
}

export class defineInvalidateQueries extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // Hook 参数
      queryKey: { id: uid(), isSlot: false, value: "" },

      // 选项
      exact: false,
      refetchType: "active",
    };

    this.addOutput("invalidate", "string");
    this.uiPanel = defineAsyncComponent(() => import("./queryClientPanel.vue"));
  }

  onExecute() {
    const props = this.properties;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    const queryKey = getParamValue(props.queryKey);
    const varPrefix = `invalidate_${uid().slice(0, 8)}`;

    // 构建选项
    const filterOptions = [];
    if (queryKey) filterOptions.push(`queryKey: ${queryKey}`);
    if (props.exact) filterOptions.push("exact: true");
    if (props.refetchType !== "active") filterOptions.push(`refetchType: '${props.refetchType}'`);

    const filterStr = filterOptions.length > 0 ? `{ ${filterOptions.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useQueryClient } from '@tanstack/vue-query';`;
    this.jsCode = `const ${varPrefix}Client = useQueryClient();\nconst ${varPrefix}Fn = () => ${varPrefix}Client.invalidateQueries(${filterStr});`;

    this.setOutputData(this.findOutputSlot("invalidate"), `${varPrefix}Fn`);
  }

  static get id() { return "tanstack-invalidatequeries-a9b0c1d2-e3f4-5678-9012-345f01234567"; }
  static get title() { return "invalidateQueries"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/TanStackQuery"; }
}

export class defineSetQueryData extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // Hook 参数
      queryKey: { id: uid(), isSlot: false, value: "" },
      updater: { id: uid(), isSlot: true, value: "" },
    };

    // updater 函数 slot
    this.addInput("updater", "function", {
      id: this.properties.updater.id,
      shape: 5,
      meta: { args: ["oldData"] },
    });

    this.addOutput("setData", "string");
    this.uiPanel = defineAsyncComponent(() => import("./queryClientPanel.vue"));
  }

  onExecute() {
    const props = this.properties;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 获取函数连接
    const getFunctionCode = (param) => {
      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex) || !this.inputs[slotIndex].link || !this.graph) return null;

      const linkInfo = this.graph.links[this.inputs[slotIndex].link];
      if (!linkInfo) return null;

      const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
      if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
        return `__FUNC_${sourceNode.id}__`;
      }
      return null;
    };

    const queryKey = getParamValue(props.queryKey);
    const updaterCode = getFunctionCode(props.updater) || "(oldData) => oldData";
    const varPrefix = `setData_${uid().slice(0, 8)}`;

    if (!queryKey) {
      this.jsCode = `// setQueryData: queryKey is required`;
      this.setOutputData(this.findOutputSlot("setData"), "undefined");
      return;
    }

    // 生成代码
    this.importStr = `import { useQueryClient } from '@tanstack/vue-query';`;
    this.jsCode = `const ${varPrefix}Client = useQueryClient();\nconst ${varPrefix}Fn = () => ${varPrefix}Client.setQueryData(${queryKey}, ${updaterCode});`;

    this.setOutputData(this.findOutputSlot("setData"), `${varPrefix}Fn`);
  }

  static get id() { return "tanstack-setquerydata-b0c1d2e3-f4a5-6789-0123-456012345678"; }
  static get title() { return "setQueryData"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/TanStackQuery"; }
}
