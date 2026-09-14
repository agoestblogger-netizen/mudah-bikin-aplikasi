'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';

interface MarkdownMessageProps {
  content: string;
  isUser?: boolean;
  className?: string;
}

export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({
  content,
  isUser = false,
  className = ''
}) => {
  const normalizedContent = React.useMemo(() => {
    if (!content) return '';
    // 1. Tangani jika ada <br> yang diletakkan di akhir baris tabel (| ... <br>) agar remark-gfm mengenalinya sebagai baris tabel terpisah
    let text = content.replace(/\|\s*<br\s*\/?>\s*/gi, '|\n');
    // 2. Tangani jika ada <br> sebelum delimiter tabel (:-| atau :---)
    text = text.replace(/<br\s*\/?>\s*(:?-+:?)/gi, '\n$1');
    // 3. Tangani jika baris tabel diawali dengan <br>
    text = text.replace(/<br\s*\/?>\s*\|/gi, '\n|');
    return text;
  }, [content]);

  if (isUser) {
    return <p className={`whitespace-pre-wrap text-xs leading-relaxed ${className}`}>{content}</p>;
  }

  return (
    <div className={`markdown-message text-xs leading-relaxed text-zinc-200 space-y-2 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ node, ...props }) => (
            <h1 className="text-sm sm:text-base font-bold text-white mt-3 mb-1.5 flex items-center gap-1.5" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-xs sm:text-sm font-bold text-white mt-2.5 mb-1 flex items-center gap-1.5" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-xs sm:text-sm font-bold text-emerald-400 mt-2 mb-1" {...props} />
          ),
          h4: ({ node, ...props }) => (
            <h4 className="text-xs font-bold text-zinc-200 mt-1.5 mb-0.5" {...props} />
          ),
          p: ({ node, children, ...props }) => (
            <p className="text-xs leading-relaxed my-1.5 text-zinc-200 whitespace-pre-wrap" {...props}>
              {children}
            </p>
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold text-white" {...props} />
          ),
          em: ({ node, ...props }) => (
            <em className="italic text-zinc-300" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc list-inside space-y-1 my-2 pl-1 text-zinc-300" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal list-inside space-y-1 my-2 pl-1 text-zinc-300" {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="text-xs leading-relaxed text-zinc-200" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-2 border-emerald-400/80 bg-emerald-500/10 rounded-r-xl px-3 py-2 my-2 text-zinc-200 text-xs italic shadow-sm"
              {...props}
            />
          ),
          table: ({ node, ...props }) => (
            <div className="relative group my-3 -mx-1 sm:mx-0">
              <div className="overflow-x-auto rounded-xl border border-white/15 bg-black/40 shadow-md">
                <table className="w-full text-left border-collapse text-[11px] sm:text-xs" {...props} />
              </div>
              <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-black/60 to-transparent rounded-r-xl opacity-75 sm:hidden" />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-white/10 text-zinc-100 font-semibold border-b border-white/15" {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody className="divide-y divide-white/10" {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-white/[0.04] transition-colors odd:bg-white/[0.01]" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th className="px-2 py-2 sm:px-3 sm:py-2.5 text-[10px] sm:text-[11px] font-bold text-zinc-100 uppercase tracking-wider text-wrap break-words leading-tight align-bottom min-w-[70px] max-w-[130px] border-r border-white/10 last:border-r-0" {...props} />
          ),
          td: ({ node, children, ...props }: any) => {
            const isDash = children === '-' || (Array.isArray(children) && children.length === 1 && children[0] === '-');
            return (
              <td
                className={`px-2 py-2 sm:px-3 sm:py-2 text-[10px] sm:text-[11px] align-top leading-snug text-wrap break-words min-w-[70px] max-w-[140px] border-r border-white/5 last:border-r-0 ${
                  isDash ? 'text-zinc-600 text-center font-bold' : 'text-zinc-300'
                }`}
                {...props}
              >
                {children}
              </td>
            );
          },
          code: ({ node, inline, className: codeClassName, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className="bg-white/10 text-emerald-300 px-1.5 py-0.5 rounded text-[11px] font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <pre className="overflow-x-auto bg-black/60 border border-white/10 rounded-xl p-3 my-2 text-[11px] font-mono text-zinc-200">
                <code className={codeClassName} {...props}>
                  {children}
                </code>
              </pre>
            );
          },
          a: ({ node, ...props }) => (
            <a
              className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2 transition-colors font-medium"
              target="_blank"
              rel="noopener noreferrer"
              {...props}
            />
          ),
          hr: ({ node, ...props }) => (
            <hr className="border-white/15 my-3" {...props} />
          )
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownMessage;
