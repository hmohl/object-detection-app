let video = null;
let canvas = null;
let ctx = null;
let model = null;
let isRunning = false;
let animationId = null;

// UI Elemente
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const captureBtn = document.getElementById('captureBtn');
const resultsList = document.getElementById('resultsList');
const statusDiv = document.getElementById('status');

// Modell laden
async function loadModel() {
    try {
        showStatus('Lade KI-Modell...', 'loading');
        model = await cocoSsd.load();
        showStatus('KI-Modell erfolgreich geladen!', 'success');
    } catch (error) {
        console.error('Fehler beim Laden des Modells:', error);
        showStatus('Fehler beim Laden des Modells: ' + error.message, 'error');
    }
}

// Kamera starten
async function startCamera() {
    try {
        showStatus('Kamera wird gestartet...', 'loading');
        
        video = document.getElementById('video');
        canvas = document.getElementById('canvas');
        ctx = canvas.getContext('2d');

        // Kamerazugriff anfordern
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });

        video.srcObject = stream;

        // Warten bis Video geladen ist
        video.onloadedmetadata = () => {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            isRunning = true;
            startBtn.disabled = true;
            stopBtn.disabled = false;
            captureBtn.disabled = false;
            
            showStatus('Kamera aktiv - Analyse läuft...', 'success');
            
            // Detektionsloop starten
            detectObjects();
        };
    } catch (error) {
        console.error('Fehler beim Kamerazugriff:', error);
        showStatus('Fehler: ' + error.message, 'error');
    }
}

// Kamera stoppen
function stopCamera() {
    if (video && video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
    
    isRunning = false;
    startBtn.disabled = false;
    stopBtn.disabled = true;
    captureBtn.disabled = true;
    
    if (animationId) {
        cancelAnimationFrame(animationId);
    }
    
    resultsList.innerHTML = '<div class="empty-state">Kamera gestoppt</div>';
    showStatus('Kamera gestoppt', 'success');
}

// Objekte erkennen
async function detectObjects() {
    if (!isRunning || !model) return;

    try {
        // Bild vom Video auf Canvas zeichnen
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Objekterkennung durchführen
        const predictions = await model.estimateObjects(canvas);

        // Canvas zeichnen mit Erkennungen
        drawPredictions(predictions);

        // Ergebnisse anzeigen
        displayResults(predictions);

    } catch (error) {
        console.error('Fehler bei der Objekterkennung:', error);
    }

    // Nächsten Frame planen
    animationId = requestAnimationFrame(detectObjects);
}

// Erkannungen auf Canvas zeichnen
function drawPredictions(predictions) {
    // Canvas löschen
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Bild erneut zeichnen (transparent)
    ctx.globalAlpha = 0.6;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.globalAlpha = 1.0;

    // Bounding Boxes zeichnen
    predictions.forEach((prediction, index) => {
        const [x, y, width, height] = prediction.bbox;
        
        // Box
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 3;
        ctx.strokeRect(x, y, width, height);

        // Label-Hintergrund
        const text = `${prediction.class} (${(prediction.score * 100).toFixed(1)}%)`;
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 16px Arial';
        
        const textWidth = ctx.measureText(text).width;
        ctx.fillRect(x - 2, y - 25, textWidth + 8, 25);

        // Text
        ctx.fillStyle = '#000000';
        ctx.fillText(text, x + 3, y - 8);
    });
}

// Ergebnisse anzeigen
function displayResults(predictions) {
    if (!predictions || predictions.length === 0) {
        resultsList.innerHTML = '<div class="empty-state">Keine Objekte erkannt</div>';
        return;
    }

    // Nach Konfidenz sortieren
    const sorted = predictions.sort((a, b) => b.score - a.score);

    resultsList.innerHTML = sorted.map(prediction => `
        <div class="detection-item">
            <div class="detection-name">${prediction.class}</div>
            <div class="detection-confidence">
                Konfidenz: ${(prediction.score * 100).toFixed(1)}%
            </div>
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${prediction.score * 100}%"></div>
            </div>
        </div>
    `).join('');
}

// Frame aufnehmen (Download)
function captureFrame() {
    if (!canvas) return;

    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/jpeg');
    link.download = `objekterkennung-${new Date().getTime()}.jpg`;
    link.click();
}

// Status anzeigen
function showStatus(message, type) {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    if (type !== 'loading') {
        setTimeout(() => {
            statusDiv.style.display = 'none';
        }, 4000);
    }
}

// Beim Laden der Seite Modell laden
window.addEventListener('load', () => {
    loadModel();
});

// Cleanup beim Schließen
window.addEventListener('beforeunload', () => {
    stopCamera();
});
