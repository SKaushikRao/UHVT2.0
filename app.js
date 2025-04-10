// Initialize the map using Leaflet.js
const map = L.map('map').setView([26.9124, 75.7873], 12); // Jaipur, India
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap contributors'
}).addTo(map);

// Temperature overlay layer
let heatLayer;
// Store grid points data
let gridPointsData = [];

// Define temperature color function
function getTemperatureColor(temp) {
    if (temp < 25) return 'rgba(0, 0, 255, 0.5)';      // blue
    if (temp < 35) return 'rgba(255, 165, 0, 0.5)';    // orange
    return 'rgba(255, 0, 0, 0.5)';                     // red
}

// Define tree cover color function
function getTreeCoverColor(cover) {
    if (cover < 20) return 'brown';             // low tree cover
    if (cover < 50) return 'lightgreen';        // medium tree cover
    return 'darkgreen';                          // high tree cover
}

// Define urban cover color function
function getUrbanCoverColor(cover) {
    if (cover < 30) return 'rgba(144, 238, 144, 0.5)';    // light green (rural)
    if (cover < 60) return 'rgba(255, 255, 0, 0.5)';      // yellow (suburban)
    return 'rgba(128, 128, 128, 0.5)';                    // gray (urban)
}

// Generate a grid of points covering Jaipur
function generateGrid() {
    // Jaipur boundaries (approximately)
    const southWest = [26.7, 75.6];
    const northEast = [27.1, 76.0];
    
    const lat_step = 0.02; // About 2km
    const lon_step = 0.02;
    const points = [];
    
    for (let lat = southWest[0]; lat <= northEast[0]; lat += lat_step) {
        for (let lon = southWest[1]; lon <= northEast[1]; lon += lon_step) {
            points.push([lat, lon]);
        }
    }
    
    return points;
}

// Create temperature overlay using circles with gradient colors
function createTemperatureOverlay(data) {
    // Remove existing heat layer if it exists
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }
    
    // Create a feature group for the temperature overlay
    heatLayer = L.featureGroup();
    
    // Add circles with appropriate colors based on temperature
    data.forEach(point => {
        const circle = L.circle([point.lat, point.lon], {
            radius: 1000, // 1km radius
            fillColor: getTemperatureColor(point.temperature),
            color: 'none',
            fillOpacity: 0.7
        }).bindPopup(createPopupContent(point));
        
        heatLayer.addLayer(circle);
    });
    
    // Add the layer to the map
    heatLayer.addTo(map);
    
    // Analyze temperature data for heatwave warnings
    analyzeHeatwave(data);
}

// Create popup content with detailed information
function createPopupContent(point) {
    const treeCover = point.treeCover;
    const urbanCover = point.urbanCover;
    const population = point.population;
    
    let popupContent = `
        <div class="popup-content">
            <h3>Area Information</h3>
            <p><strong>Temperature:</strong> ${point.temperature.toFixed(1)}°C</p>
            <p><strong>Tree Cover:</strong> ${treeCover}%</p>
            <p><strong>Urban Cover:</strong> ${urbanCover}%</p>
            <p><strong>Estimated Population:</strong> ${population} people</p>
            <hr>
            <p><strong>CO₂ Contribution:</strong> ~${(population * 0.0005).toFixed(1)} tons/day</p>
            <div class="popup-recommendation">
                ${getCoolingRecommendation(point.temperature, treeCover, urbanCover)}
            </div>
        </div>
    `;
    
    return popupContent;
}

// Function to analyze temperature data and display heatwave warnings
function analyzeHeatwave(data) {
    const temperatures = data.map(point => point.temperature);
    const avgTemp = temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;
    const maxTemp = Math.max(...temperatures);
    
    let warningHTML = '<div class="heatwave-warning">';
    warningHTML += '<h2>Heatwave Analysis</h2>';
    
    // Temperature warning and safety information
    if (maxTemp >= 41) {
        warningHTML += `<p class="severe-warning">⚠️ SEVERE HEAT ALERT: Maximum temperature of ${maxTemp.toFixed(1)}°C detected. Extreme caution advised.</p>`;
        warningHTML += '<p>Heatwave conditions are present across most of Jaipur. The current temperature exceeds 41°C in some areas, which poses significant health risks.</p>';
    } else if (maxTemp >= 36) {
        warningHTML += `<p class="high-warning">⚠️ HIGH HEAT WARNING: Maximum temperature of ${maxTemp.toFixed(1)}°C detected.</p>`;
        warningHTML += '<p>Hot conditions are present in many areas of Jaipur. Please take precautions during outdoor activities.</p>';
    } else {
        warningHTML += '<p>Current temperatures are within normal ranges for Jaipur.</p>';
    }
    
    // Hydration recommendations based on temperature
    warningHTML += '<h3>Hydration Recommendations:</h3>';
    warningHTML += '<div class="hydration-info">';
    
    if (maxTemp >= 41) {
        warningHTML += '<p>Recommended water intake: <strong>At least 4-5 liters</strong> per day (approx. 16-20 glasses)</p>';
        warningHTML += '<p>Drink at least 500ml of water every hour when outdoors</p>';
    } else if (maxTemp >= 36) {
        warningHTML += '<p>Recommended water intake: <strong>3-4 liters</strong> per day (approx. 12-16 glasses)</p>';
        warningHTML += '<p>Drink at least 400ml of water every hour when outdoors</p>';
    } else {
        warningHTML += '<p>Recommended water intake: <strong>2-3 liters</strong> per day (approx. 8-12 glasses)</p>';
        warningHTML += '<p>Drink water regularly throughout the day</p>';
    }
    warningHTML += '</div>';
    
    // Add safety recommendations
    warningHTML += '<h3>Safety Recommendations:</h3>';
    warningHTML += '<ul class="safety-tips">';
    warningHTML += '<li>Stay hydrated and drink plenty of water</li>';
    warningHTML += '<li>Avoid prolonged exposure to the sun, especially between 11 AM and 4 PM</li>';
    warningHTML += '<li>Wear light-colored, loose-fitting clothing</li>';
    warningHTML += '<li>Check on vulnerable individuals (elderly, children, etc.)</li>';
    warningHTML += '<li>Use cooling strategies like damp cloths on the neck and wrists</li>';
    warningHTML += '<li>Keep windows covered during the day to block heat</li>';
    warningHTML += '<li>If you feel dizzy, nauseous, or have a headache, seek shade and medical attention</li>';
    warningHTML += '</ul>';
    
    // City-wide statistics
    const highTempAreas = data.filter(point => point.temperature >= 38).length;
    const percentHighTemp = ((highTempAreas / data.length) * 100).toFixed(1);
    
    const lowTreeAreas = data.filter(point => point.treeCover < 20).length;
    const percentLowTree = ((lowTreeAreas / data.length) * 100).toFixed(1);
    
    const highUrbanAreas = data.filter(point => point.urbanCover > 70).length;
    const percentHighUrban = ((highUrbanAreas / data.length) * 100).toFixed(1);
    
    warningHTML += '<h3>City-wide Statistics:</h3>';
    warningHTML += `<p>Currently ${percentHighTemp}% of Jaipur is experiencing temperatures above 38°C.</p>`;
    warningHTML += `<p>${percentLowTree}% of the city has insufficient tree cover (below 20%).</p>`;
    warningHTML += `<p>${percentHighUrban}% of the city has high urban density (above 70% urban cover).</p>`;
    
    // Add city-wide cooling strategies
    warningHTML += '<h3>City-wide Cooling Strategies:</h3>';
    warningHTML += '<ul class="cooling-strategies">';
    warningHTML += '<li><strong>Urban Greening:</strong> Increase tree cover in low-canopy areas to reduce temperature by 2-8°C</li>';
    warningHTML += '<li><strong>Cool Roofs:</strong> Implementing reflective rooftops can reduce building temperatures by up to 5°C</li>';
    warningHTML += '<li><strong>Green Infrastructure:</strong> Increase permeable surfaces and rain gardens to improve cooling</li>';
    warningHTML += '<li><strong>Water Features:</strong> Strategic placement of fountains and water bodies in hot spots</li>';
    warningHTML += '<li><strong>Shade Structures:</strong> Install shade canopies in public spaces with high heat indices</li>';
    warningHTML += '</ul>';
    
    warningHTML += '</div>';
    
    // Add or update the warning element
    let warningElement = document.getElementById('heatwave-warning');
    if (!warningElement) {
        warningElement = document.createElement('div');
        warningElement.id = 'heatwave-warning';
        document.body.appendChild(warningElement);
    }
    warningElement.innerHTML = warningHTML;
}

// Function to provide cooling recommendations based on location data
function getCoolingRecommendation(temp, treeCover, urbanCover) {
    let recommendation = '<h4>Area-specific Cooling Recommendations:</h4><ul>';
    
    // Temperature-based recommendations
    if (temp >= 41) {
        recommendation += '<li><strong>Urgent Cooling Required</strong> - This area is experiencing extreme heat</li>';
    }
    
    // Urban cover recommendations
    if (urbanCover > 70) {
        recommendation += '<li><strong>High Urban Density</strong> - Install reflective rooftops and cool pavements</li>';
        recommendation += '<li>Create "cooling corridors" with street-level water misters</li>';
    } else if (urbanCover > 50) {
        recommendation += '<li><strong>Moderate Urban Density</strong> - Add green roofs and reflective materials</li>';
    }
    
    // Tree cover recommendations
    if (treeCover < 20) {
        recommendation += '<li><strong>Critical Tree Cover Deficit</strong> - Plant native shade trees along streets and in public spaces</li>';
        recommendation += '<li>Create pocket parks in available spaces</li>';
    } else if (treeCover < 40) {
        recommendation += '<li><strong>Low Tree Cover</strong> - Increase tree planting in yards and along streets</li>';
    }
    
    // Add general recommendations
    if (urbanCover > 60 && treeCover < 30) {
        recommendation += '<li>This area is a potential urban heat island hotspot - prioritize for cooling interventions</li>';
        recommendation += '<li>Consider permeable pavement to reduce heat absorption</li>';
    }
    
    recommendation += '</ul>';
    return recommendation;
}

// Fetch temperature data for multiple points
async function fetchTemperatureData(points) {
    const data = [];
    
    // For demo purposes, we'll simulate API responses with realistic data for Jaipur
    // In production, you would make actual API calls to your server
    
    // Current season simulation (summer with high temperatures)
    const baseTemp = 39; // Base temperature around 39°C
    const variation = 4;  // Variation of +/- 4°C
    
    // Urban heat island effect - center is hotter
    const cityCenter = [26.9124, 75.7873];
    
    for (const point of points) {
        // Calculate distance from city center (simplified)
        const distance = Math.sqrt(
            Math.pow(point[0] - cityCenter[0], 2) + 
            Math.pow(point[1] - cityCenter[1], 2)
        );
        
        // Urban areas (closer to center) are hotter
        let temp = baseTemp + (0.2 / distance) - (distance * 2);
        
        // Add some random variations
        temp += (Math.random() * variation) - (variation / 2);
        
        // Add some systematic patterns (hotter in certain areas)
        if (point[0] > 26.95 && point[1] < 75.75) {
            temp += 1.5; // Industrial area is hotter
        }
        
        // Ensure temperature is within realistic bounds
        temp = Math.max(32, Math.min(45, temp));
        
        // Calculate urban cover
        const urbanCover = estimateUrbanCover(point[0], point[1]);
        
        // Calculate tree cover (inversely related to urban cover but with variation)
        const treeCover = Math.min(80, Math.max(5, 
            Math.round(100 - urbanCover + ((Math.random() * 30) - 15))
        ));
        
        // Calculate population based on density and area
        // Area of the circle = π * r² = π * (1km)² ≈ 3.14 km²
        // Population = density * area
        const circleArea = Math.PI * Math.pow(1, 2); // 1 km radius circle area in km²
        const popDensity = 598; // people per km²
        
        // Adjust density based on urban cover (higher urban cover = higher population density)
        const adjustedDensity = popDensity * (0.5 + (urbanCover / 100));
        const population = Math.round(circleArea * adjustedDensity);
        
        data.push({
            lat: point[0],
            lon: point[1],
            temperature: temp,
            treeCover: treeCover,
            urbanCover: urbanCover,
            population: population
        });
    }
    
    return data;
}

// Estimate urban cover (buildings, concrete, asphalt) based on location
function estimateUrbanCover(lat, lon) {
    // In a real application, this would use satellite imagery analysis
    // For this demo, we'll use a simplified model based on location
    
    // 1. Distance from city center (urban areas have more buildings)
    const cityCenter = [26.9124, 75.7873];
    const distance = Math.sqrt(
        Math.pow(lat - cityCenter[0], 2) + 
        Math.pow(lon - cityCenter[1], 2)
    );
    
    // Commercial and industrial zones
    const urbanZones = [
        { center: [26.9124, 75.7873], radius: 0.03, name: "City Center" }, // ~80%
        { center: [26.8466, 75.8245], radius: 0.02, name: "Industrial Area" }, // ~85%
        { center: [26.9251, 75.8011], radius: 0.01, name: "Commercial District" }, // ~90%
        { center: [26.9865, 75.7550], radius: 0.025, name: "Transport Hub" }, // ~75%
    ];
    
    // Check if point is in any known urban zone
    for (const zone of urbanZones) {
        const distToZone = Math.sqrt(
            Math.pow(lat - zone.center[0], 2) + 
            Math.pow(lon - zone.center[1], 2)
        );
        
        if (distToZone < zone.radius) {
            // Point is in a dense urban zone
            return 75 + Math.random() * 20; // 75-95% urban cover
        }
    }
    
    // Base value inversely proportional to distance from center
    // Closer to center = more urban cover
    let baseCover = Math.min(85, Math.max(20, 100 - (distance * 300)));
    
    // Add noise
    baseCover += (Math.random() * 20) - 10;
    
    // Cap between 10% and 95%
    return Math.min(95, Math.max(10, Math.round(baseCover)));
}

// Create map layer toggle controls
function createLayerControls() {
    // Create the layer control
    const layerControl = document.getElementById('layer-control');
    
    // Temperature layer toggle
    const tempToggle = document.createElement('div');
    tempToggle.className = 'layer-toggle active';
    tempToggle.innerHTML = `
        <input type="checkbox" id="temp-layer" checked>
        <label for="temp-layer">Temperature Layer</label>
    `;
    layerControl.appendChild(tempToggle);
    
    // Urban cover layer toggle
    const urbanToggle = document.createElement('div');
    urbanToggle.className = 'layer-toggle';
    urbanToggle.innerHTML = `
        <input type="checkbox" id="urban-layer">
        <label for="urban-layer">Urban Cover Layer</label>
    `;
    layerControl.appendChild(urbanToggle);
    
    // Tree cover layer toggle
    const treeToggle = document.createElement('div');
    treeToggle.className = 'layer-toggle';
    treeToggle.innerHTML = `
        <input type="checkbox" id="tree-layer">
        <label for="tree-layer">Tree Cover Layer</label>
    `;
    layerControl.appendChild(treeToggle);
    
    // Add event listeners for layer toggles
    document.getElementById('temp-layer').addEventListener('change', updateLayers);
    document.getElementById('urban-layer').addEventListener('change', updateLayers);
    document.getElementById('tree-layer').addEventListener('change', updateLayers);
}

// Update map layers based on toggle selections
function updateLayers() {
    const showTemp = document.getElementById('temp-layer').checked;
    const showUrban = document.getElementById('urban-layer').checked;
    const showTree = document.getElementById('tree-layer').checked;
    
    // Remove existing layers
    if (heatLayer) {
        map.removeLayer(heatLayer);
    }
    
    // If no layers are selected, default to temperature
    if (!showTemp && !showUrban && !showTree) {
        document.getElementById('temp-layer').checked = true;
        createTemperatureOverlay(gridPointsData);
        return;
    }
    
    // Create a new feature group
    heatLayer = L.featureGroup();
    
    // Add data points with appropriate styling
    gridPointsData.forEach(point => {
        let fillColor = 'rgba(0, 0, 0, 0)';
        
        if (showTemp) {
            fillColor = getTemperatureColor(point.temperature);
        } else if (showUrban) {
            fillColor = getUrbanCoverColor(point.urbanCover);
        } else if (showTree) {
            fillColor = getTreeCoverColor(point.treeCover);
        }
        
        const circle = L.circle([point.lat, point.lon], {
            radius: 1000,
            fillColor: fillColor,
            color: 'none',
            fillOpacity: 0.7
        }).bindPopup(createPopupContent(point));
        
        heatLayer.addLayer(circle);
    });
    
    // Add the layer to the map
    heatLayer.addTo(map);
    
    // Update legend based on active layer
    updateLegend(showTemp, showUrban, showTree);
}

// Update the legend based on active layer
function updateLegend(showTemp, showUrban, showTree) {
    const legend = document.querySelector('.legend');
    
    if (showTemp) {
        legend.innerHTML = `
            <h4>Temperature Legend</h4>
            <div>
                <span style="background-color: rgba(0, 0, 255, 0.5);"></span> Low Temperature (< 25°C)
            </div>
            <div>
                <span style="background-color: rgba(255, 165, 0, 0.5);"></span> Medium Temperature (25–35°C)
            </div>
            <div>
                <span style="background-color: rgba(255, 0, 0, 0.5);"></span> High Temperature (> 35°C)
            </div>
        `;
    } else if (showUrban) {
        legend.innerHTML = `
            <h4>Urban Cover Legend</h4>
            <div>
                <span style="background-color: rgba(144, 238, 144, 0.5);"></span> Rural (< 30%)
            </div>
            <div>
                <span style="background-color: rgba(255, 255, 0, 0.5);"></span> Suburban (30–60%)
            </div>
            <div>
                <span style="background-color: rgba(128, 128, 128, 0.5);"></span> Urban (> 60%)
            </div>
        `;
    } else if (showTree) {
        legend.innerHTML = `
            <h4>Tree Cover Legend</h4>
            <div>
                <span style="background-color: brown;"></span> Low Tree Cover (< 20%)
            </div>
            <div>
                <span style="background-color: lightgreen;"></span> Medium Tree Cover (20–50%)
            </div>
            <div>
                <span style="background-color: darkgreen;"></span> High Tree Cover (> 50%)
            </div>
        `;
    }
}

// Update the zoom data sidebar with info about the hovered area
function updateZoomData(latlng) {
    // Find the closest grid point
    let closest = null;
    let minDist = Infinity;
    
    gridPointsData.forEach(point => {
        const dist = Math.sqrt(
            Math.pow(point.lat - latlng.lat, 2) + 
            Math.pow(point.lon - latlng.lng, 2)
        );
        
        if (dist < minDist) {
            minDist = dist;
            closest = point;
        }
    });
    
    if (closest) {
        // Update sidebar with data
        document.getElementById('zoom-location').textContent = 
            `Location: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
        
        document.getElementById('zoom-temperature').textContent = 
            `Temperature: ${closest.temperature.toFixed(1)}°C`;
        
        document.getElementById('zoom-tree-cover').textContent = 
            `Tree Cover: ${closest.treeCover}%`;
            
        document.getElementById('zoom-urban-cover').textContent = 
            `Urban Cover: ${closest.urbanCover}%`;
            
        document.getElementById('zoom-population').textContent = 
            `Population: ~${closest.population} people`;
        
        // Determine heat alert status
        let alertStatus = "None";
        if (closest.temperature >= 41) {
            alertStatus = "SEVERE - Extreme caution advised";
        } else if (closest.temperature >= 36) {
            alertStatus = "MODERATE - Take precautions";
        }
        
        document.getElementById('zoom-heatwave-alert').textContent = 
            `Heatwave Alert: ${alertStatus}`;
    }
}

// Display temperature trends using Chart.js
function initializeCharts() {
    const tempCtx = document.getElementById('temperatureChart').getContext('2d');
    const temperatureChart = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: ['6 AM', '9 AM', '12 PM', '3 PM', '6 PM', '9 PM'],
            datasets: [{
                label: 'Daily Temperature (°C)',
                data: [32, 36, 41, 42, 39, 35], // Realistic daily temperature curve for Jaipur
                borderColor: 'red',
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true
                },
                title: {
                    display: true,
                    text: 'Today\'s Temperature Trend'
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Time'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    },
                    beginAtZero: false,
                    suggestedMin: 25,
                    suggestedMax: 45
                }
            }
        }
    });
    
    // Urban vs. tree cover correlation chart
    const correlationCtx = document.getElementById('correlationChart').getContext('2d');
    
    // Extract a subset of data for the scatter plot
    const sampleData = gridPointsData
        .filter((_, i) => i % 5 === 0) // Take every 5th point to avoid overcrowding
        .map(point => ({
            x: point.urbanCover,
            y: point.temperature,
        }));
    
    const correlationChart = new Chart(correlationCtx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Urban Cover vs Temperature',
                data: sampleData,
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1,
                pointRadius: 5,
                pointHoverRadius: 7
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: 'Urban Cover vs Temperature Correlation'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `Urban: ${context.parsed.x}%, Temp: ${context.parsed.y.toFixed(1)}°C`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Urban Cover (%)'
                    },
                    min: 0,
                    max: 100
                },
                y: {
                    title: {
                        display: true,
                        text: 'Temperature (°C)'
                    },
                    min: 30,
                    max: 45
                }
            }
        }
    });
}

// Initialize on load
window.onload = async function() {
    // Generate grid and fetch data
    const gridPoints = generateGrid();
    gridPointsData = await fetchTemperatureData(gridPoints);
    
    // Create the initial temperature overlay
    createTemperatureOverlay(gridPointsData);
    
    // Create layer controls
    createLayerControls();
    
    // Update zoom data on mousemove
    map.on('mousemove', function(e) {
        updateZoomData(e.latlng);
    });
    
    // Initialize charts
    initializeCharts();
    
    // Display quick stats
    updateQuickStats();
    
    // Refresh data every 5 minutes
    setInterval(async function() {
        gridPointsData = await fetchTemperatureData(generateGrid());
        createTemperatureOverlay(gridPointsData);
        updateQuickStats();
        initializeCharts(); // Refresh charts with new data
    }, 5 * 60 * 1000);
};

// Update quick statistics panel
function updateQuickStats() {
    const temperatures = gridPointsData.map(point => point.temperature);
    const avgTemp = temperatures.reduce((sum, temp) => sum + temp, 0) / temperatures.length;
    const maxTemp = Math.max(...temperatures);
    
    const treeCovers = gridPointsData.map(point => point.treeCover);
    const avgTreeCover = treeCovers.reduce((sum, cover) => sum + cover, 0) / treeCovers.length;
    
    const urbanCovers = gridPointsData.map(point => point.urbanCover);
    const avgUrbanCover = urbanCovers.reduce((sum, cover) => sum + cover, 0) / urbanCovers.length;
    
    const totalPopulation = gridPointsData.reduce((sum, point) => sum + point.population, 0);
    
    document.getElementById('stat-avg-temp').textContent = avgTemp.toFixed(1) + '°C';
    document.getElementById('stat-max-temp').textContent = maxTemp.toFixed(1) + '°C';
    document.getElementById('stat-avg-tree').textContent = avgTreeCover.toFixed(1) + '%';
    document.getElementById('stat-avg-urban').textContent = avgUrbanCover.toFixed(1) + '%';
    document.getElementById('stat-total-pop').textContent = totalPopulation.toLocaleString();
    
    // Calculate temperature difference between high and low urban cover areas
    const highUrbanPoints = gridPointsData.filter(point => point.urbanCover > 70);
    const lowUrbanPoints = gridPointsData.filter(point => point.urbanCover < 30);
    
    if (highUrbanPoints.length > 0 && lowUrbanPoints.length > 0) {
        const highUrbanTemp = highUrbanPoints.reduce((sum, point) => sum + point.temperature, 0) / highUrbanPoints.length;
        const lowUrbanTemp = lowUrbanPoints.reduce((sum, point) => sum + point.temperature, 0) / lowUrbanPoints.length;
        const tempDiff = highUrbanTemp - lowUrbanTemp;
        
        document.getElementById('stat-urban-diff').textContent = tempDiff.toFixed(1) + '°C';
    }
}