(function () {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  var PALETTES = {
    'original-light': {
      isDark: false,
      bg: '#FAFAFA',
      surface: '#FFFFFF',
      surfaceAlt: '#F1F5F9',
      headerBg: 'rgba(255, 255, 255, 0.96)',
      font: '#09090B',
      muted: '#52525B',
      border: '#E2E8F0',
      borderStrong: 'rgba(79, 70, 229, 0.35)',
      button: '#4F46E5',
      buttonHover: '#4338CA',
      buttonText: '#FFFFFF',
      accentInk: '#4338CA',
      accentSoft: 'rgba(79, 70, 229, 0.12)',
      accentGlow: 'rgba(79, 70, 229, 0.24)'
    },
    'original-dark': {
      isDark: true,
      bg: '#09090B',
      surface: '#18181B',
      surfaceAlt: '#27272A',
      headerBg: 'rgba(24, 24, 27, 0.96)',
      font: '#FAFAFA',
      muted: '#A1A1AA',
      border: 'rgba(255, 255, 255, 0.14)',
      borderStrong: 'rgba(99, 102, 241, 0.45)',
      button: '#6366F1',
      buttonHover: '#818CF8',
      buttonText: '#FFFFFF',
      accentInk: '#A5B4FC',
      accentSoft: 'rgba(99, 102, 241, 0.18)',
      accentGlow: 'rgba(99, 102, 241, 0.28)'
    },
    'burnt-orange': {
      isDark: false,
      bg: '#F3EEE3',
      surface: '#FAF7F0',
      surfaceAlt: '#EAE3D5',
      headerBg: '#FAF7F0',
      font: '#111111',
      muted: '#4A443A',
      border: '#D9CFC0',
      borderStrong: 'rgba(217, 100, 30, 0.45)',
      button: '#D9641E',
      buttonHover: '#BF5414',
      buttonText: '#FFFFFF',
      accentInk: '#C25312',
      accentSoft: 'rgba(217, 100, 30, 0.14)',
      accentGlow: 'rgba(217, 100, 30, 0.26)'
    },
    'burnt-orange-dark': {
      isDark: true,
      bg: '#16110D',
      surface: '#211913',
      surfaceAlt: '#2C2119',
      headerBg: 'rgba(33, 25, 19, 0.96)',
      font: '#F5EFE6',
      muted: '#C2B5A3',
      border: 'rgba(245, 239, 230, 0.16)',
      borderStrong: 'rgba(217, 100, 30, 0.55)',
      button: '#D9641E',
      buttonHover: '#EA752E',
      buttonText: '#FFFFFF',
      accentInk: '#FF8B5E',
      accentSoft: 'rgba(217, 100, 30, 0.22)',
      accentGlow: 'rgba(217, 100, 30, 0.34)'
    },
    'hot-pink': {
      isDark: true,
      bg: '#0F183D',
      surface: '#172457',
      surfaceAlt: '#1E2E6B',
      headerBg: '#172457',
      font: '#FFFFFF',
      muted: '#C7D2FE',
      border: 'rgba(255, 255, 255, 0.16)',
      borderStrong: 'rgba(255, 61, 139, 0.48)',
      button: '#FF3D8B',
      buttonHover: '#E62E78',
      buttonText: '#FFFFFF',
      accentInk: '#FF85B3',
      accentSoft: 'rgba(255, 61, 139, 0.18)',
      accentGlow: 'rgba(255, 61, 139, 0.30)'
    },
    'hot-pink-dark': {
      isDark: true,
      bg: '#080D24',
      surface: '#101A42',
      surfaceAlt: '#182559',
      headerBg: 'rgba(16, 26, 66, 0.96)',
      font: '#FFFFFF',
      muted: '#D5DCFF',
      border: 'rgba(255, 255, 255, 0.14)',
      borderStrong: 'rgba(255, 61, 139, 0.55)',
      button: '#FF3D8B',
      buttonHover: '#FF579B',
      buttonText: '#FFFFFF',
      accentInk: '#FF96C0',
      accentSoft: 'rgba(255, 61, 139, 0.22)',
      accentGlow: 'rgba(255, 61, 139, 0.35)'
    },
    'electric-blue': {
      isDark: true,
      bg: '#1E1E1C',
      surface: '#272724',
      surfaceAlt: '#31312D',
      headerBg: '#272724',
      font: '#D8CBB3',
      muted: '#AFA28A',
      border: 'rgba(216, 203, 179, 0.18)',
      borderStrong: 'rgba(47, 107, 255, 0.48)',
      button: '#2F6BFF',
      buttonHover: '#2157DE',
      buttonText: '#FFFFFF',
      accentInk: '#8DB2FF',
      accentSoft: 'rgba(47, 107, 255, 0.2)',
      accentGlow: 'rgba(47, 107, 255, 0.30)'
    },
    'electric-blue-dark': {
      isDark: true,
      bg: '#11110F',
      surface: '#1A1A17',
      surfaceAlt: '#242420',
      headerBg: 'rgba(26, 26, 23, 0.96)',
      font: '#E3D7C1',
      muted: '#B5A890',
      border: 'rgba(227, 215, 193, 0.16)',
      borderStrong: 'rgba(47, 107, 255, 0.55)',
      button: '#2F6BFF',
      buttonHover: '#4C82FF',
      buttonText: '#FFFFFF',
      accentInk: '#9BBCFF',
      accentSoft: 'rgba(47, 107, 255, 0.24)',
      accentGlow: 'rgba(47, 107, 255, 0.36)'
    }
  };

  function getParams() {
    try {
      return new URLSearchParams(window.location.search || '');
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function resolvePaletteKey(design, darkMode) {
    var d = String(design || 'original').trim().toLowerCase();
    if (d === 'burnt-orange' || d === 'hot-pink' || d === 'electric-blue') {
      return darkMode ? (d + '-dark') : d;
    }
    return darkMode ? 'original-dark' : 'original-light';
  }

  function buildStylesheetText() {
    return [
      '/* Practise Admin Design + Responsive Embed Override */',
      'html[data-practise-design] {',
      '  color-scheme: var(--p-scheme, light);',
      '}',
      'html[data-practise-design],',
      'html[data-practise-design][data-theme],',
      'html[data-practise-design] body,',
      'html[data-practise-design] body[class*="theme-"] {',
      '  --bg-primary: var(--p-bg) !important;',
      '  --bg-secondary: var(--p-surface-alt) !important;',
      '  --bg-base: var(--p-bg) !important;',
      '  --bg-surface: var(--p-surface) !important;',
      '  --bg-color: var(--p-bg) !important;',
      '  --bg-main: var(--p-bg) !important;',
      '  --bg-page: var(--p-bg) !important;',
      '  --bg-card: var(--p-surface) !important;',
      '  --card-bg: var(--p-surface) !important;',
      '  --bg-card-hover: var(--p-surface-alt) !important;',
      '  --card-hover: var(--p-surface-alt) !important;',
      '  --bg-glass: var(--p-header-bg) !important;',
      '  --header-bg: var(--p-header-bg) !important;',
      '  --nav-bg: var(--p-header-bg) !important;',
      '  --card-inner: var(--p-surface-alt) !important;',
      '  --bg-gradient: var(--p-bg) !important;',
      '  --text-main: var(--p-font) !important;',
      '  --text-primary: var(--p-font) !important;',
      '  --text-muted: var(--p-muted) !important;',
      '  --text-secondary: var(--p-muted) !important;',
      '  --border-color: var(--p-border) !important;',
      '  --card-border: var(--p-border) !important;',
      '  --border-subtle: var(--p-border) !important;',
      '  --border-highlight: var(--p-border-strong) !important;',
      '  --border-focus: var(--p-button) !important;',
      '  --card-hover-border: var(--p-button) !important;',
      '  --accent-gold-border: var(--p-border-strong) !important;',
      '  --accent: var(--p-button) !important;',
      '  --accent-primary: var(--p-button) !important;',
      '  --accent-hover: var(--p-button-hover) !important;',
      '  --accent-light: var(--p-accent-soft) !important;',
      '  --accent-gold: var(--p-button) !important;',
      '  --accent-gold-hover: var(--p-button-hover) !important;',
      '  --accent-gold-light: var(--p-accent-soft) !important;',
      '  --accent-glow: var(--p-accent-glow) !important;',
      '  --accent-gold-glow: var(--p-accent-glow) !important;',
      '  --accent-gradient: linear-gradient(135deg, var(--p-button), var(--p-button-hover)) !important;',
      '  --btn-bg: var(--p-button) !important;',
      '  --btn-text: var(--p-button-text) !important;',
      '  --primary: var(--p-button) !important;',
      '  --primary-light: var(--p-accent-soft) !important;',
      '  --boss-gradient: linear-gradient(135deg, var(--p-surface), var(--p-surface-alt)) !important;',
      '  --boss-glow: var(--p-accent-glow) !important;',
      '  --progress-bg: var(--p-surface-alt) !important;',
      '  --shadow-lux: 0 10px 28px rgba(0, 0, 0, 0.14) !important;',
      '  --shadow-card: 0 10px 28px rgba(0, 0, 0, 0.12) !important;',
      '  --glass-shadow: 0 10px 28px rgba(0, 0, 0, 0.12) !important;',
      '}',

      'html[data-practise-design] body {',
      '  background: var(--p-bg) !important;',
      '  background-color: var(--p-bg) !important;',
      '  background-image: none !important;',
      '  background-attachment: scroll !important;',
      '  color: var(--p-font) !important;',
      '}',

      'html[data-practise-design] header,',
      'html[data-practise-design] .navbar,',
      'html[data-practise-design] .app-header {',
      '  background: var(--p-header-bg) !important;',
      '  border-bottom: 1px solid var(--p-border) !important;',
      '  color: var(--p-font) !important;',
      '  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06) !important;',
      '}',

      /* Hide redundant internal theme selectors when controlled by Admin Design inside Student Panel */
      'html.practise-embedded #theme-select,',
      'html.practise-embedded #theme-selector,',
      'html.practise-embedded #theme-toggle,',
      'html.practise-embedded #themeBtn,',
      'html.practise-embedded #themeToggleBtn,',
      'html.practise-embedded #theme-dropdown,',
      'html.practise-embedded #themeDropdown,',
      'html.practise-embedded #themeSelector,',
      'html.practise-embedded .theme-select-wrapper,',
      'html.practise-embedded .theme-selector-btn,',
      'html.practise-embedded .theme-btn,',
      'html.practise-embedded [onclick*="openThemeModal"] {',
      '  display: none !important;',
      '}',

      /* Tone down decorative neon blobs that clash with themed canvases */
      'html[data-practise-design="burnt-orange"] :is(.liquid-orb-1, .liquid-orb-2, .liquid-orb-3, .blob-1, .blob-2, .blob-3),',
      'html[data-practise-design="burnt-orange-dark"] :is(.liquid-orb-1, .liquid-orb-2, .liquid-orb-3, .blob-1, .blob-2, .blob-3),',
      'html[data-practise-design="original-light"] :is(.liquid-orb-1, .liquid-orb-2, .liquid-orb-3, .blob-1, .blob-2, .blob-3),',
      'html[data-practise-design="original-dark"] :is(.liquid-orb-1, .liquid-orb-2, .liquid-orb-3, .blob-1, .blob-2, .blob-3),',
      'html[data-practise-design^="hot-pink"] :is(.liquid-orb-1, .liquid-orb-2, .liquid-orb-3, .blob-1, .blob-2, .blob-3),',
      'html[data-practise-design^="electric-blue"] :is(.liquid-orb-1, .liquid-orb-2, .liquid-orb-3, .blob-1, .blob-2, .blob-3) {',
      '  opacity: 0.09 !important;',
      '}',

      /* Surface containers & cards */
      'html[data-practise-design] :is(.stage-card, .app-card, .welcome-card, .glass-card, .liquid-glass-card, .section-card, .module-card, .module-item, .boss-card, .boss-header, .boss-container, .final-boss-container, .summary-card, .score-card, .results-container, .question-card, .quiz-card, .passage-box, .reading-passage, .reading-text, .reading-text-box, .reading-text-card, .statement-card, .tfng-card, .speaking-card, .speaking-prompt-box, .speaking-item, .speaking-q, .vocab-card, .vocab-bank-item, .vocab-grid-item, .bank-item, .badge-card, .badge-item, .modal-box, .modal-card, .modal-content, .card-face, .flashcard-face, .flashcard-front, .flashcard-back, .hero-feature-item) {',
      '  background: var(--p-surface) !important;',
      '  background-image: none !important;',
      '  border-color: var(--p-border) !important;',
      '  color: var(--p-font) !important;',
      '}',

      /* Sub-surfaces, pills, badges, examples */
      'html[data-practise-design] :is(.stat-badge, .stat-box, .stat-chip, .stats-badge, .stat-card, .stage-pill, .progress-tracker, .progress-bar-bg, .progress-bar-container, .progress-bar-outer, .card-example, .card-example-box, .vocab-bank, .user-pill, .step-item, .level-pill, .level-badge, .explanation-box, .mcq-explanation, .tfng-explanation, .passage-highlight, .feedback-box:not(.correct):not(.incorrect)) {',
      '  background: var(--p-surface-alt) !important;',
      '  border-color: var(--p-border) !important;',
      '  color: var(--p-font) !important;',
      '}',

      /* Unselected tabs & interactive choice buttons */
      'html[data-practise-design] :is(.tab-btn, .module-tab):not(.active):not(.completed) {',
      '  background: var(--p-surface) !important;',
      '  border-color: var(--p-border) !important;',
      '  color: var(--p-muted) !important;',
      '}',

      'html[data-practise-design] :is(.option-btn, .option-item, .mcq-option, .match-card, .matching-card, .match-item, .tfng-btn):not(.correct):not(.correct-choice):not(.wrong):not(.wrong-choice):not(.incorrect):not(.matched):not(.selected):not(.selected-true):not(.selected-false):not(.selected-ng):not(.active-true):not(.active-false):not(.active-ng):not(.selected-correct):not(.selected-incorrect) {',
      '  background: var(--p-surface-alt) !important;',
      '  border-color: var(--p-border) !important;',
      '  color: var(--p-font) !important;',
      '}',

      'html[data-practise-design] :is(.option-btn, .option-item, .mcq-option, .match-card, .matching-card, .match-item, .tfng-btn).selected {',
      '  background: var(--p-accent-soft) !important;',
      '  border-color: var(--p-button) !important;',
      '  color: var(--p-font) !important;',
      '}',

      'html[data-practise-design] :is(.option-prefix, .option-indicator, .option-letter, .mcq-option-letter, .opt-letter) {',
      '  background: var(--p-surface) !important;',
      '  border-color: var(--p-border) !important;',
      '  color: var(--p-font) !important;',
      '}',

      /* Preserve clear green/red correctness states across light & dark designs */
      'html[data-practise-design] :is(.correct, .correct-choice, .selected-correct, .correct-opt, .feedback-box.correct, .match-card.matched, .matching-card.matched, .match-item.matched) {',
      '  background: rgba(16, 185, 129, 0.16) !important;',
      '  border-color: #10B981 !important;',
      '  color: var(--p-font) !important;',
      '}',
      'html[data-practise-design] :is(.wrong, .wrong-choice, .incorrect, .selected-incorrect, .incorrect-opt, .feedback-box.incorrect, .selected-false) {',
      '  background: rgba(239, 68, 68, 0.16) !important;',
      '  border-color: #EF4444 !important;',
      '  color: var(--p-font) !important;',
      '}',

      /* Primary Action Buttons */
      'html[data-practise-design] :is(.btn:not(.btn-secondary):not(.btn-outline), .btn-primary, .liquid-btn-submit, .tab-btn.active, .module-tab.active, .stage-pill.active, .step-item.active, .audio-btn, .btn-audio, .brand-badge) {',
      '  background: var(--p-button) !important;',
      '  background-image: none !important;',
      '  border-color: var(--p-button) !important;',
      '  color: var(--p-button-text) !important;',
      '  box-shadow: 0 4px 14px var(--p-accent-glow) !important;',
      '}',
      'html[data-practise-design] :is(.btn:not(.btn-secondary):not(.btn-outline), .btn-primary, .liquid-btn-submit, .tab-btn.active, .module-tab.active, .step-item.active) :is(span, svg) {',
      '  color: var(--p-button-text) !important;',
      '}',
      'html[data-practise-design] :is(.btn:not(.btn-secondary):not(.btn-outline), .btn-primary, .liquid-btn-submit, .audio-btn, .btn-audio):hover:not(:disabled) {',
      '  background: var(--p-button-hover) !important;',
      '  border-color: var(--p-button-hover) !important;',
      '}',

      /* Secondary & Icon Buttons */
      'html[data-practise-design] :is(.btn-secondary, .btn-icon, .icon-btn, .reset-btn, .reset-link, .btn-text-sm) {',
      '  background: var(--p-surface-alt) !important;',
      '  border-color: var(--p-border) !important;',
      '  color: var(--p-font) !important;',
      '}',
      'html[data-practise-design] .btn-outline {',
      '  background: transparent !important;',
      '  border-color: var(--p-button) !important;',
      '  color: var(--p-accent-ink, var(--p-button)) !important;',
      '}',

      /* Typography & Gradient Text Compatibility */
      'html[data-practise-design] :is(h1, h2, h3, .hero-title, .shimmer-hero-title, .boss-title, .module-title, .brand-title) {',
      '  background: none !important;',
      '  -webkit-background-clip: initial !important;',
      '  background-clip: initial !important;',
      '  -webkit-text-fill-color: var(--p-font) !important;',
      '  color: var(--p-font) !important;',
      '}',
      'html[data-practise-design] :is(.logo-icon, .nav-logo, .mod-icon) {',
      '  background: var(--p-button) !important;',
      '  color: var(--p-button-text) !important;',
      '}',
      'html[data-practise-design] :is(.hero-badge, .badge-pill, .liquid-glass-badge, .liquid-badge, .boss-badge-tag, .boss-badge, .speaking-tag) {',
      '  background: var(--p-accent-soft) !important;',
      '  color: var(--p-accent-ink, var(--p-button)) !important;',
      '  border-color: var(--p-border-strong) !important;',
      '}',
      'html[data-practise-design] :is(.stat-value, .stat-badge span.value, .stat-badge .gold, .stat-icon, .stat-card .val, .card-phrase, .card-term, .card-expression, .flashcard-term, .expression-title, .vocab-bank-term span, .nav-brand span) {',
      '  color: var(--p-accent-ink, var(--p-button)) !important;',
      '}',
      'html[data-practise-design] :is(.text-muted, .hero-subtitle, .subtitle, .hero p.desc, .card-hint, .flashcard-hint, .card-meta-label, .stage-subtitle, .score-card-lbl, .nav-subtitle, footer) {',
      '  color: var(--p-muted) !important;',
      '}',
      'html[data-practise-design] :is(.progress-bar-fill, .progress-bar-inner) {',
      '  background: var(--p-button) !important;',
      '}',
      'html[data-practise-design] :is(input:not([type="checkbox"]):not([type="radio"]), select, textarea) {',
      '  background: var(--p-surface-alt) !important;',
      '  border-color: var(--p-border) !important;',
      '  color: var(--p-font) !important;',
      '}',

      /* ============================================================== */
      /* Responsive Embedded & Fullscreen Layout Sizing (Fixes 1, 2, 4) */
      /* ============================================================== */
      'html.practise-embedded body {',
      '  min-height: 100% !important;',
      '  padding-bottom: 1rem !important;',
      '}',
      'html.practise-embedded :is(header, .navbar, .app-header) {',
      '  position: sticky !important;',
      '  top: 0 !important;',
      '  height: auto !important;',
      '  min-height: 46px !important;',
      '  padding: 0.45rem 1.15rem !important;',
      '}',
      'html.practise-embedded .header-container {',
      '  max-width: min(1220px, 96vw) !important;',
      '  padding: 0 !important;',
      '}',
      'html.practise-embedded :is(.container, .main-container, .app-container, main, main.container) {',
      '  max-width: min(1220px, 96vw) !important;',
      '  width: 100% !important;',
      '  margin: 0.25rem auto 0.5rem auto !important;',
      '  padding: 0.75rem 1.15rem 1.35rem 1.15rem !important;',
      '}',
      'html.practise-fullscreen :is(.container, .main-container, .app-container, .header-container, main, main.container) {',
      '  max-width: min(1280px, 96vw) !important;',
      '}',
      'html.practise-embedded .liquid-landing-container {',
      '  min-height: auto !important;',
      '  padding: 0.65rem 0 !important;',
      '}',
      'html.practise-embedded :is(.module-nav, .module-tabs, .tabs, .stage-nav) {',
      '  margin: 0 auto 0.85rem auto !important;',
      '  padding-bottom: 0.35rem !important;',
      '}',
      'html.practise-embedded :is(.module-header, .stage-header) {',
      '  margin-bottom: 0.75rem !important;',
      '}',
      'html.practise-embedded :is(.module-header h2, .stage-header h2) {',
      '  font-size: clamp(1.2rem, 2vw, 1.55rem) !important;',
      '  margin-bottom: 0.2rem !important;',
      '}',
      'html.practise-embedded .stage-card {',
      '  padding: 1rem 1.35rem !important;',
      '  margin-bottom: 0.35rem !important;',
      '}',
      'html.practise-embedded .hero {',
      '  padding: 0.2rem 0 !important;',
      '}',
      'html.practise-embedded .hero-badge {',
      '  margin-bottom: 0.5rem !important;',
      '}',
      'html.practise-embedded .hero :is(h1, .hero-title),',
      'html.practise-embedded .hero-title {',
      '  font-size: clamp(1.4rem, 2.5vw, 2.05rem) !important;',
      '  margin-bottom: 0.4rem !important;',
      '}',
      'html.practise-embedded .hero p.subtitle,',
      'html.practise-embedded .hero-subtitle {',
      '  font-size: 0.98rem !important;',
      '  margin-bottom: 0.5rem !important;',
      '}',
      'html.practise-embedded .hero p.desc {',
      '  font-size: 0.9rem !important;',
      '  margin: 0 auto 0.9rem auto !important;',
      '}',
      'html.practise-embedded .progress-tracker {',
      '  padding: 0.85rem 1rem !important;',
      '  margin-bottom: 0.95rem !important;',
      '}',
      'html.practise-embedded .progress-bar-bg {',
      '  margin-bottom: 0.75rem !important;',
      '}',
      'html.practise-embedded .hero-features-grid {',
      '  margin: 0.85rem 0 !important;',
      '  gap: 0.65rem !important;',
      '}',
      'html.practise-embedded :is(.flashcard-wrapper, .flashcard-container, .card-container, .card-flip-container) {',
      '  height: clamp(210px, 36vh, 290px) !important;',
      '  min-height: 210px !important;',
      '  max-width: 680px !important;',
      '  margin: 0.6rem auto !important;',
      '}',
      'html.practise-embedded :is(.flashcard, .flashcard-inner, .card-flip-inner) {',
      '  height: 100% !important;',
      '  min-height: 210px !important;',
      '}',
      'html.practise-embedded :is(.card-face, .flashcard-face) {',
      '  padding: 1.25rem 1.5rem !important;',
      '}',
      'html.practise-embedded :is(.card-back, .flashcard-back, .card-face-back) {',
      '  overflow-y: auto !important;',
      '  justify-content: flex-start !important;',
      '  gap: 0.5rem !important;',
      '}',
      'html.practise-embedded :is(.card-controls, .flashcard-controls, .flashcard-nav) {',
      '  max-width: 680px !important;',
      '  margin: 0.75rem auto 0 auto !important;',
      '}',
      'html.practise-embedded footer {',
      '  padding: 0.5rem 1rem !important;',
      '  margin-top: 0.25rem !important;',
      '}'
    ].join('\n');
  }

  function ensureStyleTag() {
    var existing = document.getElementById('practise-vocab-dynamic-style');
    if (existing) return existing;
    var styleEl = document.createElement('style');
    styleEl.id = 'practise-vocab-dynamic-style';
    styleEl.textContent = buildStylesheetText();
    (document.head || document.documentElement).appendChild(styleEl);
    return styleEl;
  }

  function applyDesign(design, darkMode) {
    ensureStyleTag();
    var key = resolvePaletteKey(design, darkMode);
    var p = PALETTES[key] || PALETTES['original-light'];
    var root = document.documentElement;
    root.setAttribute('data-practise-design', key);
    root.classList.toggle('dark', Boolean(p.isDark));
    root.classList.toggle('practise-dark', Boolean(p.isDark));
    root.style.setProperty('--p-scheme', p.isDark ? 'dark' : 'light');
    root.style.setProperty('--p-bg', p.bg);
    root.style.setProperty('--p-surface', p.surface);
    root.style.setProperty('--p-surface-alt', p.surfaceAlt);
    root.style.setProperty('--p-header-bg', p.headerBg);
    root.style.setProperty('--p-font', p.font);
    root.style.setProperty('--p-muted', p.muted);
    root.style.setProperty('--p-border', p.border);
    root.style.setProperty('--p-border-strong', p.borderStrong);
    root.style.setProperty('--p-button', p.button);
    root.style.setProperty('--p-button-hover', p.buttonHover);
    root.style.setProperty('--p-button-text', p.buttonText);
    root.style.setProperty('--p-accent-ink', p.accentInk || p.button);
    root.style.setProperty('--p-accent-soft', p.accentSoft);
    root.style.setProperty('--p-accent-glow', p.accentGlow);
  }

  function applyLayout(embedded, fullscreen) {
    ensureStyleTag();
    var root = document.documentElement;
    var inIframe = false;
    try { inIframe = window.self !== window.top; } catch (e) { inIframe = true; }
    if (embedded || inIframe) root.classList.add('practise-embedded');
    else root.classList.remove('practise-embedded');

    if (fullscreen) root.classList.add('practise-fullscreen');
    else root.classList.remove('practise-fullscreen');
  }

  // Initial synchronous execution before paint
  var params = getParams();
  var initDesign = params.get('design') || 'original';
  var initDark = params.get('dark') === '1';
  var initEmbedded = params.get('embedded') === '1';
  var initFullscreen = params.get('fullscreen') === '1';

  applyLayout(initEmbedded, initFullscreen);
  if (params.has('design') || initEmbedded) {
    applyDesign(initDesign, initDark);
  }

  // Live updates from parent Student Panel
  window.addEventListener('message', function (event) {
    try {
      if (event.origin && event.origin !== 'null' && event.origin !== window.location.origin) return;
      var msg = event.data;
      if (!msg || typeof msg !== 'object') return;
      if (msg.type === 'PRACTISE_THEME_SYNC') {
        applyDesign(msg.design || 'original', Boolean(msg.darkMode));
      } else if (msg.type === 'PRACTISE_LAYOUT_SYNC') {
        applyLayout(msg.embedded !== false, Boolean(msg.fullscreen));
      }
    } catch (e) {}
  });

  // Forward Escape key inside iframe to parent Student Panel
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && document.documentElement.classList.contains('practise-fullscreen')) {
      try {
        if (window.parent && window.parent !== window) {
          var targetOrigin = (window.location.origin && window.location.origin !== 'null') ? window.location.origin : '*';
          window.parent.postMessage({ type: 'PRACTISE_EXIT_FULLSCREEN' }, targetOrigin);
        }
      } catch (err) {}
    }
  });
})();
