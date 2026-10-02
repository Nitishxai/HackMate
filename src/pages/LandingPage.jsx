function LandingPage({ onNavigate }) {
  return (
    <div className="page page-landing">
      <section className="hero-panel">
        <div className="hero-copy">
          <div className="eyebrow accent">Hackathon matchmaking for builders</div>
          <h1>Find the teammates your idea is missing.</h1>
          <p className="lead">
            Discover people with the exact skills your hackathon project needs, connect instantly,
            and build your team.
          </p>
          <div className="cta-row">
            <button type="button" className="primary-button" onClick={() => onNavigate('discover')}>
              Find Teammates
            </button>
            <button type="button" className="secondary-button" onClick={() => onNavigate('projects')}>
              Explore Projects
            </button>
          </div>
          <button type="button" className="text-link" onClick={() => onNavigate('dashboard')}>
            Open dashboard
          </button>
        </div>

        <div className="hero-preview">
          <div className="preview-window">
            <div className="preview-header">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </div>

            <div className="project-card-simple">
              <div className="project-pill">AI Education Assistant</div>
              <div className="mini-stack">
                <div className="stack-line">Required skills</div>
                <div className="tag-row">
                  <span>AI/ML</span>
                  <span>React</span>
                  <span>Backend</span>
                  <span>UI/UX</span>
                </div>
              </div>

              <div className="skill-gap-panel">
                <div className="skill-gap-row">
                  <span className="skill-status missing">Missing</span>
                  <span className="skill-label">UI/UX</span>
                </div>
                <div className="skill-gap-row">
                  <span className="skill-status fill">Matched</span>
                  <span className="skill-label">AI + React</span>
                </div>
              </div>
            </div>

            <div className="preview-people">
              <div className="person-bubble">A</div>
              <div className="person-bubble">P</div>
              <div className="person-bubble">M</div>
            </div>
          </div>
        </div>
      </section>

      <section className="info-grid">
        <div className="how-it-works">
          <div className="section-header small">
            <span className="eyebrow">How HackMate works</span>
          </div>
          <div className="steps-grid">
            <div className="step-item">
              <span className="step-index">01</span>
              <h3>Create your profile</h3>
            </div>
            <div className="step-item">
              <span className="step-index">02</span>
              <h3>Tell us what you're building</h3>
            </div>
            <div className="step-item">
              <span className="step-index">03</span>
              <h3>Discover complementary teammates</h3>
            </div>
            <div className="step-item">
              <span className="step-index">04</span>
              <h3>Connect and build</h3>
            </div>
          </div>
        </div>

        <div className="problem-solution">
          <div className="mini-panel">
            <div className="panel-label">Problem</div>
            <p>
              Hackathon participants often have ideas or individual skills but struggle to find the
              right teammates.
            </p>
          </div>
          <div className="mini-panel highlight">
            <div className="panel-label">Solution</div>
            <p>
              HackMate connects people based on complementary project skills.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

export default LandingPage;
