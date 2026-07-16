package main

import (
	"encoding/json"
	"fmt"
	"log"
	"math"
	"math/rand"
	"net/http"
	"os/exec"
	"runtime"
	"sync"
	"time"
)

// SimulationRequest holds the incoming parameters from the UI
type SimulationRequest struct {
	CohortSize         int     `json:"cohortSize"`
	PathogenSeverity   float64 `json:"pathogenSeverity"`
	DrugAffinity       float64 `json:"drugAffinity"`
	CellPenetration    float64 `json:"cellPenetration"`
	SystemicToxicity   float64 `json:"systemicToxicity"`
	DailyDosage        float64 `json:"dailyDosage"`
	SimulationDays     int     `json:"simulationDays"`
}

// PatientState represents the current clinical status of a virtual patient
type PatientState string

const (
	StateHealthy   PatientState = "HEALTHY"
	StateInfected  PatientState = "INFECTED"
	StateCritical  PatientState = "CRITICAL"
	StateRecovered PatientState = "RECOVERED"
	StateDeceased  PatientState = "DECEASED"
)

// Patient holds the virtual biological parameters of a subject
type Patient struct {
	ID               int
	Age              float64
	ImmuneStrength   float64
	OrganResilience  float64
	PathogenLoad     float64
	DrugLevel        float64
	ReceptorsBlocked float64
	OrganDamage      float64
	State            PatientState
}

// DailyStats records aggregate data for a single day of simulation
type DailyStats struct {
	Day                int            `json:"day"`
	HealthyCount       int            `json:"healthyCount"`
	InfectedCount      int            `json:"infectedCount"`
	CriticalCount      int            `json:"criticalCount"`
	RecoveredCount     int            `json:"recoveredCount"`
	DeceasedCount      int            `json:"deceasedCount"`
	AvgViralLoad       float64        `json:"avgViralLoad"`
	AvgOrganDamage     float64        `json:"avgOrganDamage"`
	AvgDrugLevel       float64        `json:"avgDrugLevel"`
}

// SimulationEvent log messages for highlighting stochastic transitions
type SimulationEvent struct {
	Day     int          `json:"day"`
	PatientID int        `json:"patientId"`
	Message string       `json:"message"`
	Type    string       `json:"type"` // "info", "warning", "danger", "success"
}

// SimulationResponse contains the complete result of the simulation
type SimulationResponse struct {
	Timeline []DailyStats      `json:"timeline"`
	Events   []SimulationEvent `json:"events"`
	Summary  string            `json:"summary"`
}

func main() {
	// Seed random generator
	rand.Seed(time.Now().UnixNano())

	// Static routes
	http.HandleFunc("/", serveHTML)
	http.HandleFunc("/style.css", serveCSS)
	http.HandleFunc("/app.js", serveJS)
	
	// API routes
	http.HandleFunc("/api/simulate", handleSimulate)

	port := ":8080"
	fmt.Printf("[SYSTEM] Ares-Salus Medical Core Initialized.\n")
	fmt.Printf("[SYSTEM] Server starting on http://localhost%s...\n", port)

	// Automatically open browser on startup in another goroutine
	go func() {
		time.Sleep(1 * time.Second)
		openBrowser("http://localhost:8080")
	}()

	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func serveHTML(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "index.html")
}

func serveCSS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/css")
	http.ServeFile(w, r, "style.css")
}

func serveJS(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/javascript")
	http.ServeFile(w, r, "app.js")
}

func handleSimulate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req SimulationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate inputs
	if req.CohortSize <= 0 {
		req.CohortSize = 100
	}
	if req.SimulationDays <= 0 {
		req.SimulationDays = 30
	}

	res := runStochasticSimulation(req)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(res)
}

func runStochasticSimulation(req SimulationRequest) SimulationResponse {
	// Initialize Cohort
	cohort := make([]*Patient, req.CohortSize)
	for i := 0; i < req.CohortSize; i++ {
		// Stochastic baseline generation
		age := 18.0 + rand.Float64()*72.0
		immuneStrength := 0.3 + rand.Float64()*0.7 - (age-18.0)*0.003 // Age degrades immune strength
		if immuneStrength < 0.1 {
			immuneStrength = 0.1
		}
		organResilience := 0.4 + rand.Float64()*0.6 - (age-18.0)*0.002 // Age degrades resilience
		if organResilience < 0.1 {
			organResilience = 0.1
		}

		// Initially, 80% of the cohort is infected (this is the pandemic outbreak testing environment)
		state := StateHealthy
		pathogenLoad := 0.0
		if rand.Float64() < 0.8 {
			state = StateInfected
			pathogenLoad = 0.1 + rand.Float64()*0.3
		}

		cohort[i] = &Patient{
			ID:               i + 1,
			Age:              age,
			ImmuneStrength:   immuneStrength,
			OrganResilience:  organResilience,
			PathogenLoad:     pathogenLoad,
			DrugLevel:        0.0,
			ReceptorsBlocked: 0.0,
			OrganDamage:      0.0,
			State:            state,
		}
	}

	var events []SimulationEvent
	var eventsMutex sync.Mutex
	timeline := make([]DailyStats, req.SimulationDays)

	// We'll run the day-by-day simulation. To show off concurrency in Go,
	// we will process patients concurrently for each day.
	for day := 1; day <= req.SimulationDays; day++ {
		var wg sync.WaitGroup
		chunkSize := 100
		numWorkers := (req.CohortSize + chunkSize - 1) / chunkSize

		// Daily aggregates
		var dayHealthy, dayInfected, dayCritical, dayRecovered, dayDeceased int
		var totalViral, totalDamage, totalDrug float64
		var statsMutex sync.Mutex

		for w := 0; w < numWorkers; w++ {
			wg.Add(1)
			startIdx := w * chunkSize
			endIdx := startIdx + chunkSize
			if endIdx > req.CohortSize {
				endIdx = req.CohortSize
			}

			go func(start, end int) {
				defer wg.Done()
				
				localHealthy := 0
				localInfected := 0
				localCritical := 0
				localRecovered := 0
				localDeceased := 0
				localViral := 0.0
				localDamage := 0.0
				localDrug := 0.0

				for i := start; i < end; i++ {
					p := cohort[i]

					if p.State == StateDeceased {
						localDeceased++
						continue
					}

					// 1. PHARMACOKINETICS (PK) - Drug absorption and metabolism
					// Drug intake
					absorption := req.DailyDosage * req.CellPenetration * (0.8 + rand.Float64()*0.4)
					p.DrugLevel += absorption
					// Drug clearance (based on age and organ resilience)
					clearanceRate := 0.35 + (1.0 - p.OrganResilience)*0.25
					p.DrugLevel *= math.Max(0, 1.0-clearanceRate)

					// 2. PHARMACODYNAMICS (PD) - Binding affinity and receptor blocking
					if p.DrugLevel > 0.01 {
						// Saturation kinetics with stochasticity
						targetBlockProb := (p.DrugLevel * req.DrugAffinity) / (10.0 + p.DrugLevel*req.DrugAffinity)
						p.ReceptorsBlocked = p.ReceptorsBlocked + (targetBlockProb - p.ReceptorsBlocked) * 0.4
					} else {
						p.ReceptorsBlocked *= 0.7 // Decay
					}

					// 3. VIRAL/PATHOGEN DYNAMICS
					if p.State == StateInfected || p.State == StateCritical {
						// Pathogen replicates
						// Receptor blockage directly stops replication
						growthFactor := req.PathogenSeverity * (1.0 - p.ReceptorsBlocked) * 0.4
						p.PathogenLoad += growthFactor * (1.2 - p.ImmuneStrength) * (0.9 + rand.Float64()*0.2)

						// Immune clearance
						immuneClear := p.ImmuneStrength * 0.08 * (0.9 + rand.Float64()*0.2)
						p.PathogenLoad -= immuneClear

						if p.PathogenLoad < 0 {
							p.PathogenLoad = 0
						}
					}

					// 4. TOXICITY & ORGAN DAMAGE
					// Damage from drug toxicity
					toxDamage := (p.DrugLevel * req.SystemicToxicity) / (p.OrganResilience * 600.0)
					// Damage from viral infection inflammatory response
					virDamage := 0.0
					if p.PathogenLoad > 0.5 {
						virDamage = (p.PathogenLoad - 0.5) * 0.04
					}
					p.OrganDamage += (toxDamage + virDamage) * (0.9 + rand.Float64()*0.2)

					// Healing factor if pathogen is low
					if p.PathogenLoad < 0.2 && p.OrganDamage > 0 {
						heal := p.OrganResilience * 0.02
						p.OrganDamage = math.Max(0, p.OrganDamage-heal)
					}

					// 5. STATE TRANSITIONS
					oldState := p.State
					newState := oldState

					if p.OrganDamage >= 1.0 || p.PathogenLoad >= 1.2 {
						newState = StateDeceased
						p.PathogenLoad = 0
						p.DrugLevel = 0
						p.ReceptorsBlocked = 0
					} else if p.PathogenLoad <= 0.01 && (p.State == StateInfected || p.State == StateCritical) {
						newState = StateRecovered
						p.PathogenLoad = 0
					} else if p.State == StateInfected && (p.PathogenLoad > 0.65 || p.OrganDamage > 0.65) {
						newState = StateCritical
					} else if p.State == StateCritical && p.PathogenLoad <= 0.65 && p.OrganDamage <= 0.65 {
						newState = StateInfected
					}

					p.State = newState

					// Stochastic Event Logging (Only capture key highlights to not bloat JSON)
					if oldState != newState && rand.Float64() < 0.15 {
						eventsMutex.Lock()
						if len(events) < 100 { // Cap events count
							var msg string
							var eventType string
							switch newState {
							case StateRecovered:
								msg = fmt.Sprintf("Subject #%d (Age %.0f) recovered from Extinction Strain. Receptors fully cleared.", p.ID, p.Age)
								eventType = "success"
							case StateDeceased:
								if p.OrganDamage >= 1.0 && p.PathogenLoad < 0.6 {
									msg = fmt.Sprintf("Subject #%d deceased. Cause: Severe systemic organ toxicity.", p.ID)
								} else {
									msg = fmt.Sprintf("Subject #%d deceased. Cause: Acute pathogen replication.", p.ID)
								}
								eventType = "danger"
							case StateCritical:
								msg = fmt.Sprintf("Subject #%d transitioned to Critical. Viral Load: %.2f, Organ strain high.", p.ID, p.PathogenLoad)
								eventType = "warning"
							case StateInfected:
								msg = fmt.Sprintf("Subject #%d stabilized back to infected status.", p.ID)
								eventType = "info"
							}
							events = append(events, SimulationEvent{
								Day:       day,
								PatientID: p.ID,
								Message:   msg,
								Type:      eventType,
							})
						}
						eventsMutex.Unlock()
					}

					// Accumulate local statistics
					switch p.State {
					case StateHealthy:
						localHealthy++
					case StateInfected:
						localInfected++
					case StateCritical:
						localCritical++
					case StateRecovered:
						localRecovered++
					case StateDeceased:
						localDeceased++
					}
					localViral += p.PathogenLoad
					localDamage += p.OrganDamage
					localDrug += p.DrugLevel
				}

				// Merge into daily aggregates safely
				statsMutex.Lock()
				dayHealthy += localHealthy
				dayInfected += localInfected
				dayCritical += localCritical
				dayRecovered += localRecovered
				dayDeceased += localDeceased
				totalViral += localViral
				totalDamage += localDamage
				totalDrug += localDrug
				statsMutex.Unlock()

			}(startIdx, endIdx)
		}

		wg.Wait()

		// Calculate averages
		aliveCount := req.CohortSize - dayDeceased
		avgViral := 0.0
		avgDamage := 0.0
		avgDrug := 0.0
		if aliveCount > 0 {
			avgViral = totalViral / float64(aliveCount)
			avgDamage = totalDamage / float64(aliveCount)
			avgDrug = totalDrug / float64(aliveCount)
		}

		timeline[day-1] = DailyStats{
			Day:            day,
			HealthyCount:   dayHealthy,
			InfectedCount:  dayInfected,
			CriticalCount:  dayCritical,
			RecoveredCount: dayRecovered,
			DeceasedCount:  dayDeceased,
			AvgViralLoad:   avgViral,
			AvgOrganDamage: avgDamage,
			AvgDrugLevel:   avgDrug,
		}
	}

	// Calculate final outcome metrics for summary
	finalStats := timeline[len(timeline)-1]
	survivalRate := float64(req.CohortSize-finalStats.DeceasedCount) / float64(req.CohortSize) * 100.0
	efficacyRate := float64(finalStats.RecoveredCount+finalStats.HealthyCount) / float64(req.CohortSize) * 100.0
	
	summary := fmt.Sprintf(
		"TRIAL COMPLETED. Survival Rate: %.1f%%. Efficacy (Cured/Healthy): %.1f%%. Final deceased count: %d/%d.",
		survivalRate, efficacyRate, finalStats.DeceasedCount, req.CohortSize,
	)

	return SimulationResponse{
		Timeline: timeline,
		Events:   events,
		Summary:  summary,
	}
}

// openBrowser utility to open the default system web browser
func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("cmd", "/c", "start", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	default:
		err = fmt.Errorf("unsupported platform")
	}
	if err != nil {
		fmt.Printf("[SYSTEM] Could not auto-launch browser: %v. Please open %s manually.\n", err, url)
	}
}
