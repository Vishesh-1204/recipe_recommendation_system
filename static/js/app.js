/**
 * AI Recipe Recommendation System — Agent 3 (Frontend)
 * Main application logic for ingredient selection, recipe generation, and cook mode.
 */

// ── State ──────────────────────────────────────────────────────
const state = {
    allIngredients: [],
    categories: {},
    selectedIngredients: new Set(),
    activeCategory: 'all',
    recipes: [],
    suggestions: [],
    currentCookRecipe: null,
    currentStep: 0,
    timerInterval: null,
    timerSeconds: 0,
    timerRunning: false,
};

// ── DOM References ─────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Initialize ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadIngredients();
    setupNavScrollEffect();
    setupSearchBar();
});

// ── API Calls ──────────────────────────────────────────────────
async function loadIngredients() {
    try {
        const [ingRes, catRes] = await Promise.all([
            fetch('/api/ingredients'),
            fetch('/api/categories'),
        ]);
        const ingData = await ingRes.json();
        const catData = await catRes.json();

        state.allIngredients = ingData.ingredients;
        state.categories = catData.categories;

        renderCategoryTabs();
        renderIngredients();
        updateNavStats();
    } catch (err) {
        console.error('Failed to load ingredients:', err);
    }
}

async function generateRecipes() {
    if (state.selectedIngredients.size === 0) return;

    const btn = $('#btn-generate');
    btn.classList.add('loading');
    btn.disabled = true;

    try {
        const res = await fetch('/api/recipes/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ingredients: Array.from(state.selectedIngredients),
            }),
        });
        const data = await res.json();

        state.recipes = data.recipes;
        state.suggestions = data.suggestions || [];

        renderRecipes();
        showRecipesSection();
    } catch (err) {
        console.error('Failed to generate recipes:', err);
    } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
    }
}

// ── Rendering ──────────────────────────────────────────────────
function renderCategoryTabs() {
    const container = $('#category-tabs');
    let html = `<button class="category-tab active" data-cat="all" onclick="filterCategory('all')">
        <span>🍽️</span> All
    </button>`;

    for (const [id, cat] of Object.entries(state.categories)) {
        html += `<button class="category-tab" data-cat="${id}" onclick="filterCategory('${id}')">
            <span>${cat.emoji}</span> ${cat.name}
        </button>`;
    }
    container.innerHTML = html;
}

function renderIngredients(filter = '') {
    const container = $('#ingredients-grid');
    let ingredients = state.allIngredients;

    // Category filter
    if (state.activeCategory !== 'all') {
        ingredients = ingredients.filter(i => i.category === state.activeCategory);
    }

    // Search filter
    if (filter) {
        const q = filter.toLowerCase();
        ingredients = ingredients.filter(i => i.name.toLowerCase().includes(q));
    }

    let html = '';
    ingredients.forEach(ing => {
        const selected = state.selectedIngredients.has(ing.id) ? 'selected' : '';
        html += `
        <div class="ingredient-chip ${selected}" data-id="${ing.id}" onclick="toggleIngredient('${ing.id}')">
            <span class="chip-emoji">${ing.emoji}</span>
            <span class="chip-name">${ing.name}</span>
            <span class="chip-check">✓</span>
        </div>`;
    });

    container.innerHTML = html || '<p style="color:var(--text-muted);text-align:center;grid-column:1/-1;padding:40px;">No ingredients found.</p>';
}

function renderSelectedSummary() {
    const container = $('#selected-summary');
    const count = state.selectedIngredients.size;

    if (count === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'flex';

    const chips = Array.from(state.selectedIngredients).map(id => {
        const ing = state.allIngredients.find(i => i.id === id);
        return ing ? `<span class="mini-chip">${ing.emoji} ${ing.name}</span>` : '';
    }).join('');

    container.innerHTML = `
        <div class="selected-info">
            <span class="selected-count">${count}</span>
            <div>
                <div class="selected-label">ingredient${count > 1 ? 's' : ''} selected</div>
            </div>
        </div>
        <div class="selected-chips">${chips}</div>
        <button class="btn-clear" onclick="clearSelection()">✕ Clear All</button>
    `;
}

function renderRecipes() {
    const container = $('#recipes-grid');
    const countEl = $('#recipes-count');

    if (state.recipes.length === 0) {
        container.innerHTML = `
        <div class="no-results" style="grid-column:1/-1;">
            <span class="emoji">🔍</span>
            <h3>No recipes found</h3>
            <p>Try selecting more ingredients or a different combination to discover new recipes.</p>
        </div>`;
        countEl.innerHTML = '<span>0</span> recipes found';
        return;
    }

    countEl.innerHTML = `<span>${state.recipes.length}</span> recipe${state.recipes.length > 1 ? 's' : ''} found`;

    let html = '';
    state.recipes.forEach(recipe => {
        const matchClass = getMatchClass(recipe.match_score);
        const matchPercent = Math.round(recipe.match_score);

        let missingHtml = '';
        if (recipe.missing_ingredients.length > 0) {
            const missingNames = recipe.missing_ingredients.slice(0, 4).map(m =>
                m.replace(/_/g, ' ')
            ).join(', ');
            const altHtml = Object.entries(recipe.alternatives || {}).map(([key, alts]) =>
                `${key.replace(/_/g, ' ')} → ${alts[0].replace(/_/g, ' ')}`
            ).slice(0, 2).join(', ');

            missingHtml = `
            <div class="recipe-missing">
                <strong>Missing: ${missingNames}${recipe.missing_ingredients.length > 4 ? '...' : ''}</strong>
                ${altHtml ? `<span>Try: ${altHtml}</span>` : ''}
            </div>`;
        }

        const tagsHtml = recipe.tags.slice(0, 3).map(t =>
            `<span class="recipe-tag">${t}</span>`
        ).join('');

        html += `
        <div class="recipe-card" data-id="${recipe.id}">
            <div class="recipe-card-header">
                <span class="recipe-emoji">${recipe.image_emoji}</span>
                <div class="recipe-info">
                    <h3 class="recipe-title">${recipe.title}</h3>
                    <span class="recipe-cuisine">📍 ${recipe.cuisine} • ${recipe.difficulty}</span>
                </div>
                <span class="recipe-match ${matchClass}">${matchPercent}%</span>
            </div>
            <p class="recipe-description">${recipe.description}</p>
            <div class="recipe-meta">
                <span class="meta-item"><span class="icon">⏱️</span> ${recipe.prep_time + recipe.cook_time} min</span>
                <span class="meta-item"><span class="icon">👥</span> ${recipe.servings} servings</span>
                <span class="meta-item"><span class="icon">🔥</span> ${recipe.calories} cal</span>
                <span class="meta-item"><span class="icon">📊</span> ${recipe.matched_count}/${recipe.total_ingredients}</span>
            </div>
            <div class="match-bar-container">
                <div class="match-bar-label">
                    <span>Ingredient Match</span>
                    <span>${matchPercent}%</span>
                </div>
                <div class="match-bar">
                    <div class="match-bar-fill" style="width: ${matchPercent}%"></div>
                </div>
            </div>
            ${missingHtml}
            <div class="recipe-card-footer">
                <div class="recipe-tags">${tagsHtml}</div>
                <button class="btn-cook" onclick="openCookMode('${recipe.id}')">
                    👨‍🍳 Cook This
                </button>
            </div>
        </div>`;
    });

    container.innerHTML = html;
    renderSuggestions();
}

function renderSuggestions() {
    const container = $('#smart-suggestions');
    if (!state.suggestions || state.suggestions.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';
    const chips = state.suggestions.map(s =>
        `<span class="suggestion-chip" onclick="addSuggestion('${s.id}')">
            ${s.emoji} ${s.name}
            <small style="opacity:0.5">+${s.unlock_score}</small>
        </span>`
    ).join('');

    container.innerHTML = `
        <div class="suggestions-title">💡 Smart Suggestions — add these to unlock more recipes</div>
        <div class="suggestion-chips">${chips}</div>
    `;
}

// ── Interactions ───────────────────────────────────────────────
function toggleIngredient(id) {
    if (state.selectedIngredients.has(id)) {
        state.selectedIngredients.delete(id);
    } else {
        state.selectedIngredients.add(id);
    }

    // Update chip visually
    const chip = document.querySelector(`.ingredient-chip[data-id="${id}"]`);
    if (chip) chip.classList.toggle('selected');

    renderSelectedSummary();
    updateGenerateButton();
    updateNavStats();
}

function addSuggestion(id) {
    state.selectedIngredients.add(id);
    renderIngredients($('#search-bar').value);
    renderSelectedSummary();
    updateGenerateButton();
    updateNavStats();
    generateRecipes();
}

function clearSelection() {
    state.selectedIngredients.clear();
    renderIngredients($('#search-bar').value);
    renderSelectedSummary();
    updateGenerateButton();
    updateNavStats();
    hideRecipesSection();
}

function filterCategory(cat) {
    state.activeCategory = cat;

    $$('.category-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.cat === cat);
    });

    renderIngredients($('#search-bar').value);
}

function updateGenerateButton() {
    const btn = $('#btn-generate');
    btn.disabled = state.selectedIngredients.size === 0;
}

function updateNavStats() {
    const countEl = $('#nav-selected-count');
    if (countEl) countEl.textContent = state.selectedIngredients.size;
}

function showRecipesSection() {
    const section = $('#recipes-section');
    section.classList.add('visible');
    setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function hideRecipesSection() {
    $('#recipes-section').classList.remove('visible');
}

function scrollToIngredients() {
    $('#ingredients-section').scrollIntoView({ behavior: 'smooth' });
}

// ── Search ─────────────────────────────────────────────────────
function setupSearchBar() {
    const searchBar = $('#search-bar');
    if (!searchBar) return;

    let debounce = null;
    searchBar.addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            renderIngredients(e.target.value);
        }, 200);
    });
}

// ── Nav Scroll Effect ──────────────────────────────────────────
function setupNavScrollEffect() {
    const nav = $('.navbar');
    window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 50);
    });
}

// ── Match Score Classes ────────────────────────────────────────
function getMatchClass(score) {
    if (score >= 90) return 'match-perfect';
    if (score >= 70) return 'match-great';
    if (score >= 50) return 'match-good';
    return 'match-partial';
}

// ── COOK MODE ──────────────────────────────────────────────────
function openCookMode(recipeId) {
    const recipe = state.recipes.find(r => r.id === recipeId);
    if (!recipe) return;

    state.currentCookRecipe = recipe;
    state.currentStep = 0;
    clearTimer();

    const modal = $('#cook-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    renderCookMode();
}

function closeCookMode() {
    const modal = $('#cook-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    clearTimer();
}

function renderCookMode() {
    const modal = $('#cook-modal-content');
    const recipe = state.currentCookRecipe;
    const step = state.currentStep;
    const total = recipe.steps.length;

    if (step >= total) {
        renderCookComplete(modal, recipe);
        return;
    }

    const currentStepData = recipe.steps[step];
    const progress = ((step) / total) * 100;

    modal.innerHTML = `
        <div class="cook-modal-header">
            <div class="cook-title-area">
                <span class="cook-recipe-emoji">${recipe.image_emoji}</span>
                <div>
                    <h2 class="cook-recipe-title">${recipe.title}</h2>
                    <span class="cook-recipe-meta">${recipe.cuisine} • ${recipe.difficulty}</span>
                </div>
            </div>
            <button class="btn-close-cook" onclick="closeCookMode()">✕</button>
        </div>

        <div class="cook-progress">
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${progress}%"></div>
            </div>
            <div class="progress-label">Step ${step + 1} of ${total}</div>
        </div>

        <div class="cook-step-card">
            <div class="step-number">${currentStepData.step}</div>
            <p class="step-instruction">${currentStepData.instruction}</p>
            ${currentStepData.tip ? `<div class="step-tip">${currentStepData.tip}</div>` : ''}
            ${currentStepData.duration ? `
            <div class="step-timer">
                <div>
                    <div class="timer-display" id="timer-display">${formatTime(currentStepData.duration * 60)}</div>
                    <span class="timer-label">${currentStepData.duration} min suggested</span>
                </div>
                <button class="btn-timer" id="btn-timer" onclick="toggleTimer(${currentStepData.duration * 60})">
                    ▶ Start Timer
                </button>
            </div>` : ''}
        </div>

        <div class="cook-nav">
            <button class="btn-step btn-step-prev" onclick="prevStep()" ${step === 0 ? 'style="visibility:hidden"' : ''}>
                ← Previous
            </button>
            <button class="btn-step btn-step-next ${step === total - 1 ? 'btn-finish' : ''}" onclick="nextStep()">
                ${step === total - 1 ? '✓ Finish Cooking' : 'Next Step →'}
            </button>
        </div>
    `;
}

function renderCookComplete(modal, recipe) {
    modal.innerHTML = `
        <div class="cook-modal-header">
            <div class="cook-title-area">
                <span class="cook-recipe-emoji">${recipe.image_emoji}</span>
                <div>
                    <h2 class="cook-recipe-title">${recipe.title}</h2>
                    <span class="cook-recipe-meta">Cooking Complete!</span>
                </div>
            </div>
            <button class="btn-close-cook" onclick="closeCookMode()">✕</button>
        </div>

        <div class="cook-progress">
            <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: 100%"></div>
            </div>
            <div class="progress-label">All steps complete!</div>
        </div>

        <div class="cook-complete">
            <span class="complete-emoji">🎉</span>
            <h2>Bon Appétit!</h2>
            <p>Your ${recipe.title} is ready to serve. Enjoy your delicious homemade meal!</p>
            <button class="btn-primary" onclick="closeCookMode()" style="margin-top:20px;">
                🏠 Back to Recipes
            </button>
        </div>
    `;
}

function nextStep() {
    clearTimer();
    state.currentStep++;
    renderCookMode();
}

function prevStep() {
    clearTimer();
    if (state.currentStep > 0) {
        state.currentStep--;
        renderCookMode();
    }
}

// ── Timer ──────────────────────────────────────────────────────
function toggleTimer(totalSeconds) {
    const btn = $('#btn-timer');
    const display = $('#timer-display');

    if (state.timerRunning) {
        clearTimer();
        btn.textContent = '▶ Resume';
        return;
    }

    if (state.timerSeconds <= 0) {
        state.timerSeconds = totalSeconds;
    }

    state.timerRunning = true;
    btn.textContent = '⏸ Pause';

    state.timerInterval = setInterval(() => {
        state.timerSeconds--;
        display.textContent = formatTime(state.timerSeconds);

        if (state.timerSeconds <= 0) {
            clearTimer();
            display.textContent = '00:00';
            display.style.color = 'var(--accent-green)';
            btn.textContent = '✓ Done!';

            // Play subtle notification
            if ('Notification' in window && Notification.permission === 'granted') {
                new Notification('Timer Complete! ⏰', {
                    body: `Step is done — time to move on!`,
                });
            }
        }
    }, 1000);
}

function clearTimer() {
    clearInterval(state.timerInterval);
    state.timerRunning = false;
    state.timerSeconds = 0;
    state.timerInterval = null;
}

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
