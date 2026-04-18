"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronRight, Eye, EyeOff, Trash2, Layers } from "lucide-react";

export interface TreeNode {
  id: string;
  tag: string;
  label: string;
  hidden: boolean;
  hasChildren: boolean;
  children: TreeNode[];
}

interface LayersPanelProps {
  tree: TreeNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

export function LayersPanel({ tree, selectedId, onSelect, onDelete, onToggleHidden, onRename }: LayersPanelProps) {
  if (!tree || tree.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.04] flex items-center justify-center mb-3">
          <Layers className="w-5 h-5 text-white/40" />
        </div>
        <p className="text-[13px] font-medium text-white/60 mb-1">Sem estrutura ainda</p>
        <p className="text-[11px] text-white/30 leading-relaxed">Gere ou insira um layout para ver a árvore.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto py-2">
      {tree.map((node) => (
        <TreeRow key={node.id} node={node} depth={0} selectedId={selectedId}
          onSelect={onSelect} onDelete={onDelete} onToggleHidden={onToggleHidden} onRename={onRename} />
      ))}
    </div>
  );
}

interface TreeRowProps {
  node: TreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleHidden: (id: string) => void;
  onRename: (id: string, name: string) => void;
}

function TreeRow({ node, depth, selectedId, onSelect, onDelete, onToggleHidden, onRename }: TreeRowProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.label);
  const selected = selectedId === node.id;

  // Keep edit value in sync when label changes externally
  useEffect(() => { if (!editing) setEditValue(node.label); }, [node.label, editing]);

  const commit = () => {
    const v = editValue.trim();
    if (v && v !== node.label) onRename(node.id, v);
    setEditing(false);
  };

  return (
    <>
      <div
        className={cn(
          "group flex items-center gap-1 pr-2 py-1 cursor-pointer transition-colors",
          selected ? "bg-purple-500/20" : "hover:bg-white/[0.04]"
        )}
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={() => onSelect(node.id)}
      >
        {node.hasChildren ? (
          <button onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
            className="w-4 h-4 flex items-center justify-center text-white/30 hover:text-white/60 shrink-0">
            <ChevronRight className={cn("w-3 h-3 transition-transform", expanded && "rotate-90")} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        <span className="text-[10px] text-white/30 font-mono shrink-0 w-[14px]">◻</span>

        {editing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); commit(); }
              if (e.key === "Escape") { setEditValue(node.label); setEditing(false); }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 bg-white/[0.04] border border-purple-500/30 rounded px-1 text-[11px] text-white focus:outline-none"
          />
        ) : (
          <span
            onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
            className={cn("flex-1 truncate text-[11px]",
              node.hidden ? "text-white/25 italic" : selected ? "text-purple-300" : "text-white/70")}
          >
            {node.label}
          </span>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onToggleHidden(node.id); }}
            title={node.hidden ? "Mostrar" : "Ocultar"}
            className="p-0.5 text-white/40 hover:text-white"
          >
            {node.hidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            title="Excluir"
            className="p-0.5 text-red-400/60 hover:text-red-400"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {expanded && node.children.map((child) => (
        <TreeRow key={child.id} node={child} depth={depth + 1} selectedId={selectedId}
          onSelect={onSelect} onDelete={onDelete} onToggleHidden={onToggleHidden} onRename={onRename} />
      ))}
    </>
  );
}
