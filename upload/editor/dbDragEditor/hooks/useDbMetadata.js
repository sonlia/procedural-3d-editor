import { ref, computed, watchEffect } from "vue";

/**
 * 数据库元数据定义模块
 *
 * 本模块定义了与数据库相关的各种元数据结构，用于后续生成Knex查询代码。
 *
 * 注意：本模块只包含元数据定义，不包含实际的代码实现逻辑。
 * 实际的SQL代码生成和执行应在其他模块中基于此元数据进行实现。
 */
export function useDbMetadata() {
  // 元数据管理系统
  const metadataRegistry = {
    // 每种元数据类型的注册表
    dbProviders: {},
    fieldTypes: {},
    defaultValueTypes: {},
    indexTypes: {},
    constraintTypes: {},
    viewTypes: {},
    triggerTypes: {},
    sequenceOptions: {},
    procedureLanguages: {},
    charsetCollations: {},

    // 注册元数据项
    register(category, id, metadata) {
      if (!this[category]) {
        this[category] = {};
      }
      this[category][id] = metadata;
    },

    // 获取元数据项
    get(category, id) {
      return this[category]?.[id];
    },

    // 获取所有元数据
    getAll(category) {
      return this[category] || {};
    },

    // 获取按条件筛选的元数据项
    filter(category, filterFn) {
      const items = this[category] || {};
      return Object.entries(items)
        .filter(([id, item]) => filterFn(id, item))
        .reduce((acc, [id, item]) => {
          acc[id] = item;
          return acc;
        }, {});
    },

    // 获取特定供应商支持的元数据项
    getCompatible(category, provider) {
      return this.filter(
        category,
        (id, item) =>
          item.compatibleProviders?.includes("all") ||
          item.compatibleProviders?.includes(provider),
      );
    },

    // 格式化元数据为选项列表
    formatOptions(category, items) {
      return Object.entries(items).map(([id, item]) => ({
        label: item.label || id,
        value: item.value || id,
        description: item.description || "",
        ...item.formatOptions,
      }));
    },
  };

  // 数据库提供商映射配置 - 只支持 PostgreSQL
  const dbProviderMap = {
    // PostgreSQL - 使用Knex.js中的client名称"pg"
    pg: { client: "pg", label: "PostgreSQL", key: "pg" },
  };

  // 注册数据库提供商
  Object.entries(dbProviderMap).forEach(([id, { client, label }]) => {
    metadataRegistry.register("dbProviders", id, {
      value: client,
      label,
      description: `${label} 数据库`,
      knexClient: client,
    });
  });

  /**
   * 获取支持的数据库提供商列表（用于UI显示）
   * @returns {Array} 数据库提供商数组
   */
  const getProviders = () => {
    // 获取唯一的客户端标识符
    const uniqueProviders = {};

    Object.entries(dbProviderMap).forEach(([id, { client, label, key }]) => {
      // 使用key作为去重依据，确保每个数据库类型只出现一次
      if (!uniqueProviders[key]) {
        uniqueProviders[key] = { value: client, label };
      }
    });

    return Object.values(uniqueProviders);
  };

  /**
   * 将内部数据库提供商标识符转换为Knex.js的client标识符
   * @param {string} provider 内部数据库提供商标识符
   * @returns {string} Knex.js的client标识符
   */
  const mapProviderToKnexClient = (provider) => {
    return dbProviderMap[provider]?.client || provider;
  };

  // =========== 字段类型 ===========
  // 定义字段类型
  const scalarTypeDefinitions = {
    // ===== 整数类型 =====
    integer: {
      label: "整数 (INTEGER)",
      description: "32位整数",
      compatibleProviders: ["all"],
      category: "整数",
      params: {
        autoIncrement: { type: "boolean", label: "自增", default: false },
      },
      defaultValueOptions: [{ label: "0", value: "0" }],
    },
    bigInteger: {
      label: "大整数 (BIGINT)",
      description: "64位大整数",
      compatibleProviders: ["all"],
      category: "整数",
      params: {
        autoIncrement: { type: "boolean", label: "自增", default: false },
      },
      defaultValueOptions: [{ label: "0", value: "0" }],
    },
    smallint: {
      label: "小整数 (SMALLINT)",
      description: "16位小整数",
      compatibleProviders: ["all"],
      category: "整数",
      params: {},
      defaultValueOptions: [{ label: "0", value: "0" }],
    },
    // ===== 小数类型 =====
    float: {
      label: "浮点数 (REAL)",
      description: "单精度浮点数",
      compatibleProviders: ["all"],
      category: "小数",
      params: {
        precision: { type: "number", label: "精度", default: 8 },
      },
      defaultValueOptions: [{ label: "0", value: "0" }],
    },
    double: {
      label: "双精度 (DOUBLE PRECISION)",
      description: "双精度浮点数",
      compatibleProviders: ["all"],
      category: "小数",
      params: {
        precision: { type: "number", label: "精度", default: 15 },
        scale: { type: "number", label: "标度", default: 2 },
      },
      defaultValueOptions: [{ label: "0", value: "0" }],
    },
    decimal: {
      label: "定点数 (DECIMAL)",
      description: "精确定点数",
      compatibleProviders: ["all"],
      category: "小数",
      params: {
        precision: { type: "number", label: "精度", default: 10 },
        scale: { type: "number", label: "标度", default: 2 },
      },
      defaultValueOptions: [{ label: "0", value: "0" }],
    },
    // ===== 文本类型 =====
    string: {
      label: "字符串 (VARCHAR)",
      description: "变长字符串",
      compatibleProviders: ["all"],
      category: "文本",
      params: {
        length: { type: "number", label: "长度", default: 255 },
      },
      defaultValueOptions: [{ label: "''", value: "''" }],
    },
    text: {
      label: "长文本 (TEXT)",
      description: "无限长文本",
      compatibleProviders: ["all"],
      category: "文本",
      params: {},
      defaultValueOptions: [],
    },
    enum: {
      label: "枚举 (ENUM)",
      description: "枚举类型，限定值列表",
      compatibleProviders: ["all"],
      category: "文本",
      params: {
        values: { type: "text", label: "枚举值 (逗号分隔)", default: "" },
      },
      defaultValueOptions: [],
    },
    // ===== 日期时间类型 =====
    date: {
      label: "日期 (DATE)",
      description: "日期，无时间部分",
      compatibleProviders: ["all"],
      category: "日期时间",
      params: {},
      defaultValueOptions: [{ label: "CURRENT_DATE", value: "knex.fn.now()" }],
    },
    time: {
      label: "时间 (TIME)",
      description: "时间，无日期部分",
      compatibleProviders: ["all"],
      category: "日期时间",
      params: {
        precision: { type: "number", label: "精度", default: null },
      },
      defaultValueOptions: [{ label: "CURRENT_TIME", value: "knex.fn.now()" }],
    },
    timestamp: {
      label: "时间戳 (TIMESTAMP)",
      description: "日期时间戳",
      compatibleProviders: ["all"],
      category: "日期时间",
      params: {
        useTz: { type: "boolean", label: "带时区", default: true },
        precision: { type: "number", label: "精度", default: null },
      },
      defaultValueOptions: [{ label: "NOW()", value: "knex.fn.now()" }],
    },
    // ===== 布尔类型 =====
    boolean: {
      label: "布尔值 (BOOLEAN)",
      description: "布尔类型",
      compatibleProviders: ["all"],
      category: "布尔",
      params: {},
      defaultValueOptions: [
        { label: "true", value: "true" },
        { label: "false", value: "false" },
      ],
    },
    // ===== 二进制类型 =====
    binary: {
      label: "二进制 (BYTEA)",
      description: "二进制数据",
      compatibleProviders: ["all"],
      category: "二进制",
      params: {},
      defaultValueOptions: [],
    },
    // ===== JSON类型 =====
    json: {
      label: "JSON",
      description: "JSON 数据",
      compatibleProviders: ["all"],
      category: "JSON",
      params: {},
      defaultValueOptions: [
        { label: "{}", value: "{}" },
        { label: "[]", value: "[]" },
      ],
    },
    jsonb: {
      label: "JSONB",
      description: "二进制JSON (PostgreSQL)",
      compatibleProviders: ["pg"],
      category: "JSON",
      params: {},
      defaultValueOptions: [
        { label: "{}", value: "{}" },
        { label: "[]", value: "[]" },
      ],
    },
    // ===== 标识类型 =====
    uuid: {
      label: "UUID",
      description: "UUID 标识符",
      compatibleProviders: ["pg", "mssql"],
      category: "标识",
      params: {},
      defaultValueOptions: [
        { label: "gen_random_uuid()", value: "knex.fn.uuid()" },
      ],
    },
    // ===== 原始类型 =====
    specificType: {
      label: "原始数据库类型",
      description: "手动输入数据库原生类型",
      compatibleProviders: ["all"],
      category: "原始",
      params: {
        rawType: { type: "text", label: "原始类型", default: "" },
      },
      defaultValueOptions: [],
    },
  };

  // 注册字段类型
  Object.entries(scalarTypeDefinitions).forEach(([id, definition]) => {
    metadataRegistry.register("fieldTypes", id, {
      value: id,
      ...definition,
    });
  });

  // =========== 默认值类型 ===========
  // 定义默认值类型
  const defaultValueTypeDefinitions = {
    // 基础默认值类型
    none: {
      label: "无默认值",
      description: "不设置默认值",
      compatibleTypes: ["all"],
      isForId: false,
    },
    value: {
      label: "自定义值",
      description: "使用自定义值作为默认值",
      compatibleTypes: ["all"],
      isForId: true,
    },
    // Knex 标准自增处理
    increments: {
      label: "自增",
      description: "使用数据库自增作为主键 (Knex.increments())",
      compatibleTypes: ["integer", "bigInteger"],
      isForId: true,
    },

    // Knex 时间函数
    currentTime: {
      label: "当前时间",
      description: "当前时间 (Knex.fn.now())",
      compatibleTypes: ["datetime", "timestamp", "date", "time"],
      isForId: false,
    },
    // Knex UUID 函数
    uuid: {
      label: "UUID",
      description: "生成UUID (Knex.fn.uuid())",
      compatibleTypes: ["string", "uuid"],
      isForId: true,
      compatibleProviders: ["pg"],
    },

    // Boolean默认值
    true: {
      label: "True",
      description: "布尔值 True",
      compatibleTypes: ["boolean"],
      isForId: false,
    },
    false: {
      label: "False",
      description: "布尔值 False",
      compatibleTypes: ["boolean"],
      isForId: false,
    },
  };

  // 注册默认值类型
  Object.entries(defaultValueTypeDefinitions).forEach(([id, definition]) => {
    metadataRegistry.register("defaultValueTypes", id, {
      value: id,
      ...definition,
    });
  });

  // =========== 索引类型 ===========
  // 定义索引类型
  const indexTypeDefinitions = {
    // 通用索引类型
    index: {
      label: "标准索引",
      description: "标准索引，适用于所有数据库",
      compatibleProviders: ["all"],
    },
    btree: {
      label: "BTree索引",
      description: "B树索引，适用于大多数数据库",
      compatibleProviders: ["all"],
    },
    hash: {
      label: "Hash索引",
      description: "哈希索引，适用于等值查询",
      compatibleProviders: ["pg", "postgresql", "mysql"],
    },
    // PostgreSQL特有索引类型
    gin: {
      label: "GIN索引",
      description: "通用倒排索引，适用于包含多个值的数据类型(如数组、JSON)",
      compatibleProviders: ["pg"],
    },
    gist: {
      label: "GIST索引",
      description: "通用搜索树索引，适用于几何和全文搜索",
      compatibleProviders: ["pg"],
    },
    // MySQL特有索引类型
    fulltext: {
      label: "全文搜索索引",
      description: "全文搜索索引，适用于文本搜索",
      compatibleProviders: ["mysql"],
    },
  };

  // 注册索引类型
  Object.entries(indexTypeDefinitions).forEach(([id, definition]) => {
    metadataRegistry.register("indexTypes", id, {
      value: id,
      ...definition,
    });
  });

  // =========== 约束类型 ===========
  // 定义约束类型
  const constraintTypeDefinitions = {
    // 通用约束类型
    primaryKey: {
      label: "主键",
      description: "主键约束，确保列值唯一且非空",
      compatibleProviders: ["all"],
    },
    unique: {
      label: "唯一约束",
      description: "唯一约束，确保列值唯一",
      compatibleProviders: ["all"],
    },
    foreignKey: {
      label: "外键约束",
      description: "外键约束，确保列值引用另一表的列值",
      compatibleProviders: ["all"],
    },
    check: {
      label: "检查约束",
      description: "检查约束，确保列值满足特定条件",
      compatibleProviders: ["pg", "mssql"],
    },
    exclusion: {
      label: "排除约束",
      description: "排除约束，确保特定条件下不存在匹配的记录",
      compatibleProviders: ["pg"],
    },
  };

  // 注册约束类型
  Object.entries(constraintTypeDefinitions).forEach(([id, definition]) => {
    metadataRegistry.register("constraintTypes", id, {
      value: id,
      ...definition,
    });
  });

  // =========== 视图类型 ===========
  // 定义视图类型
  const viewTypeDefinitions = {
    // 基本视图类型
    simple: {
      label: "简单视图",
      description: "基本的SQL查询视图",
      compatibleProviders: ["all"],
    },
    materialized: {
      label: "物化视图",
      description: "缓存查询结果的视图",
      compatibleProviders: ["pg"],
    },
    recursive: {
      label: "递归视图",
      description: "使用WITH RECURSIVE的视图",
      compatibleProviders: ["pg", "sqlite3", "mysql"],
    },
  };

  // 注册视图类型
  Object.entries(viewTypeDefinitions).forEach(([id, definition]) => {
    metadataRegistry.register("viewTypes", id, {
      value: id,
      ...definition,
    });
  });

  // =========== 触发器类型 ===========
  // 定义触发器类型
  const triggerTypeDefinitions = {
    // 触发时机
    before: {
      category: "timing",
      label: "之前",
      description: "在操作之前触发",
      compatibleProviders: ["pg", "mysql", "sqlite3"],
    },
    after: {
      category: "timing",
      label: "之后",
      description: "在操作之后触发",
      compatibleProviders: ["all"],
    },
    instead_of: {
      category: "timing",
      label: "替代",
      description: "替代操作执行",
      compatibleProviders: ["pg", "mssql"],
    },
    // 触发事件
    insert: {
      category: "event",
      label: "插入",
      description: "插入操作时触发",
      compatibleProviders: ["all"],
    },
    update: {
      category: "event",
      label: "更新",
      description: "更新操作时触发",
      compatibleProviders: ["all"],
    },
    delete: {
      category: "event",
      label: "删除",
      description: "删除操作时触发",
      compatibleProviders: ["all"],
    },
    truncate: {
      category: "event",
      label: "截断",
      description: "表截断操作时触发",
      compatibleProviders: ["pg"],
    },
    // 触发范围
    row: {
      category: "level",
      label: "行级",
      description: "对每行操作触发",
      compatibleProviders: ["pg", "mysql"],
    },
    statement: {
      category: "level",
      label: "语句级",
      description: "对整个语句触发一次",
      compatibleProviders: ["all"],
    },
  };

  // 注册触发器类型
  Object.entries(triggerTypeDefinitions).forEach(([id, definition]) => {
    metadataRegistry.register("triggerTypes", id, {
      value: id,
      ...definition,
    });
  });

  // =========== 序列选项 ===========
  // 定义序列选项
  const sequenceOptionDefinitions = {
    increment: {
      label: "增量值",
      description: "序列的增量",
      default: 1,
      type: "number",
    },
    minvalue: {
      label: "最小值",
      description: "序列的最小值",
      default: 1,
      type: "number",
    },
    maxvalue: {
      label: "最大值",
      description: "序列的最大值",
      default: 9223372036854775807,
      type: "number",
    },
    start: {
      label: "起始值",
      description: "序列的起始值",
      default: 1,
      type: "number",
    },
    cache: {
      label: "缓存大小",
      description: "序列的缓存大小",
      default: 1,
      type: "number",
    },
    cycle: {
      label: "循环",
      description: "是否循环",
      default: false,
      type: "boolean",
    },
  };

  // 注册序列选项
  Object.entries(sequenceOptionDefinitions).forEach(([id, definition]) => {
    metadataRegistry.register("sequenceOptions", id, {
      value: id,
      ...definition,
    });
  });

  // =========== 序列选项 ===========
  // 序列兼容性
  metadataRegistry.register("sequenceOptions", "compatibility", {
    compatibleProviders: ["pg", "mssql"],
  });

  // =========== 存储过程语言 ===========
  // 定义存储过程语言
  const procedureLanguageDefinitions = {
    sql: {
      label: "SQL",
      description: "使用SQL语句",
      compatibleProviders: ["all"],
    },
    plpgsql: {
      label: "PL/pgSQL",
      description: "PostgreSQL过程语言",
      compatibleProviders: ["pg"],
    },
    tsql: {
      label: "T-SQL",
      description: "Microsoft SQL Server的过程语言",
      compatibleProviders: ["mssql"],
    },
  };

  // 注册存储过程语言
  Object.entries(procedureLanguageDefinitions).forEach(([id, definition]) => {
    metadataRegistry.register("procedureLanguages", id, {
      value: id,
      ...definition,
    });
  });

  // =========== 字符集和排序规则 ===========
  // 定义字符集和排序规则
  const charsetCollationDefinitions = {
    mysql: {
      charsets: [
        { value: "utf8mb4", label: "UTF-8 Unicode (utf8mb4)" },
        { value: "utf8", label: "UTF-8 Unicode (utf8)" },
        { value: "latin1", label: "Latin1 (ISO 8859-1)" },
        { value: "ascii", label: "US ASCII" },
        { value: "binary", label: "Binary" },
      ],
      collations: {
        utf8mb4: [
          { value: "utf8mb4_unicode_ci", label: "Unicode (CI)" },
          { value: "utf8mb4_general_ci", label: "General (CI)" },
          { value: "utf8mb4_bin", label: "Binary" },
        ],
        utf8: [
          { value: "utf8_unicode_ci", label: "Unicode (CI)" },
          { value: "utf8_general_ci", label: "General (CI)" },
          { value: "utf8_bin", label: "Binary" },
        ],
        latin1: [
          { value: "latin1_swedish_ci", label: "Swedish (CI)" },
          { value: "latin1_general_ci", label: "General (CI)" },
          { value: "latin1_bin", label: "Binary" },
        ],
        ascii: [
          { value: "ascii_general_ci", label: "General (CI)" },
          { value: "ascii_bin", label: "Binary" },
        ],
        binary: [{ value: "binary", label: "Binary" }],
      },
    },
    pg: {
      encodings: [
        { value: "UTF8", label: "UTF-8" },
        { value: "LATIN1", label: "ISO 8859-1" },
        { value: "LATIN2", label: "ISO 8859-2" },
        { value: "LATIN9", label: "ISO 8859-15" },
        { value: "WIN1250", label: "Windows-1250" },
        { value: "WIN1251", label: "Windows-1251" },
      ],
      collations: [
        { value: "default", label: "默认" },
        { value: "C", label: "C" },
        { value: "POSIX", label: "POSIX" },
        { value: "und-x-icu", label: "ICU" },
      ],
    },
    mssql: {
      collations: [
        { value: "Latin1_General_CI_AI", label: "Latin1 General, CI, AI" },
        { value: "Latin1_General_CI_AS", label: "Latin1 General, CI, AS" },
        { value: "Latin1_General_CS_AS", label: "Latin1 General, CS, AS" },
        {
          value: "SQL_Latin1_General_CP1_CI_AS",
          label: "SQL Latin1 General CP1, CI, AS",
        },
      ],
    },
  };

  // 注册字符集和排序规则
  Object.entries(charsetCollationDefinitions).forEach(
    ([provider, definition]) => {
      metadataRegistry.register("charsetCollations", provider, definition);
    },
  );

  // =========== 外键操作选项 ===========
  // 外键操作选项 - 适配Knex.js
  const foreignKeyActions = [
    "CASCADE",
    "RESTRICT",
    "SET NULL",
    "SET DEFAULT",
    "NO ACTION",
  ];

  // 注册外键操作选项
  foreignKeyActions.forEach((action) => {
    metadataRegistry.register("foreignKeyActions", action, {
      value: action,
      label: action,
      description: `外键${action}操作`,
    });
  });

  // =========== 统一的数据库配置定义 ===========
  // 统一的数据库配置定义
  const dbConfig = {
    // 通用配置
    pool: {
      min: {
        default: 0,
        description: "连接池最小连接数",
        type: "number",
        min: 0,
      },
      max: {
        default: 10,
        description: "连接池最大连接数",
        type: "number",
        min: 1,
      },
      idleTimeoutMillis: {
        default: 30000,
        description: "空闲连接超时时间(毫秒)",
        type: "number",
        min: 1000,
      },
      acquireTimeoutMillis: {
        default: 60000,
        description: "获取连接超时时间(毫秒)",
        type: "number",
        min: 1000,
      },
    },
    // 添加连接基本配置
    connection: {
      host: {
        default: "localhost",
        description: "数据库服务器主机地址",
        type: "string",
      },
      port: {
        default: "",
        description: "数据库服务器端口",
        type: "number",
      },
      user: {
        default: "",
        description: "数据库用户名",
        type: "string",
      },
      password: {
        default: "",
        description: "数据库密码",
        type: "string",
      },
      database: {
        default: "",
        description: "数据库名称",
        type: "string",
      },
    },
    acquireConnectionTimeout: {
      default: 60000,
      description: "获取连接超时时间(毫秒)",
      type: "number",
      min: 1000,
    },
    migrations: {
      tableName: {
        default: "migrations",
        description: "迁移表名",
        type: "string",
      },
      directory: {
        default: "./migrations",
        description: "迁移文件目录",
        type: "string",
      },
      extension: {
        default: "js",
        description: "迁移文件扩展名",
        type: "string",
      },
      transactionStrategy: {
        default: "knex",
        description: "事务策略",
        type: "select",
        options: ["knex", "prisma"],
      },
    },
    seeds: {
      directory: {
        default: "./seeds",
        description: "种子文件目录",
        type: "string",
      },
      extension: {
        default: "js",
        description: "种子文件扩展名",
        type: "string",
      },
    },
    ignoreRawBlocks: {
      default: false,
      description: "忽略模型中的@@raw块",
      type: "boolean",
    },
    engineType: {
      default: "library",
      description: "使用的Knex引擎类型 (library 或 binary)",
      type: "select",
      options: ["library", "binary"],
    },
    clientPreviewFeatures: {
      default: [],
      description: "客户端预览功能列表",
      type: "array",
    },

    // 数据库特定配置 - 键名与knexDbProviders保持一致
    pg: {
      // 由 postgresql 改为 pg
      schemas: {
        default: ["public"],
        description: "要使用的PostgreSQL schemas",
        type: "array",
        itemType: "string",
      },
      extensions: {
        default: [],
        description: "启用的PostgreSQL扩展",
        type: "array",
        itemType: "string",
      },
      pgBouncer: {
        default: false,
        description: "启用PgBouncer支持",
        type: "boolean",
      },
      useJsonB: {
        default: true,
        description: "使用JSONB类型",
        type: "boolean",
      },
      useArray: {
        default: false,
        description: "使用数组类型",
        type: "boolean",
      },
      schema: {
        default: "public",
        description: "默认Schema",
        type: "string",
      },
      searchPath: {
        default: ["public"],
        description: "PostgreSQL搜索路径",
        type: "array",
        itemType: "string",
      },
      // 添加SSL配置选项
      ssl: {
        enabled: {
          default: false,
          description: "启用SSL连接",
          type: "boolean",
        },
        rejectUnauthorized: {
          default: true,
          description: "拒绝未授权的证书连接",
          type: "boolean",
        },
        ca: {
          default: "",
          description: "CA证书路径",
          type: "string",
        },
        key: {
          default: "",
          description: "客户端私钥路径",
          type: "string",
        },
        cert: {
          default: "",
          description: "客户端证书路径",
          type: "string",
        },
      },
    },
    mysql: {
      // 数据库特有配置
      referentialIntegrity: {
        default: "knex",
        description: "引用完整性模式 (knex 或 foreignKeys)",
        type: "select",
        options: ["knex", "foreignKeys"],
      },
      charset: {
        default: "utf8mb4",
        description: "字符集",
        type: "select",
        options: ["utf8mb4", "utf8", "latin1"],
      },
      collation: {
        default: "utf8mb4_unicode_ci",
        description: "排序规则",
        type: "select",
        options: ["utf8mb4_unicode_ci", "utf8_general_ci", "latin1_swedish_ci"],
      },
      engineType: {
        default: "InnoDB",
        description: "存储引擎",
        type: "select",
        options: ["InnoDB", "MyISAM", "MEMORY"],
      },
    },
    sqlite3: {
      // 由 sqlite 改为 sqlite3
      filename: {
        default: "./database.sqlite",
        description: "数据库文件路径",
        type: "string",
      },
      useNullAsDefault: {
        default: true,
        description: "NULL值默认处理",
        type: "boolean",
      },
      flags: {
        default: [],
        description: "连接标志",
        type: "array",
        itemType: "string",
      },
    },
    mssql: {
      // 由 sqlserver 改为 mssql
      schema: {
        default: "dbo",
        description: "默认Schema",
        type: "string",
      },
      useMax: {
        default: false,
        description: "使用MAX长度",
        type: "boolean",
      },
    },
  };

  /**
   * 获取原始对象的前向兼容函数
   */
  const scalarTypes = metadataRegistry.getAll("fieldTypes");
  const defaultValueTypes = metadataRegistry.getAll("defaultValueTypes");
  const indexTypesConfig = metadataRegistry.getAll("indexTypes");
  const constraintTypesConfig = metadataRegistry.getAll("constraintTypes");
  const viewTypesConfig = metadataRegistry.getAll("viewTypes");
  const triggerTypesConfig = metadataRegistry.getAll("triggerTypes");
  const sequenceConfig = metadataRegistry.getAll("sequenceOptions");
  const procedureLanguagesConfig =
    metadataRegistry.getAll("procedureLanguages");
  const charsetCollationConfig = metadataRegistry.getAll("charsetCollations");

  /**
   * 获取支持的字段类型列表
   * @param {String} provider 可选，数据库提供商
   * @param {Boolean} formatted 是否返回格式化的选项对象
   * @returns {Array} 字段类型数组
   */
  const getFieldTypes = (provider = null, formatted = false) => {
    const types = provider
      ? metadataRegistry.getCompatible("fieldTypes", provider)
      : metadataRegistry.getAll("fieldTypes");

    return formatted
      ? metadataRegistry.formatOptions("fieldTypes", types)
      : Object.keys(types);
  };

  const getFieldTypeDef = (typeId) => {
    return metadataRegistry.get("fieldTypes", typeId);
  };

  /**
   * 获取支持的索引类型列表
   * @param {String} provider 可选，数据库提供商
   * @param {Boolean} formatted 是否返回格式化的选项对象
   * @returns {Array} 索引类型数组
   */
  const getIndexTypes = (provider = null, formatted = false) => {
    const types = provider
      ? metadataRegistry.getCompatible("indexTypes", provider)
      : metadataRegistry.getAll("indexTypes");

    return formatted
      ? metadataRegistry.formatOptions("indexTypes", types)
      : Object.keys(types);
  };

  /**
   * 获取支持的约束类型列表
   * @param {String} provider 可选，数据库提供商
   * @param {Boolean} formatted 是否返回格式化的选项对象
   * @returns {Array} 约束类型数组
   */
  const getConstraintTypes = (provider = null, formatted = false) => {
    const types = provider
      ? metadataRegistry.getCompatible("constraintTypes", provider)
      : metadataRegistry.getAll("constraintTypes");

    return formatted
      ? metadataRegistry.formatOptions("constraintTypes", types)
      : Object.keys(types);
  };

  /**
   * 获取支持的视图类型列表
   * @param {String} provider 可选，数据库提供商
   * @param {Boolean} formatted 是否返回格式化的选项对象
   * @returns {Array} 视图类型数组
   */
  const getViewTypes = (provider = null, formatted = false) => {
    const types = provider
      ? metadataRegistry.getCompatible("viewTypes", provider)
      : metadataRegistry.getAll("viewTypes");

    return formatted
      ? metadataRegistry.formatOptions("viewTypes", types)
      : Object.keys(types);
  };

  /**
   * 获取触发器元数据
   * @param {String} provider 数据库提供商
   * @param {String} category 类别：timing(时机)、event(事件)、level(范围)
   * @param {Boolean} formatted 是否返回格式化的选项对象
   * @returns {Array} 触发器配置数组
   */
  const getTriggerOptions = (provider, category, formatted = false) => {
    const allTriggers = provider
      ? metadataRegistry.getCompatible("triggerTypes", provider)
      : metadataRegistry.getAll("triggerTypes");

    // 按类别过滤
    const filteredTriggers = Object.entries(allTriggers)
      .filter(([_, item]) => item.category === category)
      .reduce((acc, [id, item]) => {
        acc[id] = item;
        return acc;
      }, {});

    return formatted
      ? metadataRegistry.formatOptions("triggerTypes", filteredTriggers)
      : Object.keys(filteredTriggers);
  };

  /**
   * 获取序列配置项
   * @param {String} provider 数据库提供商
   * @param {Boolean} formatted 是否返回格式化的选项对象
   * @returns {Object|null} 序列配置或null(如果不支持)
   */
  const getSequenceOptions = (provider, formatted = false) => {
    const compatibility = metadataRegistry.get(
      "sequenceOptions",
      "compatibility",
    );
    if (!compatibility.compatibleProviders.includes(provider)) {
      return null; // 不支持的数据库类型
    }

    const options = { ...metadataRegistry.getAll("sequenceOptions") };
    delete options.compatibility;

    if (formatted) {
      return metadataRegistry.formatOptions("sequenceOptions", options);
    }

    return options;
  };

  /**
   * 获取支持的存储过程语言
   * @param {String} provider 数据库提供商
   * @param {Boolean} formatted 是否返回格式化的选项对象
   * @returns {Array} 语言列表
   */
  const getProcedureLanguages = (provider, formatted = false) => {
    const languages = provider
      ? metadataRegistry.getCompatible("procedureLanguages", provider)
      : metadataRegistry.getAll("procedureLanguages");

    return formatted
      ? metadataRegistry.formatOptions("procedureLanguages", languages)
      : Object.keys(languages);
  };

  /**
   * 获取字符集和排序规则
   * @param {String} provider 数据库提供商
   * @param {String} type 类型：charset(字符集)或collation(排序规则)
   * @param {String} charset 当获取排序规则时的字符集
   * @returns {Array} 选项列表
   */
  const getCharsetCollationOptions = (provider, type, charset = null) => {
    const mapping = {
      pg: "pg",
      mysql: "mysql",
      mssql: "mssql",
    };

    const dbType = mapping[provider];
    if (!dbType || !metadataRegistry.get("charsetCollations", dbType)) {
      return [];
    }

    const options = metadataRegistry.get("charsetCollations", dbType);

    if (type === "charset" || type === "encoding") {
      // PostgreSQL使用encoding，MySQL使用charset
      const field = dbType === "pg" ? "encodings" : "charsets";
      return options[field] || [];
    } else if (type === "collation") {
      if (dbType === "mysql" && charset) {
        return options.collations[charset] || [];
      } else {
        return options.collations || [];
      }
    }

    return [];
  };

  /**
   * 获取默认数据库配置
   * @param {String} provider 数据库提供商（仅支持 pg）
   * @returns {Object} 默认配置对象
   */
  const getDefaultDbConfig = (provider) => {
    // 仅支持 PostgreSQL
    return {
      client: "pg",
      connection: {
        host: "172.25.194.224",
        port: 5432,
        user: "postgres",
        password: "123456",
        database: "",
      },
      pg: {
        schema: "public",
        encoding: "UTF8",
        useJsonB: true,
        useArray: false,
      },
      pool: {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000,
        acquireTimeoutMillis: 30000,
      },
      migrations: {
        tableName: "migrations",
        directory: "./migrations",
      },
      seeds: {
        directory: "./seeds",
      },
      acquireConnectionTimeout: 60000,
      engineType: "library",
    };
  };

  return {
    // 元数据注册表
    metadataRegistry,

    // 数据库提供商相关
    getProviders,
    mapProviderToKnexClient,

    dbConfig,

    // 字段类型相关
    getFieldTypes,
    getFieldTypeDef,
    scalarTypes,

    // 默认值类型相关
    defaultValueTypes,

    // 外键和类型映射
    foreignKeyActions,

    // 索引类型相关
    indexTypesConfig,
    getIndexTypes,

    // 约束类型相关
    constraintTypesConfig,
    getConstraintTypes,

    // 视图相关
    viewTypesConfig,
    getViewTypes,

    // 触发器相关
    triggerTypesConfig,
    getTriggerOptions,

    // 序列相关
    sequenceConfig,
    getSequenceOptions,

    // 存储过程相关
    procedureLanguagesConfig,
    getProcedureLanguages,

    // 字符集和排序规则
    charsetCollationConfig,
    getCharsetCollationOptions,

    // 配置相关
    getDefaultDbConfig,
  };
}
