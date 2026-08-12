import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

export default function MathText({ text }) {
  if (!text) return null;

  const parts = text.split(/(\\\(.*?\\\)|\$.*?\$)/g);

  return (
    <>
      {parts.map((part, i) => {
        const isMath =
          (part.startsWith("\\(") && part.endsWith("\\)")) ||
          (part.startsWith("$") && part.endsWith("$"));
        if (isMath) {
          const formula = part.replace(/^\\\(|\\\)$|^\$|\$$/g, "").trim();
          if (!formula) return null;
          return (
            <InlineMath
              key={i}
              math={formula}
              renderError={() => (
                <span className="text-gray-400">{formula}</span>
              )}
              settings={{ throwOnError: false, strict: false }}
            />
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
