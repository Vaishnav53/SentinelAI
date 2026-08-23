import React, { useState, memo } from 'react';
import { Copy, Check } from 'lucide-react';

/**
 * Cleanly unescape backslash-escaped Markdown characters (e.g. \##, \**, \|, \`)
 * and strip reasoning channels.
 */
function cleanEscapedMarkdown(rawText) {
  if (!rawText) return '';
  return rawText
    .replace(/\\([#*_`|\[\]()\-+!><])/g, '$1')
    .replace(/<think>[\s\S]*?<\/think>/gi, '') // Filter any internal reasoning tokens
    .replace(/\[REASONING\][\s\S]*?\[\/REASONING\]/gi, '');
}

/**
 * Parses inline formatting: **bold**, *italic*, `code`, and plain text.
 */
function renderInlineFormatting(text) {
  if (!text) return null;

  // Single-pass tokenizer for `code`, **bold**, *italic*
  const tokens = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;
  let lastIdx = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({ type: 'text', value: text.substring(lastIdx, match.index) });
    }
    const tokenStr = match[0];
    if (tokenStr.startsWith('`') && tokenStr.endsWith('`')) {
      tokens.push({ type: 'code', value: tokenStr.slice(1, -1) });
    } else if ((tokenStr.startsWith('**') && tokenStr.endsWith('**')) || (tokenStr.startsWith('__') && tokenStr.endsWith('__'))) {
      tokens.push({ type: 'bold', value: tokenStr.slice(2, -2) });
    } else if ((tokenStr.startsWith('*') && tokenStr.endsWith('*')) || (tokenStr.startsWith('_') && tokenStr.endsWith('_'))) {
      tokens.push({ type: 'italic', value: tokenStr.slice(1, -1) });
    } else {
      tokens.push({ type: 'text', value: tokenStr });
    }
    lastIdx = regex.lastIndex;
  }

  if (lastIdx < text.length) {
    tokens.push({ type: 'text', value: text.substring(lastIdx) });
  }

  return tokens.map((token, i) => {
    switch (token.type) {
      case 'code':
        return <code key={i} className="inline-code">{token.value}</code>;
      case 'bold':
        return <strong key={i} className="font-semibold text-white">{token.value}</strong>;
      case 'italic':
        return <em key={i} className="italic text-slate-300">{token.value}</em>;
      case 'text':
      default:
        return <React.Fragment key={i}>{token.value}</React.Fragment>;
    }
  });
}

/**
 * Code block with header and copy button
 */
const CodeBlock = memo(function CodeBlock({ language, code }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="agent-code-container">
      <div className="agent-code-header">
        <span className="code-lang-label">{language || 'code'}</span>
        <button className="code-copy-btn" onClick={handleCopy} title="Copy code">
          {copied ? <Check size={12} className="text-green" /> : <Copy size={12} />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <pre className="agent-code-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
});

/**
 * Table renderer for GFM markdown tables
 */
const MarkdownTable = memo(function MarkdownTable({ headers, rows }) {
  return (
    <div className="agent-table-wrapper">
      <table className="agent-markdown-table">
        <thead>
          <tr>
            {headers.map((h, idx) => (
              <th key={idx}>{renderInlineFormatting(h.trim())}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {row.map((cell, cIdx) => (
                <td key={cIdx}>{renderInlineFormatting(cell.trim())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

/**
 * Safe, robust MarkdownRenderer for Copilot chat responses.
 * Guarantees zero infinite loops during streaming and partial markdown blocks.
 */
function MarkdownRenderer({ content }) {
  if (!content) return null;

  const cleaned = cleanEscapedMarkdown(content);
  const lines = cleaned.split('\n');
  const elements = [];

  let i = 0;
  const total = lines.length;

  while (i < total) {
    const line = lines[i];

    // 1. Fenced Code Block: ```lang
    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < total && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      elements.push(
        <CodeBlock key={`code-${i}`} language={lang} code={codeLines.join('\n')} />
      );
      if (i < total && lines[i].trim().startsWith('```')) {
        i++; // Skip closing ```
      }
      continue;
    }

    // 2. Table: | col1 | col2 |
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      const tableLines = [];
      const startIdx = i;
      while (i < total && lines[i].trim().startsWith('|') && lines[i].trim().endsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }

      if (tableLines.length >= 2) {
        const headerRow = tableLines[0]
          .slice(1, -1)
          .split('|');
        
        // Skip separator row (e.g. |---|---|)
        const isSep = tableLines[1].replace(/[\s|:\-]/g, '').length === 0;
        const dataRows = (isSep ? tableLines.slice(2) : tableLines.slice(1)).map(r =>
          r.slice(1, -1).split('|')
        );

        elements.push(
          <MarkdownTable
            key={`table-${startIdx}`}
            headers={headerRow}
            rows={dataRows}
          />
        );
        continue;
      } else {
        // Only 1 table line received so far (streaming) -> Render as single row table or block
        const headerRow = tableLines[0].slice(1, -1).split('|');
        elements.push(
          <MarkdownTable
            key={`table-part-${startIdx}`}
            headers={headerRow}
            rows={[]}
          />
        );
        continue;
      }
    }

    // 3. Headings
    if (line.startsWith('#### ')) {
      elements.push(<h5 key={`h4-${i}`} className="agent-md-h4">{renderInlineFormatting(line.slice(5))}</h5>);
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      elements.push(<h4 key={`h3-${i}`} className="agent-md-h3">{renderInlineFormatting(line.slice(4))}</h4>);
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={`h2-${i}`} className="agent-md-h2">{renderInlineFormatting(line.slice(3))}</h3>);
      i++;
      continue;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={`h1-${i}`} className="agent-md-h1">{renderInlineFormatting(line.slice(2))}</h2>);
      i++;
      continue;
    }

    // 4. Blockquote: > quote
    if (line.trim().startsWith('>')) {
      const quoteLines = [];
      while (i < total && lines[i].trim().startsWith('>')) {
        quoteLines.push(lines[i].trim().replace(/^>\s?/, ''));
        i++;
      }
      elements.push(
        <blockquote key={`quote-${i}`} className="agent-md-blockquote">
          {renderInlineFormatting(quoteLines.join(' '))}
        </blockquote>
      );
      continue;
    }

    // 5. Unordered List: - item or * item
    if (/^\s*[-*]\s+/.test(line)) {
      const listItems = [];
      while (i < total && /^\s*[-*]\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="agent-md-ul">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 6. Ordered List: 1. item
    if (/^\s*\d+\.\s+/.test(line)) {
      const listItems = [];
      while (i < total && /^\s*\d+\.\s+/.test(lines[i])) {
        listItems.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="agent-md-ol">
          {listItems.map((item, idx) => (
            <li key={idx}>{renderInlineFormatting(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // 7. Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // 8. Paragraph
    const paragraphLines = [];
    while (
      i < total &&
      lines[i].trim() &&
      !lines[i].trim().startsWith('```') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].startsWith('#') &&
      !lines[i].trim().startsWith('>') &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i++;
    }

    if (paragraphLines.length > 0) {
      elements.push(
        <p key={`p-${i}`} className="agent-md-p">
          {renderInlineFormatting(paragraphLines.join(' '))}
        </p>
      );
    } else {
      // Safety advance
      i++;
    }
  }

  return <div className="agent-markdown-content font-sans">{elements}</div>;
}

export default memo(MarkdownRenderer);
