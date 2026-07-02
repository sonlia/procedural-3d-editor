<script setup>
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();
</script>

<template>
  <BasePropertyPanel v-model="props">
    <q-card dark flat class="q-mb-xs">
      <q-card-section class="q-pa-sm">
        <div class="text-caption text-grey-5">跳过本次循环，继续下一次</div>
      </q-card-section>
    </q-card>
  </BasePropertyPanel>
</template>

<style scoped></style>
