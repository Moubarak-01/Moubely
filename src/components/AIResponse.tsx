import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Check, Copy, Terminal } from 'lucide-react';
import 'highlight.js/styles/atom-one-dark.css';
// Ensure CSS is loaded to prevent double-math rendering
import 'katex/dist/katex.min.css';

// --- CUSTOM CODE BLOCK ---
const CodeBlock = ({ inline, className, children, ...props }: any) => {
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : 'text';
  const codeContent = String(children).replace(/\n$/, '');

  if (inline) {
    return (
      <code className="bg-white/10 text-pink-300 px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
        {children}
      </code>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(codeContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="my-4 rounded-lg overflow-hidden border border-white/10 bg-[#1e1e1e] shadow-lg">
      <div className="flex items-center justify-between px-4 py-2 bg-white/5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Terminal size={14} className="text-gray-400" />
          <span className="text-xs text-gray-400 font-medium lowercase">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
        >
          {isCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          {isCopied ? "Copied!" : "Copy"}
        </button>
      </div>
      
      <div className="p-4 overflow-x-auto">
        <code className={`!bg-transparent !p-0 text-sm font-mono ${className}`} {...props}>
          {children}
        </code>
      </div>
    </div>
  );
};

// --- CONFIGURATION ---
const katexOptions: any = {
  output: 'html',
  strict: false,
  throwOnError: false,
  globalGroup: true,
};

// --- CONTENT PRE-PROCESSOR (The "Bold" Fix) ---
const preprocessContent = (content: string) => {
  if (!content) return "";

  let processed = content
    // 1. Un-escape dollar signs
    .replace(/\\+(\$)/g, '$')
    
    // 2. Normalize LaTeX brackets
    .replace(/\\\[/g, '$$')
    .replace(/\\\]/g, '$$')
    .replace(/\\\(/g, '$')
    .replace(/\\\)/g, '$');

  // 3. FORCE BLOCK MATH (Fixes spacing)
  // Ensures "$$ ... $$" has blank lines around it so it renders as a block
  processed = processed.replace(/(\$\$[\s\S]*?\$\$)/g, '\n\n$1\n\n');

  // 4. AUTO-HEADER PROMOTION (The "Bold Title" Fix)
  // Detects lines that look like titles (Short, Capitalized, No period at end)
  // Examples: "Matter", "Area of a Circle", "Quadratic Formula"
  // Converts them to: ### Matter
  processed = processed.replace(/^\s*(\**[A-Z][a-zA-Z0-9\s\-\(\)'"]{2,50}\**):?\s*$/gm, '\n\n### $1\n\n');

  // 5. Cleanup extra newlines created by step 4
  processed = processed.replace(/\n{3,}/g, '\n\n');

  return processed;
};

// --- MAIN COMPONENT ---
const AIResponse = ({ content }: { content: string }) => {
  const cleanedContent = useMemo(() => preprocessContent(content), [content]);

  return (
    <div className="no-drag selectable w-full max-w-none text-left">
      <ReactMarkdown
        remarkPlugins={[remarkMath]}
        rehypePlugins={[
          [rehypeKatex, katexOptions] as any,
          rehypeHighlight as any
        ]}
        components={{
          code: CodeBlock,
          p: ({children}) => (
            <p className="mb-4 leading-7 text-gray-300 last:mb-0 relative">
              {children}
            </p>
          ),
        }}
        className="prose prose-invert prose-sm max-w-none
          
          /* --- FIX: HIDE DUPLICATE MATH --- */
          /* This hides the accessible text that causes the 'A=πr2A=...' glitch */
          [&_.katex-mathml]:hidden

          /* --- MATH STYLING --- */
          [&_.katex]:text-[1.2em] 
          [&_.katex]:text-[#e5e7eb] 
          [&_.katex]:font-normal
          
          /* Display Math Box */
          [&_.katex-display]:my-6
          [&_.katex-display]:py-4
          [&_.katex-display]:px-6
          [&_.katex-display]:bg-white/5
          [&_.katex-display]:rounded-xl
          [&_.katex-display]:overflow-x-auto
          [&_.katex-display]:flex
          [&_.katex-display]:justify-center
          
          /* Inline Math Padding */
          [&_.katex-html]:px-1
          
          /* --- BOLD HEADER STYLING (The Highlighted Look) --- */
          prose-headings:text-blue-300
          prose-headings:font-extrabold 
          prose-headings:text-xl
          prose-headings:tracking-tight
          prose-headings:mb-3 
          prose-headings:mt-8
          
          /* --- GENERAL --- */
          prose-p:text-gray-300 prose-p:leading-relaxed prose-p:mb-4
          prose-strong:text-white prose-strong:font-bold
          prose-ul:my-4 prose-ul:list-disc prose-ul:pl-4
          prose-li:text-gray-300 prose-li:my-2
          prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline"
      >
        {cleanedContent}
      </ReactMarkdown>
    </div>
  );
};

export default AIResponse;