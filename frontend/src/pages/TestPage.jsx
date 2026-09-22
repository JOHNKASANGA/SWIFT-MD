import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import MathText from "../components/MathText";
import MathToolbar from "../components/MathToolbar";

const TIMER_OPTIONS = [
  { label: "No timer", value: 0 },
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "60 min", value: 60 },
];

export default function TestPage() {
  const { courseCode: rawCourseCode } = useParams();
  const courseCode = decodeURIComponent(rawCourseCode);
  const navigate = useNavigate();
  const [mode, setMode] = useState(null);
  const [attemptMode, setAttemptMode] = useState("practice");
  const [numQuestions, setNumQuestions] = useState(10);
  const [timerMinutes, setTimerMinutes] = useState(0);
  const [cachedMCQ, setCachedMCQ] = useState(null);
  const [cachedGerman, setCachedGerman] = useState(null);

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/");
  }

  if (!mode) {
    return (
      <div className="quiz-setup-page">
        <QuizSetupHeader
          courseCode={courseCode}
          onExit={() => navigate(-1)}
          onSignOut={handleSignOut}
        />

        <main className="quiz-setup-main">
          <section className="quiz-setup-intro">
            <p className="swift-eyebrow">Curated questions</p>
            <h1>Set up your session.</h1>
            <p>
              Choose a question type and how you want to work. You can jump to
              any question once you begin.
            </p>
          </section>

          <section className="quiz-setup-section">
            <p className="quiz-setup-label">How do you want to work?</p>
            <div className="quiz-option-row">
              <button
                type="button"
                className={
                  attemptMode === "practice"
                    ? "quiz-choice-button is-selected"
                    : "quiz-choice-button"
                }
                onClick={() => setAttemptMode("practice")}
              >
                Practice
              </button>
              <button
                type="button"
                className={
                  attemptMode === "test"
                    ? "quiz-choice-button is-selected"
                    : "quiz-choice-button"
                }
                onClick={() => setAttemptMode("test")}
              >
                Test
              </button>
            </div>
            <p className="quiz-setup-hint">
              {attemptMode === "practice"
                ? "Practice reveals correctness and explanations as you work."
                : "Test keeps correctness and explanations hidden until you submit."}
            </p>
          </section>

          <section className="quiz-setup-section">
            <p className="quiz-setup-label">Number of questions</p>
            <div className="quiz-option-row">
              {[5, 10, 20, 50].map((count) => (
                <button
                  key={count}
                  type="button"
                  className={
                    numQuestions === count
                      ? "quiz-choice-button is-selected"
                      : "quiz-choice-button"
                  }
                  onClick={() => {
                    setNumQuestions(count);
                    setCachedMCQ(null);
                    setCachedGerman(null);
                  }}
                >
                  {count}
                </button>
              ))}
            </div>
          </section>

          <section className="quiz-setup-section">
            <p className="quiz-setup-label">Countdown timer</p>
            <div className="quiz-option-row">
              {TIMER_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    timerMinutes === option.value
                      ? "quiz-choice-button is-selected"
                      : "quiz-choice-button"
                  }
                  onClick={() => setTimerMinutes(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="quiz-setup-hint">
              A timer is optional. When it ends, Swift submits the quiz with
              whatever you have answered.
            </p>
          </section>

          <section className="quiz-mode-grid">
            <button
              type="button"
              className="quiz-mode-card"
              onClick={() => setMode("mcq")}
            >
              <span>01</span>
              <strong>Multiple choice</strong>
              <p>Select one answer, see feedback, and review every question.</p>
              <small>Start MCQ →</small>
            </button>

            <button
              type="button"
              className="quiz-mode-card"
              onClick={() => setMode("german")}
            >
              <span>02</span>
              <strong>Fill in the blank</strong>
              <p>Recall key terms, formulas, and concepts without options.</p>
              <small>Start recall quiz →</small>
            </button>

            <button
              type="button"
              className="quiz-mode-card quiz-mode-card-theory"
              onClick={() => setMode("theory")}
            >
              <span>03</span>
              <strong>Theory practice</strong>
              <p>Write longer answers and receive the current feedback flow.</p>
              <small>Open theory →</small>
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (mode === "mcq") {
    return (
      <MCQQuiz
        courseCode={courseCode}
        numQuestions={numQuestions}
        timerMinutes={timerMinutes}
        cachedQuestions={cachedMCQ}
        onCache={setCachedMCQ}
        attemptMode={attemptMode}
        onExit={() => setMode(null)}
      />
    );
  }

  if (mode === "german") {
    return (
      <GermanQuiz
        courseCode={courseCode}
        numQuestions={numQuestions}
        timerMinutes={timerMinutes}
        cachedQuestions={cachedGerman}
        onCache={setCachedGerman}
        attemptMode={attemptMode}
        onExit={() => setMode(null)}
      />
    );
  }

  return <TheoryQuiz courseCode={courseCode} onExit={() => setMode(null)} />;
}

function QuizSetupHeader({ courseCode, onExit, onSignOut }) {
  return (
    <header className="quiz-focus-header">
      <button type="button" className="swift-brand" onClick={onExit}>
        <span className="swift-brand-mark">S</span>
        <span>Swift</span>
      </button>

      <p>{courseCode}</p>

      <button type="button" className="quiz-exit-button" onClick={onSignOut}>
        Sign out
      </button>
    </header>
  );
}

function QuizTimer({ minutes, onExpire }) {
  const [remainingSeconds, setRemainingSeconds] = useState(minutes * 60);
  const expiredRef = useRef(false);
  const expireCallbackRef = useRef(onExpire);

  useEffect(() => {
    expireCallbackRef.current = onExpire;
  }, [onExpire]);

  useEffect(() => {
    if (!minutes) return undefined;

    expiredRef.current = false;
    const deadline = Date.now() + minutes * 60 * 1000;

    function updateTime() {
      const nextRemaining = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1000)
      );

      setRemainingSeconds(nextRemaining);

      if (nextRemaining === 0 && !expiredRef.current) {
        expiredRef.current = true;
        expireCallbackRef.current();
      }
    }

    updateTime();
    const interval = setInterval(updateTime, 500);

    return () => clearInterval(interval);
  }, [minutes]);

  if (!minutes) return null;

  const minutesLeft = Math.floor(remainingSeconds / 60);
  const secondsLeft = remainingSeconds % 60;
  const isLow = remainingSeconds <= 60;

  return (
    <span className={isLow ? "quiz-timer is-low" : "quiz-timer"}>
      {String(minutesLeft).padStart(2, "0")}:{String(secondsLeft).padStart(2, "0")}
    </span>
  );
}

function QuestionNavigator({
  total,
  current,
  isAnswered,
  flagged,
  onJump,
  onToggleFlag,
}) {
  return (
    <section className="question-navigator" aria-label="Question navigator">
      <div className="question-navigator-heading">
        <p>Questions</p>
        <button type="button" onClick={() => onToggleFlag(current)}>
          {flagged[current] ? "Remove flag" : "Flag for review"}
        </button>
      </div>

      <div className="question-grid">
        {Array.from({ length: total }, (_, index) => {
          const classes = [
            "question-grid-button",
            current === index ? "is-current" : "",
            isAnswered(index) ? "is-answered" : "",
            flagged[index] ? "is-flagged" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <button
              key={index}
              type="button"
              className={classes}
              onClick={() => onJump(index)}
              aria-label={`Go to question ${index + 1}`}
            >
              {index + 1}
            </button>
          );
        })}
      </div>

      <div className="question-key">
        <span><i className="is-current" /> Current</span>
        <span><i className="is-answered" /> Answered</span>
        <span><i className="is-flagged" /> Flagged</span>
      </div>
    </section>
  );
}

function QuizFocusHeader({ courseCode, current, total, timerMinutes, onExit, onExpire }) {
  return (
    <header className="quiz-focus-header">
      <button type="button" className="swift-brand" onClick={onExit}>
        <span className="swift-brand-mark">S</span>
        <span>Swift</span>
      </button>

      <p>
        {courseCode} <span>·</span> Question {current + 1} of {total}
      </p>

      <div className="quiz-header-right">
        <QuizTimer minutes={timerMinutes} onExpire={onExpire} />
        <button type="button" className="quiz-exit-button" onClick={onExit}>
          Exit
        </button>
      </div>
    </header>
  );
}

function MCQQuiz({
  courseCode,
  numQuestions,
  timerMinutes,
  cachedQuestions,
  onCache,
  attemptMode,
  onExit,
}) {
  const [questions, setQuestions] = useState(cachedQuestions || []);
  const [current, setCurrent] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [flagged, setFlagged] = useState({});
  const [loading, setLoading] = useState(!cachedQuestions);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (cachedQuestions) return undefined;

    let cancelled = false;

    async function fetchQuestions() {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/quiz`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_code: courseCode,
            num_questions: numQuestions,
            question_type: "mcq",
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Questions could not be loaded.");
        }

        if (!data.questions?.length) {
          throw new Error("This course does not have MCQ questions yet.");
        }

        if (!cancelled) {
          setQuestions(data.questions);
          onCache(data.questions);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message || "Questions could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQuestions();

    return () => {
      cancelled = true;
    };
  }, [cachedQuestions, courseCode, numQuestions, onCache]);

  function selectAnswer(option) {
    if (
      attemptMode === "practice" &&
      selectedAnswers[current] !== undefined
    ) {
      return;
    }

    setSelectedAnswers((answers) => ({ ...answers, [current]: option }));
  }

  function finishQuiz(wasTimedOut = false) {
    if (
      attemptMode === "test" &&
      !wasTimedOut &&
      !window.confirm(
        "Submit this test now? You will see your score and answer review after submitting."
      )
    ) {
      return;
    }

    setTimedOut(wasTimedOut);
    setDone(true);
  }

  if (loading) return <LoadingScreen label="Loading curated questions..." />;
  if (error) return <QuizError message={error} onExit={onExit} />;

  if (done) {
    const answers = questions.map((question, index) => ({
      question: question.question,
      selected: selectedAnswers[index],
      correct: question.correct_answer,
      isCorrect: selectedAnswers[index] === question.correct_answer,
    }));

    return (
      <ResultsScreen
        answers={answers}
        onExit={onExit}
        timedOut={timedOut}
        attemptMode={attemptMode}
        flaggedCount={Object.keys(flagged).filter((index) => flagged[index]).length}
      />
    );
  }

  const question = questions[current];
  const selected = selectedAnswers[current];

  return (
    <div className="quiz-page">
      <QuizFocusHeader
        courseCode={courseCode}
        current={current}
        total={questions.length}
        timerMinutes={timerMinutes}
        onExit={onExit}
        onExpire={() => finishQuiz(true)}
      />

      <main className="quiz-main">
        <section className="quiz-question-panel">
          <p className="quiz-question-label">
            {attemptMode === "test" ? "Multiple-choice test" : "Multiple-choice practice"}
          </p>
          <h1><MathText text={question.question} /></h1>

          <div className="quiz-options">
            {Object.entries(question.options).map(([key, value]) => {
              const classes = ["quiz-option"];
              if (attemptMode === "practice" && selected !== undefined) {
                if (key === question.correct_answer) classes.push("is-correct");
                else if (key === selected) classes.push("is-wrong");
                else classes.push("is-muted");
              }

              return (
                <button
                  key={key}
                  type="button"
                  className={classes.join(" ")}
                  onClick={() => selectAnswer(key)}
                  disabled={
                    attemptMode === "practice" && selected !== undefined
                  }
                >
                  <span>{key}</span>
                  <MathText text={value} />
                </button>
              );
            })}
          </div>

          {attemptMode === "practice" &&
            selected !== undefined &&
            question.explanation && (
            <div className="quiz-explanation">
              <b>{selected === question.correct_answer ? "Correct." : "Review this."}</b>
              <p>{question.explanation}</p>
            </div>
          )}

          <div className="quiz-controls">
            <button
              type="button"
              className="quiz-previous-button"
              disabled={current === 0}
              onClick={() => setCurrent((index) => Math.max(0, index - 1))}
            >
              ← Previous
            </button>

            {current < questions.length - 1 ? (
              <button
                type="button"
                className="swift-primary-button"
                onClick={() => setCurrent((index) => index + 1)}
              >
                Next question <span aria-hidden="true">→</span>
              </button>
            ) : (
              <button
                type="button"
                className="swift-primary-button"
                onClick={() => finishQuiz(false)}
              >
                {attemptMode === "test" ? "Submit test" : "Finish quiz"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </section>

        <QuestionNavigator
          total={questions.length}
          current={current}
          isAnswered={(index) => selectedAnswers[index] !== undefined}
          flagged={flagged}
          onJump={setCurrent}
          onToggleFlag={(index) =>
            setFlagged((currentFlags) => ({
              ...currentFlags,
              [index]: !currentFlags[index],
            }))
          }
        />
      </main>
    </div>
  );
}

function matchesGermanAnswer(question, input) {
  if (!input?.trim()) return false;

  return [question.correct_answer, ...(question.acceptable_answers || [])].some(
    (answer) =>
      answer.toLowerCase().trim() === input.toLowerCase().trim()
  );
}

function GermanQuiz({
  courseCode,
  numQuestions,
  timerMinutes,
  cachedQuestions,
  onCache,
  attemptMode,
  onExit,
}) {
  const [questions, setQuestions] = useState(cachedQuestions || []);
  const [current, setCurrent] = useState(0);
  const [responses, setResponses] = useState({});
  const [flagged, setFlagged] = useState({});
  const [loading, setLoading] = useState(!cachedQuestions);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (cachedQuestions) return undefined;

    let cancelled = false;

    async function fetchQuestions() {
      try {
        const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/quiz`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_code: courseCode,
            num_questions: numQuestions,
            question_type: "german",
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Questions could not be loaded.");
        }

        if (!data.questions?.length) {
          throw new Error("This course does not have fill-in-the-blank questions yet.");
        }

        if (!cancelled) {
          setQuestions(data.questions);
          onCache(data.questions);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError.message || "Questions could not be loaded.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQuestions();

    return () => {
      cancelled = true;
    };
  }, [cachedQuestions, courseCode, numQuestions, onCache]);

  const response = responses[current] || {
    input: "",
    checked: false,
    isCorrect: false,
  };

  function updateInput(value) {
    setResponses((currentResponses) => ({
      ...currentResponses,
      [current]: {
        input: value,
        checked: false,
        isCorrect: false,
      },
    }));
  }

  function checkAnswer() {
    const question = questions[current];
    const isCorrect = matchesGermanAnswer(question, response.input);

    setResponses((currentResponses) => ({
      ...currentResponses,
      [current]: {
        input: response.input,
        checked: true,
        isCorrect,
      },
    }));
  }

  function finishQuiz(wasTimedOut = false) {
    if (
      attemptMode === "test" &&
      !wasTimedOut &&
      !window.confirm(
        "Submit this test now? You will see your score and answer review after submitting."
      )
    ) {
      return;
    }

    setTimedOut(wasTimedOut);
    setDone(true);
  }

  if (loading) return <LoadingScreen label="Loading curated questions..." />;
  if (error) return <QuizError message={error} onExit={onExit} />;

  if (done) {
    const answers = questions.map((question, index) => {
      const answer = responses[index];

      return {
        question: question.question,
        input: answer?.input,
        correct: question.correct_answer,
        isCorrect:
          answer?.checked
            ? answer.isCorrect
            : matchesGermanAnswer(question, answer?.input),
      };
    });

    return (
      <ResultsScreen
        answers={answers}
        onExit={onExit}
        timedOut={timedOut}
        attemptMode={attemptMode}
        flaggedCount={Object.keys(flagged).filter((index) => flagged[index]).length}
      />
    );
  }

  const question = questions[current];

  return (
    <div className="quiz-page">
      <QuizFocusHeader
        courseCode={courseCode}
        current={current}
        total={questions.length}
        timerMinutes={timerMinutes}
        onExit={onExit}
        onExpire={() => finishQuiz(true)}
      />

      <main className="quiz-main">
        <section className="quiz-question-panel">
          <p className="quiz-question-label">
            {attemptMode === "test" ? "Recall test" : "Fill-in-the-blank practice"}
          </p>
          <h1><MathText text={question.question} /></h1>

          {attemptMode === "practice" && question.hint && (
            <p className="quiz-hint">Hint: {question.hint}</p>
          )}

          {!response.checked && (
            <MathToolbar onInsert={(symbol) => updateInput(response.input + symbol)} />
          )}

          <input
            type="text"
            value={response.input}
            onChange={(event) => updateInput(event.target.value)}
            disabled={attemptMode === "practice" && response.checked}
            placeholder="Type your answer"
            className="quiz-answer-input"
          />

          {response.checked && (
            <div
              className={
                response.isCorrect
                  ? "quiz-explanation is-correct"
                  : "quiz-explanation is-wrong"
              }
            >
              <b>
                {response.isCorrect
                  ? "Correct."
                  : `Correct answer: ${question.correct_answer}`}
              </b>
              {question.explanation && <p>{question.explanation}</p>}
            </div>
          )}

          <div className="quiz-controls">
            <button
              type="button"
              className="quiz-previous-button"
              disabled={current === 0}
              onClick={() => setCurrent((index) => Math.max(0, index - 1))}
            >
              ← Previous
            </button>

            {attemptMode === "practice" && !response.checked ? (
              <button
                type="button"
                className="swift-primary-button"
                disabled={!response.input.trim()}
                onClick={checkAnswer}
              >
                Check answer
              </button>
            ) : current < questions.length - 1 ? (
              <button
                type="button"
                className="swift-primary-button"
                onClick={() => setCurrent((index) => index + 1)}
              >
                Next question <span aria-hidden="true">→</span>
              </button>
            ) : (
              <button
                type="button"
                className="swift-primary-button"
                onClick={() => finishQuiz(false)}
              >
                {attemptMode === "test" ? "Submit test" : "Finish quiz"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            )}
          </div>
        </section>

        <QuestionNavigator
          total={questions.length}
          current={current}
          isAnswered={(index) => Boolean(responses[index]?.input?.trim())}
          flagged={flagged}
          onJump={setCurrent}
          onToggleFlag={(index) =>
            setFlagged((currentFlags) => ({
              ...currentFlags,
              [index]: !currentFlags[index],
            }))
          }
        />
      </main>
    </div>
  );
}

function TheoryQuiz({ courseCode, onExit }) {
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [allResults, setAllResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchQuestions() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/generate-theory-question`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ course_code: courseCode, num_questions: 5 }),
          }
        );

        const data = await response.json();

        if (!response.ok) throw new Error(data.detail || "Theory could not load.");

        if (!cancelled) setQuestions(data.questions || []);
      } catch (fetchError) {
        if (!cancelled) setError(fetchError.message || "Theory could not load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQuestions();

    return () => {
      cancelled = true;
    };
  }, [courseCode]);

  async function submitAnswer() {
    if (!answer.trim()) return;

    setGrading(true);
    setError("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/grade-theory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            course_code: courseCode,
            question: questions[current]?.question || "",
            answer,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) throw new Error(data.detail || "Answer could not be graded.");

      setResult(data.grading);
      setAllResults((results) => [
        ...results,
        { question: questions[current]?.question, grading: data.grading },
      ]);
    } catch (gradingError) {
      setError(gradingError.message || "Answer could not be graded.");
    } finally {
      setGrading(false);
    }
  }

  function nextQuestion() {
    if (current + 1 >= questions.length) {
      setDone(true);
      return;
    }

    setCurrent((index) => index + 1);
    setAnswer("");
    setResult(null);
  }

  if (loading) return <LoadingScreen label="Loading theory questions..." />;
  if (error && !questions.length) return <QuizError message={error} onExit={onExit} />;

  if (done) {
    const average =
      allResults.length > 0
        ? allResults.reduce((sum, item) => sum + item.grading.score, 0) /
          allResults.length
        : 0;

    return (
      <div className="quiz-results-page">
        <button type="button" className="swift-back-button" onClick={onExit}>
          ← Back to quiz setup
        </button>
        <p className="swift-eyebrow">Theory complete</p>
        <h1>{average.toFixed(1)}<span>/10 average</span></h1>
        <div className="quiz-review-list">
          {allResults.map((item, index) => (
            <article key={index} className="quiz-review-row">
              <p>{item.question}</p>
              <strong>
                {item.grading.score}/{item.grading.max_score} · {item.grading.grade}
              </strong>
            </article>
          ))}
        </div>
      </div>
    );
  }

  const question = questions[current];

  return (
    <div className="quiz-page">
      <QuizFocusHeader
        courseCode={courseCode}
        current={current}
        total={questions.length}
        timerMinutes={0}
        onExit={onExit}
        onExpire={() => {}}
      />

      <main className="theory-main">
        <section className="quiz-question-panel">
          <p className="quiz-question-label">
            Theory · {question?.difficulty || "Practice"}
          </p>
          <h1><MathText text={question?.question} /></h1>

          {question?.key_points?.length > 0 && (
            <div className="theory-key-points">
              <b>Points to cover</b>
              {question.key_points.map((point) => (
                <span key={point}>{point}</span>
              ))}
            </div>
          )}

          {result ? (
            <div className="theory-feedback">
              <p>
                <strong>{result.score}/{result.max_score}</strong> · {result.grade}
              </p>
              {result.feedback?.suggestion && <span>{result.feedback.suggestion}</span>}
              <button type="button" className="swift-primary-button" onClick={nextQuestion}>
                {current + 1 >= questions.length ? "See results" : "Next question"} →
              </button>
            </div>
          ) : (
            <>
              <MathToolbar onInsert={(symbol) => setAnswer((text) => text + symbol)} />
              <textarea
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Write your answer here"
                rows={10}
                className="theory-answer-area"
              />
              {error && <p className="cgpa-error">{error}</p>}
              <button
                type="button"
                className="swift-primary-button"
                disabled={grading || !answer.trim()}
                onClick={submitAnswer}
              >
                {grading ? "Grading..." : "Submit answer"}
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function ResultsScreen({
  answers,
  onExit,
  timedOut,
  flaggedCount,
  attemptMode = "practice",
}) {
  const score = answers.filter((answer) => answer.isCorrect).length;
  const percentage = answers.length
    ? Math.round((score / answers.length) * 100)
    : 0;
  const unanswered = answers.filter(
    (answer) => !answer.selected && !answer.input
  ).length;

  return (
    <div className="quiz-results-page">
      <button type="button" className="swift-back-button" onClick={onExit}>
        ← Back to quiz setup
      </button>

      <p className="swift-eyebrow">
        {timedOut
          ? "Time expired"
          : attemptMode === "test"
            ? "Test complete"
            : "Practice complete"}
      </p>
      <h1>
        {score}<span>/{answers.length}</span>
      </h1>
      <p className="quiz-results-summary">{percentage}% correct</p>

      {(unanswered > 0 || flaggedCount > 0) && (
        <p className="quiz-results-note">
          {unanswered > 0 && `${unanswered} unanswered`}
          {unanswered > 0 && flaggedCount > 0 && " · "}
          {flaggedCount > 0 && `${flaggedCount} flagged for review`}
        </p>
      )}

      <div className="quiz-review-list">
        {answers.map((answer, index) => (
          <article
            key={index}
            className={
              answer.isCorrect
                ? "quiz-review-row is-correct"
                : "quiz-review-row is-wrong"
            }
          >
            <p>{answer.question}</p>
            <small>
              Your answer: {answer.selected || answer.input || "Not answered"}
            </small>
            {!answer.isCorrect && <b>Correct: {answer.correct}</b>}
          </article>
        ))}
      </div>
    </div>
  );
}

function LoadingScreen({ label }) {
  return (
    <div className="swift-loading-screen">
      <span className="swift-loading-mark">S</span>
      <p>{label}</p>
    </div>
  );
}

function QuizError({ message, onExit }) {
  return (
    <div className="quiz-results-page quiz-error-page">
      <p className="swift-eyebrow">Practice unavailable</p>
      <h1>We could not start this quiz.</h1>
      <p>{message}</p>
      <button type="button" className="swift-primary-button" onClick={onExit}>
        Back to quiz setup
      </button>
    </div>
  );
}
