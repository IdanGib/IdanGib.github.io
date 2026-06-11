import { apps } from "./apps";

const App = () => (
  <div className="relative flex min-h-screen flex-col overflow-hidden">
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-10 bg-[url(/grain.svg)] bg-repeat opacity-[0.04]"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-[10%] -right-[8%] h-[480px] w-[480px] rounded-full bg-primary/25 blur-[100px] motion-safe:animate-pulse"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-[5%] -left-[6%] h-[360px] w-[360px] rounded-full bg-accent/20 blur-[100px] [animation-delay:-2s] motion-safe:animate-pulse"
    />

    <header className="relative z-[2] flex items-center justify-center px-5 pt-5 pb-2 sm:px-10 sm:pt-7 sm:pb-3">
      <h1 className="text-[13px] font-bold tracking-[0.16em] uppercase opacity-40">
        IG Apps
      </h1>
    </header>

    <main className="relative z-[2] flex flex-1 items-start justify-center px-5 pt-6 pb-15 sm:px-10 sm:pt-8 sm:pb-20">
      <nav
        aria-label="Apps"
        className="grid w-full max-w-[360px] grid-cols-4 justify-items-center gap-x-3 gap-y-5 sm:w-auto sm:max-w-none sm:grid-cols-[repeat(4,88px)] sm:gap-x-5 sm:gap-y-7"
      >
        {apps.map((app) => (
          <a
            key={app.href}
            href={app.href}
            className="group flex w-full flex-col items-center gap-2 rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary sm:w-[88px]"
          >
            <span
              aria-hidden="true"
              className={`flex aspect-square w-full items-center justify-center rounded-[18px] shadow-lg shadow-black/50 ring-1 ring-white/15 ring-inset transition-transform duration-300 ease-fluid group-hover:scale-[1.08] group-active:scale-[0.94] group-active:duration-100 motion-reduce:transition-none sm:rounded-[22px] ${app.iconClass}`}
            >
              {app.icon}
            </span>
            <span className="max-w-full truncate text-[11px] tracking-[0.02em] text-base-content/85 drop-shadow-md sm:text-xs">
              {app.name}
            </span>
          </a>
        ))}
      </nav>
    </main>
  </div>
);

export default App;
