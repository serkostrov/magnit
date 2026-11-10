"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Eraser,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

type EditorMode = "editor" | "html" | "preview";

function ToolbarButton({
  active = false,
  disabled = false,
  icon,
  label,
  onClick,
}: {
  active?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`admin-editor-tool${active ? " is-active" : ""}`}
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      <span className="admin-editor-tool-icon" aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

function ToolbarGroup({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="admin-editor-tool-group" role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function AdminRichTextEditor({
  initialHtml,
  name,
}: {
  initialHtml: string;
  name: string;
}) {
  const [html, setHtml] = useState(initialHtml || "<p></p>");
  const [safeHtml, setSafeHtml] = useState("");
  const [mode, setMode] = useState<EditorMode>("editor");
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
    ],
    content: initialHtml || "<p></p>",
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => setHtml(currentEditor.getHTML()),
  });

  const editorState = useEditorState({
    editor,
    selector: ({ editor: currentEditor }) => ({
      bold: currentEditor?.isActive("bold") ?? false,
      italic: currentEditor?.isActive("italic") ?? false,
      strike: currentEditor?.isActive("strike") ?? false,
      heading2: currentEditor?.isActive("heading", { level: 2 }) ?? false,
      heading3: currentEditor?.isActive("heading", { level: 3 }) ?? false,
      bulletList: currentEditor?.isActive("bulletList") ?? false,
      orderedList: currentEditor?.isActive("orderedList") ?? false,
      blockquote: currentEditor?.isActive("blockquote") ?? false,
    }),
  });

  useEffect(() => {
    let active = true;
    void import("dompurify").then(({ default: DOMPurify }) => {
      if (active) setSafeHtml(DOMPurify.sanitize(html));
    });
    return () => {
      active = false;
    };
  }, [html]);

  function switchMode(nextMode: EditorMode) {
    if (nextMode === "editor" && editor && editor.getHTML() !== html) {
      editor.commands.setContent(html, { emitUpdate: false });
    }
    setMode(nextMode);
  }

  return (
    <div className="admin-rich-editor">
      <input type="hidden" name={name} value={html} />

      <div className="admin-editor-tabs" role="tablist" aria-label="Режим описания">
        {([
          ["editor", "Редактор"],
          ["html", "HTML"],
          ["preview", "Превью"],
        ] as const).map(([value, label]) => (
          <button
            className={mode === value ? "is-active" : ""}
            type="button"
            role="tab"
            aria-selected={mode === value}
            key={value}
            onClick={() => switchMode(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "editor" && (
        <div className="admin-editor-shell">
          <div className="admin-editor-toolbar" aria-label="Форматирование текста">
            <ToolbarGroup label="Начертание текста">
              <ToolbarButton icon={<Bold size={18} />} label="Жирный" active={editorState?.bold} disabled={!editor} onClick={() => editor?.chain().focus().toggleBold().run()} />
              <ToolbarButton icon={<Italic size={18} />} label="Курсив" active={editorState?.italic} disabled={!editor} onClick={() => editor?.chain().focus().toggleItalic().run()} />
              <ToolbarButton icon={<Strikethrough size={18} />} label="Зачеркнуть" active={editorState?.strike} disabled={!editor} onClick={() => editor?.chain().focus().toggleStrike().run()} />
            </ToolbarGroup>

            <ToolbarGroup label="Заголовки">
              <ToolbarButton icon={<Heading2 size={18} />} label="Заголовок" active={editorState?.heading2} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} />
              <ToolbarButton icon={<Heading3 size={18} />} label="Подзаголовок" active={editorState?.heading3} disabled={!editor} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} />
            </ToolbarGroup>

            <ToolbarGroup label="Списки и блоки">
              <ToolbarButton icon={<List size={18} />} label="Маркированный список" active={editorState?.bulletList} disabled={!editor} onClick={() => editor?.chain().focus().toggleBulletList().run()} />
              <ToolbarButton icon={<ListOrdered size={18} />} label="Нумерованный список" active={editorState?.orderedList} disabled={!editor} onClick={() => editor?.chain().focus().toggleOrderedList().run()} />
              <ToolbarButton icon={<Quote size={18} />} label="Цитата" active={editorState?.blockquote} disabled={!editor} onClick={() => editor?.chain().focus().toggleBlockquote().run()} />
            </ToolbarGroup>

            <ToolbarGroup label="Действия редактора">
              <ToolbarButton icon={<Eraser size={18} />} label="Очистить формат" disabled={!editor} onClick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()} />
              <ToolbarButton icon={<Undo2 size={18} />} label="Отменить" disabled={!editor?.can().chain().focus().undo().run()} onClick={() => editor?.chain().focus().undo().run()} />
              <ToolbarButton icon={<Redo2 size={18} />} label="Повторить" disabled={!editor?.can().chain().focus().redo().run()} onClick={() => editor?.chain().focus().redo().run()} />
            </ToolbarGroup>
          </div>
          <EditorContent editor={editor} />
        </div>
      )}

      {mode === "html" && (
        <textarea
          className="admin-editor-html"
          aria-label="HTML описания"
          value={html}
          onChange={(event) => setHtml(event.target.value)}
          spellCheck={false}
        />
      )}

      {mode === "preview" && (
        <div className="admin-editor-preview" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      )}
    </div>
  );
}
