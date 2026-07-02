<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">

      <!-- 卡片1: 声明区配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- Export 单独一行 -->
          <q-checkbox dense dark :model-value="localProperties.exported"
            @update:model-value="(val) => updateField('exported', val)" label="Export"
            :disable="localProperties.varName?.isSlot" class="q-mb-xs" />

          <!-- 变量声明行 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName" :model-value="localProperties.varName?.isSlot"
              @update:model-value="toggleVarNameSlot" style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined :model-value="localProperties.declareType"
              :disable="localProperties.varName?.isSlot"
              @update:model-value="(val) => updateField('declareType', val)" :options="declareTypeOptions" emit-value
              map-options class="col-auto" style="min-width: 70px;">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input dense dark outlined class="col" :model-value="localProperties.varName?.value"
              :disable="localProperties.varName?.isSlot"
              @update:model-value="(val) => updateField('varName.value', val)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    VNode 变量名<br />
                    示例: vnode, myComponent, element
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片2: h() 函数参数 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-sm">h() Function Arguments</div>

          <!-- Type 参数 -->
          <div class="row items-center q-gutter-x-sm no-wrap q-mb-xs">
            <q-toggle dense dark label="Type" :model-value="localProperties.useTypeSlot"
              @update:model-value="(val) => toggleSimpleSlot('type', localProperties.typeSlotId, val)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :model-value="localProperties.typeValue"
              :disable="localProperties.useTypeSlot"
              @update:model-value="(val) => updateField('typeValue', val)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    组件、标签或 Fragment<br />
                    示例: 'div', MyComponent, Fragment
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>

          <!-- Children 参数 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="Children" :model-value="localProperties.useChildrenSlot"
              @update:model-value="(val) => toggleSimpleSlot('children', localProperties.childrenSlotId, val)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :model-value="localProperties.childrenValue"
              :disable="localProperties.useChildrenSlot"
              @update:model-value="(val) => updateField('childrenValue', val)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    子节点内容<br />
                    示例: 'Hello', [vnode1, vnode2]
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片3: Props/Attributes -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-sm">Props / Attributes</div>

          <!-- Main Props Slot (mergeProps) -->
          <div class="row items-center q-gutter-x-sm no-wrap q-mb-sm">
            <q-toggle dense dark label="Props" :model-value="localProperties.usePropsSlot"
              @update:model-value="(val) => toggleSimpleSlot('props', localProperties.propsSlotId, val)"
              style="min-width: 90px; flex-shrink: 0;" />
            <span class="text-body2 text-grey-5">mergeProps(props, attrs)</span>
            <q-icon name="help_outline"  class="cursor-pointer">
              <q-tooltip class="bg-dark" max-width="300px">
                启用后接收外部 props 对象<br />
                将与下方 Attributes 通过 Vue mergeProps 合并<br />
                优先级: 外部 props &lt; 静态 attrs
              </q-tooltip>
            </q-icon>
          </div>

          <q-separator dark class="q-my-sm" />

          <!-- Attributes List -->
          <div class="text-caption text-grey-6 q-mb-xs">Attributes</div>
          <div v-for="(attr, index) in localProperties.attributesList" :key="attr.id" class="q-mt-xs">
            <div style="position: relative;">
              <div class="q-pa-sm rounded-borders q-gutter-y-xs" style="border: 1px solid #444; padding-right: 48px;">
                <q-select v-model="attr.key" :options="attrOptions" use-input dense dark outlined hide-dropdown-icon
                  input-debounce="0" emit-value map-options @new-value="(val, done) => done(val, 'add-unique')"
                  label="Attribute">
                  <template v-slot:option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>
                <div class="row items-center q-gutter-x-sm no-wrap">
                  <q-toggle v-model="attr.isSlot" :icon="mdiCodeBraces" dense dark label="Value"
                    @update:model-value="updateAttributeSlot(attr, $event)" style="min-width: 90px; flex-shrink: 0;" />
                  <q-input v-model="attr.value" dense dark outlined :disable="attr.isSlot" class="col">
                    <template v-slot:append>
                      <q-icon name="help_outline"  class="cursor-pointer">
                        <q-tooltip class="bg-dark" max-width="250px">
                          属性值（JS 表达式）<br />
                          字符串需加引号: 'my-class'<br />
                          变量直接写: className
                        </q-tooltip>
                      </q-icon>
                    </template>
                  </q-input>
                </div>
              </div>
              <q-btn flat dense icon="close" color="negative" @click="removeAttribute(index)"
                style="position: absolute; right: 8px; top: 8px;" />
            </div>
          </div>
          <q-btn dense flat no-caps label="Add Attribute" color="primary" @click="addAttribute"
            class="full-width q-mt-sm" />
        </q-card-section>
      </q-card>

      <!-- 卡片4: Events -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-sm">Events</div>

          <div v-for="(event, index) in localProperties.eventsList" :key="event.id" class="q-mt-xs">
            <div style="position: relative;">
              <div class="q-pa-sm rounded-borders q-gutter-y-xs" style="border: 1px solid #444; padding-right: 48px;">
                <q-select v-model="event.key" label="Event Name" :options="eventOptions" use-input dense dark outlined
                  hide-dropdown-icon input-debounce="0" @new-value="(val, done) => done(val, 'add-unique')" clearable
                  emit-value map-options options-dense @update:model-value="() => onEventKeyChange(event)">
                  <template v-slot:option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>

                <q-select v-model="event.modifiers" :options="modifierOptions" label="Modifiers" dense dark outlined
                  multiple emit-value map-options options-dense clearable>
                  <template v-slot:option="scope">
                    <q-item v-bind="scope.itemProps">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                        <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                </q-select>

                <!-- Event-level Directives -->
                <div v-if="event.directives && event.directives.length > 0" class="q-mt-sm">
                  <q-separator dark class="q-my-xs" />
                  <div class="text-caption text-grey-6 q-mb-xs">Directives for this Event</div>
                  <div v-for="(edir, dIndex) in event.directives" :key="edir.id" class="q-mt-xs">
                    <div style="position: relative;">
                      <div class="q-pa-xs rounded-borders q-gutter-y-xs"
                        style="border: 1px dashed #555; padding-right: 40px;">
                        <q-input v-model="edir.key" label="Directive Variable" dense dark outlined
                          @update:model-value="() => updateDirectiveSlots(edir)">
                          <template v-slot:append>
                            <q-icon name="help_outline"  class="cursor-pointer">
                              <q-tooltip class="bg-dark" max-width="250px">
                                指令变量名<br />
                                示例: vFocus, vTooltip
                              </q-tooltip>
                            </q-icon>
                          </template>
                        </q-input>
                        <div class="row items-center q-gutter-x-sm no-wrap">
                          <q-toggle v-model="edir.dirValueIsSlot" :icon="mdiCodeBraces" dense dark label="Value"
                            @update:model-value="() => updateDirectiveSlots(edir)"
                            style="min-width: 80px; flex-shrink: 0;" />
                          <q-input v-model="edir.dirValue" dense dark outlined :disable="edir.dirValueIsSlot"
                            class="col" />
                        </div>
                        <div class="row items-center q-gutter-x-sm no-wrap">
                          <q-toggle v-model="edir.dirArgIsSlot" :icon="mdiCodeBraces" dense dark label="Arg"
                            @update:model-value="() => updateDirectiveSlots(edir)"
                            style="min-width: 80px; flex-shrink: 0;" />
                          <q-input v-model="edir.dirArg" dense dark outlined :disable="edir.dirArgIsSlot" class="col" />
                        </div>
                        <q-input v-model="edir.dirModifiersStr" label="Modifiers (comma-separated)" dense dark outlined>
                          <template v-slot:append>
                            <q-icon name="help_outline"  class="cursor-pointer">
                              <q-tooltip class="bg-dark" max-width="250px">
                                修饰符列表，逗号分隔<br />
                                示例: lazy, trim
                              </q-tooltip>
                            </q-icon>
                          </template>
                        </q-input>
                      </div>
                      <q-btn flat dense icon="close" color="negative" @click="removeEventDirective(index, dIndex)"
                        style="position: absolute; right: 4px; top: 4px;" />
                    </div>
                  </div>
                  <q-btn label="Add Directive" icon="add" color="secondary" @click="addEventDirective(index)" flat dense
                    class="full-width q-mt-xs" />
                </div>
              </div>
              <q-btn flat dense color="negative" @click="removeEvent(index)"
                style="position: absolute; right: 8px; top: 8px;" />
            </div>
          </div>
          <q-btn label="Add Event" color="primary" @click="addEvent" dense flat no-caps class="full-width q-mt-sm" />
        </q-card-section>
      </q-card>

    </div>
  </BasePropertyPanel>
</template>

<script setup>
import { ref, watch } from "vue";
import { cloneDeep, set } from "lodash-es";
import { uid } from "quasar";
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

// --- Data Initialization ---
const props = defineModel();
const node = props.value;

// 声明类型选项
const declareTypeOptions = [
  { label: 'const', value: 'const', description: '常量声明，不可重新赋值' },
  { label: 'let', value: 'let', description: '变量声明，可重新赋值' },
];

function initializeProperties() {
  const p = cloneDeep(node.properties);
  if (!p.attributesList) p.attributesList = [];
  if (!p.eventsList) p.eventsList = [];
  if (!p.directivesList) p.directivesList = [];

  // 迁移旧的 varName 格式到三元组
  if (typeof p.varName === 'string') {
    p.varName = { id: uid(), isSlot: p.varNameIsSlot || false, value: p.varName };
    delete p.varNameIsSlot;
    delete p.varNameSlotId;
  }

  // 确保有 exported 和 declareType
  if (p.exported === undefined) p.exported = false;
  if (!p.declareType) p.declareType = 'const';

  // 确保有 slotId
  if (!p.typeSlotId) p.typeSlotId = uid();
  if (!p.childrenSlotId) p.childrenSlotId = uid();
  if (!p.propsSlotId) p.propsSlotId = uid();

  // Migration from old propsList
  if (p.propsList) {
    p.propsList.forEach(item => {
      if (item.propType === 'attribute') p.attributesList.push(item);
      else if (item.propType === 'event') p.eventsList.push(item);
      else if (item.propType === 'directive') p.directivesList.push(item);
    });
    delete p.propsList;
  }
  return p;
}

const localProperties = ref(initializeProperties());


const attrOptions = ref([
  { label: 'class', value: 'class', description: 'CSS 类名' },
  { label: 'style', value: 'style', description: '内联样式对象' },
  { label: 'innerHTML', value: 'innerHTML', description: '设置元素内部 HTML' },
  { label: 'id', value: 'id', description: '元素唯一标识' },
  { label: 'ref', value: 'ref', description: 'Vue ref 引用' },
  { label: 'key', value: 'key', description: 'Vue 列表渲染 key' },
]);

// 事件与其参数说明
const eventParamMap = {
  click: { label: 'click', params: ['MouseEvent e'], description: '鼠标点击' },
  dblclick: { label: 'dblclick', params: ['MouseEvent e'], description: '鼠标双击' },
  mousedown: { label: 'mousedown', params: ['MouseEvent e'], description: '鼠标按下' },
  mouseup: { label: 'mouseup', params: ['MouseEvent e'], description: '鼠标释放' },
  mouseover: { label: 'mouseover', params: ['MouseEvent e'], description: '鼠标移入（冒泡）' },
  mouseout: { label: 'mouseout', params: ['MouseEvent e'], description: '鼠标移出（冒泡）' },
  mousemove: { label: 'mousemove', params: ['MouseEvent e'], description: '鼠标移动' },
  mouseenter: { label: 'mouseenter', params: ['MouseEvent e'], description: '鼠标进入（不冒泡）' },
  mouseleave: { label: 'mouseleave', params: ['MouseEvent e'], description: '鼠标离开（不冒泡）' },
  contextmenu: { label: 'contextmenu', params: ['MouseEvent e'], description: '右键菜单' },
  keydown: { label: 'keydown', params: ['KeyboardEvent e'], description: '键盘按下' },
  keyup: { label: 'keyup', params: ['KeyboardEvent e'], description: '键盘释放' },
  keypress: { label: 'keypress', params: ['KeyboardEvent e'], description: '按键（已弃用）' },
  submit: { label: 'submit', params: ['SubmitEvent e'], description: '表单提交' },
  input: { label: 'input', params: ['InputEvent e'], description: '输入内容变化' },
  change: { label: 'change', params: ['Event e'], description: '值改变（失焦后）' },
  focus: { label: 'focus', params: ['FocusEvent e'], description: '获得焦点' },
  blur: { label: 'blur', params: ['FocusEvent e'], description: '失去焦点' },
  touchstart: { label: 'touchstart', params: ['TouchEvent e'], description: '触摸开始' },
  touchend: { label: 'touchend', params: ['TouchEvent e'], description: '触摸结束' },
  touchmove: { label: 'touchmove', params: ['TouchEvent e'], description: '触摸移动' },
  touchcancel: { label: 'touchcancel', params: ['TouchEvent e'], description: '触摸取消' },
  scroll: { label: 'scroll', params: ['Event e'], description: '滚动' },
};

const eventOptions = ref(Object.values(eventParamMap).map(e => ({
  label: e.label,
  value: e.label,
  description: `${e.description} (${e.params.join(', ')})`,
})));

const modifierOptions = ref([
  { label: '.stop', value: 'stop', description: '阻止冒泡' },
  { label: '.prevent', value: 'prevent', description: '阻止默认行为' },
  { label: '.self', value: 'self', description: '仅自身触发' },
  { label: '.capture', value: 'capture', description: '捕获模式' },
  { label: '.once', value: 'once', description: '只触发一次' },
  { label: '.passive', value: 'passive', description: '优化滚动性能' },
  { label: '.ctrl', value: 'ctrl', description: 'Ctrl 键' },
  { label: '.alt', value: 'alt', description: 'Alt 键' },
  { label: '.shift', value: 'shift', description: 'Shift 键' },
  { label: '.meta', value: 'meta', description: 'Meta 键 (Mac: Cmd)' },
  { label: '.exact', value: 'exact', description: '精确匹配修饰键' },
  { label: '.left', value: 'left', description: '鼠标左键' },
  { label: '.right', value: 'right', description: '鼠标右键' },
  { label: '.middle', value: 'middle', description: '鼠标中键' },
]);

// --- Deep Watcher to Sync All Properties ---
watch(localProperties, (newVal) => {
  Object.assign(node.properties, newVal);
  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}, { deep: true });


// --- Field Update ---
function updateField(key, value) {
  set(localProperties.value, key, value);
  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

// --- Slot Management ---

/**
 * 切换变量名 slot（三元组模式）
 */
function toggleVarNameSlot(isEnabled) {
  const varNameParam = localProperties.value.varName;
  varNameParam.isSlot = isEnabled;

  const existingIdx = node.inputs.findIndex(s => s.id === varNameParam.id);
  if (isEnabled && existingIdx === -1) {
    node.addInput('VarName', 'string', { id: varNameParam.id });
  } else if (!isEnabled && existingIdx !== -1) {
    node.removeInput(existingIdx);
  }
  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

/**
 * 切换简单参数 slot（type/children/props）
 */
function toggleSimpleSlot(slotName, slotId, isEnabled) {
  // 更新对应的 useXxxSlot 属性
  if (slotName === 'type') localProperties.value.useTypeSlot = isEnabled;
  else if (slotName === 'children') localProperties.value.useChildrenSlot = isEnabled;
  else if (slotName === 'props') localProperties.value.usePropsSlot = isEnabled;

  const index = node.inputs.findIndex(s => s.id === slotId);
  if (isEnabled) {
    if (index === -1) node.addInput(slotName, 'string', { id: slotId });
  } else {
    if (index !== -1) node.removeInput(index);
  }
  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

function updateAttributeSlot(attr, isEnabled) {
  const { slotId, key } = attr;
  const index = node.inputs.findIndex(s => s.id === slotId);
  if (isEnabled) {
    const slotName = key || "attr";
    if (index === -1) node.addInput(slotName, "string", { id: slotId });
    else if (node.inputs[index].name !== slotName) node.inputs[index].name = slotName;
  } else if (index !== -1) {
    node.removeInput(index);
  }
}

/**
 * 创建/更新事件的 function input slot
 * 根据 skill 规范：事件处理器是当前节点消费的函数，所以用 addInput
 */
function updateEventSlot(event) {
  const { slotId, key } = event;
  const slotName = key ? `on${key.charAt(0).toUpperCase()}${key.slice(1)}` : 'onEvent';

  // 计算参数签名
  const args = (eventParamMap[key]?.params || ['e']).map(p => {
    const parts = String(p).trim().split(/\s+/);
    return parts[parts.length - 1] || 'e';
  });

  const inputIndex = node.inputs.findIndex(s => s.id === slotId);
  if (inputIndex !== -1) {
    // 就地更新已有输入槽
    const inp = node.inputs[inputIndex];
    inp.name = slotName;
    inp.type = 'function';
    inp.shape = 5;
    inp.meta = { args };
  } else {
    // 创建新的 function input slot
    node.addInput(slotName, 'function', { id: slotId, shape: 5, meta: { args } });
  }
  node.graph?.setDirtyCanvas(true, true);
}

function onEventKeyChange(event) {
  // 更新输入插槽名称与参数签名
  updateEventSlot(event);
}


function updateDirectiveSlots(prop, removeAll = false) {
  // 不再为指令创建任何 slot in，仅做清理
  const { dirSlotId, dirValueSlotId, dirArgSlotId } = prop;
  const dirIndex = node.inputs.findIndex(s => s.id === dirSlotId);
  if (dirIndex !== -1) node.removeInput(dirIndex);
  const valueIndex = node.inputs.findIndex(s => s.id === dirValueSlotId);
  if (valueIndex !== -1) node.removeInput(valueIndex);
  const argIndex = node.inputs.findIndex(s => s.id === dirArgSlotId);
  if (argIndex !== -1) node.removeInput(argIndex);
}

// --- List Management ---

function addAttribute() {
  localProperties.value.attributesList.push({
    id: uid(),
    key: '',
    value: '',
    isSlot: false,
    slotId: uid(),
  });
}

function removeAttribute(index) {
  const attr = localProperties.value.attributesList[index];
  if (attr.isSlot) {
    updateAttributeSlot(attr, false);
  }
  localProperties.value.attributesList.splice(index, 1);
}

function addEvent() {
  const newEvent = {
    id: uid(),
    key: '',
    modifiers: [],
    slotId: uid(),
    directives: [],
  };
  localProperties.value.eventsList.push(newEvent);
  // 立即创建对应的 function input slot
  updateEventSlot(newEvent);
}

function removeEvent(index) {
  const event = localProperties.value.eventsList[index];
  // 清理 function input slot
  const inputIndex = node.inputs.findIndex(s => s.id === event.slotId);
  if (inputIndex !== -1) node.removeInput(inputIndex);

  // Clean up event-level directives slots
  (event.directives || []).forEach(d => updateDirectiveSlots(d, true));

  localProperties.value.eventsList.splice(index, 1);
}

function addEventDirective(eventIndex) {
  const event = localProperties.value.eventsList[eventIndex];
  if (!event.directives) event.directives = [];
  const edir = {
    id: uid(),
    key: '',
    dirSlotId: uid(),
    dirValue: '',
    dirValueIsSlot: false,
    dirValueSlotId: uid(),
    dirArg: '',
    dirArgIsSlot: false,
    dirArgSlotId: uid(),
    dirModifiersStr: '',
  };
  event.directives.push(edir);
}

function removeEventDirective(eventIndex, dirIndex) {
  const event = localProperties.value.eventsList[eventIndex];
  const edir = event.directives?.[dirIndex];
  if (edir) updateDirectiveSlots(edir, true);
  event.directives.splice(dirIndex, 1);
}

function addDirective() {
  localProperties.value.directivesList.push({
    id: uid(),
    key: '',
    dirSlotId: uid(), // Slot for the directive variable itself
    dirValue: '',
    dirValueIsSlot: false,
    dirValueSlotId: uid(),
    dirArg: '',
    dirArgIsSlot: false,
    dirArgSlotId: uid(),
    dirModifiersStr: '',
  });
}

function removeDirective(index) {
  const directive = localProperties.value.directivesList[index];
  updateDirectiveSlots(directive, true); // remove all slots
  localProperties.value.directivesList.splice(index, 1);
}


// --- Initial Sync on Mount ---
function syncSlotsOnMount() {
  // 同步变量名 slot
  if (localProperties.value.varName?.isSlot) {
    toggleVarNameSlot(true);
  }

  // 同步 type/children/props slot
  if (localProperties.value.useTypeSlot) {
    toggleSimpleSlot('type', localProperties.value.typeSlotId, true);
  }
  if (localProperties.value.useChildrenSlot) {
    toggleSimpleSlot('children', localProperties.value.childrenSlotId, true);
  }
  if (localProperties.value.usePropsSlot) {
    toggleSimpleSlot('props', localProperties.value.propsSlotId, true);
  }

  // 同步 attributes/events/directives
  localProperties.value.attributesList.forEach(attr => updateAttributeSlot(attr, attr.isSlot));
  localProperties.value.eventsList.forEach(event => updateEventSlot(event));
  localProperties.value.directivesList.forEach(dir => updateDirectiveSlots(dir));
}

syncSlotsOnMount();
</script>
