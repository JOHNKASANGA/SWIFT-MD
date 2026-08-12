const SYMBOLS = [
  { label: "x²", insert: "^2" },
  { label: "x³", insert: "^3" },
  { label: "xⁿ", insert: "^" },
  { label: "√", insert: "√" },
  { label: "π", insert: "π" },
  { label: "Σ", insert: "Σ" },
  { label: "±", insert: "±" },
  { label: "≤", insert: "≤" },
  { label: "≥", insert: "≥" },
  { label: "≠", insert: "≠" },
  { label: "∞", insert: "∞" },
  { label: "÷", insert: "÷" },
  { label: "×", insert: "×" },
  { label: "α", insert: "α" },
  { label: "β", insert: "β" },
  { label: "θ", insert: "θ" },
  { label: "μ", insert: "μ" },
  { label: "σ", insert: "σ" },
  { label: "Δ", insert: "Δ" },
  { label: "∑", insert: "∑" },
];

export default function MathToolbar({ onInsert }) {
  return (
    <div className="flex flex-wrap gap-2 mb-3 p-2 bg-gray-900 border border-gray-800 rounded-xl">
      {SYMBOLS.map((s) => (
        <button
          key={s.label}
          type="button"
          onClick={() => onInsert(s.insert)}
          className="bg-gray-800 hover:bg-gray-700 text-white text-sm font-bold px-3 py-1.5 rounded-lg transition-colors"
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
