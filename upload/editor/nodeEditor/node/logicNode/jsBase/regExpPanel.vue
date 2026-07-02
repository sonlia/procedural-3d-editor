<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { uid } from 'quasar';
import { cloneDeep, isEqual, set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();

// --- 数据模型 & 同步 ---
const defaultProperties = () => ({
  exported: false,
  declareType: 'const',
  outputVar: { id: uid(), isSlot: false, value: `regex_${uid().slice(0, 8)}` },
  pattern: { id: uid(), isSlot: false, value: '' },
  flags: {
    g: false,
    i: false,
    m: false,
    s: false,
    u: false,
    y: false,
  },
  methods: [],
  remark: ''
});

const localProperties = ref(defaultProperties());

// 方法参数映射
const methodParamMap = {
  test: { params: ['str'], hasReturnValue: true, description: '测试是否匹配，返回 boolean' },
  exec: { params: ['str'], hasReturnValue: true, description: '执行匹配，返回数组或 null' },
};

const methodOptions = Object.keys(methodParamMap).map(m => ({
  label: m,
  value: m,
  description: methodParamMap[m].description
}));

// flags 选项配置
const flagOptions = [
  { value: 'g', label: 'g', description: 'global - 全局匹配' },
  { value: 'i', label: 'i', description: 'ignoreCase - 忽略大小写' },
  { value: 'm', label: 'm', description: 'multiline - 多行模式' },
  { value: 's', label: 's', description: 'dotAll - 点号匹配换行' },
  { value: 'u', label: 'u', description: 'unicode - Unicode 模式' },
  { value: 'y', label: 'y', description: 'sticky - 粘性匹配' },
];

onMounted(() => {
  const initialProps = { ...defaultProperties(), ...cloneDeep(props.value?.properties ?? {}) };

  // 确保结构存在
  if (!initialProps.outputVar?.id) {
    initialProps.outputVar = { id: uid(), isSlot: false, value: initialProps.outputVar || 'myRegExp' };
  }
  if (!initialProps.pattern?.id) {
    initialProps.pattern = { id: uid(), isSlot: false, value: initialProps.pattern || '' };
  }
  if (!initialProps.flags) {
    initialProps.flags = defaultProperties().flags;
  }
  if (!Array.isArray(initialProps.methods)) {
    initialProps.methods = [];
  }

  // 恢复 slot
  if (initialProps.outputVar.isSlot) {
    const existing = props.value.inputs.find(i => i.id === initialProps.outputVar.id);
    if (!existing) {
      props.value.addInput('VarName', 'string', { id: initialProps.outputVar.id });
    }
  }
  if (initialProps.pattern.isSlot) {
    const existing = props.value.inputs.find(i => i.id === initialProps.pattern.id);
    if (!existing) {
      props.value.addInput('pattern', 'string', { id: initialProps.pattern.id });
    }
  }
  // 恢复方法参数 slot
  initialProps.methods.forEach(method => {
    (method.params || []).forEach(p => {
      if (p.isSlot) {
        const existing = props.value.inputs.find(i => i.id === p.id);
        if (!existing) {
          props.value.addInput(p.label, 'string', { id: p.id });
        }
      }
    });
  });

  if (!isEqual(localProperties.value, initialProps)) {
    localProperties.value = initialProps;
  }
  if (!isEqual(props.value.properties, localProperties.value)) {
    props.value.properties = cloneDeep(localProperties.value);
  }
});

// Watchers
watch(localProperties, (newVal) => {
  if (!isEqual(props.value.properties, newVal)) {
    props.value.properties = cloneDeep(newVal);
    props.value.onExecute?.();
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}, { deep: true });

watch(() => props.value?.properties, (newVal) => {
  const newProps = { ...defaultProperties(), ...cloneDeep(newVal ?? {}) };
  if (!isEqual(newProps, localProperties.value)) {
    localProperties.value = newProps;
  }
}, { deep: true });

// --- UI 事件处理 ---
function updateField(key, value) {
  set(localProperties.value, key, value);
}

// VarName slot 管理
function updateVarNameSlot(isSlot) {
  const slotId = localProperties.value.outputVar.id;
  const existingIdx = props.value.inputs.findIndex(i => i.id === slotId);

  localProperties.value.outputVar.isSlot = isSlot;

  if (isSlot && existingIdx === -1) {
    props.value.addInput('VarName', 'string', { id: slotId });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
}

// Pattern slot 管理
function updatePatternSlot(isSlot) {
  const slotId = localProperties.value.pattern.id;
  const existingIdx = props.value.inputs.findIndex(i => i.id === slotId);

  localProperties.value.pattern.isSlot = isSlot;

  if (isSlot && existingIdx === -1) {
    props.value.addInput('pattern', 'string', { id: slotId });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
}

// 方法参数 slot 管理
function updateParamSlot(param, isSlot) {
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex(s => s.id === param.id);

  if (isSlot && existingIdx === -1) {
    props.value.addInput(param.label, 'string', { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
}

// --- 方法链管理 ---
function addMethod() {
  const methodName = 'test';
  const paramDefs = methodParamMap[methodName]?.params || [];
  const params = paramDefs.map(label => ({
    id: uid(),
    label,
    isSlot: false,
    value: ''
  }));

  localProperties.value.methods.push({
    methodName,
    params
  });
}

function removeMethod(index) {
  const method = localProperties.value.methods[index];
  // 清理该方法的所有 slot
  (method.params || []).forEach(p => {
    if (p.isSlot) {
      const slotIdx = props.value.inputs.findIndex(i => i.id === p.id);
      if (slotIdx !== -1) {
        props.value.removeInput(slotIdx);
      }
    }
  });
  localProperties.value.methods.splice(index, 1);
}

function onMethodChange(method, newMethodName) {
  // 清理旧参数的 slot
  (method.params || []).forEach(p => {
    if (p.isSlot) {
      const slotIdx = props.value.inputs.findIndex(i => i.id === p.id);
      if (slotIdx !== -1) {
        props.value.removeInput(slotIdx);
      }
    }
  });

  // 创建新参数
  const paramDefs = methodParamMap[newMethodName]?.params || [];
  method.methodName = newMethodName;
  method.params = paramDefs.map(label => ({
    id: uid(),
    label,
    isSlot: false,
    value: ''
  }));
}

// 生成的正则表达式预览
const regExpPreview = computed(() => {
  const pattern = localProperties.value.pattern?.value || '';
  const flags = localProperties.value.flags || {};
  const flagKeys = ['g', 'i', 'm', 's', 'u', 'y'];
  const flagsStr = flagKeys.filter(k => flags[k]).join('');

  if (localProperties.value.pattern?.isSlot) {
    return flagsStr ? `new RegExp(pattern, '${flagsStr}')` : 'new RegExp(pattern)';
  }
  return `/${pattern}/${flagsStr}`;
});

// --- 正则测试 ---
const testInput = ref('');
const testResult = ref(null);

function runRegExpTest() {
  const pattern = localProperties.value.pattern?.value || '';
  const flags = localProperties.value.flags || {};
  const flagKeys = ['g', 'i', 'm', 's', 'u', 'y'];
  const flagsStr = flagKeys.filter(k => flags[k]).join('');

  // 清空测试结果条件：无 pattern 或 pattern 是 slot 模式或无测试输入
  if (!pattern || localProperties.value.pattern?.isSlot || !testInput.value) {
    testResult.value = null;
    return;
  }

  try {
    const regex = new RegExp(pattern, flagsStr);
    const input = testInput.value;
    const isMatch = regex.test(input);

    // 重置 lastIndex 用于获取所有匹配
    regex.lastIndex = 0;
    const matches = [];
    if (flagsStr.includes('g')) {
      let match;
      while ((match = regex.exec(input)) !== null) {
        matches.push({ value: match[0], index: match.index });
      }
    } else {
      const match = regex.exec(input);
      if (match) {
        matches.push({ value: match[0], index: match.index, groups: match.slice(1) });
      }
    }

    testResult.value = { isMatch, matches };
  } catch (e) {
    testResult.value = { error: e.message };
  }
}

// 监听配置变化和测试输入变化，自动执行测试
watch([
  () => localProperties.value.pattern?.value,
  () => localProperties.value.pattern?.isSlot,
  () => localProperties.value.flags,
  testInput
], () => {
  runRegExpTest();
}, { deep: true });
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 声明区 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-checkbox dense dark :model-value="localProperties.exported" :disable="localProperties.outputVar?.isSlot"
            @update:model-value="val => updateField('exported', val)" label="Export" class="q-mb-xs" />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark :model-value="localProperties.outputVar?.isSlot"
              @update:model-value="updateVarNameSlot" label="VarName" style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined class="col-auto" :options="['const', 'let']"
              :model-value="localProperties.declareType" @update:model-value="val => updateField('declareType', val)"
              :disable="localProperties.outputVar?.isSlot" />
            <q-input dense dark outlined class="col" :model-value="localProperties.outputVar?.value"
              @update:model-value="val => updateField('outputVar.value', val)" placeholder="变量名"
              :disable="localProperties.outputVar?.isSlot" />
          </div>
        </q-card-section>
      </q-card>

      <!-- 正则定义区 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">正则表达式</div>

          <!-- Pattern -->
          <div class="row items-center q-gutter-x-sm no-wrap q-mb-xs">
            <q-toggle dense dark :model-value="localProperties.pattern?.isSlot" @update:model-value="updatePatternSlot"
              label="Pattern" style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :model-value="localProperties.pattern?.value"
              @update:model-value="val => updateField('pattern.value', val)" placeholder="正则模式，如 \d+"
              :disable="localProperties.pattern?.isSlot" />
          </div>

          <!-- Flags -->
          <div class="row items-center q-gutter-x-xs no-wrap">
            <span class="text-caption text-grey-4" style="min-width: 90px; flex-shrink: 0;">Flags</span>
            <q-checkbox v-for="flag in flagOptions" :key="flag.value" dense dark size="sm"
              :model-value="localProperties.flags?.[flag.value]"
              @update:model-value="val => updateField(`flags.${flag.value}`, val)" :label="flag.label">
              <q-tooltip>{{ flag.description }}</q-tooltip>
            </q-checkbox>
          </div>

          <!-- 预览 -->
          <div class="text-caption text-grey-6 q-mt-xs">
            预览: <code class="text-light-blue-4">{{ regExpPreview }}</code>
          </div>
        </q-card-section>
      </q-card>

      <!-- 方法链区 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between q-mb-xs">
            <span class="text-caption text-grey-5">方法链</span>
          </div>

          <template v-for="(method, idx) in localProperties.methods" :key="idx">
            <div class="q-pa-xs q-mb-xs" style="background: rgba(255,255,255,0.05); border-radius: 4px;">
              <div class="row items-center q-gutter-x-sm no-wrap q-mb-xs">
                <q-badge color="primary">{{ idx + 1 }}</q-badge>
                <q-select dense dark outlined :model-value="method.methodName"
                  @update:model-value="val => onMethodChange(method, val)" :options="methodOptions"
                  style="min-width: 100px;" emit-value map-options>
                  <template v-slot:option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
                <q-space />
                <q-btn dense flat icon="close" color="negative" @click="removeMethod(idx)">
                  <q-tooltip>删除方法</q-tooltip>
                </q-btn>
              </div>

              <!-- 方法参数 -->
              <div v-for="param in method.params" :key="param.id"
                class="row items-center q-gutter-x-sm no-wrap q-mt-xs">
                <q-toggle dense dark :model-value="param.isSlot"
                  @update:model-value="val => updateParamSlot(param, val)" :label="param.label"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :model-value="param.value"
                  @update:model-value="val => param.value = val" :placeholder="param.label" :disable="param.isSlot" />
              </div>
            </div>
          </template>
          <q-btn flat color="primary" label="Add Method" no-caps dense class="full-width" @click="addMethod" />

          <div v-if="!localProperties.methods?.length" class="text-caption text-grey-6 text-center q-py-sm">
            无方法调用，将仅创建正则对象
          </div>
        </q-card-section>
      </q-card>

      <!-- 正则测试区 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">测试</div>
          <q-input dense dark outlined class="col" v-model="testInput" placeholder="输入测试字符串"
            :disable="localProperties.pattern?.isSlot" />
          <div v-if="testResult" class="q-mt-xs">
            <template v-if="testResult.error">
              <div class="text-caption text-negative">{{ testResult.error }}</div>
            </template>
            <template v-else>
              <div class="text-caption" :class="testResult.isMatch ? 'text-positive' : 'text-grey-6'">
                {{ testResult.isMatch ? '✓ 匹配成功' : '✗ 不匹配' }}
              </div>
              <div v-if="testResult.matches?.length" class="text-caption text-grey-5 q-mt-xs">
                <div v-for="(m, i) in testResult.matches" :key="i">
                  [{{ m.index }}]: <code class="text-light-blue-4">{{ m.value }}</code>
                  <span v-if="m.groups?.length" class="text-grey-6">
                    groups: {{ m.groups.join(', ') }}
                  </span>
                </div>
              </div>
            </template>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>

<style scoped>
code {
  font-family: 'Fira Code', 'Consolas', monospace;
}
</style>
