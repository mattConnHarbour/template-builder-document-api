import type { SuperDoc } from 'superdoc';
import type { FieldDefinition } from './template-builder-api';

export interface AutofillOptions {
  /** The opening delimiter (default: '{{') */
  openDelimiter?: string;
  /** The closing delimiter (default: '}}') */
  closeDelimiter?: string;
  /** Available fields to match against */
  availableFields: FieldDefinition[];
  /** Called when a field is auto-inserted */
  onAutoInsert?: (field: FieldDefinition) => void;
}

type TrackingState = { status: 'idle' } | { status: 'tracking'; openFrom: number };

interface UpdateContext {
  cursorPos: number;
  justTypedOpen: boolean;
  justTypedClose: boolean;
  textBetween: (from: number, to: number) => string;
}

type StateHandler = (ctx: UpdateContext, state: TrackingState) => TrackingState | null;

export class AutofillController {
  private superdoc: SuperDoc;
  private openDelimiter: string;
  private closeDelimiter: string;
  private availableFields: FieldDefinition[];
  private onAutoInsert?: (field: FieldDefinition) => void;

  private state: TrackingState = { status: 'idle' };
  private destroyed = false;
  private boundUpdateHandler: ((event: unknown) => void) | null = null;

  private stateHandlers: Record<TrackingState['status'], StateHandler> = {
    /**
     * Idle: Waiting for user to type the opening delimiter (e.g. "{{").
     * When detected, transition to 'tracking' and record where it started.
     */
    idle: (ctx) => {
      if (ctx.justTypedOpen) {
        return { status: 'tracking', openFrom: ctx.cursorPos - this.openDelimiter.length };
      }
      return null;
    },

    /**
     * Tracking: User typed "{{", now waiting for the closing delimiter ("}}").
     * - If cursor moves before the opening position, abandon and go back to idle.
     * - If closing delimiter typed, extract the variable name and attempt auto-insert.
     */
    tracking: (ctx, state) => {
      if (state.status !== 'tracking') return null;

      const { openFrom } = state;
      const cursorMovedBeforeOpen = ctx.cursorPos < openFrom + this.openDelimiter.length;

      if (cursorMovedBeforeOpen) {
        return { status: 'idle' };
      }

      if (ctx.justTypedClose) {
        const contentStart = openFrom + this.openDelimiter.length;
        const contentEnd = ctx.cursorPos - this.closeDelimiter.length;
        const variableName =
          contentEnd > contentStart ? ctx.textBetween(contentStart, contentEnd) : '';

        this.tryAutoInsert(variableName, openFrom, ctx.cursorPos);
        return { status: 'idle' };
      }

      return null;
    },
  };

  constructor(superdoc: SuperDoc, options: AutofillOptions) {
    this.superdoc = superdoc;
    this.openDelimiter = options.openDelimiter || '{{';
    this.closeDelimiter = options.closeDelimiter || '}}';
    this.availableFields = options.availableFields;
    this.onAutoInsert = options.onAutoInsert;

    this.setupListeners();
  }

  /** Update the available fields */
  setAvailableFields(fields: FieldDefinition[]): void {
    this.availableFields = fields;
  }

  /** Remove event listeners and clean up */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    const editor = this.superdoc.activeEditor;
    if (editor && this.boundUpdateHandler) {
      editor.off('update', this.boundUpdateHandler);
    }

    this.state = { status: 'idle' };
  }

  private setupListeners(): void {
    const editor = this.superdoc.activeEditor;
    if (!editor) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.boundUpdateHandler = (event: any) => {
      if (this.destroyed) return;

      const e = event.editor || event;
      const editorState = e.state;
      if (!editorState) return;

      const cursorPos = editorState.selection.from;
      const textEndingAt = (pos: number, length: number) =>
        pos >= length ? editorState.doc.textBetween(pos - length, pos) : '';

      const ctx: UpdateContext = {
        cursorPos,
        justTypedOpen: textEndingAt(cursorPos, this.openDelimiter.length) === this.openDelimiter,
        justTypedClose: textEndingAt(cursorPos, this.closeDelimiter.length) === this.closeDelimiter,
        textBetween: (from, to) => editorState.doc.textBetween(from, to),
      };

      const handler = this.stateHandlers[this.state.status];
      const nextState = handler(ctx, this.state);
      if (nextState) {
        this.state = nextState;
      }
    };

    editor.on('update', this.boundUpdateHandler);
  }

  private tryAutoInsert(variableName: string, deleteFrom: number, deleteTo: number): void {
    const normalizedName = variableName.trim().toLowerCase();
    if (!normalizedName) return;

    // Find matching field (case-insensitive)
    const matchedField = this.availableFields.find((f) => f.alias.toLowerCase() === normalizedName);

    if (!matchedField) return;

    const editor = this.superdoc.activeEditor;
    if (!editor) return;

    // Delete the entire {{variable}} text
    const tr = editor.state.tr.delete(deleteFrom, deleteTo);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (editor as any).view.dispatch(tr);

    // Insert the SDT content control
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const doc = (editor as any).doc;
    if (doc?.create?.contentControl) {
      doc.create.contentControl({
        kind: matchedField.mode || 'inline',
        controlType: 'text',
        alias: matchedField.alias,
        content: matchedField.defaultValue || matchedField.alias,
      });

      this.onAutoInsert?.(matchedField);
    }
  }
}
