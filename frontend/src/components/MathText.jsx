import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

// Data reaching this component should already have ALL LaTeX wrapped in
// clean $...$ delimiters (normalized upstream when the question bank was
// built). This component only needs to split on those delimiters and
// render each math segment - no guessing about raw/undelimited LaTeX.
export default function MathText({ text }) {
  if (!text) return null;

  const parts = text.split(/(\\\(.*?\\\)|\$.*?\$)/g);

  return (
    <>
      {parts.map((part, i) => {
        const isDelimited =
          (part.startsWith("\\(") && part.endsWith("\\)")) ||
          (part.startsWith("$") && part.endsWith("$") && part.length > 1);

        if (!isDelimited) {
          return part ? <span key={i}>{part}</span> : null;
        }

        const formula = part.replace(/^\\\(|\\\)$|^\$|\$$/g, "").trim();
        if (!formula) return null;

        return (
          <InlineMath
            key={i}
            math={formula}
            throwOnError={false}
            strict={false}
            renderError={(error) => {
              console.error("KaTeX render error for formula:", formula, error);
              return <span className="text-gray-400">{formula}</span>;
            }}
          />
        );
      })}
    </>
  );
}
