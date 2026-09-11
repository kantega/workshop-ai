import type { ReactNode } from "react";
import logo from "./valer-logo.svg";

export function Layout({ children, person }: { children: ReactNode; person?: string | null }) {
  return (
    <div className="vk">
      <header className="vk-header">
        <div className="wrap">
          <a href="#/" aria-label="Til forsiden">
            <img className="vk-logo" src={logo} alt="Våler kommune" />
          </a>
          <nav className="vk-nav" aria-label="Hovedmeny">
            <a href="https://www.valer.kommune.no/" target="_blank" rel="noreferrer">
              Tjenester
            </a>
            <a href="https://www.valer.kommune.no/" target="_blank" rel="noreferrer">
              Politikk
            </a>
            <a href="https://www.valer.kommune.no/" target="_blank" rel="noreferrer">
              Kommunen vår
            </a>
            <a href="https://www.valer.kommune.no/" target="_blank" rel="noreferrer">
              Kontakt
            </a>
            <span className="btn btn-secondary" style={{ padding: "0.6rem 1rem", fontSize: "0.9375rem" }}>
              {person ?? "Min kommune"}
            </span>
          </nav>
        </div>
      </header>
      {children}
      <footer className="vk-footer">
        <div className="wrap">
          <div>
            <strong>Våler kommune</strong>
            Herredshuset, Kjosveien 1, 1592 Våler i Østfold
            <br />
            <a href="tel:+4769289100">69 28 91 00</a> · <a href="mailto:postmottak@valer.kommune.no">postmottak@valer.kommune.no</a>
          </div>
          <ul>
            <li>
              <a href="https://www.valer.kommune.no/" target="_blank" rel="noreferrer">
                Personvern og informasjonskapsler
              </a>
            </li>
            <li>
              <a href="https://www.valer.kommune.no/" target="_blank" rel="noreferrer">
                Tilgjengelighetserklæring
              </a>
            </li>
            <li>
              <a href="#/verktoy">Verktøy for demo (utsted testbevis)</a>
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
