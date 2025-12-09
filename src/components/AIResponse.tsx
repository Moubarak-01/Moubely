import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';     // 👈 Detects math ($$)
import rehypeKatex from 'rehype-katex';   // 👈 Renders math
import { Check, Copy, Terminal } from 'lucide-react';
import 'highlight.js/styles/atom-one-dark.css';

// --- CUSTOM CODE BLOCK COMPONENT ---
// (No changes here, keeping your existing code)
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

// --- MAIN COMPONENT ---
const AIResponse = ({ content }: { content: string }) => {
  return (
    <div className="no-drag selectable w-full max-w-none text-left">
      <ReactMarkdown
        // 1. Parse the math syntax
        remarkPlugins={[remarkMath]}
        // 2. Render the math (Katex) and Highlight code
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={{
          code: CodeBlock,
          // Custom paragraph to make sure text around math looks good
          p: ({children}) => <p className="mb-4 leading-7 text-gray-300 last:mb-0">{children}</p>,
        }}
        className="prose prose-invert prose-sm max-w-none
          /* MATH STYLING OVERRIDES */
          [&_.katex]:text-base [&_.katex]:font-serif [&_.katex-display]:my-4
          
          /* YOUR EXISTING STYLES */
          prose-p:text-gray-300 prose-p:leading-7 prose-p:mb-4
          prose-headings:text-white prose-headings:font-medium prose-headings:mb-3 prose-headings:mt-6
          prose-strong:text-white prose-strong:font-semibold
          prose-ul:my-4 prose-ul:list-disc prose-ul:pl-4
          prose-li:text-gray-300 prose-li:my-1
          prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline"
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default AIResponse;