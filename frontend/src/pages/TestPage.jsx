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

          <p className="quiz-setup-hint quiz-setup-hint-theory-note">
            Theory practice always uses its own full set of questions and does
            not use the question count or timer above — it has its own pacing
            built in.
          </p>

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

  return (
    <TheoryQuiz
      courseCode={courseCode}
      attemptMode={attemptMode}
      onExit={() => setMode(null)}
    />
  );
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
      {String(minutesLeft).padStart(2, "0")}:
      {String(secondsLeft).padStart(2, "0")}
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
        <span>
          <i className="is-current" /> Current
        </span>
        <span>
          <i className="is-answered" /> Answered
        </span>
        <span>
          <i className="is-flagged" /> Flagged
        </span>
      </div>
    </section>
  );
}

function QuizFocusHeader({
  courseCode,
  current,
  total,
  timerMinutes,
  onExit,
  onExpire,
}) {
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
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/quiz`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              course_code: courseCode,
              num_questions: numQuestions,
              question_type: "mcq",
            }),
          }
        );

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
    if (attemptMode === "practice" && selectedAnswers[current] !== undefined) {
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
        flaggedCount={
          Object.keys(flagged).filter((index) => flagged[index]).length
        }
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
            {attemptMode === "test"
              ? "Multiple-choice test"
              : "Multiple-choice practice"}
          </p>
          <h1>
            <MathText text={question.question} />
          </h1>

          <div className="quiz-options">
            {Object.entries(question.options).map(([key, value]) => {
              const classes = ["quiz-option"];
              if (attemptMode === "test" && key === selected) {
                classes.push("is-selected");
              }

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
                  aria-pressed={selected === key}
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
                <b>
                  {selected === question.correct_answer
                    ? "Correct."
                    : "Review this."}
                </b>
                <p>
                  <MathText text={question.explanation} />
                </p>
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
    (answer) => answer.toLowerCase().trim() === input.toLowerCase().trim()
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
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/quiz`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              course_code: courseCode,
              num_questions: numQuestions,
              question_type: "german",
            }),
          }
        );

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.detail || "Questions could not be loaded.");
        }

        if (!data.questions?.length) {
          throw new Error(
            "This course does not have fill-in-the-blank questions yet."
          );
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
        isCorrect: answer?.checked
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
        flaggedCount={
          Object.keys(flagged).filter((index) => flagged[index]).length
        }
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
            {attemptMode === "test"
              ? "Recall test"
              : "Fill-in-the-blank practice"}
          </p>
          <h1>
            <MathText text={question.question} />
          </h1>

          {attemptMode === "practice" && question.hint && (
            <p className="quiz-hint">
              Hint: <MathText text={question.hint} />
            </p>
          )}

          {!response.checked && (
            <MathToolbar
              onInsert={(symbol) => updateInput(response.input + symbol)}
            />
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
                {response.isCorrect ? (
                  "Correct."
                ) : (
                  <>
                    Correct answer: <MathText text={question.correct_answer} />
                  </>
                )}
              </b>
              {question.explanation && (
                <p>
                  <MathText text={question.explanation} />
                </p>
              )}
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

function shuffleArray(items) {
  const array = [...items];
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const LETTERS = ["a", "b", "c", "d", "e", "f"];

function buildPaper(rawQuestions) {
  const shuffled = shuffleArray(rawQuestions);
  const targetQuestionCount = randomInt(4, 6);

  const groups = [];
  let cursor = 0;

  for (let i = 0; i < targetQuestionCount; i++) {
    const remaining = shuffled.length - cursor;
    if (remaining <= 0) break;

    const subCount = Math.min(randomInt(2, 4), remaining);
    const parts = shuffled.slice(cursor, cursor + subCount).map((q, index) => ({
      letter: LETTERS[index],
      question: q.question,
      max_marks: q.max_marks,
      answer: q.answer,
    }));

    cursor += subCount;

    groups.push({
      questionNumber: i + 1,
      totalMarks: parts.reduce((sum, part) => sum + (part.max_marks || 0), 0),
      parts,
    });

    if (cursor >= shuffled.length) break;
  }

  return groups;
}

function TheoryQuiz({ courseCode, attemptMode, onExit }) {
  const [rawQuestions, setRawQuestions] = useState([]);
  const [paper, setPaper] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [flipDirection, setFlipDirection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function fetchQuestions() {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_BACKEND_URL}/generate-theory-question`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              course_code: courseCode,
              num_questions: 100,
            }),
          }
        );

        const data = await response.json();

        if (!response.ok)
          throw new Error(data.detail || "Theory paper could not load.");

        if (!cancelled) {
          const questions = data.questions || [];
          setRawQuestions(questions);
          setPaper(buildPaper(questions));
        }
      } catch (fetchError) {
        if (!cancelled)
          setError(fetchError.message || "Theory paper could not load.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchQuestions();

    return () => {
      cancelled = true;
    };
  }, [courseCode]);

  function reshuffle() {
    setPaper(buildPaper(rawQuestions));
    setCurrentPage(0);
  }

  function goToPage(nextIndex, direction) {
    if (nextIndex < 0 || nextIndex >= paper.length || flipDirection) return;
    setFlipDirection(direction);
  }

  function onFlipComplete(nextIndex) {
    setCurrentPage(nextIndex);
    setFlipDirection(null);
  }

  if (loading) return <LoadingScreen label="Preparing your theory paper..." />;
  if (error && !paper.length)
    return <QuizError message={error} onExit={onExit} />;

  return (
    <div className="quiz-page theory-paper-page">
      <header className="quiz-focus-header">
        <button type="button" className="swift-brand" onClick={onExit}>
          <span className="swift-brand-mark">S</span>
          <span>Swift</span>
        </button>
        <p>{courseCode} · Theory paper</p>
        <div className="theory-paper-actions">
          <button
            type="button"
            className="theory-shuffle-button"
            onClick={reshuffle}
          >
            Shuffle again
          </button>
          <button
            type="button"
            className="theory-download-button"
            onClick={() => window.print()}
          >
            Download PDF
          </button>
        </div>
      </header>

      <main className="theory-screen-only theory-flip-stage">
        <button
          type="button"
          className="theory-flip-arrow theory-flip-arrow-prev"
          onClick={() => goToPage(currentPage - 1, "prev")}
          disabled={currentPage === 0 || !!flipDirection}
          aria-label="Previous question"
        >
          ←
        </button>

        <div className="theory-flip-perspective">
          <PaperSheet
            group={paper[currentPage]}
            courseCode={courseCode}
            attemptMode={attemptMode}
            isFirstPage={currentPage === 0}
          />

          {flipDirection && (
            <FlippingSheet
              outgoingGroup={paper[currentPage]}
              incomingGroup={
                paper[
                  flipDirection === "next" ? currentPage + 1 : currentPage - 1
                ]
              }
              courseCode={courseCode}
              attemptMode={attemptMode}
              direction={flipDirection}
              isFirstPage={currentPage === 0}
              onComplete={() =>
                onFlipComplete(
                  flipDirection === "next" ? currentPage + 1 : currentPage - 1
                )
              }
            />
          )}
        </div>

        <button
          type="button"
          className="theory-flip-arrow theory-flip-arrow-next"
          onClick={() => goToPage(currentPage + 1, "next")}
          disabled={currentPage >= paper.length - 1 || !!flipDirection}
          aria-label="Next question"
        >
          →
        </button>
      </main>

      <p className="theory-screen-only theory-page-indicator">
        Question {currentPage + 1} of {paper.length}
      </p>

      <div className="theory-print-only theory-print-sheet">
        {paper.map((group, index) => (
          <PrintedQuestion
            key={group.questionNumber}
            group={group}
            courseCode={courseCode}
            attemptMode={attemptMode}
            isFirstPage={index === 0}
            isLastPage={index === paper.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

function PaperHeader({ courseCode, isFirstPage }) {
  if (!isFirstPage) return null;

  return (
    <div className="theory-paper-header">
      <p className="theory-paper-brand">SWIFT PRACTICE PAPER</p>
      <h2>{courseCode}</h2>
      <div className="theory-paper-meta">
        <span>Duration: 2 Hours</span>
        <span>Answer ALL Questions</span>
      </div>
    </div>
  );
}

function QuestionBody({ group, attemptMode }) {
  if (!group) return null;

  return (
    <div className="theory-question-block">
      <p className="theory-question-title">
        QUESTION {group.questionNumber} ({group.totalMarks} Marks)
      </p>

      {group.parts.map((part) => (
        <div key={part.letter} className="theory-question-part">
          <p className="theory-question-part-text">
            <span className="theory-part-letter">({part.letter})</span>{" "}
            <MathText text={part.question} />{" "}
            <span className="theory-part-marks">({part.max_marks} marks)</span>
          </p>

          {attemptMode === "practice" && part.answer && (
            <div className="theory-answer-block">
              <b>Answer</b>
              <MathText text={part.answer} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function PaperSheet({ group, courseCode, attemptMode, isFirstPage }) {
  return (
    <div className="theory-paper-sheet">
      <PaperHeader courseCode={courseCode} isFirstPage={isFirstPage} />
      <QuestionBody group={group} attemptMode={attemptMode} />
    </div>
  );
}

function FlippingSheet({
  outgoingGroup,
  incomingGroup,
  courseCode,
  attemptMode,
  direction,
  isFirstPage,
  onComplete,
}) {
  return (
    <div
      className={`theory-flipping-sheet theory-flip-${direction}`}
      onAnimationEnd={onComplete}
    >
      <div className="theory-flip-face theory-flip-front">
        <PaperSheet
          group={outgoingGroup}
          courseCode={courseCode}
          attemptMode={attemptMode}
          isFirstPage={isFirstPage}
        />
      </div>
      <div className="theory-flip-face theory-flip-back">
        <PaperSheet
          group={incomingGroup}
          courseCode={courseCode}
          attemptMode={attemptMode}
          isFirstPage={false}
        />
      </div>
    </div>
  );
}

function PrintedQuestion({
  group,
  courseCode,
  attemptMode,
  isFirstPage,
  isLastPage,
}) {
  return (
    <div className="theory-print-page">
      <PaperHeader courseCode={courseCode} isFirstPage={isFirstPage} />
      <QuestionBody group={group} attemptMode={attemptMode} />
      {!isLastPage && <p className="theory-turn-over">PLEASE TURN OVER</p>}
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
        {score}
        <span>/{answers.length}</span>
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
            <p>
              <MathText text={answer.question} />
            </p>
            <small>
              Your answer:{" "}
              <MathText
                text={answer.selected || answer.input || "Not answered"}
              />
            </small>
            {!answer.isCorrect && (
              <b>
                Correct: <MathText text={answer.correct} />
              </b>
            )}
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
