import { Fragment, type ReactNode } from 'react';
import { cn } from '@shared/utils/cn';

/**
 * Minimal, safe markdown renderer (no external deps, no raw HTML injection).
 * Supports the subset an AI travel agent actually uses: headings, bullet/numbered
 * lists, tables, blockquotes, horizontal rules, and inline **bold** / *italic* /
 * `code` / [links](url). Plain, escaped text everywhere else.
 */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return <div className={cn('space-y-2 text-sm leading-relaxed', className)}>{parseBlocks(content)}</div>;
}

function parseBlocks(md: string): ReactNode[] {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  const isTableRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isDivider = (l: string) => /^\s*\|?[\s:-]+\|[\s:|-]*$/.test(l) && l.includes('-');

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      const Tag = (['text-lg', 'text-base', 'text-sm'][Math.min(level - 1, 2)] ?? 'text-sm') as string;
      blocks.push(
        <p key={key++} className={cn('font-semibold text-foreground', Tag)}>
          {renderInline(h[2])}
        </p>,
      );
      i += 1;
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      blocks.push(<hr key={key++} className="border-border" />);
      i += 1;
      continue;
    }

    // Table
    if (isTableRow(line) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const header = splitRow(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && isTableRow(lines[i])) {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push(
        <div key={key++} className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                {header.map((c, ci) => (
                  <th key={ci} className="px-2 py-1.5 font-medium">
                    {renderInline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-border last:border-0">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2 py-1.5">
                      {renderInline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^\s*>\s?/, ''));
        i += 1;
      }
      blocks.push(
        <blockquote key={key++} className="border-l-2 border-primary/40 pl-3 text-muted-foreground">
          {renderInline(quote.join(' '))}
        </blockquote>,
      );
      continue;
    }

    // Unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ul key={key++} className="list-disc space-y-1 pl-5">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push(
        <ol key={key++} className="list-decimal space-y-1 pl-5">
          {items.map((it, ii) => (
            <li key={ii}>{renderInline(it)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Paragraph (consume consecutive non-blank, non-structural lines)
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^(#{1,6})\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !isTableRow(lines[i]) &&
      !/^\s*>\s?/.test(lines[i])
    ) {
      para.push(lines[i]);
      i += 1;
    }
    blocks.push(
      <p key={key++} className="text-foreground">
        {renderInline(para.join(' '))}
      </p>,
    );
  }

  return blocks;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

/** Inline: **bold**, *italic*, `code`, [text](url). Everything else is escaped text. */
function renderInline(text: string): ReactNode {
  const tokens: ReactNode[] = [];
  const regex = /(\*\*([^*]+)\*\*)|(\*([^*]+)\*)|(`([^`]+)`)|(\[([^\]]+)\]\(([^)]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = regex.exec(text)) !== null) {
    if (m.index > last) tokens.push(<Fragment key={key++}>{text.slice(last, m.index)}</Fragment>);
    if (m[2]) tokens.push(<strong key={key++} className="font-semibold text-foreground">{m[2]}</strong>);
    else if (m[4]) tokens.push(<em key={key++}>{m[4]}</em>);
    else if (m[6]) tokens.push(<code key={key++} className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{m[6]}</code>);
    else if (m[8]) tokens.push(
      <a key={key++} href={m[9]} target="_blank" rel="noreferrer" className="text-primary underline">
        {m[8]}
      </a>,
    );
    last = regex.lastIndex;
  }
  if (last < text.length) tokens.push(<Fragment key={key++}>{text.slice(last)}</Fragment>);
  return tokens;
}
