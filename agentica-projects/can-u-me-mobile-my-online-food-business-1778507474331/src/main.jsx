import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ArrowRight, CheckCircle2, Minus, Plus, Search, ShoppingBag } from "lucide-react";
import "./styles.css";

const spec = {
  "wantsApp": true,
  "appType": "restaurant",
  "title": "Can U Me Mobile My Online Food Business",
  "prompt": "can u build me a mobile app for my online food business",
  "audience": "business buyers",
  "tone": "modern",
  "catalog": [
    {
      "id": "restaurant-1",
      "name": "Mango Cloud",
      "category": "Dessert",
      "price": 140,
      "rating": 4.5,
      "inventory": 10,
      "description": "Whipped mango cream with biscuit crumble."
    },
    {
      "id": "restaurant-2",
      "name": "Smoked Paneer Bowl",
      "category": "Bowl",
      "price": 260,
      "rating": 4.6,
      "inventory": 17,
      "description": "Charred paneer, rice, herbs, and house sauce."
    },
    {
      "id": "restaurant-3",
      "name": "Street Corn Tacos",
      "category": "Tacos",
      "price": 180,
      "rating": 4.7,
      "inventory": 24,
      "description": "Three soft tacos with lime, spice, and crunch."
    }
  ],
  "modules": [
    "menu categories",
    "order tray",
    "table booking",
    "specials",
    "contact action",
    "responsive shell",
    "hero",
    "search/filter",
    "data cards",
    "detail panel"
  ],
  "actions": [
    "Add to Order",
    "Book Table"
  ],
  "stats": {
    "items": 3,
    "average": 193,
    "label": "items"
  },
  "primaryAction": "Add to Order",
  "secondaryAction": "Book Table"
};

function money(value) {
  if (spec.appType === "portfolio" || spec.appType === "website") return "";
  return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function headline() {
  if (spec.appType === "commerce") return "A working storefront with products, cart, and checkout flow.";
  if (spec.appType === "booking") return "A booking experience with availability and reservation intent.";
  if (spec.appType === "dashboard") return "A focused operating dashboard for decisions.";
  if (spec.appType === "restaurant") return "A menu and ordering flow built for fast decisions.";
  return "A working web app shaped from your prompt.";
}

function App() {
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [cart, setCart] = useState([]);
  const categories = useMemo(() => ["All", ...new Set(spec.catalog.map((item) => item.category))], []);
  const visibleItems = spec.catalog.filter((item) => {
    const categoryMatch = category === "All" || item.category === category;
    const queryMatch = !query || [item.name, item.category, item.description].join(" ").toLowerCase().includes(query.toLowerCase());
    return categoryMatch && queryMatch;
  });
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * item.qty, 0);

  function addItem(item) {
    setCart((current) => {
      const found = current.find((entry) => entry.id === item.id);
      if (found) return current.map((entry) => entry.id === item.id ? { ...entry, qty: entry.qty + 1 } : entry);
      return [...current, { ...item, qty: 1 }];
    });
  }

  function decreaseItem(id) {
    setCart((current) => current
      .map((entry) => entry.id === id ? { ...entry, qty: entry.qty - 1 } : entry)
      .filter((entry) => entry.qty > 0));
  }

  return (
    <main>
      <nav className="nav">
        <strong>{spec.title}</strong>
        <div>
          <a href="#catalog">Catalog</a>
          <a href="#summary">Summary</a>
          <a href="#flow">Flow</a>
        </div>
      </nav>

      <header className="hero">
        <div className="hero-copy">
          <span>{spec.appType} for {spec.audience}</span>
          <h1>{headline()}</h1>
          <p>Agentica inferred the domain, modules, data, actions, and UI from the prompt instead of using one fixed template.</p>
          <div className="hero-actions">
            <a className="button primary" href="#catalog">{spec.primaryAction} <ArrowRight size={18} /></a>
            <a className="button" href="#summary">{spec.secondaryAction}</a>
          </div>
        </div>
      </header>

      <section className="strip">
        <strong>{spec.stats.items} {spec.stats.label}</strong>
        <span>{spec.modules.slice(0, 4).join(" • ")}</span>
      </section>

      <section className="workspace" id="catalog">
        <aside className="control-panel">
          <label className="search">
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" />
          </label>
          <div className="filters">
            {categories.map((entry) => (
              <button className={entry === category ? "active" : ""} key={entry} onClick={() => setCategory(entry)}>{entry}</button>
            ))}
          </div>
          <div className="summary-box" id="summary">
            <ShoppingBag size={22} />
            <strong>{spec.appType === "restaurant" ? "Order" : spec.appType === "booking" ? "Reservation" : "Cart"} summary</strong>
            {cart.length ? cart.map((item) => (
              <div className="line" key={item.id}>
                <span>{item.name} x{item.qty}</span>
                <button onClick={() => decreaseItem(item.id)}><Minus size={14} /></button>
              </div>
            )) : <p>No items selected yet.</p>}
            <h3>{money(total) || cart.length + " selected"}</h3>
            <button className="button primary full" onClick={() => alert("Demo flow: connect payment/API next")}>{spec.secondaryAction}</button>
          </div>
        </aside>

        <section className="cards">
          {visibleItems.map((item) => (
            <article className="card" key={item.id}>
              <div className="thumb">{item.category.slice(0, 2).toUpperCase()}</div>
              <div className="card-head"><span>{item.category}</span><b>{item.rating}★</b></div>
              <h2>{item.name}</h2>
              <p>{item.description}</p>
              <div className="card-foot">
                <strong>{money(item.price) || item.inventory + " slots"}</strong>
                <button onClick={() => addItem(item)}><Plus size={16} /> {spec.primaryAction}</button>
              </div>
            </article>
          ))}
        </section>
      </section>

      <section className="flow" id="flow">
        {spec.modules.slice(0, 6).map((module, index) => (
          <div key={module}>
            <CheckCircle2 size={18} />
            <span>0{index + 1}</span>
            <strong>{module}</strong>
            <p>Generated because the prompt calls for a {spec.appType} experience.</p>
          </div>
        ))}
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
