import { useState } from "react";
import { useNavigate } from "react-router-dom";

const levels = [
  {
    level: "100",
    title: "Build the foundation",
    detail: "Core science, maths, and introductory engineering courses.",
  },
  {
    level: "200",
    title: "Develop your practice",
    detail: "Departmental courses, problem solving, and deeper applications.",
  },
  {
    level: "300",
    title: "Go further",
    detail: "Advanced courses for your current academic stage.",
  },
];

export default function StudyDeck() {
  const navigate = useNavigate();
  const [selectedLevel, setSelectedLevel] = useState("100");
  const selected = levels.find((item) => item.level === selectedLevel);

  function chooseLevel(level) {
    setSelectedLevel(level);
  }

  function openLevel() {
    navigate(`/level/${selectedLevel}`);
  }

  return (
    <section className="study-deck" aria-labelledby="study-deck-title">
      <div className="study-deck-copy">
        <p className="swift-eyebrow">Your study space</p>
        <h2 id="study-deck-title">What are you studying now?</h2>
        <p className="study-deck-description">
          Start from your level, then open a course, its materials, and the
          practice available for it.
        </p>

        <div className="level-selector" role="group" aria-label="Choose a level">
          {levels.map((item) => (
            <button
              key={item.level}
              type="button"
              onClick={() => chooseLevel(item.level)}
              className={`level-selector-button ${
                selectedLevel === item.level ? "is-selected" : ""
              }`}
            >
              {item.level} Level
            </button>
          ))}
        </div>

        <button type="button" className="swift-primary-button" onClick={openLevel}>
          Open {selectedLevel} Level
          <span aria-hidden="true">→</span>
        </button>
      </div>

      <div className="deck-stage" aria-live="polite">
        <div className={`deck-stack level-${selectedLevel}`}>
          {levels.map((item, index) => (
            <button
              key={item.level}
              type="button"
              onClick={() => chooseLevel(item.level)}
              className={`deck-card deck-card-${index + 1} ${
                selectedLevel === item.level ? "is-selected" : ""
              }`}
              aria-label={`Select ${item.level} Level`}
            >
              <span className="deck-card-kicker">{item.level} Level</span>
              <strong>{item.title}</strong>
              <span>{item.detail}</span>
            </button>
          ))}
        </div>

        <p className="deck-caption">
          Selected: <strong>{selected.level} Level</strong>
        </p>
      </div>
    </section>
  );
}
