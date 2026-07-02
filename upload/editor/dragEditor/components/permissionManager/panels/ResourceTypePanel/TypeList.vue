<template>
  <q-list dense dark class="bg-grey-10">
    <q-item
      v-for="type in types"
      :key="type.id"
      clickable
      :active="selectedId === type.id"
      active-class="bg-grey-9"
      @click="handleSelect(type)"
      dense
      dark
    >
      <q-item-section avatar>
        <q-icon
          :name="type.icon || 'category'"
          :color="type.isSystem ? 'primary' : 'grey-7'"
          size="sm"
        />
      </q-item-section>

      <q-item-section>
        <q-item-label class="text-grey-7">{{ type.name }}</q-item-label>
        <q-item-label caption class="text-grey-7">{{ type.code }}</q-item-label>
      </q-item-section>

      <q-item-section side v-if="!simpleMode">
        <q-badge
          v-if="type.isSystem"
          label="系统"
          color="grey-8"
          dense
        />
        <q-btn
          v-else
          flat
          dense
          round
          icon="delete"
          size="sm"
          color="negative"
          @click.stop="handleDelete(type)"
        >
          <q-tooltip>删除</q-tooltip>
        </q-btn>
      </q-item-section>
    </q-item>

    <!-- 空状态 -->
    <div v-if="types.length === 0" class="text-center text-grey-7 q-py-xl">
      <q-icon name="category" size="md" class="q-mb-md" />
      <div class="text-subtitle2 q-mb-sm">暂无资源类型</div>
      <div class="text-caption text-grey-8">点击上方"+"按钮添加类型</div>
    </div>
  </q-list>
</template>

<script setup>
const props = defineProps({
  types: {
    type: Array,
    required: true
  },
  selectedId: {
    type: String,
    default: null
  },
  simpleMode: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['select', 'delete']);

function handleSelect(type) {
  emit('select', type);
}

function handleDelete(type) {
  emit('delete', type);
}
</script>
