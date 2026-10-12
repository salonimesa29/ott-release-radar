import { Fragment } from "react";

/**
 * Renders our own Telegram HTML (only <b>, <i>, <a href>) as React elements — no
 * dangerouslySetInnerHTML. Entities are decoded; anything else stays plain text.
 */
export function TelegramMessage({ html }: { html: string }) {
  const tokens = html.split(/(<b>|<\/b>|<i>|<\/i>|<a href="[^"]*">|<\/a>)/);
  const out: React.ReactNode[] = [];
  const stack: { tag: "b" | "i" | "a"; href?: string; children: React.ReactNode[] }[] = [];
  const push = (n: React.ReactNode) => (stack.length ? stack[stack.length - 1].children : out).push(n);

  tokens.forEach((tok, i) => {
    if (tok === "<b>" || tok === "<i>") stack.push({ tag: tok[1] as "b" | "i", children: [] });
    else if (tok.startsWith("<a href=")) stack.push({ tag: "a", href: decode(tok.slice(9, -2)), children: [] });
    else if (tok === "</b>" || tok === "</i>" || tok === "</a>") {
      const top = stack.pop();
      if (!top) return;
      const el =
        top.tag === "b" ? <strong key={i}>{top.children}</strong> : top.tag === "i" ? <em key={i}>{top.children}</em> : (
          <a key={i} href={top.href} target="_blank" rel="noreferrer" className="text-cyan underline">{top.children}</a>
        );
      push(el);
    } else if (tok) push(<Fragment key={i}>{decode(tok)}</Fragment>);
  });
  return <div className="whitespace-pre-wrap break-words text-[13px] leading-relaxed">{out}</div>;
}

const decode = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** Telegram-style chat bubble. */
export function TelegramBubble({ html }: { html: string }) {
  return (
    <div className="max-w-full rounded-2xl rounded-tl-sm border border-white/5 bg-[#182533] px-4 py-3 text-[#e9eef3] shadow-lg">
      <TelegramMessage html={html} />
    </div>
  );
}
