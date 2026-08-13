import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

// Characters that essentially never appear in plain English words but are
// near-universal in raw (undelimited) LaTeX fragments like "mR\,dT" or "C_v".
const MATH_TOKEN_PATTERN = /[\\_^=]/;

function isMathToken(token) {
  return MATH_TOKEN_PATTERN.test(token);
}

function renderFormula(formula, key) {
  const trimmed = formula.trim();
  if (!trimmed) return null;
  return (
    <InlineMath
      key={key}
      math={trimmed}
      throwOnError={false}
      strict={false}
      renderError={(error) => {
        console.error("KaTeX render error for formula:", trimmed, error);
        return <span className="text-gray-400">{trimmed}</span>;
      }}
    />
  );
}

// Renders a plain-text segment (no explicit \( \) or $ $ delimiters found),
// but which may still contain raw, undelimited LaTeX fragments mixed with
// English words — e.g. "because d(PV)=mR\,dT for an ideal gas, so mC_v\,dT...".
// Splits on whitespace, merges consecutive math-looking tokens into one
// KaTeX expression, and leaves everything else as plain text.
function renderMixedSegment(text, keyPrefix) {
  const words = text.split(/(\s+)/); // keep the whitespace separators
  const output = [];
  let mathBuffer = [];
  let key = 0;

  function flushMathBuffer() {
    if (mathBuffer.length > 0) {
      const formula = mathBuffer.join("");
      output.push(renderFormula(formula, `${keyPrefix}-m-${key++}`));
      mathBuffer = [];
    }
  }

  for (const word of words) {
    if (/^\s+$/.test(word) || word === "") {
      // whitespace: if we're mid math-token run, keep buffering it so
      // multi-word formulas like "m(C_v+R)dT=mC_p\,dT" stay together
      if (mathBuffer.length > 0) {
        mathBuffer.push(word);
      } else {
        output.push(<span key={`${keyPrefix}-s-${key++}`}>{word}</span>);
      }
      continue;
    }
    if (isMathToken(word)) {
      mathBuffer.push(word);
    } else {
      flushMathBuffer();
      output.push(<span key={`${keyPrefix}-w-${key++}`}>{word}</span>);
    }
  }
  flushMathBuffer();

  return output;
}

export default function MathText({ text }) {
  if (!text) return null;

  const parts = text.split(/(\\\(.*?\\\)|\$.*?\$)/g);

  return (
    <>
      {parts.map((part, i) => {
        const isDelimited =
          (part.startsWith("\\(") && part.endsWith("\\)")) ||
          (part.startsWith("$") && part.endsWith("$"));

        if (isDelimited) {
          const formula = part.replace(/^\\\(|\\\)$|^\$|\$$/g, "");
          return renderFormula(formula, i);
        }

        if (!part) return null;

        return <span key={i}>{renderMixedSegment(part, `seg${i}`)}</span>;
      })}
    </>
  );
}
