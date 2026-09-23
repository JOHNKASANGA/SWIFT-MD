import { InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

const MATH_SEGMENT_PATTERN =
  /(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\)|\$\$[\s\S]*?\$\$|\$[^\n$]+?\$)/g;

function getMathSegment(part) {
  if (part.startsWith("\\[") && part.endsWith("\\]")) {
    return {
      display: true,
      formula: part.slice(2, -2).trim(),
    };
  }

  if (part.startsWith("\\(") && part.endsWith("\\)")) {
    return {
      display: false,
      formula: part.slice(2, -2).trim(),
    };
  }

  if (part.startsWith("$$") && part.endsWith("$$")) {
    return {
      display: true,
      formula: part.slice(2, -2).trim(),
    };
  }

  if (part.startsWith("$") && part.endsWith("$")) {
    return {
      display: false,
      formula: part.slice(1, -1).trim(),
    };
  }

  return null;
}

function MathFallback({ formula }) {
  return (
    <code className="math-text-fallback" title="This formula could not be rendered">
      {formula}
    </code>
  );
}

export default function MathText({ text }) {
  if (text === null || text === undefined || text === "") return null;

  const parts = String(text).split(MATH_SEGMENT_PATTERN);

  return (
    <span className="math-text">
      {parts.map((part, index) => {
        if (!part) return null;

        const segment = getMathSegment(part);

        if (!segment) {
          return <span key={index}>{part}</span>;
        }

        if (!segment.formula) {
          return <MathFallback key={index} formula={part} />;
        }

        const math = (
          <InlineMath
            math={segment.formula}
            throwOnError
            strict="ignore"
            renderError={() => <MathFallback formula={segment.formula} />}
          />
        );

        if (segment.display) {
          return (
            <span key={index} className="math-text-display">
              {math}
            </span>
          );
        }

        return (
          <span key={index} className="math-text-inline">
            {math}
          </span>
        );
      })}
    </span>
  );
}
