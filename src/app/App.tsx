import { useEffect, useRef } from "react";
import "./App.css";

const App = () => {
  const servicesRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = servicesRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="page">
      <div className="grain" />
      <nav className="nav fade-in">
        <span className="logo">IG</span>
        <div className="nav-links">
          <a className="nav-link" href="/cv/">
            CV
          </a>
          <a className="cta" href="mailto:idangibly.dev@gmail.com">
            Let's talk
          </a>
        </div>
      </nav>
      <main className="hero">
        <h1 className="fade-in" style={{ animationDelay: "0.15s" }}>
          <span className="line">Design</span>
          <span className="line accent">& craft.</span>
        </h1>
        <p
          className="tagline fade-in"
          style={{ animationDelay: "0.35s" }}
        >
          Idan Gibly — product designer & creative technologist
          <br />
          Tel Aviv · Remote
        </p>
      </main>
      <section className="services" ref={servicesRef}>
        <div className="service-card">
          <h2>Web Design & Development</h2>
          <p>
            Custom websites built from scratch — clean code, modern design, fast
            performance.
          </p>
        </div>
        <div className="service-card">
          <h2>UI/UX Product Design</h2>
          <p>
            User research, wireframes, and polished UI — from concept to
            pixel-perfect design.
          </p>
        </div>
      </section>
      <div className="orb orb-1" />
      <div className="orb orb-2" />
    </div>
  );
};

export default App;
