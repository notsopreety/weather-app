// Theme handling
const themeToggle = document.getElementById('theme-toggle');
const html = document.documentElement;
let isDark = localStorage.getItem('dark-mode') === 'true';

function updateTheme() {
    if (isDark) {
        html.classList.add('dark');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        html.classList.remove('dark');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }
}

themeToggle.addEventListener('click', () => {
    isDark = !isDark;
    localStorage.setItem('dark-mode', isDark);
    updateTheme();
    document.body.classList.add('animate__animated', 'animate__fadeIn');
    setTimeout(() => {
        document.body.classList.remove('animate__animated', 'animate__fadeIn');
    }, 1000);
});

// Initialize theme
updateTheme();

// Loading screen handling
const loadingScreen = document.getElementById('loading-screen');

function hideLoadingScreen() {
    loadingScreen.classList.add('animate__animated', 'animate__fadeOut');
    setTimeout(() => {
        loadingScreen.style.display = 'none';
    }, 1000);
}

// Location handling
const locationBtn = document.getElementById('location-btn');
const locationSearch = document.getElementById('location-search');
let userLocation = null;

async function getLocationFromIP() {
    try {
        const ipResponse = await fetch('https://api.ipify.org/?format=json');
        const ipData = await ipResponse.json();
        const ip = ipData.ip;

        const locResponse = await fetch(`https://ipinfo.io/${ip}?token=0c5a9caba5ff3d`);
        const locData = await locResponse.json();

        return {
            city: locData.city,
            country: locData.country
        };
    } catch (error) {
        console.error('Error getting location from IP:', error);
        return null;
    }
}

async function initializeLocation() {
    if (navigator.geolocation) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            await fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
        } catch (error) {
            console.log('GPS location failed, falling back to IP location');
            userLocation = await getLocationFromIP();
            if (userLocation && userLocation.city) {
                await fetchWeatherByLocation(userLocation.city);
            } else {
                document.getElementById('location').textContent = 'Location not available';
            }
        }
    } else {
        userLocation = await getLocationFromIP();
        if (userLocation && userLocation.city) {
            await fetchWeatherByLocation(userLocation.city);
        } else {
            document.getElementById('location').textContent = 'Location not available';
        }
    }
    hideLoadingScreen();
}

locationBtn.addEventListener('click', async () => {
    locationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    if (navigator.geolocation) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject);
            });
            await fetchWeatherByCoords(position.coords.latitude, position.coords.longitude);
        } catch (error) {
            console.error('Error getting location:', error);
            userLocation = await getLocationFromIP();
            if (userLocation && userLocation.city) {
                await fetchWeatherByLocation(userLocation.city);
            }
        }
    }
    locationBtn.innerHTML = '<i class="fas fa-location-dot"></i>';
});

let searchTimeout;
locationSearch.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        if (e.target.value.length >= 3) {
            fetchWeatherByLocation(e.target.value);
        }
    }, 500);
});

// AI Summary handling
const aiSummaryBtn = document.getElementById('ai-summary');
const aiSummaryContainer = document.getElementById('ai-summary-container');
const aiSummaryText = document.getElementById('ai-summary-text');
const aiTypingIndicator = document.getElementById('ai-typing-indicator');

// Simple Markdown to HTML converter
function markdownToHtml(text) {
    let html = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>') // Italic
        .replace(/^- (.*)$/gm, '<li>$1</li>') // Bullets
        .replace(/\n/g, '<br>'); // Line breaks
    
    // Wrap bullet lists in <ul> tags
    html = html.replace(/(<li>.*<\/li>)/g, '<ul>$1</ul>');
    return html;
}

async function generateAISummary(weatherData) {
    const current = weatherData.current_condition[0];
    const weather = weatherData.weather[0];
    const astronomy = weather.astronomy[0];

    const prompt = `As a weather expert, provide a friendly and detailed analysis of the following weather conditions in Markdown format. Use **bold** for emphasis, *italics* for subtle notes, - for bullet lists, and line breaks for clarity:

Location: ${weatherData.nearest_area[0].areaName[0].value}, ${weatherData.nearest_area[0].country[0].value}

Current Conditions:
- Temperature: ${current.temp_C}°C (feels like ${current.FeelsLikeC}°C)
- Weather: ${current.weatherDesc[0].value}
- Humidity: ${current.humidity}%
- Wind: ${current.windspeedKmph} km/h from ${current.winddir16Point}
- UV Index: ${current.uvIndex}
- Visibility: ${current.visibility} km

Today's Forecast:
- High: ${weather.maxtempC}°C
- Low: ${weather.mintempC}°C
- Sunrise: ${astronomy.sunrise}
- Sunset: ${astronomy.sunset}
- Moon Phase: ${astronomy.moon_phase} (${astronomy.moon_illumination}% illuminated)

Please provide:
1. **A brief overview of current conditions**
2. **How it feels outside and what to wear**
3. **Any weather-related recommendations or warnings**
4. **Best times for outdoor activities today**

Keep the response concise but informative and conversational. Use Markdown formatting as specified.`;

    aiTypingIndicator.classList.remove('hidden');
    
    const myHeaders = new Headers({
        "Content-Type": "application/json",
    });

    const raw = JSON.stringify({
        "model": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "messages": [
            {
                "role": "system",
                "content": "You are a knowledgeable and friendly weather expert. Provide helpful, practical weather advice in a conversational tone using Markdown formatting: **bold** for emphasis, *italics* for notes, - for bullets, and line breaks for clarity."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "stream": true
    });

    try {
        const response = await fetch("https://api.deepinfra.com/v1/openai/chat/completions", {
            method: "POST",
            headers: myHeaders,
            body: raw
        });

        const reader = response.body.getReader();
        let summary = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.slice(6));
                        if (data.choices?.[0]?.delta?.content) {
                            summary += data.choices[0].delta.content;
                            aiSummaryText.innerHTML = markdownToHtml(summary);
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
        aiSummaryText.textContent = 'Failed to generate AI summary';
    } finally {
        aiTypingIndicator.classList.add('hidden');
    }
}

aiSummaryBtn.addEventListener('click', () => {
    aiSummaryContainer.classList.toggle('hidden');
    if (!aiSummaryContainer.classList.contains('hidden')) {
        aiSummaryContainer.classList.add('animate__animated', 'animate__fadeIn');
        generateAISummary(lastWeatherData);
    }
});

// Weather data handling
let lastWeatherData = null;

async function fetchWeatherByCoords(lat, lon) {
    try {
        const response = await fetch(`https://wttr.in/${lat},${lon}?format=j1`);
        const data = await response.json();
        lastWeatherData = data;
        updateUI(data);
    } catch (error) {
        console.error('Error fetching weather data:', error);
        document.getElementById('location').textContent = 'Error loading data';
    }
}

async function fetchWeatherByLocation(city) {
    try {
        const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
        const data = await response.json();
        lastWeatherData = data;
        updateUI(data);
    } catch (error) {
        console.error('Error fetching weather data:', error);
        document.getElementById('location').textContent = 'Error loading data';
    }
}

function updateUI(data) {
    const current = data.current_condition[0];
    const weather = data.weather[0];

    const animateElement = (element) => {
        element.classList.add('animate__animated', 'animate__fadeIn');
        setTimeout(() => {
            element.classList.remove('animate__animated', 'animate__fadeIn');
        }, 1000);
    };

    const locationElement = document.getElementById('location');
    const locationName = data.nearest_area[0].areaName[0].value;
    const country = data.nearest_area[0].country[0].value;
    locationElement.textContent = `${locationName}, ${country}`;
    animateElement(locationElement);

    const elements = {
        temperature: `${current.temp_C}°C`,
        'weather-desc': current.weatherDesc[0].value,
        'feels-like': `${current.FeelsLikeC}°C`,
        humidity: `${current.humidity}%`,
        'wind-speed': `${current.windspeedKmph} km/h`,
        pressure: `${current.pressure} mb`,
        'uv-index': current.uvIndex,
        visibility: `${current.visibility} km`,
        'temp-range': `Min: ${weather.mintempC}°C / Max: ${weather.maxtempC}°C`
    };

    Object.entries(elements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        element.textContent = value;
        animateElement(element);
    });

    const dateElement = document.getElementById('date');
    const currentDate = new Date();
    dateElement.textContent = currentDate.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    animateElement(dateElement);

    const astronomy = weather.astronomy[0];
    const astronomyElements = {
        sunrise: astronomy.sunrise,
        sunset: astronomy.sunset,
        moonrise: astronomy.moonrise,
        moonset: astronomy.moonset,
        'moon-phase': astronomy.moon_phase,
        'moon-illumination': `${astronomy.moon_illumination}%`
    };

    Object.entries(astronomyElements).forEach(([id, value]) => {
        const element = document.getElementById(id);
        element.textContent = value;
        animateElement(element);
    });

    updateHourlyForecast(weather.hourly);
}

function updateHourlyForecast(hourlyData) {
    const hourlyForecastContainer = document.getElementById('hourly-forecast');
    hourlyForecastContainer.innerHTML = '';

    hourlyData.slice(0, 4).forEach((hourData, index) => {
        const hour = (parseInt(hourData.time) / 100).toString().padStart(2, '0');
        
        const hourlyElement = document.createElement('div');
        hourlyElement.className = 'glass-card text-gray-800 dark:text-white text-center p-3 rounded-xl transform hover:scale-105 transition-all duration-300 animate__animated animate__fadeIn';
        hourlyElement.style.animationDelay = `${index * 0.2}s`;
        
        hourlyElement.innerHTML = `
            <p class="text-sm opacity-80">${hour}:00</p>
            <p class="text-xl font-bold my-1">${hourData.tempC}°C</p>
            <p class="text-sm">${hourData.weatherDesc[0].value}</p>
            <p class="text-xs opacity-80">${hourData.chanceofrain}% rain</p>
            <p class="text-xs opacity-80">Humidity: ${hourData.humidity}%</p>
            <p class="text-xs opacity-80">Wind: ${hourData.windspeedKmph} km/h</p>
        `;
        
        hourlyForecastContainer.appendChild(hourlyElement);
    });
}

// Initialize the app
initializeLocation();