# 🚀 ARES-SALUS // Bio-Stochastic Medical Engine

> **Mission Extinction Countermeasure** — A high-performance stochastic drug trial simulator built for pandemic-level threat analysis.

![Go](https://img.shields.io/badge/Backend-Go-00ADD8?style=for-the-badge&logo=go)
![HTML5](https://img.shields.io/badge/Frontend-HTML5%2FCSS3%2FJS-E34F26?style=for-the-badge&logo=html5)
![Monte Carlo](https://img.shields.io/badge/Engine-Monte%20Carlo-FF6F00?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)

---

## 🧬 What is ARES-SALUS?

**ARES-SALUS** is a NASA/Mars-themed stochastic medicine testing engine that simulates experimental drug trials on virtual human cohorts. Built with a Go backend for high-performance concurrent Monte Carlo simulations and a futuristic Martian HUD frontend.

The simulator models a fictional pandemic called **"The Extinction Strain"** and provides real-time telemetry, biological diagnostic radar, and clinical survival curves for life-critical healthcare analysis.

---

## ⚡ Features

- 🔬 **Stochastic Monte Carlo Engine** — Go goroutines process patients concurrently across parallel worker pools
- 💊 **Full Pharmacokinetics (PK/PD)** — Drug absorption, clearance, receptor binding affinity, saturation kinetics
- 🦠 **Viral Dynamics Model** — Pathogen replication, immune clearance, state transitions (Healthy → Infected → Critical → Recovered/Deceased)
- 🧫 **Organ Toxicity System** — Stochastic damage from both viral load and drug side effects
- 📡 **Live Biological Radar** — Animated canvas-based radar scope with real-time compound binding visualization
- 📊 **SVG Telemetry Charts** — Real-time cohort distribution timeline (Infected / Recovered / Deceased)
- 🖥️ **Stochastic Event Log** — Live terminal console with clinical state transition events
- 🔊 **Martian Ambient Audio** — Procedurally generated Web Audio API soundscape

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| Backend | Go (net/http, goroutines, sync) |
| Frontend | HTML5, Vanilla CSS, JavaScript |
| Simulation | Monte Carlo, PK/PD modeling |
| Rendering | SVG Charts, Canvas API, Web Audio API |
| Typography | Orbitron + Share Tech Mono (Google Fonts) |

---

## 🚀 Getting Started

### Prerequisites
- [Go 1.21+](https://go.dev/dl/)

### Run locally

```bash
# Clone the repository
git clone https://github.com/danielkt34/motor-estocastico-sector-salud.git
cd motor-estocastico-sector-salud

# Run the Go server
go run main.go
```

The browser will open automatically at **http://localhost:8080**

---

## 🎛️ Simulation Parameters

| Parameter | Description |
|---|---|
| **Cohort Size** | Number of virtual patients (10–1000) |
| **Pathogen Severity** | LOW / ELEVATED / LETHAL strain variants |
| **Receptor Binding Affinity** | Probability of drug binding to pathogenic receptors |
| **Cellular Penetration** | Absorption coefficient through lipid bilayer |
| **Systemic Toxicity** | Stochastic hepatic/renal cell damage factor |
| **Daily Dosage** | Agent accumulation level (10–200 mg) |
| **Trial Duration** | Simulation length in days (10–45) |

---

## 📐 Simulation Architecture

```
SimulationRequest
      │
      ▼
 Cohort Init (Stochastic baseline: age, immune strength, organ resilience)
      │
      ▼
 Day Loop ──► Goroutine Workers (concurrent patient processing)
      │              │
      │              ├── PK: Drug absorption + clearance
      │              ├── PD: Receptor binding (saturation kinetics)
      │              ├── Viral: Pathogen replication + immune response
      │              ├── Toxicity: Organ damage accumulation
      │              └── State: Healthy → Infected → Critical → Recovered/Deceased
      │
      ▼
 DailyStats aggregation → SimulationResponse → Frontend HUD
```

---

## 📄 License

MIT © 2026 danielkt34
