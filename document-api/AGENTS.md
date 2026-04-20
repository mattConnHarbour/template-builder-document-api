# Document API Demo - Agent Guide

This demo shows how to build a template builder using SuperDoc's Document API. It's designed for customers to extract and adapt to their own apps.

## Project Structure

```
src/
├── lib/
│   └── index.ts              # Barrel export - import everything from here
├── template-builder-api.ts   # Core API wrapper (framework-agnostic)
├── trigger-menu-controller.ts # Trigger menu logic (framework-agnostic)
├── App.vue                   # Example Vue app (reference implementation)
└── components/
    └── FieldInsertMenu.vue   # Example Vue component using the controller
```

## What to Extract

### For any framework (React, Vue, Angular, vanilla JS):

1. **`src/template-builder-api.ts`** - Document API wrapper class
   - `getFields()` - List all template fields in the document
   - `insertField(field)` - Insert a new field at cursor
   - `deleteField(id, mode)` - Remove a field
   - `selectField(id)` - Navigate to and select a field
   - `export(fileName)` - Export the document as .docx

2. **`src/trigger-menu-controller.ts`** - Trigger menu controller
   - Detects when user types `{{` (configurable)
   - Provides cursor position for menu placement
   - Handles cleanup of trigger text when field is inserted
   - Callback-based API works with any UI framework

### Vue-specific (reference only):

- `src/App.vue` - Shows how to wire everything together
- `src/components/FieldInsertMenu.vue` - Example menu component

## Usage Pattern

```typescript
import { TemplateBuilderApi, TriggerMenuController } from './lib';

// After SuperDoc is ready:
const api = new TemplateBuilderApi(superdoc);
const menu = new TriggerMenuController(superdoc, {
  trigger: '{{',
  onOpen: (position) => { /* show your menu UI at position */ },
  onClose: () => { /* hide menu */ },
  onQueryChange: (query) => { /* filter your field list */ },
});

// Insert a field:
api.insertField({ alias: 'User Name', defaultValue: '{{User Name}}' });

// When user selects from menu:
menu.acceptAndCleanup(); // removes the '{{...' text
api.insertField(selectedField);

// Cleanup on unmount:
menu.destroy();
```

## Key Interfaces

```typescript
interface FieldDefinition {
  alias: string;
  defaultValue?: string;
  mode?: 'inline' | 'block';
}

interface TemplateField {
  id: string;
  alias: string;
  mode: 'inline' | 'block';
  tag?: string;
  group?: string;
  controlType?: string;
}

interface MenuPosition {
  top: number;
  left: number;
}
```

## Common Tasks

### Add a new field type
Edit `AVAILABLE_FIELDS` in App.vue (or your equivalent config).

### Change the trigger character
Pass `trigger: '@'` (or any string) to `TriggerMenuController`.

### Customize field appearance
Use SuperDoc's Document API directly: `superdoc.activeEditor.doc.contentControls.patch()`

### Add field validation
Extend `TemplateBuilderApi` with validation logic before `insertField()`.
