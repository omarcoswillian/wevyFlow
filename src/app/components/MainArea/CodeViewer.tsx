"use client";

import { useState, useCallback } from "react";
import { Light as SyntaxHighlighter } from "react-syntax-highlighter";
import xml from "react-syntax-highlighter/dist/esm/languages/hljs/xml";
import css from "react-syntax-highlighter/dist/esm/languages/hljs/css";
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs";

SyntaxHighlighter.registerLanguage("xml", xml);
SyntaxHighlighter.registerLanguage("css", css);

interface CodeViewerProps {
  code: string;
}

export function CodeViewer({ code }: CodeViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [code]);

  return (
    <div className="h-full relative group">
      {/* Floating copy button */}
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 z-10 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer bg-wf-surface-elevated border border-wf-border text-wf-text-muted hover:text-wf-text hover:border-wf-primary opacity-0 group-hover:opacity-100"
      >
        {copied ? "Copiado!" : "Copiar"}
      </button>

      <div className="h-full overflow-auto">
        <SyntaxHighlighter
          language="xml"
          style={atomOneDark}
          showLineNumbers
          lineNumberStyle={{
            color: "#4a4a5a",
            fontSize: "11px",
            paddingRight: "16px",
            minWidth: "40px",
          }}
          customStyle={{
            background: "var(--wf-bg)",
            margin: 0,
            padding: "16px",
            fontSize: "13px",
            lineHeight: "1.7",
            height: "100%",
          }}
          wrapLongLines
        >
          {code}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}
