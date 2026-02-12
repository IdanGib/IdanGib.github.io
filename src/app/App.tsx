import "./App.css";

const App = () => (
  <div className="page">
    <header className="hero">
      <nav className="nav">
        <span className="logo">Idan Gibly</span>
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
          <a className="primary" href="mailto:hello@idangibly.com">
            Start a project
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
  </div>
);

export default App;
