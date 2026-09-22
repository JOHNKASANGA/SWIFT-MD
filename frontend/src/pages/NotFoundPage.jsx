import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const INITIAL_GAME = {
  lift: 0,
  velocity: 0,
  obstacle: 104,
  score: 0,
};

export default function NotFoundPage() {
  const navigate = useNavigate();
  const animationFrame = useRef(null);
  const lastFrame = useRef(null);
  const game = useRef({ ...INITIAL_GAME });

  const [isPlaying, setIsPlaying] = useState(false);
  const [runnerLift, setRunnerLift] = useState(0);
  const [obstaclePosition, setObstaclePosition] = useState(104);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);

  function syncGame() {
    setRunnerLift(game.current.lift);
    setObstaclePosition(game.current.obstacle);
    setScore(game.current.score);
  }

  function startGame() {
    game.current = { ...INITIAL_GAME };
    lastFrame.current = null;
    setHasStarted(true);
    setIsPlaying(true);
    syncGame();
  }

  function jump() {
    if (!isPlaying) {
      startGame();
      return;
    }

    if (game.current.lift < 1.5) {
      game.current.velocity = 72;
    }
  }

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.code !== "Space" && event.code !== "ArrowUp") return;

      event.preventDefault();
      jump();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  });

  useEffect(() => {
    if (!isPlaying) return undefined;

    function tick(timestamp) {
      if (!lastFrame.current) {
        lastFrame.current = timestamp;
      }

      const delta = Math.min((timestamp - lastFrame.current) / 1000, 0.04);
      lastFrame.current = timestamp;

      const currentGame = game.current;
      currentGame.velocity -= 235 * delta;
      currentGame.lift = Math.max(
        0,
        currentGame.lift + currentGame.velocity * delta
      );

      if (currentGame.lift === 0 && currentGame.velocity < 0) {
        currentGame.velocity = 0;
      }

      const speed = 42 + Math.min(currentGame.score * 1.4, 20);
      currentGame.obstacle -= speed * delta;

      if (currentGame.obstacle < -12) {
        currentGame.obstacle = 104;
        currentGame.score += 1;
      }

      const hitsObstacle =
        currentGame.obstacle < 25 &&
        currentGame.obstacle > 8 &&
        currentGame.lift < 13;

      if (hitsObstacle) {
        setBestScore((currentBest) =>
          Math.max(currentBest, currentGame.score)
        );
        setIsPlaying(false);
        syncGame();
        return;
      }

      syncGame();
      animationFrame.current = requestAnimationFrame(tick);
    }

    animationFrame.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
    };
  }, [isPlaying]);

  return (
    <div className="not-found-page">
      <header className="not-found-header">
        <Link to="/" className="swift-brand" aria-label="Go to Swift home">
          <span className="swift-brand-mark">S</span>
          <span>Swift</span>
        </Link>

        <button
          type="button"
          className="not-found-back-link"
          onClick={() => navigate(-1)}
        >
          Go back
        </button>
      </header>

      <main className="not-found-main">
        <section className="not-found-copy">
          <p className="swift-eyebrow">404 · Wrong turn</p>
          <h1>This page has skipped class.</h1>
          <p>
            The link does not lead anywhere yet. While you are here, help Swift
            clear a few study obstacles.
          </p>

          <div className="not-found-actions">
            <button
              type="button"
              className="swift-primary-button"
              onClick={() => navigate("/")}
            >
              Return to Swift <span aria-hidden="true">→</span>
            </button>

            <button
              type="button"
              className="not-found-text-button"
              onClick={startGame}
            >
              {hasStarted ? "Restart game" : "Play Swift Sprint"}
            </button>
          </div>
        </section>

        <section
          className="swift-sprint"
          aria-label="Swift Sprint game. Tap the game area or press Space to jump."
          onPointerDown={jump}
        >
          <div className="swift-sprint-topbar">
            <p>Swift Sprint</p>
            <div>
              <span>Score {String(score).padStart(2, "0")}</span>
              <span>Best {String(bestScore).padStart(2, "0")}</span>
            </div>
          </div>

          <div className="swift-sprint-sky">
            <span className="swift-sprint-sun" aria-hidden="true" />
            <span className="swift-sprint-cloud cloud-one" aria-hidden="true" />
            <span className="swift-sprint-cloud cloud-two" aria-hidden="true" />

            <div
              className="swift-sprint-runner"
              style={{ transform: `translateY(-${runnerLift}%)` }}
              aria-hidden="true"
            >
              S
            </div>

            <div
              className="swift-sprint-obstacle"
              style={{ left: `${obstaclePosition}%` }}
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
            </div>

            <div className="swift-sprint-ground" aria-hidden="true" />
          </div>

          <div className="swift-sprint-instruction">
            {isPlaying
              ? "Tap anywhere or press Space to jump."
              : hasStarted
                ? "Notebook collision. Tap to try again."
                : "Tap to start. Clear the notebooks."}
          </div>
        </section>
      </main>
    </div>
  );
}
