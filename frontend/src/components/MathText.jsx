import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

// Renders text that may contain \( ... \) or $ ... $ LaTeX segments
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
          const formula = part.replace(/^\\\(|\\\)$|^\$|\$$/g, "");
          try {
            return <InlineMath key={i} math={formula} />;
          } catch {
            return <span key={i}>{part}</span>;
          }
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
