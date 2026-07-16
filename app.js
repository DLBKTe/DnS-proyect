// ==========================================
// PROJECT ARES-SALUS - FRONTEND CORE LOGIC
// ==========================================

// --- State Variables ---
let audioCtx = null;
let ambientOsc1 = null;
let ambientOsc2 = null;
let ambientGain = null;
let audioEnabled = false;

let canvas = null;
let ctx = null;
let canvasAnimId = null;
let particles = [];
let receptors = [];
let simActive = false;
let simProgress = 0; // 0 to 1

// Simulation configurations
let config = {
    cohortSize: 250,
    pathogenSeverity: 0.55,
    drugAffinity: 0.75,
    cellPenetration: 0.60,
    systemicToxicity: 0.15,
    dailyDosage: 80,
    simulationDays: 30
};

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
    initSliders();
    initCanvas();
    initEventListeners();
});

// --- Sliders & Inputs ---
function initSliders() {
    const sliders = [
        { id: "drug-affinity", displayId: "val-affinity", suffix: "" },
        { id: "cell-penetration", displayId: "val-penetration", suffix: "" },
        { id: "systemic-toxicity", displayId: "val-toxicity", suffix: "" },
        { id: "daily-dosage", displayId: "val-dosage", suffix: " mg" },
        { id: "simulation-days", displayId: "val-days", suffix: " Days" }
    ];

    sliders.forEach(slider => {
        const inputEl = document.getElementById(slider.id);
        const displayEl = document.getElementById(slider.displayId);
        
        if (inputEl && displayEl) {
            inputEl.addEventListener("input", (e) => {
                const val = parseFloat(e.target.value);
                displayEl.textContent = val + slider.suffix;
                config[slider.id.replace(/-([a-z])/g, g => g[1].toUpperCase())] = val;
                playChirp(800, 0.01, 0.02); // Tactile audio feedback
            });
        }
    });

    const cohortSizeInput = document.getElementById("cohort-size");
    cohortSizeInput.addEventListener("change", (e) => {
        config.cohortSize = parseInt(e.target.value) || 250;
        playChirp(600, 0.02, 0.05);
    });

    const severitySelect = document.getElementById("pathogen-severity");
    severitySelect.addEventListener("change", (e) => {
        config.pathogenSeverity = parseFloat(e.target.value);
        playChirp(500, 0.03, 0.08);
    });
}

function initEventListeners() {
    const audioBtn = document.getElementById("audio-toggle");
    audioBtn.addEventListener("click", () => {
        toggleAudio();
    });

    const runBtn = document.getElementById("run-btn");
    runBtn.addEventListener("click", () => {
        runStochasticTrial();
    });
    
    // Add hover sound effects to buttons
    const buttons = document.querySelectorAll(".btn");
    buttons.forEach(btn => {
        btn.addEventListener("mouseenter", () => {
            playChirp(1200, 0.005, 0.01);
        });
    });
}

// ==========================================
// AUDIO SYNTHESIZER ENGINE (WEB AUDIO API)
// ==========================================

function toggleAudio() {
    if (!audioCtx) {
        // Initialize Web Audio
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
    }

    const audioBtn = document.getElementById("audio-toggle");

    if (!audioEnabled) {
        // Resume context if suspended
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        startAmbientHum();
        audioEnabled = true;
        audioBtn.innerHTML = '<span class="audio-icon">🔊</span> SYSTEM AUDIO ACTIVE';
        audioBtn.classList.remove("btn-secondary");
        audioBtn.classList.add("btn-primary");
        playSonarSweep();
    } else {
        stopAmbientHum();
        audioEnabled = false;
        audioBtn.innerHTML = '<span class="audio-icon">🔇</span> SYSTEM AUDIO OFF';
        audioBtn.classList.remove("btn-primary");
        audioBtn.classList.add("btn-secondary");
    }
}

// Background space hum
function startAmbientHum() {
    if (!audioCtx) return;

    // Create Oscillators
    ambientOsc1 = audioCtx.createOscillator();
    ambientOsc2 = audioCtx.createOscillator();
    ambientGain = audioCtx.createGain();
    
    // Low frequency hum + harmonic
    ambientOsc1.type = 'sine';
    ambientOsc1.frequency.value = 55.0; // A1 note
    
    ambientOsc2.type = 'sawtooth';
    ambientOsc2.frequency.value = 110.0; // A2 note
    
    // Low-pass filter to make hum dark and muffled
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 120;
    filter.Q.value = 1.0;

    ambientGain.gain.setValueAtTime(0.04, audioCtx.currentTime); // Low volume background

    // Connections
    ambientOsc1.connect(filter);
    ambientOsc2.connect(filter);
    
    const harmonyGain = audioCtx.createGain();
    harmonyGain.gain.value = 0.15; // Muffle the sawtooth harmonic
    ambientOsc2.connect(harmonyGain);
    harmonyGain.connect(filter);
    
    filter.connect(ambientGain);
    ambientGain.connect(audioCtx.destination);

    ambientOsc1.start();
    ambientOsc2.start();
}

function stopAmbientHum() {
    if (ambientOsc1) {
        try { ambientOsc1.stop(); } catch(e){}
    }
    if (ambientOsc2) {
        try { ambientOsc2.stop(); } catch(e){}
    }
    ambientOsc1 = null;
    ambientOsc2 = null;
}

// Diagnostic Sonar/Radar Sweep sound
function playSonarSweep() {
    if (!audioEnabled || !audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 1.2);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(300, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(1000, audioCtx.currentTime + 1.2);
    filter.Q.value = 3.0;

    gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.4);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 1.5);
}

// Interactive feedback chirp
function playChirp(frequency = 800, volume = 0.05, duration = 0.05) {
    if (!audioEnabled || !audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.5, audioCtx.currentTime + duration);

    gain.gain.setValueAtTime(volume, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.01);
}

// Alarm/Emergency beeper
function playAlarmTone(duration = 0.5) {
    if (!audioEnabled || !audioCtx) return;

    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(660, audioCtx.currentTime);
    
    // Pitch LFO modulation
    osc.frequency.linearRampToValueAtTime(440, audioCtx.currentTime + duration * 0.5);
    osc.frequency.linearRampToValueAtTime(660, audioCtx.currentTime + duration);

    gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.08, audioCtx.currentTime + duration - 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1000;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + duration + 0.05);
}

// ==========================================
// BIO-SCANNER ANIMATION ENGINE (CANVAS)
// ==========================================

function initCanvas() {
    canvas = document.getElementById("radar-canvas");
    ctx = canvas.getContext("2d");
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Populate stationary target receptors inside the cellular membrane structure
    receptors = [];
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = 65; // Inner cell boundary
    const receptorCount = 8;

    for (let i = 0; i < receptorCount; i++) {
        const angle = (i / receptorCount) * Math.PI * 2;
        receptors.push({
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            angle: angle,
            blocked: false,
            blockedProgress: 0,
            pulseRadius: 8,
            infected: false
        });
    }

    // Start background particle loop
    simActive = false;
    particles = [];
    generateBackgroundParticles();
    animateCanvas();
}

function resizeCanvas() {
    if (!canvas) return;
    const rect = canvas.parentElement.getBoundingClientRect();
    canvas.width = Math.min(rect.width, 400);
    canvas.height = Math.min(rect.width, 400);
}

function generateBackgroundParticles() {
    // Generate organic ambient cells/mitochondria
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    particles = [];
    
    for (let i = 0; i < 25; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            radius: 2 + Math.random() * 3,
            color: "rgba(255, 255, 255, 0.08)",
            type: "ambient"
        });
    }
}

// Run loop for the biological diagnostic radar
function animateCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const maxRadius = canvas.width / 2 - 10;
    
    // Draw Radar Ring Backgrounds
    ctx.strokeStyle = "rgba(209, 79, 38, 0.15)";
    ctx.lineWidth = 1;
    
    // Outer circle
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Medium radar ring
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius * 0.65, 0, Math.PI * 2);
    ctx.stroke();

    // Inner cell membrane structure
    ctx.strokeStyle = "rgba(0, 230, 118, 0.25)";
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(centerX, centerY, 65, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw scanning sweeper line
    const sweepAngle = (Date.now() / 2500) % (Math.PI * 2);
    ctx.strokeStyle = "rgba(209, 79, 38, 0.1)";
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(sweepAngle) * maxRadius, centerY + Math.sin(sweepAngle) * maxRadius);
    ctx.stroke();
    
    // Draw sweeping glow arc
    let gradient = ctx.createRadialGradient(centerX, centerY, 20, centerX, centerY, maxRadius);
    gradient.addColorStop(0, "rgba(209, 79, 38, 0.0)");
    gradient.addColorStop(0.9, "rgba(209, 79, 38, 0.02)");
    gradient.addColorStop(1, "rgba(209, 79, 38, 0.05)");
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
    ctx.fill();

    // UPDATE AND DRAW RECEPTORS
    receptors.forEach(r => {
        // Redraw center anchor
        r.x = centerX + Math.cos(r.angle) * 65;
        r.y = centerY + Math.sin(r.angle) * 65;

        // Draw receptor glow
        ctx.beginPath();
        if (r.blocked) {
            ctx.fillStyle = "rgba(255, 179, 0, 0.25)";
            ctx.strokeStyle = "rgba(255, 179, 0, 0.8)";
        } else if (r.infected) {
            ctx.fillStyle = "rgba(255, 23, 68, 0.2)";
            ctx.strokeStyle = "rgba(255, 23, 68, 0.8)";
        } else {
            ctx.fillStyle = "rgba(0, 230, 118, 0.1)";
            ctx.strokeStyle = "rgba(0, 230, 118, 0.6)";
        }
        ctx.arc(r.x, r.y, r.pulseRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Pulsing animation
        r.pulseRadius += (r.blocked || r.infected ? 0.08 : 0.02);
        if (r.pulseRadius > (r.blocked || r.infected ? 12 : 9)) {
            r.pulseRadius = r.blocked || r.infected ? 7 : 6;
        }

        // Label receptor ID
        ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
        ctx.font = "8px Share Tech Mono";
        ctx.fillText("REC-" + Math.floor(r.angle * 10), r.x - 12, r.y - 12);
    });

    // UPDATE AND DRAW PARTICLES
    particles.forEach((p, idx) => {
        // Stochastic motion (random walks / brownian influence)
        p.vx += (Math.random() - 0.5) * 0.15;
        p.vy += (Math.random() - 0.5) * 0.15;
        
        // Speed limits
        const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        const maxSpeed = p.type === "drug" ? 1.5 : p.type === "pathogen" ? 1.0 : 0.4;
        if (speed > maxSpeed) {
            p.vx = (p.vx / speed) * maxSpeed;
            p.vy = (p.vy / speed) * maxSpeed;
        }

        p.x += p.vx;
        p.y += p.vy;

        // Boundary checks (stay inside scope circle or bounce)
        const dist = Math.sqrt((p.x - centerX) * (p.x - centerX) + (p.y - centerY) * (p.y - centerY));
        if (dist > maxRadius - 5) {
            const angle = Math.atan2(p.y - centerY, p.x - centerX);
            p.x = centerX + Math.cos(angle) * (maxRadius - 6);
            p.vx = -p.vx * 0.8;
            p.vy = -p.vy * 0.8;
        }

        // Draw Particle
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();

        // If trial is running, check molecular binding collisions
        if (simActive) {
            receptors.forEach(r => {
                const rDist = Math.sqrt((p.x - r.x) * (p.x - r.x) + (p.y - r.y) * (p.y - r.y));
                if (rDist < 12) {
                    if (p.type === "drug" && !r.blocked) {
                        r.blocked = true;
                        r.infected = false;
                        // Particle is absorbed/binded: remove it
                        particles.splice(idx, 1);
                        playChirp(1000, 0.02, 0.03); // Binding chirp
                    } else if (p.type === "pathogen" && !r.blocked && !r.infected) {
                        r.infected = true;
                        particles.splice(idx, 1);
                        playChirp(300, 0.04, 0.08); // Infection alert chirp
                    }
                }
            });
        }
    });

    // Spawning drug and pathogen particles dynamically during active trial
    if (simActive && Math.random() < 0.12) {
        // Spawn Drug (coming from bloodstream outer rim)
        const spawnAngle = Math.random() * Math.PI * 2;
        particles.push({
            x: centerX + Math.cos(spawnAngle) * (maxRadius - 10),
            y: centerY + Math.sin(spawnAngle) * (maxRadius - 10),
            vx: -Math.cos(spawnAngle) * (0.8 + Math.random() * 0.5),
            vy: -Math.sin(spawnAngle) * (0.8 + Math.random() * 0.5),
            radius: 3,
            color: "rgba(255, 179, 0, 0.8)",
            type: "drug"
        });
    }

    if (simActive && Math.random() < (config.pathogenSeverity * 0.15)) {
        // Spawn Pathogen (coming from infected cell centers or outside)
        const spawnAngle = Math.random() * Math.PI * 2;
        particles.push({
            x: centerX + Math.cos(spawnAngle) * (20 + Math.random() * 30),
            y: centerY + Math.sin(spawnAngle) * (20 + Math.random() * 30),
            vx: Math.cos(spawnAngle) * (0.5 + Math.random() * 0.5),
            vy: Math.sin(spawnAngle) * (0.5 + Math.random() * 0.5),
            radius: 4,
            color: "rgba(255, 23, 68, 0.85)",
            type: "pathogen"
        });
    }

    canvasAnimId = requestAnimationFrame(animateCanvas);
}

// ==========================================
// STOCHASTIC TRIAL CONTROLLER
// ==========================================

async function runStochasticTrial() {
    const runBtn = document.getElementById("run-btn");
    runBtn.disabled = true;
    runBtn.textContent = "⚙️ CALCULATING PARALLEL MARKONIAN PATHS...";
    
    document.getElementById("engine-state").textContent = "SIMULATING";
    document.getElementById("engine-state").className = "value text-amber blink";
    document.getElementById("trial-summary").textContent = "Generating cohort baseline parameters. Triggering concurrent Monte Carlo trajectories...";
    
    // Clear receptor blocking and infection state
    receptors.forEach(r => {
        r.blocked = false;
        r.infected = false;
    });
    
    playSonarSweep();

    try {
        const response = await fetch("/api/simulate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(config)
        });

        if (!response.ok) {
            throw new Error("API server responded with error code " + response.status);
        }

        const data = await response.json();
        
        // Execute the visual telemetry animation of the results
        animateTelemetryResults(data);
        
    } catch (err) {
        console.error(err);
        document.getElementById("trial-summary").textContent = "API CONNECTION FAILED. Ensure Go backend is online. Err: " + err.message;
        document.getElementById("engine-state").textContent = "ERROR";
        document.getElementById("engine-state").className = "value text-red";
        runBtn.disabled = false;
        runBtn.textContent = "⚡ RUN STOCHASTIC TRIAL";
    }
}

function animateTelemetryResults(data) {
    const timeline = data.timeline;
    const events = data.events;
    const totalDays = timeline.length;
    let currentDayIndex = 0;
    
    simActive = true;
    
    // Clear terminal screen
    const logScreen = document.getElementById("log-screen");
    logScreen.innerHTML = '<div class="log-line text-green">SYS: Telemetry established. Cohort synchronized.</div>';
    
    // Clear particles, keep background
    generateBackgroundParticles();

    // Timer interval to run day-by-day telemetry rendering
    const intervalTime = 250; // 250ms per day = 7.5 seconds for 30 days
    const timer = setInterval(() => {
        if (currentDayIndex >= totalDays) {
            clearInterval(timer);
            simActive = false;
            finalizeTrial(data.summary);
            return;
        }

        const dayStats = timeline[currentDayIndex];
        const currentDay = dayStats.day;
        
        // Update stats widgets
        document.getElementById("stat-healthy").textContent = dayStats.healthyCount;
        document.getElementById("stat-infected").textContent = dayStats.infectedCount;
        document.getElementById("stat-critical").textContent = dayStats.criticalCount;
        document.getElementById("stat-recovered").textContent = dayStats.recoveredCount;
        document.getElementById("stat-deceased").textContent = dayStats.deceasedCount;

        // Update progress bar
        const progressPct = ((currentDayIndex + 1) / totalDays) * 100;
        document.getElementById("progress-bar-fill").style.width = `${progressPct}%`;
        
        // Check for alarms if mortality jumps or critical rate is severe
        if (dayStats.criticalCount > config.cohortSize * 0.3 || dayStats.deceasedCount > config.cohortSize * 0.4) {
            playAlarmTone(0.2);
        } else {
            playChirp(440, 0.02, 0.05); // Telemetry ticker sound
        }

        // Draw/Update SVG curves up to the current day
        drawTelemetryChart(timeline.slice(0, currentDayIndex + 1));

        // Inject event logs for the current day
        const dayEvents = events.filter(e => e.day === currentDay);
        dayEvents.forEach(e => {
            const line = document.createElement("div");
            line.className = `log-line text-${e.type}`;
            line.textContent = `[DAY ${e.day}] ${e.message}`;
            logScreen.appendChild(line);
            
            // Auto scroll console
            logScreen.scrollTop = logScreen.scrollHeight;
        });

        currentDayIndex++;
    }, intervalTime);
}

function drawTelemetryChart(timelineData) {
    const totalDays = config.simulationDays;
    const maxVal = config.cohortSize;

    // SVG coordinates boundaries
    const startX = 40;
    const endX = 480;
    const startY = 150;
    const endY = 20;

    const width = endX - startX;
    const height = startY - endY;

    let activePoints = [];
    let recoveredPoints = [];
    let deceasedPoints = [];

    timelineData.forEach((d, idx) => {
        // x-coord scales linearly with day
        const x = startX + (idx / (totalDays - 1)) * width;
        
        // y-coords scale inversely with ratio
        const activeCount = d.infectedCount + d.criticalCount;
        const yActive = startY - (activeCount / maxVal) * height;
        const yRec = startY - (d.recoveredCount / maxVal) * height;
        const yDec = startY - (d.deceasedCount / maxVal) * height;

        activePoints.push(`${x},${yActive}`);
        recoveredPoints.push(`${x},${yRec}`);
        deceasedPoints.push(`${x},${yDec}`);
    });

    // Write path data
    document.getElementById("path-active").setAttribute("d", activePoints.length > 0 ? "M " + activePoints.join(" L ") : "");
    document.getElementById("path-recovered").setAttribute("d", recoveredPoints.length > 0 ? "M " + recoveredPoints.join(" L ") : "");
    document.getElementById("path-deceased").setAttribute("d", deceasedPoints.length > 0 ? "M " + deceasedPoints.join(" L ") : "");
}

function finalizeTrial(summaryText) {
    const runBtn = document.getElementById("run-btn");
    runBtn.disabled = false;
    runBtn.textContent = "⚡ RUN STOCHASTIC TRIAL";

    document.getElementById("engine-state").textContent = "COMPLETED";
    document.getElementById("engine-state").className = "value text-green";
    document.getElementById("trial-summary").textContent = summaryText;

    // Log completion
    const logScreen = document.getElementById("log-screen");
    const endLine = document.createElement("div");
    endLine.className = "log-line text-green";
    endLine.textContent = `SYS: Stochastic trial concluded. Target telemetry stored.`;
    logScreen.appendChild(endLine);
    logScreen.scrollTop = logScreen.scrollHeight;

    // Play final high chime
    playChirp(1200, 0.08, 0.15);
    setTimeout(() => {
        playChirp(1600, 0.08, 0.25);
    }, 120);
}
