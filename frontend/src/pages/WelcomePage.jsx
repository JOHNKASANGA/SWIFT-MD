import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import swiftLogo from "../assets/swift-logo-motion.webp";
import studyDesk from "../assets/swift-study-desk.webp";
import "./WelcomePageEnhancements.css";

const journeySteps = [
  {
    eyebrow: "Choose the course",
    title: "Start where the lecture left off.",
    copy: "Find the course first, then move straight into the materials that belong to it.",
    image: "https://dca.uonbi.ac.ke/sites/dca.uonbi.ac.ke/files/inline-images/international%20students.jpg",
    alt: "University of Nairobi students walking together across campus",
    credit: "University of Nairobi",
  },
  {
    eyebrow: "Read with direction",
    title: "Keep the useful material in reach.",
    copy: "Open notes, textbooks and study resources without searching through old group-chat links.",
    image: "https://www.amref.nl/media/_thumbs/images/Projecten/AMIU/2022%20AMIU%20Amref%20International%20University%20student%20Faith%20-%20Photo_s%20Steve%20Kagia%20_Amref%20Health%20Africa_Steve%20Kagia-min774x-75.jpg",
    alt: "An African university student reading a book in a library",
    credit: "Amref International University, photo by Steve Kagia",
  },
  {
    eyebrow: "Return to the idea",
    title: "Turn reading into recall.",
    copy: "Use study checks and question banks to see what stayed, what slipped and what needs another pass.",
    image: "https://newvision-media.s3.amazonaws.com/cms/7f70186e-a851-4213-8bc5-2e64823cd684.jpg",
    alt: "African university students reviewing work together around a laptop",
    credit: "New Vision Uganda",
  },
];

function formatHeroTime(date) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export default function WelcomePage() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [heroTime, setHeroTime] = useState(() => formatHeroTime(new Date()));
  const [journeyStep, setJourneyStep] = useState(0);
  const featureCarouselRef = useRef(null);
  const journeyRef = useRef(null);
  const modesRef = useRef(null);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "INITIAL_SESSION") {
          if (session) {
            navigate("/home");
          } else {
            setChecking(false);
          }
        }

        if (event === "SIGNED_IN") {
          navigate("/home");
        }
      }
    );

    return () => listener.subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    let frame;

    const updateScrollDepth = () => {
      frame = window.requestAnimationFrame(() => {
        const scroll = window.scrollY;
        document.documentElement.style.setProperty(
          "--swift-scroll-near",
          `${Math.round(scroll * -0.055)}px`
        );
        document.documentElement.style.setProperty(
          "--swift-scroll-far",
          `${Math.round(scroll * -0.12)}px`
        );

        if (journeyRef.current) {
          const rect = journeyRef.current.getBoundingClientRect();
          const distance = Math.max(
            journeyRef.current.offsetHeight - window.innerHeight,
            1
          );
          const progress = Math.min(0.999, Math.max(0, -rect.top / distance));
          setJourneyStep(Math.min(2, Math.floor(progress * 3)));
        }

        if (modesRef.current) {
          const modesRect = modesRef.current.getBoundingClientRect();
          const travel = window.innerHeight + modesRect.height;
          const progress = Math.min(
            1,
            Math.max(0, (window.innerHeight - modesRect.top) / travel)
          );
          modesRef.current.style.setProperty(
            "--swift-book-shift",
            `${Math.round((progress - 0.5) * 28)}px`
          );
        }
      });
    };

    updateScrollDepth();
    window.addEventListener("scroll", updateScrollDepth, { passive: true });

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", updateScrollDepth);
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setHeroTime(formatHeroTime(new Date())), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    journeySteps.forEach(({ image }) => {
      const photograph = new Image();
      photograph.src = image;
    });
  }, []);

  useEffect(() => {
    const advanceCarousel = () => {
      const track = featureCarouselRef.current;
      if (!track || document.hidden) return;

      const firstCard = track.querySelector(".swift-feature-card");
      const gap = Number.parseFloat(window.getComputedStyle(track).gap) || 16;
      const distance = (firstCard?.getBoundingClientRect().width || 350) + gap;
      const reachedEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 12;

      track.scrollTo({
        left: reachedEnd ? 0 : track.scrollLeft + distance,
        behavior: "smooth",
      });
    };

    const carouselTimer = window.setInterval(advanceCarousel, 4200);
    return () => window.clearInterval(carouselTimer);
  }, []);

  if (checking) {
    return (
      <div className="swift-loading-screen">
        <span className="swift-loading-mark">S</span>
        <p>Preparing Swift...</p>
      </div>
    );
  }

  return (
    <div className="swift-landing">
      <header className="swift-landing-header">
        <button
          type="button"
          className="swift-landing-brand"
          onClick={() => navigate("/")}
          aria-label="Go to Swift home"
        >
          <img src={swiftLogo} alt="Swift" />
        </button>

        <nav className="swift-landing-nav" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#study-modes">Study modes</a>
          <button type="button" onClick={() => navigate("/signin")}>
            Sign in
          </button>
          <button
            type="button"
            className="swift-landing-nav-cta"
            onClick={() => navigate("/signup")}
          >
            Start studying <span aria-hidden="true">↗</span>
          </button>
        </nav>
      </header>

      <main>
        <section
          className="swift-landing-hero"
          onMouseMove={(event) => {
            const bounds = event.currentTarget.getBoundingClientRect();
            event.currentTarget.style.setProperty(
              "--pointer-x",
              `${((event.clientX - bounds.left) / bounds.width - 0.5) * 24}px`
            );
            event.currentTarget.style.setProperty(
              "--pointer-y",
              `${((event.clientY - bounds.top) / bounds.height - 0.5) * 20}px`
            );
          }}
          onMouseLeave={(event) => {
            event.currentTarget.style.setProperty("--pointer-x", "0px");
            event.currentTarget.style.setProperty("--pointer-y", "0px");
          }}
        >
          <div
            className="swift-hero-photo"
            aria-hidden="true"
            style={{ backgroundImage: `url(${studyDesk})` }}
          />
          <div className="swift-hero-grid" aria-hidden="true" />
          <div className="swift-hero-light-trail" aria-hidden="true"><span /><span /><span /></div>
          <div className="swift-hero-film-label" aria-hidden="true"><span>Swift</span><span>Study motion 01</span><span>Unilag</span></div>
          <div className="swift-hero-content">
            <p className="swift-landing-kicker">
              <span /> Built for the work between lectures
            </p>
            <h1>
              Your course,
              <br /> finally in focus.
            </h1>
            <p className="swift-hero-lede">
              Swift brings course materials, quality practice, and the tools
              that keep you moving into one calm study space.
            </p>

            <div className="swift-hero-actions">
              <button
                type="button"
                className="swift-landing-primary"
                onClick={() => navigate("/signup")}
              >
                Build your study space <span aria-hidden="true">→</span>
              </button>
              <a className="swift-landing-text-link" href="#how-it-works">
                See how Swift works <span aria-hidden="true">↓</span>
              </a>
            </div>
          </div>

          <div className="swift-hero-study-card" aria-label="Study dashboard preview">
            <div className="swift-hero-card-topline">
              <span>Today&apos;s study plan</span>
              <strong>{heroTime}</strong>
            </div>
            <div className="swift-hero-card-course">
              <span className="swift-card-orb" />
              <div>
                <small>Up next</small>
                <strong>TCH 202</strong>
              </div>
              <b>42%</b>
            </div>
            <div className="swift-hero-card-progress"><span /></div>
            <div className="swift-hero-card-row">
              <span>Material review</span><strong>18 min</strong>
            </div>
            <div className="swift-hero-card-row">
              <span>Practice questions</span><strong>05 queued</strong>
            </div>
          </div>
          <div className="swift-hero-floating-note">
            <span>01</span>
            <p>Less searching.<br /><strong>More studying.</strong></p>
          </div>
          <div className="swift-hero-marquee" aria-hidden="true">
            <div><span>COURSES</span><i /> <span>MATERIALS</span><i /> <span>RECALL</span><i /> <span>COURSES</span><i /> <span>MATERIALS</span><i /> <span>RECALL</span><i /></div>
          </div>
        </section>

        <section className="swift-feature-carousel" aria-label="What you can do with Swift">
          <div className="swift-feature-carousel-head">
            <div>
              <p className="swift-landing-kicker"><span /> Inside Swift</p>
              <h2>Tools that follow your actual study flow.</h2>
            </div>
          </div>
          <div className="swift-feature-carousel-track" ref={featureCarouselRef}>
            <article className="swift-feature-card">
              <span>01</span><h3>Your courses</h3><p>Move through your own level and sequence without digging through chats.</p><b>Course map</b>
            </article>
            <article className="swift-feature-card swift-feature-card--ink">
              <span>02</span><h3>Materials that stay put</h3><p>Open the file you need when you need it, inside the right course.</p><b>Study shelf</b>
            </article>
            <article className="swift-feature-card">
              <span>03</span><h3>Practice with context</h3><p>Use question banks and study checks to turn reading into recall.</p><b>Active recall</b>
            </article>
            <article className="swift-feature-card swift-feature-card--blue">
              <span>04</span><h3>See the bigger picture</h3><p>Keep an eye on your CGPA while you build the habits behind it.</p><b>CGPA tools</b>
            </article>
          </div>
        </section>

        <section className="swift-landing-proof" aria-label="Swift benefits">
          <p>One place for the material that matters.</p>
          <div><strong>Courses</strong><span>in your own sequence</span></div>
          <div><strong>Practice</strong><span>when you are ready</span></div>
          <div><strong>Momentum</strong><span>without the clutter</span></div>
        </section>

        <section className="swift-landing-way swift-landing-way--restored">
          <div className="swift-landing-section-intro">
            <p className="swift-landing-kicker"><span /> A better rhythm</p>
            <h2>Study in the order your brain actually needs.</h2>
            <p>
              Start with the course. Open exactly the material you need.
              Then use practice to make the knowledge stick.
            </p>
          </div>

          <div className="swift-landing-steps">
            <article className="swift-landing-step swift-step-photo swift-step-photo--cafe">
              <div className="swift-step-number">01</div>
              <div className="swift-step-copy">
                <p>Find your footing</p>
                <h3>Everything begins with the right course.</h3>
              </div>
            </article>
            <article className="swift-landing-step swift-step-ink">
              <div className="swift-step-number">02</div>
              <div className="swift-step-copy">
                <p>Read with purpose</p>
                <h3>Keep the useful materials close, not lost in a group chat.</h3>
              </div>
              <div className="swift-paper-stack" aria-hidden="true">
                <span>Fluid mechanics</span><span>Week 05 · notes</span>
              </div>
            </article>
            <article className="swift-landing-step swift-step-paper">
              <div className="swift-step-number">03</div>
              <div className="swift-step-copy">
                <p>Check understanding</p>
                <h3>Turn the page into recall, one question at a time.</h3>
              </div>
              <div className="swift-mini-score" aria-hidden="true"><b>4</b><span>of 5 correct</span></div>
            </article>
          </div>
        </section>

        <section className="cinema-journey" id="how-it-works" ref={journeyRef}>
          <div className="cinema-journey-sticky">
            <div className="cinema-journey-copy">
              <p className="cinema-journey-kicker">The study flow</p>
              <div className="cinema-journey-step" key={journeyStep}>
                <p>{journeySteps[journeyStep].eyebrow}</p>
                <h2>{journeySteps[journeyStep].title}</h2>
                <div>{journeySteps[journeyStep].copy}</div>
              </div>
            </div>

            <div
              className={`cinema-product-scene cinema-product-scene--${journeyStep + 1}`}
              aria-label="Student study photograph"
            >
              <figure className="cinema-journey-photo" key={journeyStep}>
                <img
                  src={journeySteps[journeyStep].image}
                  alt={journeySteps[journeyStep].alt}
                />
                <figcaption>{journeySteps[journeyStep].credit}</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="swift-landing-modes" id="study-modes" ref={modesRef}>
          <div className="swift-modes-image" aria-hidden="true" />
          <div className="swift-modes-content">
            <p className="swift-landing-kicker"><span /> Your study shelf</p>
            <h2>Built for more than collecting PDFs.</h2>
            <p>
              Swift is designed around the whole loop: find a course, learn
              the material, test recall, and understand where to go next.
            </p>
            <ul>
              <li><span>01</span> Course materials, organised clearly</li>
              <li><span>02</span> Practice banks that respect the course</li>
              <li><span>03</span> A CGPA calculator for the bigger picture</li>
            </ul>
            <button type="button" className="swift-landing-primary" onClick={() => navigate("/signup")}>
              Start with your courses <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        <section className="cinema-final">
          <div className="cinema-final-photo" aria-hidden="true" />
          <div className="cinema-final-shade" aria-hidden="true" />
          <div className="cinema-final-content">
            <p>Your next study session</p>
            <h2>Open the course.<br />Stay with the idea.</h2>
            <button type="button" onClick={() => navigate("/signup")}>Start with Swift <span>↗</span></button>
          </div>
        </section>
      </main>

      <footer className="cinema-footer">
        <div className="cinema-footer-main">
          <div className="cinema-footer-brand">
            <button type="button" className="swift-landing-brand cinema-footer-logo" onClick={() => navigate("/")} aria-label="Swift home">
              <span className="cinema-footer-logo-art">
                <img src={swiftLogo} alt="Swift" />
                <img src={swiftLogo} alt="" aria-hidden="true" className="cinema-footer-logo-word" />
              </span>
            </button>
            <p>A focused place for university study, beginning with UNILAG.</p>
          </div>
          <nav aria-label="Study links"><p>Study</p><a href="#study-modes">Inside Swift</a><a href="#how-it-works">Study flow</a><button type="button" onClick={() => navigate("/signup")}>Create account</button></nav>
          <nav aria-label="Account links"><p>Account</p><button type="button" onClick={() => navigate("/signin")}>Sign in</button><button type="button" onClick={() => navigate("/signup")}>Get started</button></nav>
          <nav aria-label="Legal links"><p>Legal</p><button type="button" onClick={() => navigate("/privacy")}>Privacy</button><button type="button" onClick={() => navigate("/terms")}>Terms</button><button type="button" onClick={() => navigate("/accessibility")}>Accessibility</button></nav>
        </div>
        <div className="cinema-footer-base"><span>© {new Date().getFullYear()} Swift</span><span>Built for focused study.</span></div>
      </footer>
    </div>
  );
}
