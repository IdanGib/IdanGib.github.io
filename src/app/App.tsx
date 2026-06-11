import "./App.css";
import { apps } from "./apps";

const App = () => (
  <div className="page">
    <div className="grain" aria-hidden="true" />
    <div className="orb orb-1" aria-hidden="true" />
    <div className="orb orb-2" aria-hidden="true" />

    <header className="status-bar">
      <h1 className="status-name">IG Apps</h1>
    </header>

    <main className="home-screen">
      <nav className="app-grid" aria-label="Apps">
        {apps.map((app) => (
          <a key={app.href} href={app.href} className="app-icon-wrap">
            <span
              className="app-icon"
              style={{ background: app.gradient }}
              aria-hidden="true"
            >
              {app.icon}
            </span>
            <span className="app-label">{app.name}</span>
          </a>
        ))}
      </nav>
    </main>
  </div>
);

export default App;
