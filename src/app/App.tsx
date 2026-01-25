import "./App.css";

const App = () => (
  <div className="page">
    <header className="hero">
      <nav className="nav">
        <span className="logo">Idan Gibly</span>
        <div className="nav-links">
          <a href="#about">About</a>
          <a href="#work">Work</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>
      <div className="hero-content">
        <p className="eyebrow">Product Designer • Creative Technologist</p>
        <h1>Crafting digital experiences with clarity and heart.</h1>
        <p className="lead">
          Idan Gibly is a multidisciplinary designer helping teams transform bold
          ideas into purposeful products, immersive brands, and elegant user
          journeys.
        </p>
        <div className="cta-row">
          <a className="primary" href="#contact">
            Start a project
          </a>
          <a className="secondary" href="#work">
            View selected work
          </a>
        </div>
        <div className="hero-card">
          <div>
            <p className="card-title">Currently</p>
            <p className="card-body">
              Building customer-first platforms and design systems for global
              startups.
            </p>
          </div>
          <div>
            <p className="card-title">Location</p>
            <p className="card-body">Tel Aviv · Remote worldwide</p>
          </div>
        </div>
      </div>
    </header>

    <main>
      <section id="about" className="section">
        <h2>About</h2>
        <p>
          With a background in product strategy, motion, and UI engineering, Idan
          bridges the gap between concept and execution. Every project blends
          research, storytelling, and meticulous craft.
        </p>
        <div className="pill-grid">
          <span>Product Strategy</span>
          <span>UX & UI Design</span>
          <span>Design Systems</span>
          <span>Brand Direction</span>
          <span>Prototyping</span>
          <span>Creative Technology</span>
        </div>
      </section>

      <section id="work" className="section">
        <h2>Selected Work</h2>
        <div className="work-grid">
          <article>
            <h3>Northwind Logistics</h3>
            <p>
              Reimagined the customer portal with real-time shipment visibility
              and a new visual language.
            </p>
          </article>
          <article>
            <h3>Pulse Health</h3>
            <p>
              Designed a telehealth onboarding journey that increased retention
              by 38%.
            </p>
          </article>
          <article>
            <h3>Studio Atlas</h3>
            <p>
              Crafted a brand identity and site experience for a boutique
              architecture firm.
            </p>
          </article>
        </div>
      </section>

      <section id="contact" className="section contact">
        <div>
          <h2>Let’s build something meaningful</h2>
          <p>
            Tell me about your vision, timeline, and the people you want to
            impact. I’ll respond within 48 hours.
          </p>
        </div>
        <a className="primary" href="mailto:hello@idangibly.com">
          hello@idangibly.com
        </a>
      </section>
    </main>

    <footer className="footer">
      <span>© 2024 Idan Gibly. All rights reserved.</span>
      <div>
        <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">
          LinkedIn
        </a>
        <a href="https://www.behance.net" target="_blank" rel="noreferrer">
          Behance
        </a>
      </div>
    </footer>
  </div>
);

export default App;
