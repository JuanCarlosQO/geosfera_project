// js/telemetry.js - Interfaz visual y bucle en tiempo real para el simulador de telemetría
import { calculateTelemetry } from './telemetry-core.js';

export function initTelemetryView(container) {
    let baseValues = {
        heartRate: 75,
        co2Level: 450,
        fatigueIndex: 20,
        radiation: 1.25
    };

    container.innerHTML = `
        <div class="telemetry-dashboard">
            <h2>Astronaut Telemetry & Health Monitoring</h2>
            <div class="metrics-grid">
                <div class="metric-card" id="card-hr">
                    <h3>Heart Rate</h3>
                    <span class="value" id="val-hr">--</span> bpm
                </div>
                <div class="metric-card" id="card-co2">
                    <h3>Suit / Cabin CO₂</h3>
                    <span class="value" id="val-co2">--</span> ppm
                </div>
                <div class="metric-card" id="card-fatigue">
                    <h3>Fatigue Index</h3>
                    <span class="value" id="val-fatigue">--</span> %
                </div>
                <div class="metric-card" id="card-rad">
                    <h3>Radiation</h3>
                    <span class="value" id="val-rad">--</span> mSv
                </div>
            </div>
            <div class="controls-panel">
                <button id="btn-nominal" class="btn">Nominal State</button>
                <button id="btn-emergency" class="btn alert">Simulate CO₂ Emergency</button>
            </div>
            <div id="alert-box" class="alert-box">Status: NOMINAL</div>
        </div>
    `;

    let currentScenario = 'nominal';

    container.querySelector('#btn-nominal').addEventListener('click', () => { currentScenario = 'nominal'; });
    container.querySelector('#btn-emergency').addEventListener('click', () => { currentScenario = 'emergency_co2'; });

    setInterval(() => {
        const data = calculateTelemetry(baseValues, currentScenario);
        
        container.querySelector('#val-hr').textContent = data.heartRate;
        container.querySelector('#val-co2').textContent = data.co2Level;
        container.querySelector('#val-fatigue').textContent = Math.round(data.fatigueIndex);
        container.querySelector('#val-rad').textContent = data.radiation;

        const alertBox = container.querySelector('#alert-box');
        alertBox.textContent = `Status: ${data.status} ${data.alerts.length > 0 ? '- ' + data.alerts[0].message : ''}`;
        alertBox.className = `alert-box ${data.status.toLowerCase()}`;
    }, 1000);
}