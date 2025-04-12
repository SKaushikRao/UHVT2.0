from flask import Flask, jsonify, render_template, send_from_directory
import requests
import logging
import os
import json
import math
import random
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.DEBUG, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__, static_folder='static')

# Cache for temperature data to reduce API calls
temp_cache = {}
CACHE_EXPIRY = 300  # Cache for 5 minutes (300 seconds)

@app.route('/')
def index():
    """Serve the main HTML page"""
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('static', path)

@app.route('/api/realtime-temperature/<float:lat>/<float:lon>')
def realtime_temperature(lat, lon):
    """Get real-time temperature data from OpenWeatherMap API"""
    # Check if we have a cached value that's still valid
    cache_key = f"{lat:.4f}_{lon:.4f}"
    current_time = datetime.now().timestamp()
    if cache_key in temp_cache and current_time - temp_cache[cache_key]['timestamp'] < CACHE_EXPIRY:
        logger.debug(f"Using cached temperature data for {cache_key}")
        return jsonify(temp_cache[cache_key]['data'])
    
    # No valid cache found, make API call
    api_key = "ac8061bd1352eb9147a0dbd16330acf2"  # Replace with your API key
    api_url = f"http://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lon}&appid={api_key}&units=metric"
    try:
        logger.debug(f"Fetching real-time temperature data for {lat}, {lon}")
        response = requests.get(api_url)
        if response.status_code != 200:
            logger.error(f"Error fetching real-time temperature data: {response.status_code}")
            return jsonify({"error": "Failed to fetch data"}), 500
        data = response.json()
        temperature = data['main']['temp']
        humidity = data['main'].get('humidity', 50)
        result = {
            "temperature": temperature,
            "humidity": humidity,
            "feels_like": data['main'].get('feels_like', temperature)
        }
        # Cache the result
        temp_cache[cache_key] = {
            'timestamp': current_time,
            'data': result
        }
        return jsonify(result)
    except Exception as e:
        logger.error(f"Exception while fetching temperature data: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/grid-data')
def grid_data():
    """Generate a grid of climate data for Jaipur using real-time interpolation"""
    # Jaipur boundaries (approximately)
    south_west = [26.7, 75.6]
    north_east = [27.1, 76.0]
    lat_step = 0.02  # About 2km
    lon_step = 0.02
    city_center = [26.9124, 75.7873]  # Jaipur city center
    
    # Key locations for real-time temperature data
    key_locations = [
        {"name": "City Center", "lat": 26.9124, "lon": 75.7873},
        {"name": "Industrial Area", "lat": 26.8466, "lon": 75.8245},
        {"name": "Commercial District", "lat": 26.9251, "lon": 75.8011},
        {"name": "Transport Hub", "lat": 26.9865, "lon": 75.7550}
    ]
    
    # Fetch real-time temperatures for key locations
    realtime_temps = {}
    for location in key_locations:
        lat, lon = location["lat"], location["lon"]
        response = requests.get(f"/api/realtime-temperature/{lat}/{lon}")
        if response.status_code == 200:
            realtime_temps[location["name"]] = response.json()["temperature"]
        else:
            logger.error(f"Failed to fetch real-time temperature for {location['name']}")
            realtime_temps[location["name"]] = None
    
    # Interpolate temperatures for grid points
    def interpolate_temperature(lat, lon, realtime_temps, city_center):
        distances = []
        weights = []
        temps = []
        
        # Calculate distances and weights for key locations
        for location in key_locations:
            loc_lat, loc_lon = location["lat"], location["lon"]
            distance = math.sqrt((lat - loc_lat) ** 2 + (lon - loc_lon) ** 2)
            distances.append(distance)
            weights.append(1 / max(distance, 0.01))  # Avoid division by zero
            temps.append(realtime_temps[location["name"]])
        
        # Normalize weights
        total_weight = sum(weights)
        normalized_weights = [w / total_weight for w in weights]
        
        # Calculate weighted average temperature
        interpolated_temp = sum(w * t for w, t in zip(normalized_weights, temps))
        return interpolated_temp
    
    # Generate grid data
    grid_data = []
    for lat in [round(south_west[0] + i * lat_step, 4) for i in range(int((north_east[0] - south_west[0]) / lat_step) + 1)]:
        for lon in [round(south_west[1] + i * lon_step, 4) for i in range(int((north_east[1] - south_west[1]) / lon_step) + 1)]:
            # Interpolate temperature
            temp = interpolate_temperature(lat, lon, realtime_temps, city_center)
            
            # Add random variation (optional)
            temp += (random.random() * 2) - 1  # Small random noise
            temp = max(32, min(45, temp))  # Ensure realistic bounds
            
            # Estimate urban cover
            urban_cover = estimate_urban_cover(lat, lon, city_center, [])
            
            # Estimate tree cover
            tree_cover = min(80, max(5, round(100 - urban_cover + ((random.random() * 30) - 15))))
            
            # Calculate population
            circle_area = math.pi * (1 ** 2)  # 1 km radius
            pop_density = 598  # people per km²
            adjusted_density = pop_density * (0.5 + (urban_cover / 100))
            population = round(circle_area * adjusted_density)
            
            grid_data.append({
                "lat": lat,
                "lon": lon,
                "temperature": round(temp, 1),
                "tree_cover": tree_cover,
                "urban_cover": urban_cover,
                "population": population
            })
    
    return jsonify({"grid_data": grid_data})

def estimate_urban_cover(lat, lon, city_center, urban_zones):
    """Estimate urban cover based on location"""
    distance = math.sqrt(
        (lat - city_center[0]) ** 2 + 
        (lon - city_center[1]) ** 2
    )
    base_cover = min(85, max(20, 100 - (distance * 300)))
    base_cover += (random.random() * 20) - 10
    return round(min(95, max(10, base_cover)))

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)