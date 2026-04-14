"""
Recipe Engine — Agent 2 (Backend/AI)
Smart recommendation logic that matches user ingredients to recipes,
scores them, suggests alternatives, and generates cooking tips.
"""

import random
from recipe_data import RECIPES, INGREDIENT_CATEGORIES, get_all_ingredients


# ---------------------------------------------------------------------------
# Alternative ingredient suggestions
# ---------------------------------------------------------------------------
ALTERNATIVES = {
    "chicken": ["tofu", "paneer", "fish", "shrimp"],
    "beef": ["lamb", "chicken", "tofu"],
    "shrimp": ["fish", "chicken", "tofu"],
    "fish": ["shrimp", "chicken", "tofu"],
    "lamb": ["beef", "chicken"],
    "paneer": ["tofu", "cheese"],
    "tofu": ["paneer", "chicken", "chickpeas"],
    "butter": ["olive_oil", "vegetable_oil"],
    "cream": ["coconut_milk", "yogurt", "milk"],
    "milk": ["coconut_milk", "yogurt"],
    "yogurt": ["cream", "coconut_milk"],
    "cheese": ["paneer", "yogurt"],
    "pasta": ["noodles", "rice"],
    "noodles": ["pasta", "rice"],
    "rice": ["noodles", "pasta", "bread"],
    "bread": ["tortilla", "rice"],
    "tortilla": ["bread", "naan"],
    "coconut_milk": ["cream", "milk", "yogurt"],
    "tomato": ["tomato_sauce"],
    "tomato_sauce": ["tomato"],
    "spinach": ["cabbage", "lettuce", "broccoli"],
    "broccoli": ["cauliflower", "spinach"],
    "cauliflower": ["broccoli"],
    "bell_pepper": ["tomato", "zucchini"],
    "mushroom": ["eggplant", "zucchini"],
    "lentils": ["chickpeas"],
    "chickpeas": ["lentils"],
}

# ---------------------------------------------------------------------------
# Cooking tips pool (AI-generated style)
# ---------------------------------------------------------------------------
COOKING_TIPS = [
    "Prep all ingredients before you start cooking — mise en place saves time and stress.",
    "Taste as you go! Seasoning is a journey, not a destination.",
    "Let proteins rest after cooking — this redistributes juices evenly.",
    "Fresh herbs added at the end create bright, vibrant flavors.",
    "A splash of acid (lemon or vinegar) at the end can elevate any dish.",
    "Don't overcrowd the pan — cook in batches for better browning.",
    "Use the right heat: high for searing, low for simmering.",
    "Salt your pasta water generously — it should taste like the sea.",
    "Room-temperature ingredients cook more evenly than cold ones.",
    "A sharp knife is safer and faster than a dull one.",
]


def calculate_match_score(recipe, selected_ingredients):
    """
    Calculate how well a recipe matches the user's selected ingredients.
    Returns a dict with score details.
    """
    recipe_ingredient_ids = [ing["name"] for ing in recipe["ingredients"]]
    selected_set = set(selected_ingredients)

    matched = [i for i in recipe_ingredient_ids if i in selected_set]
    missing = [i for i in recipe_ingredient_ids if i not in selected_set]

    # Core ingredients are the first 3 listed (most important)
    core_ingredients = recipe_ingredient_ids[:3]
    core_matched = [i for i in core_ingredients if i in selected_set]

    # Score formula:
    # Base: % of total ingredients matched (0-70 points)
    # Bonus: core ingredient match (0-30 points)
    total = len(recipe_ingredient_ids)
    if total == 0:
        return {"score": 0, "matched": [], "missing": [], "alternatives": {}}

    base_score = (len(matched) / total) * 70
    core_score = (len(core_matched) / len(core_ingredients)) * 30 if core_ingredients else 0
    final_score = round(base_score + core_score, 1)

    # Find alternatives for missing ingredients
    alternatives = {}
    for m in missing:
        if m in ALTERNATIVES:
            available_alts = [a for a in ALTERNATIVES[m] if a in selected_set]
            if available_alts:
                alternatives[m] = available_alts

    return {
        "score": final_score,
        "matched": matched,
        "missing": missing,
        "alternatives": alternatives,
        "total_ingredients": total,
        "matched_count": len(matched),
        "missing_count": len(missing),
    }


def generate_recipes(selected_ingredients, min_score=15):
    """
    Generate recipe recommendations based on selected ingredients.
    Returns recipes sorted by match score.
    """
    if not selected_ingredients:
        return []

    results = []
    for recipe in RECIPES:
        score_data = calculate_match_score(recipe, selected_ingredients)

        if score_data["score"] >= min_score:
            result = {
                **recipe,
                "match_score": score_data["score"],
                "matched_ingredients": score_data["matched"],
                "missing_ingredients": score_data["missing"],
                "alternatives": score_data["alternatives"],
                "matched_count": score_data["matched_count"],
                "missing_count": score_data["missing_count"],
                "total_ingredients": score_data["total_ingredients"],
                "match_label": _get_match_label(score_data["score"]),
                "cooking_tip": random.choice(COOKING_TIPS),
            }
            results.append(result)

    # Sort by match score descending
    results.sort(key=lambda x: x["match_score"], reverse=True)
    return results


def _get_match_label(score):
    """Return a human-readable label for the match score."""
    if score >= 90:
        return "Perfect Match! 🎯"
    elif score >= 70:
        return "Great Match! ✨"
    elif score >= 50:
        return "Good Match 👍"
    elif score >= 30:
        return "Partial Match 🔄"
    else:
        return "Worth Trying 💡"


def get_recipe_by_id(recipe_id):
    """Get a single recipe by its ID."""
    for recipe in RECIPES:
        if recipe["id"] == recipe_id:
            return recipe
    return None


def get_categories():
    """Return ingredient categories with counts."""
    categories = {}
    for cat_id, cat_data in INGREDIENT_CATEGORIES.items():
        categories[cat_id] = {
            "id": cat_id,
            "name": cat_id.replace("_", " ").title(),
            "emoji": cat_data["emoji"],
            "count": len(cat_data["items"]),
            "items": cat_data["items"],
        }
    return categories


def get_smart_suggestions(selected_ingredients):
    """
    Based on selected ingredients, suggest additional ingredients
    that would unlock more recipes.
    """
    if not selected_ingredients:
        return []

    selected_set = set(selected_ingredients)
    suggestion_scores = {}

    for recipe in RECIPES:
        recipe_ings = set(ing["name"] for ing in recipe["ingredients"])
        current_match = len(recipe_ings & selected_set)
        total = len(recipe_ings)

        if current_match == 0:
            continue

        # For each missing ingredient, calculate how many recipes it unlocks
        for missing in recipe_ings - selected_set:
            if missing not in suggestion_scores:
                suggestion_scores[missing] = 0
            # More points if adding this ingredient gets us closer to completing a recipe
            suggestion_scores[missing] += (current_match / total) * 10

    # Sort by score and return top suggestions
    sorted_suggestions = sorted(suggestion_scores.items(), key=lambda x: x[1], reverse=True)

    # Get ingredient details
    all_ings = {i["id"]: i for i in get_all_ingredients()}
    suggestions = []
    for ing_id, score in sorted_suggestions[:6]:
        if ing_id in all_ings:
            suggestions.append({
                **all_ings[ing_id],
                "unlock_score": round(score, 1),
            })

    return suggestions
