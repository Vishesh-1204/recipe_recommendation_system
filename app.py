"""
Flask Application — Agent 4 (Integration)
Main entry point for the AI-Driven Recipe Recommendation System.
"""

from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from recipe_engine import (
    generate_recipes,
    get_recipe_by_id,
    get_categories,
    get_smart_suggestions,
)
from recipe_data import get_all_ingredients

app = Flask(__name__)
CORS(app)


# ---------------------------------------------------------------------------
# Page Routes
# ---------------------------------------------------------------------------
@app.route("/")
def index():
    """Serve the main application page."""
    return render_template("index.html")


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------
@app.route("/api/ingredients", methods=["GET"])
def api_ingredients():
    """Return all available ingredients."""
    ingredients = get_all_ingredients()
    return jsonify({"success": True, "ingredients": ingredients})


@app.route("/api/categories", methods=["GET"])
def api_categories():
    """Return ingredient categories."""
    categories = get_categories()
    return jsonify({"success": True, "categories": categories})


@app.route("/api/recipes/generate", methods=["POST"])
def api_generate_recipes():
    """Generate recipes based on selected ingredients."""
    data = request.get_json()
    if not data or "ingredients" not in data:
        return jsonify({"success": False, "error": "No ingredients provided"}), 400

    selected = data["ingredients"]
    if not selected:
        return jsonify({"success": False, "error": "Please select at least one ingredient"}), 400

    recipes = generate_recipes(selected)
    suggestions = get_smart_suggestions(selected)

    return jsonify({
        "success": True,
        "recipes": recipes,
        "count": len(recipes),
        "suggestions": suggestions,
    })


@app.route("/api/recipe/<recipe_id>", methods=["GET"])
def api_recipe_detail(recipe_id):
    """Get detailed recipe information."""
    recipe = get_recipe_by_id(recipe_id)
    if not recipe:
        return jsonify({"success": False, "error": "Recipe not found"}), 404
    return jsonify({"success": True, "recipe": recipe})


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("\n🍳 AI Recipe Recommendation System")
    print("=" * 40)
    print("🌐 Open: http://localhost:5000")
    print("=" * 40 + "\n")
    app.run(debug=True, port=5000)
