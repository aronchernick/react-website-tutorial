// Roman Emperor Game — Main Application Logic

class EmperorGame {
  constructor() {
    this.totalCards = 30;
    this.currentIndex = 0;
    this.responses = [];
    this.emperorScores = {};
    this.categoryStats = {};
    this.askedIds = new Set();
    this.currentQuestion = null;
    this.isAnimating = false;

    // Load data (uses admin localStorage overrides if they exist)
    this.emperors = this._loadEmperors();
    this.questions = this._loadQuestions();

    // Initialize emperor scores
    Object.keys(this.emperors).forEach(id => {
      this.emperorScores[id] = 0;
    });

    // Initialize category stats
    Object.keys(CATEGORIES).forEach(cat => {
      this.categoryStats[cat] = { likes: 0, dislikes: 0, asked: 0 };
    });

    this.init();
  }

  // Load emperors — use admin overrides from localStorage if present
  _loadEmperors() {
    try {
      const override = localStorage.getItem('admin_emperors');
      if (override) return JSON.parse(override);
    } catch(e) { /* fall through */ }
    return JSON.parse(JSON.stringify(EMPERORS));
  }

  // Load questions — use admin overrides from localStorage if present
  _loadQuestions() {
    try {
      const override = localStorage.getItem('admin_questions');
      if (override) return JSON.parse(override);
    } catch(e) { /* fall through */ }
    return JSON.parse(JSON.stringify(QUESTIONS));
  }

  init() {
    this.bindEvents();
    this.showScreen('start-screen');
    this.initCookieBanner();
  }

  // ===== COOKIE CONSENT =====
  initCookieBanner() {
    const consent = localStorage.getItem('cookieConsent');
    if (!consent) {
      document.getElementById('cookie-banner').classList.remove('hidden');
    }
  }

  acceptCookies() {
    localStorage.setItem('cookieConsent', 'accepted');
    document.getElementById('cookie-banner').classList.add('hidden');
  }

  declineCookies() {
    localStorage.setItem('cookieConsent', 'declined');
    document.getElementById('cookie-banner').classList.add('hidden');
    // Clear any existing storage
    localStorage.removeItem('emperorGameData');
  }

  // ===== EVENT BINDING =====
  bindEvents() {
    document.getElementById('start-btn').addEventListener('click', () => this.startGame());
    document.getElementById('like-btn').addEventListener('click', () => this.respond(true));
    document.getElementById('dislike-btn').addEventListener('click', () => this.respond(false));
    document.getElementById('finish-btn').addEventListener('click', () => this.finishGame());
    document.getElementById('play-again-btn').addEventListener('click', () => this.restart());

    // Cookie banner
    document.getElementById('cookie-accept').addEventListener('click', () => this.acceptCookies());
    document.getElementById('cookie-decline').addEventListener('click', () => this.declineCookies());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (this.isAnimating) return;
      const gameScreen = document.getElementById('game-screen');
      if (gameScreen.classList.contains('hidden')) return;

      if (e.key === 'ArrowRight' || e.key === 'l') this.respond(true);
      if (e.key === 'ArrowLeft' || e.key === 'd') this.respond(false);
    });
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
  }

  startGame() {
    this.currentIndex = 0;
    this.responses = [];
    this.askedIds = new Set();
    // Reload data each game in case admin made changes
    this.emperors = this._loadEmperors();
    this.questions = this._loadQuestions();
    Object.keys(this.emperors).forEach(id => {
      this.emperorScores[id] = 0;
    });
    Object.keys(CATEGORIES).forEach(cat => {
      this.categoryStats[cat] = { likes: 0, dislikes: 0, asked: 0 };
    });
    this.showScreen('game-screen');
    this.showNextCard();
  }

  // ===== ADAPTIVE QUESTION SELECTION =====
  pickNextQuestion() {
    const remaining = this.questions.filter(q => !this.askedIds.has(q.id));
    if (remaining.length === 0) return null;

    const totalAsked = this.currentIndex;
    const numCategories = Object.keys(CATEGORIES).length;

    // Phase 1: Ensure each category gets at least one question
    if (totalAsked < numCategories) {
      const catsAsked = new Set(this.responses.map(r => r.category));
      const unaskedCats = Object.keys(CATEGORIES).filter(c => !catsAsked.has(c));

      if (unaskedCats.length > 0) {
        const cat = unaskedCats[Math.floor(Math.random() * unaskedCats.length)];
        const catQuestions = remaining.filter(q => q.category === cat);
        if (catQuestions.length > 0) {
          return catQuestions[Math.floor(Math.random() * catQuestions.length)];
        }
      }
    }

    // Phase 2: Ensure each category has at least 2 questions
    if (totalAsked < numCategories * 2) {
      const catCounts = {};
      Object.keys(CATEGORIES).forEach(c => catCounts[c] = 0);
      this.responses.forEach(r => catCounts[r.category]++);

      const underRep = Object.keys(CATEGORIES).filter(c => catCounts[c] < 2);
      if (underRep.length > 0) {
        const cat = underRep[Math.floor(Math.random() * underRep.length)];
        const catQuestions = remaining.filter(q => q.category === cat);
        if (catQuestions.length > 0) {
          return catQuestions[Math.floor(Math.random() * catQuestions.length)];
        }
      }
    }

    // Phase 3: Weighted random — favor categories where user is more engaged (agreeing)
    const roll = Math.random();
    if (roll < 0.7) {
      const weights = {};
      let totalWeight = 0;
      Object.keys(CATEGORIES).forEach(cat => {
        const stat = this.categoryStats[cat];
        const w = stat.likes + 1;
        weights[cat] = w;
        totalWeight += w;
      });

      let r = Math.random() * totalWeight;
      let selectedCat = null;
      for (const cat of Object.keys(weights)) {
        r -= weights[cat];
        if (r <= 0) {
          selectedCat = cat;
          break;
        }
      }

      const catQuestions = remaining.filter(q => q.category === selectedCat);
      if (catQuestions.length > 0) {
        return catQuestions[Math.floor(Math.random() * catQuestions.length)];
      }
    }

    return remaining[Math.floor(Math.random() * remaining.length)];
  }

  showNextCard() {
    if (this.currentIndex >= this.totalCards) {
      this.finishGame();
      return;
    }

    const question = this.pickNextQuestion();
    if (!question) {
      this.finishGame();
      return;
    }

    this.currentQuestion = question;
    this.askedIds.add(question.id);

    // Update progress
    const progress = ((this.currentIndex) / this.totalCards) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('card-count').textContent = `${this.currentIndex + 1} / ${this.totalCards}`;

    // Update card content
    const card = document.getElementById('question-card');
    const catInfo = CATEGORIES[question.category];

    document.getElementById('card-branch').textContent = `${catInfo.icon} ${catInfo.name}`;
    document.getElementById('card-branch').style.background = catInfo.color;
    document.getElementById('card-text').textContent = question.text;
    document.getElementById('card-context').textContent = question.context;
    document.getElementById('like-btn-text').textContent = question.likeText;
    document.getElementById('dislike-btn-text').textContent = question.dislikeText;

    // Animate card in
    card.classList.remove('card-exit-left', 'card-exit-right');
    card.classList.add('card-enter');
    requestAnimationFrame(() => {
      card.classList.remove('card-enter');
    });
  }

  respond(liked) {
    if (this.isAnimating || !this.currentQuestion) return;
    this.isAnimating = true;

    const question = this.currentQuestion;
    const category = question.category;

    // Record response
    this.responses.push({
      questionId: question.id,
      category: category,
      liked: liked
    });

    // Update category stats
    this.categoryStats[category].asked++;
    if (liked) {
      this.categoryStats[category].likes++;
    } else {
      this.categoryStats[category].dislikes++;
    }

    // UPDATE EMPEROR SCORES — the core scoring mechanic
    const scoring = liked ? question.agree : question.disagree;
    if (scoring) {
      Object.entries(scoring).forEach(([emperorId, points]) => {
        if (this.emperorScores.hasOwnProperty(emperorId)) {
          this.emperorScores[emperorId] += points;
        }
      });
    }

    // Animate card out
    const card = document.getElementById('question-card');
    card.classList.add(liked ? 'card-exit-right' : 'card-exit-left');

    const btn = liked ? document.getElementById('like-btn') : document.getElementById('dislike-btn');
    btn.classList.add('btn-flash');
    setTimeout(() => btn.classList.remove('btn-flash'), 300);

    this.currentIndex++;

    setTimeout(() => {
      this.isAnimating = false;
      this.showNextCard();
    }, 400);
  }

  finishGame() {
    this.showScreen('results-screen');
    this.calculateResults();
  }

  calculateResults() {
    // Find the emperor with the highest score
    let topEmperor = null;
    let topScore = -Infinity;
    const sortedEmperors = Object.entries(this.emperorScores)
      .sort((a, b) => b[1] - a[1]);

    topEmperor = sortedEmperors[0][0];
    topScore = sortedEmperors[0][1];

    const emperor = this.emperors[topEmperor];

    // Render results
    document.getElementById('emperor-name').textContent = emperor.name;
    document.getElementById('emperor-reign').textContent = emperor.reign;
    document.getElementById('emperor-title').textContent = emperor.title;
    document.getElementById('emperor-tagline').textContent = emperor.tagline;
    document.getElementById('emperor-description').textContent = emperor.description;
    document.getElementById('result-gif').src = emperor.gif;
    document.getElementById('emperor-icon-large').textContent = emperor.icon;

    // Render top 5 emperor scores
    this.renderEmperorRanking(sortedEmperors);

    // Render category stats
    this.renderCategoryStats();

    // Animate in
    document.getElementById('results-screen').classList.add('results-animate');
  }

  renderEmperorRanking(sortedEmperors) {
    const container = document.getElementById('emperor-ranking');
    container.innerHTML = '';

    const maxScore = sortedEmperors[0][1] || 1;
    const top5 = sortedEmperors.slice(0, 5);

    top5.forEach(([id, score], index) => {
      const emp = this.emperors[id];
      const pct = Math.round((score / maxScore) * 100);

      const el = document.createElement('div');
      el.className = 'ranking-item' + (index === 0 ? ' ranking-top' : '');
      el.innerHTML = `
        <div class="ranking-header">
          <span class="ranking-position">${index === 0 ? '👑' : '#' + (index + 1)}</span>
          <span class="ranking-name">${emp.icon} ${emp.name}</span>
          <span class="ranking-score">${score} pts</span>
        </div>
        <div class="ranking-bar-container">
          <div class="ranking-bar" style="width: ${pct}%; background: ${emp.color}"></div>
        </div>
      `;
      container.appendChild(el);
    });
  }

  renderCategoryStats() {
    const container = document.getElementById('category-stats');
    container.innerHTML = '';

    const totalResponses = this.responses.length;

    Object.keys(CATEGORIES).forEach(cat => {
      const info = CATEGORIES[cat];
      const stat = this.categoryStats[cat];
      const total = stat.likes + stat.dislikes;

      if (total === 0) return;

      const likePercent = Math.round((stat.likes / total) * 100);
      const dislikePercent = 100 - likePercent;

      const el = document.createElement('div');
      el.className = 'branch-stat';
      el.innerHTML = `
        <div class="branch-stat-header">
          <span class="branch-stat-name">${info.icon} ${info.name}</span>
          <span class="branch-stat-count">${total} questions</span>
        </div>
        <div class="stat-bar-container">
          <div class="stat-bar stat-bar-like" style="width: ${likePercent}%; background: ${info.color}">
            ${likePercent > 15 ? `👍 ${stat.likes}` : ''}
          </div>
          <div class="stat-bar stat-bar-dislike" style="width: ${dislikePercent}%">
            ${dislikePercent > 15 ? `👎 ${stat.dislikes}` : ''}
          </div>
        </div>
      `;
      container.appendChild(el);
    });

    const totalLikes = this.responses.filter(r => r.liked).length;
    const totalDislikes = this.responses.filter(r => !r.liked).length;
    document.getElementById('total-stats').textContent =
      `${totalResponses} questions answered · ${totalLikes} agrees · ${totalDislikes} disagrees`;
  }

  restart() {
    document.getElementById('results-screen').classList.remove('results-animate');
    this.currentIndex = 0;
    this.responses = [];
    this.askedIds = new Set();
    this.currentQuestion = null;
    Object.keys(this.emperors).forEach(id => {
      this.emperorScores[id] = 0;
    });
    Object.keys(CATEGORIES).forEach(cat => {
      this.categoryStats[cat] = { likes: 0, dislikes: 0, asked: 0 };
    });
    this.showScreen('start-screen');
  }
}

// Boot the game
document.addEventListener('DOMContentLoaded', () => {
  new EmperorGame();
});
