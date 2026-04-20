import type { SuperDoc } from 'superdoc';

export interface TemplateField {
  id: string;
  alias: string;
  tag?: string;
  mode: 'inline' | 'block';
  group?: string;
  controlType?: string;
}

export interface FieldDefinition {
  alias: string;
  defaultValue?: string;
  mode?: 'inline' | 'block';
}

export class TemplateBuilderApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private doc: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private editor: any;
  private superdoc: SuperDoc;

  constructor(superdoc: SuperDoc) {
    this.superdoc = superdoc;
    this.editor = superdoc.activeEditor;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.doc = (this.editor as any).doc;
  }

  getFields(): TemplateField[] {
    const result = this.doc.contentControls.list();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return result.items.map((cc: any) => ({
      id: cc.id,
      alias: cc.properties?.alias || '',
      tag: cc.properties?.tag,
      mode: cc.kind as 'inline' | 'block',
      group: this.parseGroup(cc.properties?.tag),
      controlType: cc.controlType,
    }));
  }

  insertField(field: FieldDefinition): boolean {
    const result = this.doc.create.contentControl({
      kind: field.mode || 'inline',
      controlType: 'text',
      alias: field.alias,
      content: field.defaultValue || field.alias,
    });
    return result.success;
  }

  deleteField(id: string, mode: 'inline' | 'block'): boolean {
    const target = { kind: mode, nodeType: 'sdt', nodeId: id };
    const result = this.doc.contentControls.delete({ target });
    return result.success;
  }

  selectField(id: string): void {
    this.editor.commands?.selectStructuredContentById?.(id);
  }

  getFieldContent(id: string, mode: 'inline' | 'block'): string | null {
    const target = { kind: mode, nodeType: 'sdt', nodeId: id };
    const result = this.doc.contentControls.getContent({ target });
    return result.content ?? null;
  }

  setFieldContent(id: string, mode: 'inline' | 'block', content: string): boolean {
    const target = { kind: mode, nodeType: 'sdt', nodeId: id };
    const result = this.doc.contentControls.replaceContent({ target, content, format: 'text' });
    return result.success;
  }

  async export(fileName = 'template'): Promise<void> {
    await this.superdoc.export({
      exportType: ['docx'],
      exportedName: fileName,
      triggerDownload: true,
    });
  }

  private parseGroup(tag?: string): string | undefined {
    if (!tag) return undefined;
    try {
      return JSON.parse(tag)?.group;
    } catch {
      return undefined;
    }
  }
}
