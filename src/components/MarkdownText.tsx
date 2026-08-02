import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type MarkdownTextProps = {
  content: string;
  className?: string;
};

export function MarkdownText({ content, className }: MarkdownTextProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      className={className}
      components={{
        a: ({ node, ...props }: any) => (
          <a
            {...props}
            className="text-bridge underline decoration-2 underline-offset-2"
            target="_blank"
            rel="noreferrer"
          />
        ),
        code: ({ inline, className: codeClassName, children, ...props }: any) =>
          inline ? (
            <code
              className="rounded bg-[#f3f4f6] px-1 py-[0.1rem] font-mono text-sm"
              {...props}
            >
              {children}
            </code>
          ) : (
            <pre className={`rounded bg-[#f7f7f7] p-3 overflow-x-auto ${codeClassName ?? ""}`}>
              <code {...props}>{children}</code>
            </pre>
          ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
