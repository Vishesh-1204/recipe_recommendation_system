# 🍳 AI-Driven Recipe Recommendation System — Architecture

## Core Features
1. **Ingredient-Based Recipe Generation** — Users select ingredients → AI generates matching recipes
2. **Guided Cook Mode** — Step-by-step interactive cooking instructions with timers
3. **Smart Recommendations** — Missing ingredient detection, alternatives, difficulty ratings
4. **Interactive UI** — Dark glassmorphism design, animations, responsive layout

## System Architecture
- Frontend: HTML/CSS/JS with dark glassmorphism design
- Backend: Flask/Python REST API
- AI Engine: Smart recipe matching and recommendation logic

## API Endpoints
- GET /api/ingredients — List all available ingredients
- POST /api/recipes/generate — Generate recipes from selected ingredients
- GET /api/recipe/<id> — Get full recipe details
- GET /api/categories — Get ingredient categories
