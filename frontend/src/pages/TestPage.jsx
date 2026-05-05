import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import AnimatedBackground from "../components/AnimatedBackground";

export default function TestPage() {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const [mode, setMode] = useState(null);
  const [numQuestions, setNumQuestions] = useState(10);
  const [cachedMCQ, setCachedMCQ] = useState(null);
  const [cachedGerman, setCachedGerman] = useState(null);

  if (!mode) {
    return (
      <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-12"
        >
          <button
            onClick={() => navigate(-1)}
            className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
          >
            ← Back
          </button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <h1 className="text-white font-black text-3xl mb-2">Test Yourself</h1>
          <p className="text-gray-500 text-sm">Choose a quiz mode to begin.</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-3">
            Number of Questions
          </p>
          <div className="flex gap-3">
            {[5, 10, 20, 50].map((n) => (
              <button
                key={n}
                onClick={() => {
                  setNumQuestions(n);
                  setCachedMCQ(null);
                  setCachedGerman(null);
                }}
                className={`px-4 py-2 rounded-xl text-sm font-black transition-colors ${
                  numQuestions === n
                    ? "bg-white text-gray-950"
                    : "bg-gray-900 border border-gray-800 text-gray-400 hover:border-gray-600"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col gap-4"
        >
          <button
            onClick={() => setMode("mcq")}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-gray-600 transition-colors"
          >
            <p className="text-white font-black text-lg mb-1">MCQ</p>
            <p className="text-gray-500 text-sm">
              Multiple choice questions generated from your material.
            </p>
          </button>

          <button
            onClick={() => setMode("german")}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-gray-600 transition-colors"
          >
            <p className="text-white font-black text-lg mb-1">
              Fill in the Blank
            </p>
            <p className="text-gray-500 text-sm">
              Recall answers from memory. No options given.
            </p>
          </button>

          <button
            onClick={() => setMode("theory")}
            className="bg-gray-900 border border-gray-800 rounded-2xl p-6 text-left hover:border-gray-600 transition-colors"
          >
            <p className="text-white font-black text-lg mb-1">Theory</p>
            <p className="text-gray-500 text-sm">
              Write your answer. AI grades and gives feedback.
            </p>
          </button>
        </motion.div>
      </div>
    );
  }

  if (mode === "mcq")
    return (
      <MCQQuiz
        materialId={materialId}
        onBack={() => setMode(null)}
        numQuestions={numQuestions}
        cachedQuestions={cachedMCQ}
        onCache={setCachedMCQ}
      />
    );
  if (mode === "german")
    return (
      <GermanQuiz
        materialId={materialId}
        onBack={() => setMode(null)}
        numQuestions={numQuestions}
        cachedQuestions={cachedGerman}
        onCache={setCachedGerman}
      />
    );
  if (mode === "theory")
    return <TheoryQuiz materialId={materialId} onBack={() => setMode(null)} />;
}

// ─── MCQ Quiz ────────────────────────────────────────────────────────────────

function MCQQuiz({
  materialId,
  onBack,
  numQuestions,
  cachedQuestions,
  onCache,
}) {
  const [questions, setQuestions] = useState(cachedQuestions || []);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(!cachedQuestions);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useState(() => {
    if (cachedQuestions) return;
    async function fetchQuestions() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/generate-mcq`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              material_id: parseInt(materialId),
              num_questions: numQuestions,
            }),
          },
        );
        const data = await res.json();
        setQuestions(data.quiz.questions);
        onCache(data.quiz.questions);
      } catch {
        setError("Failed to generate questions. Try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, []);

  function handleSelect(option) {
    if (selected) return;
    setSelected(option);
  }

  function handleNext() {
    const newAnswers = [
      ...answers,
      {
        question: questions[current].question,
        selected,
        correct: questions[current].correct_answer,
        isCorrect: selected === questions[current].correct_answer,
      },
    ];
    setAnswers(newAnswers);

    if (current + 1 >= questions.length) {
      setDone(true);
    } else {
      setCurrent(current + 1);
      setSelected(null);
    }
  }

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} onBack={onBack} />;

  if (done) {
    const score = answers.filter((a) => a.isCorrect).length;
    return (
      <ResultsScreen
        score={score}
        total={questions.length}
        answers={answers}
        onBack={onBack}
        showCorrect
      />
    );
  }

  const q = questions[current];

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-12">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
        >
          ← Back
        </button>
        <span className="text-gray-500 text-sm font-bold">
          {current + 1} / {questions.length}
        </span>
      </div>

      <motion.div
        key={current}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8"
      >
        <p className="text-white font-black text-xl mb-6">{q.question}</p>
        <div className="flex flex-col gap-3">
          {Object.entries(q.options).map(([key, value]) => {
            let style = "bg-gray-900 border border-gray-800 text-white";
            if (selected) {
              if (key === q.correct_answer)
                style = "bg-green-900 border border-green-600 text-white";
              else if (key === selected)
                style = "bg-red-900 border border-red-600 text-white";
              else style = "bg-gray-900 border border-gray-800 text-gray-600";
            }
            return (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className={`${style} rounded-xl px-5 py-4 text-left text-sm font-bold transition-colors`}
              >
                <span className="text-gray-400 mr-3">{key}.</span>
                {value}
              </button>
            );
          })}
        </div>

        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 p-4 bg-gray-900 border border-gray-800 rounded-xl"
          >
            <p className="text-gray-400 text-xs">{q.explanation}</p>
          </motion.div>
        )}
      </motion.div>

      {selected && (
        <button
          onClick={handleNext}
          className="w-full bg-white text-gray-950 font-black py-3 rounded-xl hover:bg-gray-200 transition-colors"
        >
          {current + 1 >= questions.length ? "See Results" : "Next Question"}
        </button>
      )}
    </div>
  );
}

// ─── German Quiz ─────────────────────────────────────────────────────────────

function GermanQuiz({
  materialId,
  onBack,
  numQuestions,
  cachedQuestions,
  onCache,
}) {
  const [questions, setQuestions] = useState(cachedQuestions || []);
  const [current, setCurrent] = useState(0);
  const [input, setInput] = useState("");
  const [checked, setChecked] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(!cachedQuestions);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useState(() => {
    if (cachedQuestions) return;
    async function fetchQuestions() {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/generate-german-quiz`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              material_id: parseInt(materialId),
              num_questions: numQuestions,
            }),
          },
        );
        const data = await res.json();
        setQuestions(data.quiz.questions);
        onCache(data.quiz.questions);
      } catch {
        setError("Failed to generate questions. Try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchQuestions();
  }, []);

  function handleCheck() {
    const q = questions[current];
    const acceptable = [q.correct_answer, ...(q.acceptable_answers || [])];
    const correct = acceptable.some(
      (a) => a.toLowerCase().trim() === input.toLowerCase().trim(),
    );
    setIsCorrect(correct);
    setChecked(true);
  }

  function handleNext() {
    const newAnswers = [
      ...answers,
      {
        question: questions[current].question,
        input,
        correct: questions[current].correct_answer,
        isCorrect,
      },
    ];
    setAnswers(newAnswers);

    if (current + 1 >= questions.length) {
      setDone(true);
    } else {
      setCurrent(current + 1);
      setInput("");
      setChecked(false);
      setIsCorrect(false);
    }
  }

  if (loading) return <LoadingScreen />;
  if (error) return <ErrorScreen message={error} onBack={onBack} />;

  if (done) {
    const score = answers.filter((a) => a.isCorrect).length;
    return (
      <ResultsScreen
        score={score}
        total={questions.length}
        answers={answers}
        onBack={onBack}
        showCorrect
      />
    );
  }

  const q = questions[current];

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-12">
        <button
          onClick={onBack}
          className="text-gray-500 hover:text-white text-sm font-bold transition-colors"
        >
          ← Back
        </button>
        <span className="text-gray-500 text-sm font-bold">
          {current + 1} / {questions.length}
        </span>
      </div>

      <motion.div
        key={current}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        className="mb-8"
      >
        <p className="text-white font-black text-xl mb-2">{q.question}</p>
        {q.hint && <p className="text-gray-500 text-xs mb-6">Hint: {q.hint}</p>}

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={checked}
          placeholder="Type your answer..."
          className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors"
        />

        {checked && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`mt-4 p-4 rounded-xl border ${isCorrect ? "bg-green-900 border-green-600" : "bg-red-900 border-red-600"}`}
          >
            <p className="text-white text-xs font-bold mb-1">
              {isCorrect ? "Correct!" : `Wrong. Answer: ${q.correct_answer}`}
            </p>
            <p className="text-gray-300 text-xs">{q.explanation}</p>
          </motion.div>
        )}
      </motion.div>

      {!checked ? (
        <button
          onClick={handleCheck}
          disabled={!input.trim()}
          className="w-full bg-white text-gray-950 font-black py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-30"
        >
          Check Answer
        </button>
      ) : (
        <button
          onClick={handleNext}
          className="w-full bg-white text-gray-950 font-black py-3 rounded-xl hover:bg-gray-200 transition-colors"
        >
          {current + 1 >= questions.length ? "See Results" : "Next Question"}
        </button>
      )}
    </div>
  );
}

// ─── Theory Quiz ─────────────────────────────────────────────────────────────

function TheoryQuiz({ materialId, onBack }) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!answer.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/grade-theory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ material_id: parseInt(materialId), answer }),
        },
      );
      const data = await res.json();
      setResult(data.grading);
    } catch {
      setError("Failed to grade. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">
        <button
          onClick={() => {
            setResult(null);
            setAnswer("");
          }}
          className="text-gray-500 hover:text-white text-sm font-bold transition-colors mb-12"
        >
          ← Try Again
        </button>

        <div className="mb-6">
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">
            Your Score
          </p>
          <p className="text-white font-black text-5xl">
            {result.score}
            <span className="text-gray-500 text-2xl">/{result.max_score}</span>
          </p>
          <p className="text-gray-400 text-sm mt-1">Grade: {result.grade}</p>
        </div>

        <div className="flex flex-col gap-4">
          {result.feedback.strengths?.length > 0 && (
            <div className="bg-green-900 border border-green-700 rounded-2xl p-5">
              <p className="text-green-400 text-xs font-bold uppercase tracking-widest mb-3">
                Strengths
              </p>
              {result.feedback.strengths.map((s, i) => (
                <p key={i} className="text-white text-sm mb-1">
                  • {s}
                </p>
              ))}
            </div>
          )}

          {result.feedback.weaknesses?.length > 0 && (
            <div className="bg-red-900 border border-red-700 rounded-2xl p-5">
              <p className="text-red-400 text-xs font-bold uppercase tracking-widest mb-3">
                Weaknesses
              </p>
              {result.feedback.weaknesses.map((w, i) => (
                <p key={i} className="text-white text-sm mb-1">
                  • {w}
                </p>
              ))}
            </div>
          )}

          {result.feedback.suggestion && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">
                Suggestion
              </p>
              <p className="text-white text-sm">{result.feedback.suggestion}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="text-gray-500 hover:text-white text-sm font-bold transition-colors mb-12"
      >
        ← Back
      </button>

      <h1 className="text-white font-black text-2xl mb-2">Theory Answer</h1>
      <p className="text-gray-500 text-sm mb-8">
        Write everything you know about this material. AI will grade your
        response.
      </p>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Write your answer here..."
        rows={10}
        className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition-colors resize-none mb-6"
      />

      {error && <p className="text-red-400 text-xs font-bold mb-4">{error}</p>}

      <button
        onClick={handleSubmit}
        disabled={loading || !answer.trim()}
        className="w-full bg-white text-gray-950 font-black py-3 rounded-xl hover:bg-gray-200 transition-colors disabled:opacity-30"
      >
        {loading ? "Grading..." : "Submit for Grading"}
      </button>
    </div>
  );
}

// ─── Shared Components ────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-3">
      <p className="text-gray-500 text-sm font-bold animate-pulse">
        Generating questions...
      </p>
      <p className="text-gray-700 text-xs">This may take 20–30 seconds</p>
    </div>
  );
}

function ErrorScreen({ message, onBack }) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4">
      <p className="text-red-400 text-sm">{message}</p>
      <button
        onClick={onBack}
        className="text-white text-sm font-bold underline"
      >
        Go Back
      </button>
    </div>
  );
}

function ResultsScreen({ score, total, answers, onBack, showCorrect }) {
  const percentage = Math.round((score / total) * 100);
  return (
    <div className="min-h-screen bg-gray-950 px-6 py-10 max-w-2xl mx-auto">
      <button
        onClick={onBack}
        className="text-gray-500 hover:text-white text-sm font-bold transition-colors mb-12"
      >
        ← Try Again
      </button>

      <div className="mb-8">
        <p className="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">
          Results
        </p>
        <p className="text-white font-black text-5xl">
          {score}
          <span className="text-gray-500 text-2xl">/{total}</span>
        </p>
        <p className="text-gray-400 text-sm mt-1">{percentage}% correct</p>
      </div>

      <div className="flex flex-col gap-3">
        {answers.map((a, i) => (
          <div
            key={i}
            className={`rounded-xl p-4 border ${a.isCorrect ? "bg-green-900 border-green-700" : "bg-red-900 border-red-700"}`}
          >
            <p className="text-white text-sm font-bold mb-1">{a.question}</p>
            <p className="text-gray-300 text-xs">
              Your answer: {a.selected || a.input}
            </p>
            {!a.isCorrect && showCorrect && (
              <p className="text-green-400 text-xs">Correct: {a.correct}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
