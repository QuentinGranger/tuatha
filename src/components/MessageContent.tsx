"use client";

import React from "react";

/**
 * Lightweight markdown renderer for chat messages.
 * Supports: **bold**, *italic*, `inline code`, ```code blocks```,
 * [links](url), auto-linked URLs, and line breaks.
 * No external dependencies — pure regex-based parsing.
 */

interface Props {
  content: string;
  className?: string;
}

// URL regex (simplified, covers most practical cases)
const URL_RE =
  /https?:\/\/[^\s<>"'`,;)}\]]+/g;

type Segment =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "codeblock"; value: string }
  | { type: "link"; label: string; href: string }
  | { type: "autolink"; href: string }
  | { type: "br" };

function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  // Combined regex for inline markdown tokens
  // Order matters: code first (greedy), then bold, italic, md links, raw URLs
  const TOKEN_RE =
    /```([\s\S]*?)```|`([^`\n]+)`|\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/[^\s<>"'`,;)}\]]+)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = TOKEN_RE.exec(text)) !== null) {
    // Push any plain text before this match
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index);
      pushTextWithBreaks(segments, plain);
    }

    if (match[1] !== undefined) {
      segments.push({ type: "codeblock", value: match[1].trim() });
    } else if (match[2] !== undefined) {
      segments.push({ type: "code", value: match[2] });
    } else if (match[3] !== undefined) {
      segments.push({ type: "bold", value: match[3] });
    } else if (match[4] !== undefined) {
      segments.push({ type: "italic", value: match[4] });
    } else if (match[5] !== undefined && match[6] !== undefined) {
      segments.push({ type: "link", label: match[5], href: match[6] });
    } else if (match[7] !== undefined) {
      segments.push({ type: "autolink", href: match[7] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    pushTextWithBreaks(segments, text.slice(lastIndex));
  }

  return segments;
}

function pushTextWithBreaks(segments: Segment[], text: string) {
  const lines = text.split("\n");
  lines.forEach((line, i) => {
    if (line) segments.push({ type: "text", value: line });
    if (i < lines.length - 1) segments.push({ type: "br" });
  });
}

export default function MessageContent({ content, className }: Props) {
  const segments = parseInline(content);

  return (
    <span className={className}>
      {segments.map((seg, i) => {
        switch (seg.type) {
          case "text":
            return <React.Fragment key={i}>{seg.value}</React.Fragment>;
          case "br":
            return <br key={i} />;
          case "bold":
            return <strong key={i}>{seg.value}</strong>;
          case "italic":
            return <em key={i}>{seg.value}</em>;
          case "code":
            return (
              <code key={i} className="msgInlineCode">
                {seg.value}
              </code>
            );
          case "codeblock":
            return (
              <pre key={i} className="msgCodeBlock">
                <code>{seg.value}</code>
              </pre>
            );
          case "link":
            return (
              <a
                key={i}
                href={seg.href}
                target="_blank"
                rel="noopener noreferrer"
                className="msgLink"
              >
                {seg.label}
              </a>
            );
          case "autolink":
            return (
              <a
                key={i}
                href={seg.href}
                target="_blank"
                rel="noopener noreferrer"
                className="msgLink"
              >
                {seg.href.length > 50
                  ? seg.href.slice(0, 47) + "..."
                  : seg.href}
              </a>
            );
          default:
            return null;
        }
      })}
    </span>
  );
}
