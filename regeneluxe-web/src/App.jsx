// src/App.jsx

import './App.css';

function App() {
  return (
    <div className="app-root">
      <header className="hero">
        <div className="hero-content">
          <span className="badge">Early Build · ReGeneLuxe</span>
          <h1>ReGeneLuxe</h1>
          <p className="hero-subtitle">
            An AI engine that <strong>creates</strong>, <strong>automates</strong>, and <strong>optimizes</strong> your
            video and content campaigns — so you can focus on the vision, not the busywork.
          </p>

          <div className="hero-actions">
            <button className="primary-btn">Join the Early Access List</button>
            <button className="ghost-btn">Watch How It Works</button>
          </div>

          <p className="hero-note">
            Day 1 build · This is the first live skeleton of the ReGeneLuxe experience.
          </p>
        </div>
      </header>

      <main>
        <section className="pillars">
          <div className="pillar-card">
            <h2>Create</h2>
            <p>
              Generate videos, scripts, captions, thumbnails and ad copy from a single brief. ReGeneLuxe becomes your
              in-house creative studio.
            </p>
          </div>
          <div className="pillar-card">
            <h2>Automate</h2>
            <p>
              Turn content into full campaigns with smart schedules across platforms — without manual posting or
              scattered tools.
            </p>
          </div>
          <div className="pillar-card">
            <h2>Optimize</h2>
            <p>
              See what performs, get AI recommendations, and regenerate under-performing assets with one click.
            </p>
          </div>
        </section>
      </main>

      <footer className="footer">
        <p>© {new Date().getFullYear()} ReGeneLuxe. Built by Valid · Powered by G.</p>
      </footer>
    </div>
  );
}

export default App;
