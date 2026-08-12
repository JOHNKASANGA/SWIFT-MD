import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

// Detects if a string contains LaTeX-like syntax even without \( \) or $ $ delimiters
function looksLikeLatex(text) {
  return /\\[a-zA-Z]+|[_^]\{?[a-zA-Z0-9]/.test(text);
}

function renderFormula(formula, key) {
  if (!formula.trim()) return null;
  return (
    <InlineMath
      key={key}
      math={formula}
      throwOnError={false}
      strict={false}
      renderError={(error) => {
        console.error("KaTeX render error for formula:", formula, error);
        return <span className="text-gray-400">{formula}</span>;
      }}
    />
  );
}

export default function MathText({ text }) {
  if (!text) return null;

  const parts = text.split(/(\\\(.*?\\\)|\$.*?\$)/g);
  const hasDelimitedMath = parts.some(
    (part) =>
      (part.startsWith("\\(") && part.endsWith("\\)")) ||
      (part.startsWith("$") && part.endsWith("$"))
  );

  // No explicit \( \) or $ $ delimiters found anywhere in the string.
  // If the whole thing still looks like raw LaTeX (e.g. option fragments
  // like "\sum x_i = 0"), render the entire string as one math expression.
  if (!hasDelimitedMath && looksLikeLatex(text)) {
    return renderFormula(text.trim(), "whole");
  }

  return (
    <>
      {parts.map((part, i) => {
        const isMath =
          (part.startsWith("\\(") && part.endsWith("\\)")) ||
          (part.startsWith("$") && part.endsWith("$"));
        if (isMath) {
          const formula = part.replace(/^\\\(|\\\)$|^\$|\$$/g, "").trim();
          return renderFormula(formula, i);
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
