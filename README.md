# Wanderwise — AI Travel Recommendation Chatbot

A beginner-friendly travel planner built with Flask, Groq, and Firebase
Cloud Firestore. It supports natural-language trip planning, optional travel
preferences, day-by-day itineraries, and saved conversations. Groq keys and
Firebase credentials are used only by the Flask server; they are never sent to
the browser.

## Requirements

- Python 3.10 or newer
- A Groq API key from [Groq Console](https://console.groq.com/keys)
- A Firebase project with Cloud Firestore enabled and a Firebase Admin service
  account JSON file (optional: operates in local session mode without it)

The AI does not have live booking, flight, hotel availability, or price data.
It is instructed to identify unverified details; verify practical details with
official providers before booking.

## Windows PowerShell setup

Open PowerShell in this project folder:

```powershell
python --version
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
```

If PowerShell blocks virtual-environment activation, allow it for this
PowerShell process and activate again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
```

Edit `.env` and set:

- `GROQ_API_KEY`: your Groq API key. If you previously configured an
  `OPENAI_API_KEY`, remove it; this app no longer uses OpenAI.
- `GROQ_MODEL`: a model enabled for your Groq account (default:
  `llama-3.3-70b-versatile`).
- `OPENWEATHER_API_KEY`: your OpenWeatherMap API key for live weather.
- `FIREBASE_CREDENTIALS_PATH`: path to your Firebase Admin service account JSON file (optional).
- `FLASK_SECRET_KEY`: persistent random value.

## Firebase setup (Optional for persistent Cloud storage)

1. Create a project in the [Firebase console](https://console.firebase.google.com/).
2. Open **Build → Firestore Database** and create a database.
3. In **Project settings → Service accounts**, generate a new private key and
   download the JSON file.
4. Put its path in `.env`, for example:

   ```dotenv
   FIREBASE_CREDENTIALS_PATH=./firebase-credentials.json
   ```

## Run locally

With the virtual environment active and `.env` configured:

```powershell
python app.py
```

Open <http://127.0.0.1:5000>.

## Key Features (MCA Project Highlights)

- 🎙️ **Speech-to-Text (Voice Search)**: Hands-free voice querying using the native HTML5 Web Speech API with real-time audio pulse feedback.
- 🔊 **Text-to-Speech (Audio Travel Guide)**: "Read Aloud" speaker control on all generated plans and itineraries to listen to day-by-day guides.
- 🗺️ **Interactive Geographic Map (Leaflet.js + OpenStreetMap)**: Live plotting of destination landmarks, day-by-day attraction pins, and interactive popup cards with zoom-to-pin navigation.
- ☀️ **Real-Time Weather Widget**: Integrated with the Open-Meteo API for real-time temperatures, weather conditions, wind speed, and 3-day forecasts for any chosen city.
- 📊 **Smart Budget Estimator & Analytics (Chart.js)**: Algorithmic budget breakdown allocating funds across Stay, Food, Transport, Sightseeing, and Emergency cushions with an interactive donut chart.
- 📄 **1-Click PDF Itinerary Export**: Uses `html2pdf.js` to convert AI-generated plans into beautifully formatted, printable PDF travel documents.
- ✨ **Rich Markdown Typography**: Styled headings, lists, blockquotes, and tables powered by `marked.js`.
- 💾 **Hybrid Persistence Architecture**: Cloud Firestore integration with automatic local fallback session memory.
- 📱 **Adaptive 3-Column Responsive UI**: Side-by-side trip history, interactive conversation stream, and sliding travel toolkit drawer.
