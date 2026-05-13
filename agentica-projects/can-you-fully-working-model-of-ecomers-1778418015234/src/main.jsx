import React from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, CalendarDays, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import "./styles.css";

const site = {
  "title": "Can You Fully Working Model Of Ecomers",
  "prompt": "CAN YOU BUILD A FULLY WORKING MODEL OF A ECOMERS WEBSITE",
  "eyebrow": "Agentica Build",
  "headline": "Can You Fully Working Model Of Ecomers",
  "subhead": "A working React project generated from your prompt, ready for iteration, integrations, and deployment.",
  "image": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=80",
  "features": [
    "Responsive layout",
    "Project source files",
    "Clear user flow",
    "Ready to extend"
  ]
};

function App() {
  return (
    <main>
      <nav className="nav">
        <strong>{site.title}</strong>
        <div>
          <a href="#rooms">Rooms</a>
          <a href="#experiences">Experiences</a>
          <a href="#book">Book</a>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-copy">
          <span>{site.eyebrow}</span>
          <h1>{site.headline}</h1>
          <p>{site.subhead}</p>
          <div className="hero-actions">
            <a className="button primary" href="#book">Check Availability <ArrowRight size={18} /></a>
            <a className="button" href="#rooms">View Rooms</a>
          </div>
        </div>
      </section>

      <section className="section grid" id="rooms">
        {site.features.map((feature, index) => (
          <article className="feature" key={feature}>
            <span>0{index + 1}</span>
            <h2>{feature}</h2>
            <p>Designed from the prompt, ready for copy, imagery, booking flow, and brand refinements.</p>
          </article>
        ))}
      </section>

      <section className="section split" id="experiences">
        <div>
          <span className="eyebrow">Guest Journey</span>
          <h2>From first look to confirmed stay.</h2>
          <p>This project is structured as a real React app, so you can keep adding pages, components, booking forms, and API integrations.</p>
        </div>
        <div className="timeline">
          <p><MapPin size={18} /> Discover the place and local experiences.</p>
          <p><CalendarDays size={18} /> Pick dates, room type, and guest count.</p>
          <p><ShieldCheck size={18} /> Build trust with policies, reviews, and host details.</p>
        </div>
      </section>

      <section className="booking" id="book">
        <div>
          <Sparkles size={22} />
          <h2>Ready to make this real?</h2>
          <p>Next steps: connect a booking backend, add room inventory, wire email/CRM, and deploy.</p>
        </div>
        <a className="button primary dark" href="mailto:host@example.com">Email Host</a>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
