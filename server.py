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
    api_key = "66f04386577e2e577ce71950a182d4e3"  # Replace with your API key
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
    """Generate a grid of climate data for Jaipur"""
    # Jaipur boundaries (approximately)
    south_west = [26.7, 75.6]
    north_east = [27.1, 76.0]
    
    lat_step = 0.02  # About 2km
    lon_step = 0.02
    
    city_center = [26.9124, 75.7873]  # Jaipur city center
    base_temp = 39  # Base temperature around 39°C
    variation = 4   # Variation of +/- 4°C
    
    # Urban zones - areas with higher urban density
    urban_zones = [
        {"center": [26.9124, 75.7873], "radius": 0.03, "name": "City Center"},
        {"center": [26.8466, 75.8245], "radius": 0.02, "name": "Industrial Area"},
        {"center": [26.9251, 75.8011], "radius": 0.01, "name": "Commercial District"},
        {"center": [26.9865, 75.7550], "radius": 0.025, "name": "Transport Hub"}
    ]
    
    grid_data = []
    
    # Generate data for each grid point
    for lat in [round(south_west[0] + i * lat_step, 4) for i in range(int((north_east[0] - south_west[0]) / lat_step) + 1)]:
        for lon in [round(south_west[1] + i * lon_step, 4) for i in range(int((north_east[1] - south_west[1]) / lon_step) + 1)]:
            # Calculate distance from city center
            distance = math.sqrt(
                (lat - city_center[0]) ** 2 + 
                (lon - city_center[1]) ** 2
            )
            
            # Urban heat island effect - closer to center is hotter
            temp = base_temp + (0.2 / max(distance, 0.01)) - (distance * 2)
            
            # Add random variation
            temp += (random.random() * variation) - (variation / 2)
            
            # Check if in any special urban zone
            in_urban_zone = False
            for zone in urban_zones:
                zone_distance = math.sqrt(
                    (lat - zone["center"][0]) ** 2 + 
                    (lon - zone["center"][1]) ** 2
                )
                if zone_distance < zone["radius"]:
                    in_urban_zone = True
                    # Industrial areas are hotter
                    if zone["name"] == "Industrial Area":
                        temp += 1.5
                    break
            
            # Ensure temperature is within realistic bounds
            temp = max(32, min(45, temp))
            
            # Calculate urban cover
            urban_cover = estimate_urban_cover(lat, lon, city_center, urban_zones)
            
            # Calculate tree cover (inversely related to urban cover but with variation)
            tree_cover = min(80, max(5, 
                round(100 - urban_cover + ((random.random() * 30) - 15))
            ))
            
            # Calculate population based on density and area
            # Area of the circle = π * r² = π * (1km)² ≈ 3.14 km²
            circle_area = math.pi * (1 ** 2)  # 1 km radius
            pop_density = 598  # people per km²
            
            # Adjust density based on urban cover (higher urban cover = higher population density)
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
    # Calculate distance from city center
    distance = math.sqrt(
        (lat - city_center[0]) ** 2 + 
        (lon - city_center[1]) ** 2
    )
    
    # Check if point is in any known urban zone
    for zone in urban_zones:
        zone_distance = math.sqrt(
            (lat - zone["center"][0]) ** 2 + 
            (lon - zone["center"][1]) ** 2
        )
        
        if zone_distance < zone["radius"]:
            # Point is in a dense urban zone
            return round(75 + random.random() * 20)  # 75-95% urban cover
    
    # Base value inversely proportional to distance from center
    # Closer to center = more urban cover
    base_cover = min(85, max(20, 100 - (distance * 300)))
    
    # Add noise
    base_cover += (random.random() * 20) - 10
    
    # Cap between 10% and 95%
    return round(min(95, max(10, base_cover)))

@app.route('/api/cooling-strategies/<float:temp>/<int:tree_cover>/<int:urban_cover>')
def cooling_strategies(temp, tree_cover, urban_cover):
    """Get cooling strategies based on temperature and environmental factors"""
    strategies = []
    
    # Temperature-based strategies
    if temp >= 41:
        strategies.append({
            "type": "urgent",
            "title": "Urgent Heat Mitigation Required",
            "description": "This area has critically high temperatures that require immediate action.",
            "actions": [
                "Deploy temporary shade structures",
                "Set up cooling stations",
                "Distribute emergency water supplies"
            ]
        })
    
    # Urban cover strategies
    if urban_cover > 70:
        strategies.append({
            "type": "urban",
            "title": "High Urban Density Cooling",
            "description": "This area has excessive built environment that contributes to heat.",
            "actions": [
                "Install cool/reflective roofs on buildings",
                "Replace dark pavement with light-colored or permeable materials",
                "Create small pocket parks in available spaces",
                "Install vertical gardens on building facades",
                "Implement green roofs where structurally feasible"
            ]
        })
    elif urban_cover > 50:
        strategies.append({
            "type": "urban",
            "title": "Moderate Urban Density Cooling",
            "description": "This area has significant urban cover contributing to heat.",
            "actions": [
                "Increase green space in public areas",
                "Install shade structures over parking areas",
                "Implement cool pavements in next resurfacing project",
                "Create water features in public spaces"
            ]
        })
    
    # Tree cover strategies
    if tree_cover < 20:
        strategies.append({
            "type": "vegetation",
            "title": "Critical Tree Cover Deficit",
            "description": "This area has severely inadequate tree cover.",
            "actions": [
                "Implement aggressive street tree planting program",
                "Create community gardens and green spaces",
                "Offer incentives for private property tree planting",
                "Install shade structures while trees mature"
            ]
        })
    elif tree_cover < 40:
        strategies.append({
            "type": "vegetation",
            "title": "Low Tree Cover",
            "description": "This area would benefit from increased vegetation.",
            "actions": [
                "Increase street tree density",
                "Convert unused spaces to community gardens",
                "Encourage green roofs and balcony gardens"
            ]
        })
    
    return jsonify({"strategies": strategies})

@app.route('/api/hydration-guidance/<float:temp>')
def hydration_guidance(temp):
    """Get hydration recommendations based on temperature"""
    if temp >= 41:
        return jsonify({
            "risk_level": "Extreme",
            "water_intake_liters": 4.5,
            "water_glasses": 18,
            "hourly_intake_ml": 500,
            "recommendations": [
                "Drink at least 500ml of water every hour when outdoors",
                "Avoid alcohol and caffeine entirely",
                "Consider electrolyte replacement drinks",
                "Monitor for signs of dehydration: headache, dark urine, dizziness"
            ]
        })
    elif temp >= 36:
        return jsonify({
            "risk_level": "High",
            "water_intake_liters": 3.5, 
            "water_glasses": 14,
            "hourly_intake_ml": 400,
            "recommendations": [
                "Drink at least 400ml of water every hour when outdoors",
                "Limit alcohol and caffeine consumption",
                "Consider electrolyte replacement for extended outdoor activities",
                "Check urine color - should be light yellow"
            ]
        })
    else:
        return jsonify({
            "risk_level": "Moderate",
            "water_intake_liters": 2.5,
            "water_glasses": 10,
            "hourly_intake_ml": 300,
            "recommendations": [
                "Drink water regularly throughout the day",
                "Moderate alcohol and caffeine consumption",
                "No special electrolyte needs for most people"
            ]
        })

if __name__ == '__main__':
    # Check for environment variable PORT (for deployment environments)
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=True)