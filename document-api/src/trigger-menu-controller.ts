import type { SuperDoc } from 'superdoc';

export interface MenuPosition {
  top: number;
  left: number;
}

export interface TriggerMenuOptions {
  /** The trigger string that opens the menu (default: '{{') */
  trigger?: string;
  /** Called when the menu should open */
  onOpen?: (position: MenuPosition) => void;
  /** Called when the menu should close */
  onClose?: () => void;
  /** Called when the filter query changes */
  onQueryChange?: (query: string) => void;
  /** Called when the position updates (as user types) */
  onPositionChange?: (position: MenuPosition) => void;
}

export class TriggerMenuController {
  private superdoc: SuperDoc;
  private trigger: string;
  private onOpen?: (position: MenuPosition) => void;
  private onClose?: () => void;
  private onQueryChange?: (query: string) => void;
  private onPositionChange?: (position: MenuPosition) => void;

  private isOpen = false;
  private triggerFrom: number | null = null; // Position after trigger - for filtering
  private deleteFrom: number | null = null; // Position before trigger - for cleanup
  private query = '';
  private destroyed = false;
  private boundUpdateHandler: ((event: unknown) => void) | null = null;
  private boundBlurHandler: (() => void) | null = null;

  constructor(superdoc: SuperDoc, options: TriggerMenuOptions = {}) {
    this.superdoc = superdoc;
    this.trigger = options.trigger || '{{';
    this.onOpen = options.onOpen;
    this.onClose = options.onClose;
    this.onQueryChange = options.onQueryChange;
    this.onPositionChange = options.onPositionChange;

    this.setupListeners();
  }

  /** Current filter query (text typed after trigger) */
  getQuery(): string {
    return this.query;
  }

  /** Whether the menu is currently open */
  getIsOpen(): boolean {
    return this.isOpen;
  }

  /** Close the menu without inserting anything */
  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.query = '';
    this.triggerFrom = null;
    this.deleteFrom = null;
    this.onClose?.();
  }

  /** Clean up trigger text and close menu (call before inserting field) */
  acceptAndCleanup(): void {
    if (!this.isOpen || this.deleteFrom === null) return;

    const editor = this.superdoc.activeEditor;
    if (editor) {
      const currentPos = editor.state.selection.from;
      const tr = editor.state.tr.delete(this.deleteFrom, currentPos);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (editor as any).view.dispatch(tr);
    }

    this.close();
  }

  /** Remove event listeners and clean up */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    const editor = this.superdoc.activeEditor;
    if (editor) {
      if (this.boundUpdateHandler) {
        editor.off('update', this.boundUpdateHandler);
      }
      if (this.boundBlurHandler) {
        editor.off('blur', this.boundBlurHandler);
      }
    }

    this.close();
  }

  private setupListeners(): void {
    const editor = this.superdoc.activeEditor;
    if (!editor) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.boundUpdateHandler = (event: any) => {
      if (this.destroyed) return;

      const e = event.editor || event;
      const state = e.state;
      if (!state) return;

      const { from } = state.selection;

      // Check if trigger was just typed
      if (from >= this.trigger.length && !this.isOpen) {
        const triggerStart = from - this.trigger.length;
        const text = state.doc.textBetween(triggerStart, from);

        if (text === this.trigger) {
          const coords = editor.coordsAtPos(from);
          if (coords) {
            this.isOpen = true;
            this.query = '';
            this.triggerFrom = from;
            this.deleteFrom = triggerStart;
            this.onOpen?.({ top: coords.bottom + 4, left: coords.left });
          }
          return;
        }
      }

      // Update filter if menu is open
      if (this.isOpen && this.triggerFrom !== null) {
        if (from < this.triggerFrom) {
          this.close();
          return;
        }

        const newQuery = state.doc.textBetween(this.triggerFrom, from);
        if (newQuery !== this.query) {
          this.query = newQuery;
          this.onQueryChange?.(newQuery);
        }

        const coords = editor.coordsAtPos(from);
        if (coords) {
          this.onPositionChange?.({ top: coords.bottom + 4, left: coords.left });
        }
      }
    };

    this.boundBlurHandler = () => {
      setTimeout(() => {
        if (!this.destroyed && this.isOpen) this.close();
      }, 200);
    };

    editor.on('update', this.boundUpdateHandler);
    editor.on('blur', this.boundBlurHandler);
  }
}
