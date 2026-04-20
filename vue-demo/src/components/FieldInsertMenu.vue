<script setup lang="ts">
import { ref, computed } from 'vue';
import type { SuperDoc } from 'superdoc';
import type { FieldDefinition } from '../template-builder-api';
import { TriggerMenuController } from '../trigger-menu-controller';

// =============================================================================
// Props & Emits
// =============================================================================

const props = defineProps<{
  superdoc: SuperDoc | null;
  availableFields: FieldDefinition[];
  trigger?: string;
}>();

const emit = defineEmits<{
  insert: [field: FieldDefinition];
}>();

// =============================================================================
// State
// =============================================================================

const visible = ref(false);
const position = ref({ top: 0, left: 0 });
const query = ref('');
let controller: TriggerMenuController | null = null;

// =============================================================================
// Computed
// =============================================================================

const filteredFields = computed(() => {
  const q = query.value.toLowerCase();
  if (!q) return props.availableFields;
  return props.availableFields.filter(f => f.alias.toLowerCase().includes(q));
});

// =============================================================================
// Methods
// =============================================================================

const handleSelect = (field: FieldDefinition) => {
  controller?.acceptAndCleanup();
  emit('insert', field);
};

const setupTriggerListener = () => {
  if (!props.superdoc) return;

  controller = new TriggerMenuController(props.superdoc, {
    trigger: props.trigger,
    onOpen: (pos) => {
      visible.value = true;
      position.value = pos;
      query.value = '';
    },
    onClose: () => {
      visible.value = false;
      query.value = '';
    },
    onQueryChange: (q) => {
      query.value = q;
    },
    onPositionChange: (pos) => {
      position.value = pos;
    },
  });
};

// Expose setup method for parent to call when superdoc becomes ready
defineExpose({ setupTriggerListener });
</script>

<template>
  <div
    v-if="visible"
    class="field-menu"
    :style="{ top: position.top + 'px', left: position.left + 'px' }"
  >
    <div class="field-menu-header">Insert Field</div>
    <ul class="field-menu-list">
      <li
        v-for="field in filteredFields"
        :key="field.alias"
        class="field-menu-item"
        @click="handleSelect(field)"
      >
        {{ field.alias }}
      </li>
      <li v-if="filteredFields.length === 0" class="field-menu-empty">
        No matching fields
      </li>
    </ul>
  </div>
</template>

<style scoped>
.field-menu {
  position: fixed;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 200px;
  z-index: 1000;
}

.field-menu-header {
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  border-bottom: 1px solid #e8e8e8;
}

.field-menu-list {
  list-style: none;
  padding: 4px 0;
  margin: 0;
  max-height: 240px;
  overflow-y: auto;
}

.field-menu-item {
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  transition: background 0.1s;
}

.field-menu-item:hover {
  background: #f5f5f5;
}

.field-menu-empty {
  padding: 12px;
  color: #888;
  font-size: 13px;
  text-align: center;
}
</style>
