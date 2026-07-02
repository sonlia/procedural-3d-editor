<template>
  <div class="column no-wrap fit bg-grey-10">
    <!-- Tab 导航 -->
    <q-tabs
      v-model="permissionTab"
      dense
      dark
      class="bg-grey-9 text-grey-7"
      active-color="primary"
      indicator-color="primary"
      align="left"
    >
      <q-tab name="role" label="角色-权限">
        <q-tooltip>配置角色在各组织的权限</q-tooltip>
      </q-tab>
      <q-tab name="user" label="人员-权限">
        <q-tooltip>配置人员的权限（支持排除）</q-tooltip>
      </q-tab>
    </q-tabs>

    <!-- Tab 内容 -->
    <q-tab-panels v-model="permissionTab" animated class="col bg-grey-10">
      <!-- Tab 1: 角色-权限 -->
      <q-tab-panel name="role" class="q-pa-none">
        <role-permission-config />
      </q-tab-panel>

      <!-- Tab 2: 人员-权限 -->
      <q-tab-panel name="user" class="q-pa-none">
        <user-permission-config />
      </q-tab-panel>
    </q-tab-panels>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import RolePermissionConfig from './PermissionConfig/RolePermissionConfig.vue';
import UserPermissionConfig from './PermissionConfig/UserPermissionConfig.vue';

const permissionTab = ref('role');
</script>
