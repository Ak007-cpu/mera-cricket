import React, { useState } from 'react';

interface ArticleRendererProps {
  content: string;
  className?: string;
}

const ArticleImage: React.FC<{ src: string; alt: string }> = ({ src, alt }) => {
  const [failed, setFailed] = useState(false);
  if (failed || !src) return null;

  return (
    <figure className="my-6 rounded-2xl overflow-hidden border border-slate-300 dark:border-slate-800 bg-slate-100 dark:bg-slate-950/70">
      <img
        src={src}
        alt={alt || 'Article visual'}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full max-h-[460px] object-cover block"
      />
      {alt && (
        <figcaption className="px-4 py-2.5 text-xs text-slate-600 dark:text-slate-400 border-t border-slate-200 dark:border-slate-800/80">
          {alt}
        </figcaption>
      )}
    </figure>
  );
};

function renderInlineFormatting(text: string): React.ReactNode[] {
  // Parse **bold** and *italic* safely without dangerouslySetInnerHTML
  const tokens = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold text-slate-950 dark:text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={idx} className="italic text-slate-800 dark:text-slate-200">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export const ArticleRenderer: React.FC<ArticleRendererProps> = ({ content, className = '' }) => {
  const lines = (content || '').split(/\r?\n/);
  const blocks: React.ReactNode[] = [];
  let listBuffer: string[] = [];
  let keyCounter = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const items = [...listBuffer];
    listBuffer = [];
    blocks.push(
      <ul key={`list-${keyCounter++}`} className="list-disc pl-6 space-y-2 text-slate-800 dark:text-slate-200 my-4">
        {items.map((item, i) => (
          <li key={i} className="leading-relaxed">
            {renderInlineFormatting(item)}
          </li>
        ))}
      </ul>
    );
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    // Standalone image syntax: ![caption](url)
    const imgMatch = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      flushList();
      blocks.push(
        <ArticleImage key={`img-${keyCounter++}`} alt={imgMatch[1].trim()} src={imgMatch[2].trim()} />
      );
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      flushList();
      blocks.push(
        <h3 key={`h3-${keyCounter++}`} className="text-lg sm:text-xl font-bold text-sky-700 dark:text-sky-300 mt-7 mb-2.5">
          {renderInlineFormatting(line.slice(4))}
        </h3>
      );
      continue;
    }

    if (line.startsWith('## ')) {
      flushList();
      blocks.push(
        <h2 key={`h2-${keyCounter++}`} className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white mt-8 mb-3 tracking-tight">
          {renderInlineFormatting(line.slice(3))}
        </h2>
      );
      continue;
    }

    if (line.startsWith('# ')) {
      flushList();
      blocks.push(
        <h2 key={`h1-${keyCounter++}`} className="text-2xl sm:text-3xl font-black text-slate-950 dark:text-white mt-8 mb-3 tracking-tight">
          {renderInlineFormatting(line.slice(2))}
        </h2>
      );
      continue;
    }

    // Bullet list items
    if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuffer.push(line.slice(2));
      continue;
    }

    flushList();
    blocks.push(
      <p key={`p-${keyCounter++}`} className="text-base sm:text-[17px] leading-[1.75] text-slate-800 dark:text-slate-200 mb-4">
        {renderInlineFormatting(line)}
      </p>
    );
  }

  flushList();

  return <div className={`space-y-1 ${className}`}>{blocks}</div>;
};
