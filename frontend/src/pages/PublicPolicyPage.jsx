import { useNavigate } from "react-router-dom";

const pages = {
  privacy: {
    eyebrow: "Privacy",
    title: "A clear approach to your information.",
    intro:
      "Swift is built to help students study. This notice explains the information needed to provide that service.",
    sections: [
      ["What Swift uses", "Account details and the information you choose to add while using Swift, such as your study activity and course choices."],
      ["Why it is used", "To provide your account, keep study features working, improve the platform, and respond when you contact the team."],
      ["Your choices", "You can request help with your account or ask questions about your information through the contact channel provided in Swift."],
    ],
  },
  terms: {
    eyebrow: "Terms",
    title: "Use Swift with care and respect.",
    intro:
      "Swift is a study companion. It does not replace your lecturers, official course materials, or university assessment rules.",
    sections: [
      ["Your account", "Keep your sign-in details private and use the platform only for lawful, academic purposes."],
      ["Study content", "Use materials and question banks responsibly. Always verify important academic information against your official course guidance."],
      ["The platform", "Swift is actively improving. Features, available content, and access can change as the service develops."],
    ],
  },
  accessibility: {
    eyebrow: "Accessibility",
    title: "Study tools should be easier to use.",
    intro:
      "Swift aims for a clear, responsive experience across common devices and supports reduced motion where your device requests it.",
    sections: [
      ["Motion", "The landing page respects the reduced-motion preference in your browser or device settings."],
      ["Readability", "We are continuing to improve contrast, structure, and keyboard-friendly controls across the platform."],
      ["Feedback", "If something makes Swift difficult to use, please let the team know so it can be prioritised."],
    ],
  },
};

export default function PublicPolicyPage({ page }) {
  const navigate = useNavigate();
  const content = pages[page] || pages.privacy;

  return (
    <main className="swift-policy-page">
      <header className="swift-policy-header">
        <button type="button" className="swift-policy-brand" onClick={() => navigate("/")}>
          Swift
        </button>
        <button type="button" onClick={() => navigate("/")}>Back to home</button>
      </header>
      <article className="swift-policy-content">
        <p>{content.eyebrow}</p>
        <h1>{content.title}</h1>
        <div className="swift-policy-rule" />
        <p className="swift-policy-intro">{content.intro}</p>
        <div className="swift-policy-sections">
          {content.sections.map(([heading, body]) => (
            <section key={heading}>
              <h2>{heading}</h2>
              <p>{body}</p>
            </section>
          ))}
        </div>
      </article>
    </main>
  );
}
