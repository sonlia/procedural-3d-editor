<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateVarNameSlot(isSlot) {
  const param = properties.value.outputVar;
  if (!param) return;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput("VarName", "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateParamSlot(param, slotName, isSlot) {
  if (!param) return;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput(slotName, "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

const declareTypeOptions = [
  { label: "const", value: "const", description: "常量声明，不可重新赋值" },
  { label: "let", value: "let", description: "变量声明，可重新赋值" },
];
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 说明 -->
      <div class="text-caption text-grey">无限滚动/分页加载数据</div>

      <!-- 卡片 1：输出变量 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-checkbox dense dark label="Export" :disable="properties.outputVar?.isSlot"
            :model-value="properties.exported"
            @update:model-value="v => updateField('exported', v)" class="q-mb-xs" />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName"
              :model-value="properties.outputVar?.isSlot"
              @update:model-value="v => updateVarNameSlot(v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined :disable="properties.outputVar?.isSlot"
              :model-value="properties.declareType"
              @update:model-value="v => updateField('declareType', v)"
              :options="declareTypeOptions" emit-value map-options class="col-auto">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input dense dark outlined class="col" :disable="properties.outputVar?.isSlot"
              :model-value="properties.outputVar?.value"
              @update:model-value="v => updateField('outputVar.value', v)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    无限查询对象变量名<br />
                    示例: postsQuery, commentsQuery
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：查询键 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">查询键 (queryKey)</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="queryKey"
              :model-value="properties.queryKey?.isSlot"
              @update:model-value="v => updateParamSlot(properties.queryKey, 'queryKey', v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :disable="properties.queryKey?.isSlot"
              :model-value="properties.queryKey?.value"
              @update:model-value="v => updateField('queryKey.value', v)"
              placeholder="['posts']">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    唯一标识查询的键数组<br />
                    示例: ['posts'], ['comments', postId]
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 3：查询函数 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">查询函数 (queryFn)</div>
          <div class="text-caption text-blue-4">
            <q-icon name="info"  class="q-mr-xs" />
            连接 FunctionBlock 节点，参数: context (包含 pageParam, queryKey 等)
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 4：分页参数函数 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">获取下一页参数 (getNextPageParam)</div>
          <div class="text-caption text-blue-4">
            <q-icon name="info"  class="q-mr-xs" />
            连接 FunctionBlock 节点，参数: lastPage, allPages, lastPageParam, allPageParams
          </div>
          <div class="text-caption text-grey q-mt-xs">
            返回下一页的参数，返回 undefined 表示没有更多数据
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 5：初始页参数 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">初始页参数 (initialPageParam)</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="initial"
              :model-value="properties.initialPageParam?.isSlot"
              @update:model-value="v => updateParamSlot(properties.initialPageParam, 'initialPageParam', v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :disable="properties.initialPageParam?.isSlot"
              :model-value="properties.initialPageParam?.value"
              @update:model-value="v => updateField('initialPageParam.value', v)"
              placeholder="0">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    第一页的参数值<br />
                    示例: 0, 1, null, { cursor: null }
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 6：选项 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">选项</div>
          <div class="column q-gutter-y-xs">
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="enabled"
                :model-value="properties.enabled?.isSlot"
                @update:model-value="v => updateParamSlot(properties.enabled, 'enabled', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.enabled?.isSlot"
                :model-value="properties.enabled?.value"
                @update:model-value="v => updateField('enabled.value', v)"
                placeholder="true">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      是否启用查询<br />
                      示例: true, !!userId
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="maxPages"
                :model-value="properties.maxPages?.isSlot"
                @update:model-value="v => updateParamSlot(properties.maxPages, 'maxPages', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.maxPages?.isSlot"
                :model-value="properties.maxPages?.value"
                @update:model-value="v => updateField('maxPages.value', v)"
                placeholder="无限制">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      最大缓存页数<br />
                      示例: 3, 5, 10
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 7：输出说明 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">可用输出</div>
          <div class="column q-gutter-y-xs text-caption">
            <div><span class="text-blue-4">data</span> - 所有页面数据 { pages, pageParams }</div>
            <div><span class="text-blue-4">error</span> - 错误信息</div>
            <div><span class="text-blue-4">isLoading</span> - 首次加载中</div>
            <div><span class="text-blue-4">isFetchingNextPage</span> - 正在加载下一页</div>
            <div><span class="text-blue-4">hasNextPage</span> - 是否有下一页</div>
            <div><span class="text-blue-4">fetchNextPage</span> - 加载下一页函数</div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
