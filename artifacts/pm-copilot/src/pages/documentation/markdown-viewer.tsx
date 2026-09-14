import React from 'react';

export function MarkdownViewer({ content }: { content: string }) {
  const lines = content.split('\n');
  let inList = false;
  let inOl = false;
  const elements: React.ReactNode[] = [];

  const formatText = (text: string, baseKey: string) => {
    // Simple inline parser for bold and code
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={`${baseKey}-${i}`}>{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={`${baseKey}-${i}`} className="bg-muted px-1.5 py-0.5 rounded text-[0.9em] font-mono">{part.slice(1, -1)}</code>;
      }
      return part;
    });
  };

  let listItems: React.ReactNode[] = [];

  const flushList = (key: string) => {
    if (inList && listItems.length > 0) {
      elements.push(<ul key={`ul-${key}`} className="list-disc pl-6 mb-4 space-y-1">{listItems}</ul>);
      listItems = [];
      inList = false;
    }
    if (inOl && listItems.length > 0) {
      elements.push(<ol key={`ol-${key}`} className="list-decimal pl-6 mb-4 space-y-1">{listItems}</ol>);
      listItems = [];
      inOl = false;
    }
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (inOl) flushList(`flush-${i}`);
      inList = true;
      listItems.push(<li key={`li-${i}`}>{formatText(trimmed.slice(2), `text-${i}`)}</li>);
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (inList) flushList(`flush-${i}`);
      inOl = true;
      listItems.push(<li key={`li-${i}`}>{formatText(trimmed.replace(/^\d+\.\s/, ''), `text-${i}`)}</li>);
    } else {
      flushList(`flush-${i}`);

      if (trimmed === '') {
        // Just empty line, add spacing if next line is not empty?
        // Let's just ignore and let paragraphs handle margin.
      } else if (trimmed.startsWith('### ')) {
        elements.push(<h3 key={`h3-${i}`} className="text-lg font-semibold tracking-tight mt-6 mb-3 text-foreground">{formatText(trimmed.slice(4), `text-${i}`)}</h3>);
      } else if (trimmed.startsWith('## ')) {
        elements.push(<h2 key={`h2-${i}`} className="text-xl font-semibold tracking-tight mt-8 mb-4 text-foreground">{formatText(trimmed.slice(3), `text-${i}`)}</h2>);
      } else if (trimmed.startsWith('# ')) {
        elements.push(<h1 key={`h1-${i}`} className="text-2xl font-bold tracking-tight mt-10 mb-6 text-foreground">{formatText(trimmed.slice(2), `text-${i}`)}</h1>);
      } else if (trimmed.startsWith('> ')) {
        elements.push(<blockquote key={`bq-${i}`} className="border-l-4 border-muted pl-4 italic text-muted-foreground my-4">{formatText(trimmed.slice(2), `text-${i}`)}</blockquote>);
      } else {
        elements.push(<p key={`p-${i}`} className="mb-4 leading-relaxed text-foreground/90">{formatText(trimmed, `text-${i}`)}</p>);
      }
    }
  });

  flushList('end');

  return (
    <div className="text-sm sm:text-base animate-in fade-in duration-300">
      {elements}
    </div>
  );
}