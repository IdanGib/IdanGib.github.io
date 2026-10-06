const App = () => (
  <main className="grid min-h-screen place-items-center p-4">
    <section className="card w-full max-w-md bg-base-200 shadow-lg" aria-labelledby="editor-title">
      <div className="card-body gap-4 text-center">
        <h1 id="editor-title" className="card-title justify-center text-2xl">עורך תיק הקסם</h1>
        <p className="text-base-content/70">העורך אינו זמין כרגע. אפשר להמשיך להשתמש בתיק הקסם.</p>
        <div className="card-actions justify-center">
          <a className="btn btn-primary" href={`${import.meta.env.BASE_URL}magic-bag-app.html`}>לתיק הקסם</a>
          <a className="btn btn-ghost" href={import.meta.env.BASE_URL}>לעמוד הבית</a>
        </div>
      </div>
    </section>
  </main>
);

export default App;
