import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import MathText from "../components/MathText";
import { supabase } from "../lib/supabase";

export default function MaterialStudyCheckPage() {
  const { materialId } = useParams();
  const navigate = useNavigate();
  const [material, setMaterial] = useState(null);
  const [questionType, setQuestionType] = useState("mcq");
  const [focus, setFocus] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    async function loadMaterial() {
      const { data, error: materialError } = await supabase
        .from("materials")
        .select("id, title, course_code")
        .eq("id", materialId)
        .single();
      if (materialError || !data) setError("This material could not be found.");
      else setMaterial(data);
    }
    loadMaterial();
  }, [materialId]);

  async function generateCheck(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Please sign in again to use AI study checks.");

      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/ai/material-study-check`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            material_id: Number(materialId),
            question_type: questionType,
            num_questions: 5,
            focus: focus.trim() || null,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Study check failed.");
      setResult(data);
      setCurrent(0);
      setAnswer("");
      setChecked(false);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  function moveToQuestion(index) {
    setCurrent(index);
    setAnswer("");
    setChecked(false);
  }

  const question = result?.questions?.[current];
  const acceptedAnswers = question
    ? [question.correct_answer, ...(question.acceptable_answers || [])]
        .filter(Boolean)
        .map((value) => String(value).trim().toLowerCase())
    : [];
  const isCorrect = checked && acceptedAnswers.includes(answer.trim().toLowerCase());

  return (
    <div className="study-check-page">
      <header className="study-check-header">
        <button type="button" className="swift-brand" onClick={() => navigate("/home")}>
          <span className="swift-brand-mark">S</span><span>Swift</span>
        </button>
        <button type="button" className="viewer-back-button" onClick={() => navigate(-1)}>
          <span aria-hidden="true">←</span> Material
        </button>
      </header>

      <main className="study-check-main">
        <section className="study-check-intro">
          <p className="swift-eyebrow">AI study check</p>
          <h1>Turn this material into five useful questions.</h1>
          <p className="study-check-source">
            <strong>{material?.course_code || "Course material"}</strong>
            <span>{material?.title || "Loading material…"}</span>
          </p>
          <p>Swift reads this selected material and grounds every question in its contents. Add a focus only if you want to practise one topic.</p>
        </section>

        {!result && (
          <form className="study-check-form" onSubmit={generateCheck}>
            <fieldset>
              <legend>Question type</legend>
              <div className="study-check-choice-row">
                <button type="button" className={questionType === "mcq" ? "is-selected" : ""} onClick={() => setQuestionType("mcq")}>Multiple choice</button>
                <button type="button" className={questionType === "german" ? "is-selected" : ""} onClick={() => setQuestionType("german")}>Fill in the blank</button>
              </div>
            </fieldset>
            <label htmlFor="study-focus">Focus <span>Optional</span></label>
            <input id="study-focus" value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="For example: Bernoulli equation" maxLength={120} />
            <small>Use a topic or term that appears in the material.</small>
            {error && <p className="study-check-error">{error}</p>}
            <button type="submit" className="swift-primary-button study-check-generate" disabled={loading || !material}>
              {loading ? "Reading the material…" : "Generate five questions"}
            </button>
          </form>
        )}

        {question && (
          <section className="study-check-session" aria-live="polite">
            <div className="study-check-proof"><span>Generated from this material</span><span>{result.provider}</span></div>
            <p className="study-check-progress">Question {current + 1} of {result.questions.length}</p>
            <h2><MathText text={question.question} /></h2>
            {questionType === "mcq" ? (
              <div className="study-check-options">
                {Object.entries(question.options || {}).map(([key, value]) => (
                  <button type="button" key={key} className={answer === key ? "is-selected" : ""} onClick={() => { setAnswer(key); setChecked(false); }}>
                    <strong>{key}</strong><MathText text={value} />
                  </button>
                ))}
              </div>
            ) : (
              <input className="study-check-answer" value={answer} onChange={(event) => { setAnswer(event.target.value); setChecked(false); }} placeholder="Type your answer" />
            )}
            {!checked ? (
              <button type="button" className="swift-primary-button" disabled={!answer.trim()} onClick={() => setChecked(true)}>Check answer</button>
            ) : (
              <div className={isCorrect ? "study-check-feedback is-correct" : "study-check-feedback"}>
                <strong>{isCorrect ? "Correct." : `Answer: ${question.correct_answer}`}</strong>
                <p><MathText text={question.explanation} /></p>
              </div>
            )}
            <div className="study-check-footer">
              <button type="button" disabled={current === 0} onClick={() => moveToQuestion(current - 1)}>Previous</button>
              {current < result.questions.length - 1
                ? <button type="button" onClick={() => moveToQuestion(current + 1)}>Next question →</button>
                : <button type="button" onClick={() => setResult(null)}>Build another check</button>}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
