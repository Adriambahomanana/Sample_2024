// Application state
let map, minimap;
let surveyData = [];
let currentPointIndex = 0;
let isShowingFront = true;
let markers = [];
let isViewerMode = false;

async function init() {
    try {
        await loadCSVData();
        initMap();
        initMinimap();
        setupControls();
        document.getElementById('loading').classList.add('hidden');
    } catch (error) {
        showError('Failed to initialize: ' + error.message);
        console.error('Init error:', error);
    }
}

function loadCSVData() {
    return new Promise((resolve, reject) => {
        Papa.parse('./data.csv', {
            download: true,
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.data && results.data.length > 0) {
                    // Filter out any rows with missing required fields
                    const validData = results.data.filter(row => 
                        row && row.id && row.lat && row.long && row.heading_front && row.front && row.rear
                    );
                    
                    if (validData.length === 0) {
                        reject(new Error('No valid data in CSV'));
                        return;
                    }
                    
                    surveyData = validData.sort((a, b) => 
                        String(a.id).localeCompare(String(b.id))
                    );
                    console.log(`Loaded ${surveyData.length} survey points`);
                    resolve();
                } else {
                    reject(new Error('No data in CSV'));
                }
            },
            error: (error) => reject(new Error('CSV error: ' + error.message))
        });
    });
}

function initMap() {
    const lats = surveyData.map(p => p.lat);
    const lngs = surveyData.map(p => p.long);
    const bounds = [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]];
    
    map = L.map('map', { zoomControl: false }).fitBounds(bounds, { padding: [50, 50] });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(map);
    
    surveyData.forEach((point, index) => {
        const marker = L.circleMarker([point.lat, point.long], {
            radius: 10,
            fillColor: '#05CB63',
            color: 'white',
            weight: 3,
            fillOpacity: 1
        }).addTo(map);
        
        marker.bindPopup(`<strong>Point ${point.id}</strong><br>Heading: ${point.heading_front}°<br><em>Click to view</em>`);
        
        marker.on('click', () => {
            currentPointIndex = index;
            isShowingFront = true;
            enterViewerMode();
        });
        
        markers.push(marker);
    });
    
    highlightMarker(0);
}

function initMinimap() {
    minimap = L.map('minimap', {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OSM'
    }).addTo(minimap);
    
    document.getElementById('minimap-container').addEventListener('click', exitViewerMode);
}

function enterViewerMode() {
    isViewerMode = true;
    document.getElementById('viewer-container').classList.add('active');
    
    // Load and display the image instantly
    updateImage();
    updateViewerInfo();
    updateMinimap();
    highlightMarker(currentPointIndex);
}

function exitViewerMode() {
    isViewerMode = false;
    document.getElementById('viewer-container').classList.remove('active');
    
    const point = surveyData[currentPointIndex];
    map.setView([point.lat, point.long], map.getZoom());
    highlightMarker(currentPointIndex);
}

function updateImage() {
    const point = surveyData[currentPointIndex];
    const imageFile = isShowingFront ? point.front : point.rear;
    const imageElement = document.getElementById('survey-image');
    
    // Set image source - instant switch, no transitions!
    imageElement.src = `./images/${imageFile}`;
}

function updateViewerInfo() {
    const point = surveyData[currentPointIndex];
    const view = isShowingFront ? 'Front' : 'Rear';
    const heading = isShowingFront ? point.heading_front : (point.heading_front + 180) % 360;
    
    document.getElementById('title-info').innerHTML = `
        <strong>Point ${currentPointIndex + 1} of ${surveyData.length}</strong> | 
        ${view} View | 
        Heading: ${heading}°
    `;
    
    document.getElementById('prev-point-btn').disabled = currentPointIndex === 0;
    document.getElementById('next-point-btn').disabled = currentPointIndex === surveyData.length - 1;
}

function updateMinimap() {
    const point = surveyData[currentPointIndex];
    minimap.setView([point.lat, point.long], 15);
    
    minimap.eachLayer(layer => {
        if (layer instanceof L.CircleMarker) {
            minimap.removeLayer(layer);
        }
    });
    
    L.circleMarker([point.lat, point.long], {
        radius: 8,
        fillColor: '#e74c3c',
        color: 'white',
        weight: 2,
        fillOpacity: 1
    }).addTo(minimap);
}

function highlightMarker(index) {
    markers.forEach((marker, i) => {
        marker.setStyle(i === index ? 
            { fillColor: '#e74c3c', radius: 12 } : 
            { fillColor: '#05CB63', radius: 10 }
        );
    });
}

function setupControls() {
    document.getElementById('zoom-in').addEventListener('click', () => map.zoomIn());
    document.getElementById('zoom-out').addEventListener('click', () => map.zoomOut());
    document.getElementById('close-viewer-btn').addEventListener('click', exitViewerMode);
    
    // Prev button - instant image switch
    document.getElementById('prev-point-btn').addEventListener('click', () => {
        if (currentPointIndex > 0) {
            currentPointIndex--;
            updateImage();
            updateViewerInfo();
            updateMinimap();
            highlightMarker(currentPointIndex);
        }
    });
    
    // Next button - instant image switch
    document.getElementById('next-point-btn').addEventListener('click', () => {
        if (currentPointIndex < surveyData.length - 1) {
            currentPointIndex++;
            updateImage();
            updateViewerInfo();
            updateMinimap();
            highlightMarker(currentPointIndex);
        }
    });
    
    // Switch view button - instant front/rear toggle
    document.getElementById('switch-view-btn').addEventListener('click', () => {
        isShowingFront = !isShowingFront;
        updateImage();
        updateViewerInfo();
    });
}

function showError(message) {
    const loading = document.getElementById('loading');
    loading.classList.remove('hidden');
    loading.innerHTML = `
        <div style="background: #e74c3c; padding: 20px; border-radius: 8px; text-align: center;">
            <strong>Error:</strong> ${message}
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', init);
