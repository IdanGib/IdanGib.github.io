import "./App.css";

const App = () => (
  <div className="page">
    <div className="grain" />
    <nav className="nav">
      <span className="logo">IG</span>
      <a className="cta" href="mailto:idangibly.dev@gmail.com">
        Let's talk
      </a>
    </nav>
    <main className="hero">
      <h1>
        <span className="line">Design</span>
        <span className="line accent">& craft.</span>
      </h1>
      <p className="tagline">
        Idan Gibly — product designer & creative technologist
        <br />
        Tel Aviv · Remote
      </p>
    </main>
    <div className="orb orb-1" />
    <div className="orb orb-2" />
  </div>
);

export default App;
