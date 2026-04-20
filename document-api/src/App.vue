<script setup lang="ts">
import { ref, shallowRef, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { SuperDoc } from 'superdoc';
import { TemplateBuilderApi, type TemplateField, type FieldDefinition } from './template-builder-api';
import FieldInsertMenu from './components/FieldInsertMenu.vue';

// =============================================================================
// Config
// =============================================================================

const AVAILABLE_FIELDS: FieldDefinition[] = [
  { alias: 'User Name', defaultValue: '{{User Name}}' },
  { alias: 'Company Name', defaultValue: '{{Company Name}}' },
  { alias: 'Agreement Date', defaultValue: '{{Agreement Date}}' },
  { alias: 'Email Address', defaultValue: '{{Email Address}}' },
  { alias: 'Signature', defaultValue: '{{Signature}}', mode: 'block' },
];

const documentUrl = 'https://storage.googleapis.com/public_static_hosting/public_demo_docs/new_service_agreement.docx';

// =============================================================================
// State
// =============================================================================

const api = shallowRef<TemplateBuilderApi | null>(null);
const superdocInstance = shallowRef<SuperDoc | null>(null);
const isReady = ref(false);
const fields = ref<TemplateField[]>([]);
const selectedFieldId = ref<string | null>(null);
const fieldMenuRef = ref<InstanceType<typeof FieldInsertMenu> | null>(null);

// =============================================================================
// Click Handlers
// =============================================================================

const refreshFields = () => {
  fields.value = api.value!.getFields();
  console.log(`Refreshed: ${fields.value.length} fields`);
};

const handleInsertField = (field: FieldDefinition) => {
  const success = api.value!.insertField(field);
  if (success) {
    console.log(`Inserted field: ${field.alias}`);
    refreshFields();
  } else {
    console.error(`Failed to insert field: ${field.alias}`);
  }
};

const handleDeleteField = (id: string) => {
  const field = fields.value.find(f => f.id === id);
  if (!field) return;

  const success = api.value!.deleteField(id, field.mode);
  if (success) {
    console.log(`Deleted field: ${field.alias}`);
    if (selectedFieldId.value === id) selectedFieldId.value = null;
    refreshFields();
  } else {
    console.error(`Failed to delete field: ${field.alias}`);
  }
};

const handleSelectField = (id: string) => {
  const field = fields.value.find(f => f.id === id);
  if (!field) return;

  api.value!.selectField(id);
  selectedFieldId.value = id;
  console.log(`Selected field: ${field.alias}`);
};

const handleExport = async () => {
  console.log('Exporting...');
  await api.value!.export();
  console.log('Exported template');
};

// =============================================================================
// Lifecycle
// =============================================================================

onMounted(() => {
  console.log('Initializing SuperDoc...');

  const superdoc = new SuperDoc({
    selector: '#superdoc-editor',
    document: documentUrl,
    documentMode: 'editing',
    toolbar: '#superdoc-toolbar',
    modules: { comments: false },
    onReady: () => {
      superdocInstance.value = superdoc;
      api.value = new TemplateBuilderApi(superdoc);
      isReady.value = true;
      console.log('SuperDoc ready');

      setTimeout(refreshFields, 500);
      nextTick(() => {
        fieldMenuRef.value?.setupTriggerListener();
      });

      superdoc.activeEditor?.on('update', () => {
        setTimeout(refreshFields, 100);
      });
    },
  });
});

onBeforeUnmount(() => {
  superdocInstance.value?.destroy();
});
</script>

<template>
  <div class="app">
    <!-- Header -->
    <header class="header">
      <div class="header-hint">
        Type <code>{{"{{"}}</code> to insert a field &nbsp;|&nbsp; Tab/Shift+Tab to navigate
      </div>
      <div class="header-actions">
        <button class="btn btn-outline" :disabled="!isReady">Import File</button>
        <button class="btn btn-primary" @click="handleExport" :disabled="!isReady">Export Template</button>
      </div>
    </header>

    <!-- Main Content -->
    <div class="main">
      <!-- Editor -->
      <div class="editor-container">
        <div id="superdoc-toolbar" class="toolbar"></div>
        <div class="editor-wrapper">
          <div id="superdoc-editor"></div>
        </div>
      </div>

      <!-- Field List Sidebar -->
      <aside class="sidebar">
        <h2>Template Fields ({{ fields.length }})</h2>
        <ul v-if="fields.length > 0" class="field-list">
          <li
            v-for="field in fields"
            :key="field.id"
            class="field-item"
            :class="{ selected: field.id === selectedFieldId }"
            @click="handleSelectField(field.id)"
          >
            <div class="field-content">
              <div class="field-alias">{{ field.alias || '(no alias)' }}</div>
              <div class="field-meta">
                <span class="field-id">ID: {{ field.id.toString().slice(-9) }}</span>
                <span class="field-mode">{{ field.mode }}</span>
              </div>
            </div>
            <button class="btn-delete" @click.stop="handleDeleteField(field.id)" title="Delete field">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
              </svg>
            </button>
          </li>
        </ul>
        <div v-else class="empty-state">No fields in document</div>
      </aside>
    </div>

    <!-- Field Insert Menu -->
    <FieldInsertMenu
      ref="fieldMenuRef"
      :superdoc="superdocInstance"
      :available-fields="AVAILABLE_FIELDS"
      @insert="handleInsertField"
    />
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: #f5f5f5;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
}

.header-hint {
  color: #666;
  font-size: 14px;
}

.header-hint code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}

.header-actions {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: #2563eb;
  color: white;
  border: none;
}

.btn-primary:hover:not(:disabled) {
  background: #1d4ed8;
}

.btn-outline {
  background: white;
  color: #2563eb;
  border: 1px solid #2563eb;
}

.btn-outline:hover:not(:disabled) {
  background: #eff6ff;
}

.main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.editor-container {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  padding: 16px;
}

.toolbar {
  background: white;
  border: 1px solid #e0e0e0;
  border-bottom: none;
  border-radius: 8px 8px 0 0;
}

.editor-wrapper {
  flex: 1;
  background: white;
  border: 1px solid #e0e0e0;
  border-top: none;
  border-radius: 0 0 8px 8px;
  overflow: auto;
}

.sidebar {
  width: 320px;
  flex-shrink: 0;
  background: white;
  border-left: 1px solid #e0e0e0;
  padding: 16px;
  overflow-y: auto;
}

.sidebar h2 {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin: 0 0 16px 0;
}

.field-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.field-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: 12px;
  background: #fafafa;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.field-item:hover {
  border-color: #d0d0d0;
}

.field-item.selected {
  border-color: #2563eb;
  background: #eff6ff;
}

.field-content {
  flex: 1;
  min-width: 0;
}

.field-alias {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  margin-bottom: 4px;
}

.field-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: #888;
}

.field-id {
  font-family: monospace;
}

.btn-delete {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #999;
  border-radius: 4px;
  transition: all 0.15s;
}

.btn-delete:hover {
  color: #ef4444;
  background: #fef2f2;
}

.empty-state {
  color: #888;
  font-size: 14px;
  text-align: center;
  padding: 24px;
}
</style>
