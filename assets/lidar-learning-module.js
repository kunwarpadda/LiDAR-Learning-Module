(function () {
  const panelOrder = ['home', 'section-1', 'section-2', 'section-3', 'section-4', 'section-5', 'final'];

  // Sections that must be "attempted" before the next one unlocks, plus the
  // selectors that count as an attempt (any interaction is enough).
  const attemptSelectors = {
    'section-1': ['[data-choice]', '[data-response-input]'],
    'section-2': ['[data-choice]', '[data-tof-range]', '[data-response-input]'],
    'section-3': ['[data-run-point-experiment]', '[data-choice]', '[data-response-input]'],
    'section-4': ['[data-gps-error]', '[data-imu-error]', '[data-laser-error]', 'input[name="error-prediction"]', '[data-response-input]'],
    'section-5': ['[data-case-option]', '[data-response-input]'],
  };

  const suggestedNames = [
    'Curious Cartographer',
    'Laser Pioneer',
    'Point Cloud Pilot',
    'Terrain Scout',
    'Echo Surveyor',
    'Pulse Navigator',
    'Summit Mapper',
    'Beacon Ranger',
    'LiDAR Voyager',
    'Canopy Explorer',
  ];

  const NAME_KEY = 'lidar-learning-name';
  const PROGRESS_KEY = 'lidar-learning-progress';
  const CASE_KEY = 'lidar-learning-case';

  // ── Final Assessment submission (Google Forms) ───────────────────────────
  // Students type their answers in the module; clicking "Submit my answers"
  // opens a Google Form PRE-FILLED with what they typed. They review and press
  // Submit in the form, and the response lands in the Google Sheet you own.
  //
  // ONE-TIME SETUP:
  //  1. Build a Google Form with one "Paragraph" question per item below, plus
  //     a short-answer "Name" question. The wording can mirror the Final
  //     Assessment prompts.
  //  2. In the form's ⋮ menu choose "Get pre-filled link", type throwaway text
  //     into every field, and click "Get link".
  //  3. The link looks like:
  //       https://docs.google.com/forms/d/e/FORM_ID/viewform?usp=pp_url
  //         &entry.111111=foo&entry.222222=bar...
  //     Paste FORM_ID into `formId`, and copy each `entry.NNN` id into the
  //     matching slot below (match by the throwaway text you typed).
  //  4. Set `enabled: true`. Until then the Submit button shows a friendly
  //     "not set up yet" message and points students to Export / print.
  const GOOGLE_FORM = {
    enabled: true,
    formId: '1FAIpQLSdiWHpLyF7NO-OU7_z11NyHHgDdqujh2vgI6WH3Ak0eKa4DGA',
    // Map each module answer key → the Google Form entry id (e.g. 'entry.123').
    entries: {
      name: 'entry.1383868954',
      'final-1': 'entry.1919228247',
      'final-2': 'entry.266725739',
      'final-3': 'entry.890382185',
      'final-4': 'entry.239506645',
      'final-5': 'entry.1345535939',
      'final-6': 'entry.601707971',
    },
  };

  function initAll() {
    document.querySelectorAll('[data-lidar-module]:not([data-lidar-ready])').forEach(initModule);
  }

  function initModule(module) {
    module.dataset.lidarReady = 'true';
    const tabs = Array.from(module.querySelectorAll('[data-panel-target]'));
    const panels = Array.from(module.querySelectorAll('[data-panel]'));
    const progressBar = module.querySelector('[data-progress-bar]');
    const progressLabel = module.querySelector('[data-progress-label]');
    const toast = module.querySelector('[data-toast]');

    // ── Redraw-on-reveal ────────────────────────────────────────────────
    // Canvases drawn while their panel is hidden can come back blank when the
    // panel is finally shown (notably on iOS Safari / inside WordPress). We
    // re-run each panel's draw functions at the moment it becomes visible.
    const redrawHandlers = {};
    function registerRedraw(panelName, fn) {
      (redrawHandlers[panelName] = redrawHandlers[panelName] || []).push(fn);
    }
    function runRedraws(panelName) {
      (redrawHandlers[panelName] || []).forEach((fn) => {
        try {
          fn();
        } catch (error) {
          /* ignore draw errors */
        }
      });
    }

    // ── Progress / gating ───────────────────────────────────────────────
    const completed = loadCompleted();
    // Every panel except Home counts toward completion.
    const gatedPanels = panelOrder.slice(1);

    function highestCompletedIndex() {
      let highest = 0;
      completed.forEach((name) => {
        highest = Math.max(highest, panelOrder.indexOf(name));
      });
      return highest;
    }
    function maxUnlockedIndex() {
      return Math.min(panelOrder.length - 1, Math.max(1, highestCompletedIndex() + 1));
    }
    function isUnlocked(panelName) {
      return panelOrder.indexOf(panelName) <= maxUnlockedIndex();
    }
    function markComplete(panelName) {
      if (completed.has(panelName)) {
        return;
      }
      completed.add(panelName);
      saveCompleted(completed);
      updateLocks();
      refreshTabStates();
      updateProgress();
    }
    function updateLocks() {
      const max = maxUnlockedIndex();
      // Locked controls stay clickable on purpose: a click runs openPanel,
      // which shows the "attempt this section first" toast. (Disabling them
      // would swallow the click and leave a passive reader with no feedback.)
      const lock = (element, targetName) => {
        const locked = panelOrder.indexOf(targetName) > max;
        element.classList.toggle('is-locked', locked);
        element.setAttribute('aria-disabled', String(locked));
      };
      tabs.forEach((tab) => lock(tab, tab.dataset.panelTarget));
      module.querySelectorAll('[data-open-panel]').forEach((button) => lock(button, button.dataset.openPanel));
    }
    function refreshTabStates() {
      tabs.forEach((tab) => {
        tab.classList.toggle('is-complete', completed.has(tab.dataset.panelTarget));
      });
    }
    function updateProgress() {
      const done = gatedPanels.filter((name) => completed.has(name)).length;
      const pct = Math.round((done / gatedPanels.length) * 100);
      if (progressBar) {
        progressBar.style.width = `${pct}%`;
      }
      if (progressLabel) {
        progressLabel.textContent = done >= gatedPanels.length
          ? `All ${gatedPanels.length} sections complete`
          : `${done} of ${gatedPanels.length} sections complete`;
      }
    }
    function clearAllProgress() {
      try {
        const keys = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (key && key.indexOf('lidar-learning') === 0) {
            keys.push(key);
          }
        }
        keys.forEach((key) => window.localStorage.removeItem(key));
      } catch (error) {
        /* ignore storage errors */
      }
      completed.clear();
      module.querySelectorAll('[data-answer-key]').forEach((field) => {
        field.value = '';
      });
      const nameInput = module.querySelector('[data-name-input]');
      if (nameInput) {
        nameInput.value = '';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
      }
      module.querySelectorAll('[data-case-option].is-selected').forEach((button) => {
        button.classList.remove('is-selected');
      });
      updateLocks();
      refreshTabStates();
      updateProgress();
      openPanel('home', { force: true });
      showToast('Progress and saved answers cleared.');
    }

    let toastTimer = null;
    function showToast(message) {
      if (!toast) {
        return;
      }
      toast.textContent = message;
      toast.hidden = false;
      toast.classList.add('is-visible');
      clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        toast.classList.remove('is-visible');
        toast.hidden = true;
      }, 2600);
    }

    let heroAnim = null;

    function openPanel(panelName, options) {
      const opts = options || {};
      if (!opts.force && !isUnlocked(panelName)) {
        showToast('Locked — try the current section first (answer a question or write a note) to unlock the next one.');
        return false;
      }

      panels.forEach((panel) => {
        const isActive = panel.dataset.panel === panelName;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      });

      tabs.forEach((tab) => {
        const isActive = tab.dataset.panelTarget === panelName;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
        tab.tabIndex = isActive ? 0 : -1;
      });

      // The progress bar reflects how many sections are complete, not which
      // panel is open, so it never moves backward when you revisit Home.
      updateProgress();

      if (heroAnim) {
        if (panelName === 'home') {
          heroAnim.start();
        } else {
          heroAnim.stop();
        }
      }

      runRedraws(panelName);

      if (opts.scroll !== false) {
        module.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
      }
      return true;
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => openPanel(tab.dataset.panelTarget));
    });

    // Roving-tabindex keyboard support for the tablist (WAI-ARIA pattern):
    // arrow keys move focus between tabs; Enter/Space activate via the native
    // button click handler above.
    const tablist = module.querySelector('[role="tablist"]');
    if (tablist) {
      tablist.addEventListener('keydown', (event) => {
        const current = tabs.indexOf(document.activeElement);
        if (current === -1) {
          return;
        }
        let next = null;
        if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
          next = (current + 1) % tabs.length;
        } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
          next = (current - 1 + tabs.length) % tabs.length;
        } else if (event.key === 'Home') {
          next = 0;
        } else if (event.key === 'End') {
          next = tabs.length - 1;
        }
        if (next === null) {
          return;
        }
        event.preventDefault();
        tabs[next].focus();
      });
    }

    module.querySelectorAll('[data-open-panel]').forEach((button) => {
      button.addEventListener('click', () => openPanel(button.dataset.openPanel));
    });

    module.querySelectorAll('[data-scroll-target]').forEach((button) => {
      button.addEventListener('click', () => {
        const target = module.querySelector(`#${button.dataset.scrollTarget}`);
        if (target) {
          target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
        }
      });
    });

    // Mark a section complete after any genuine interaction within it.
    Object.keys(attemptSelectors).forEach((panelName) => {
      const panel = module.querySelector(`[data-panel="${panelName}"]`);
      if (!panel) {
        return;
      }
      attemptSelectors[panelName].forEach((selector) => {
        panel.querySelectorAll(selector).forEach((element) => {
          const eventName = element.tagName === 'BUTTON' ? 'click' : 'input';
          element.addEventListener(eventName, () => markComplete(panelName));
        });
      });
    });

    const identity = initIdentity(module);

    const finishButton = module.querySelector('[data-finish-module]');
    if (finishButton) {
      finishButton.addEventListener('click', () => {
        markComplete('final');
        showCelebration(module, identity.getName());
      });
    }

    const resetButton = module.querySelector('[data-reset-progress]');
    if (resetButton) {
      resetButton.addEventListener('click', () => {
        const ok = window.confirm('Reset your progress and clear saved answers on this device? This cannot be undone.');
        if (ok) {
          clearAllProgress();
        }
      });
    }

    const exportButton = module.querySelector('[data-export-answers]');
    if (exportButton) {
      exportButton.addEventListener('click', () => exportAnswers(module, identity.getName(), showToast));
    }

    const submitButton = module.querySelector('[data-submit-answers]');
    if (submitButton) {
      submitButton.addEventListener('click', () => submitAnswers(module, identity.getName(), showToast));
    }

    initResponses(module);
    initQuiz(module);
    initTimeOfFlight(module);
    initPointExperiment(module, registerRedraw);
    initErrorExperiment(module, registerRedraw);
    initCaseOptions(module);

    const pointCloudCanvas = module.querySelector('[data-point-cloud-canvas]');
    if (pointCloudCanvas) {
      drawPointCloud(pointCloudCanvas);
      registerRedraw('section-1', () => drawPointCloud(pointCloudCanvas));
    }

    heroAnim = initHeroCanvas(module.querySelector('[data-lidar-hero-canvas]'));

    updateLocks();
    refreshTabStates();
    openPanel('home', { force: true, scroll: false });
    initHeightReporter(module);
  }

  // When embedded in an iframe (e.g. WordPress), report the module's height to
  // the parent so it can size the iframe to fit — no inner scrollbar, so the
  // page shows a single scrollbar instead of two. Reports the module element's
  // own height (not the 100vh shell) so it can shrink for shorter panels.
  function initHeightReporter(module) {
    if (window.parent === window) {
      return; // not embedded — nothing to report to
    }
    let last = 0;
    let timer = 0;
    const send = () => {
      timer = 0;
      const height = Math.ceil(module.getBoundingClientRect().height);
      if (height && Math.abs(height - last) > 1) {
        last = height;
        window.parent.postMessage({ type: 'lidar-module-height', height }, '*');
      }
    };
    const schedule = () => {
      if (!timer) {
        timer = window.setTimeout(send, 50);
      }
    };
    send(); // immediate first report (don't wait on a frame/timer)
    window.addEventListener('load', schedule);
    window.addEventListener('resize', schedule);
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(schedule).observe(module);
    }
  }

  function initIdentity(module) {
    const input = module.querySelector('[data-name-input]');
    const suggestButton = module.querySelector('[data-suggest-name]');
    const greeting = module.querySelector('[data-name-greeting]');

    function getName() {
      return input ? input.value.trim() : '';
    }

    function updateGreeting() {
      if (!greeting) {
        return;
      }
      const name = getName();
      if (name) {
        greeting.textContent = `Hi, ${name} — your progress is saved on this device.`;
        greeting.hidden = false;
      } else {
        greeting.hidden = true;
      }
    }

    if (input) {
      input.value = getStoredNote(NAME_KEY);
      input.addEventListener('input', () => {
        saveStoredNote(NAME_KEY, getName());
        updateGreeting();
      });
    }

    if (suggestButton && input) {
      suggestButton.addEventListener('click', () => {
        const pick = suggestedNames[Math.floor(Math.random() * suggestedNames.length)];
        input.value = pick;
        saveStoredNote(NAME_KEY, pick);
        updateGreeting();
        input.focus();
      });
    }

    updateGreeting();
    return { getName };
  }

  function showCelebration(module, name) {
    const overlay = module.querySelector('[data-celebrate]');
    if (!overlay) {
      return;
    }

    const nameLabel = overlay.querySelector('[data-celebrate-name]');
    if (nameLabel) {
      nameLabel.textContent = name ? `Nice work, ${name}!` : 'Nice work!';
    }

    overlay.classList.add('is-visible');

    const canvas = overlay.querySelector('[data-confetti-canvas]');
    const closeButton = overlay.querySelector('[data-celebrate-close]');
    let stopConfetti = function () {};
    if (canvas && !prefersReducedMotion()) {
      stopConfetti = runConfetti(canvas);
    }

    function close() {
      overlay.classList.remove('is-visible');
      stopConfetti();
      document.removeEventListener('keydown', onKeyDown);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') {
        close();
      }
    }

    if (closeButton) {
      closeButton.addEventListener('click', close, { once: true });
      closeButton.focus();
    }
    overlay.addEventListener('click', (event) => {
      if (event.target === overlay) {
        close();
      }
    });
    document.addEventListener('keydown', onKeyDown);
  }

  function runConfetti(canvas) {
    const context = canvas.getContext('2d');
    const colors = ['#d95735', '#f6c66d', '#67d06d', '#8be0d3', '#ffd29a', '#17635b'];

    function resize() {
      canvas.width = canvas.clientWidth || window.innerWidth;
      canvas.height = canvas.clientHeight || window.innerHeight;
    }
    resize();

    const pieces = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      size: 4 + Math.random() * 7,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 1.6,
      vy: 2 + Math.random() * 3.6,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.22,
    }));

    let rafId = null;
    let running = true;

    function frame() {
      context.clearRect(0, 0, canvas.width, canvas.height);
      pieces.forEach((piece) => {
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.vy += 0.02;
        piece.rotation += piece.spin;
        if (piece.y > canvas.height + 24) {
          piece.y = -24;
          piece.x = Math.random() * canvas.width;
          piece.vy = 2 + Math.random() * 3.6;
        }
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.rotation);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 2, piece.size, piece.size * 0.6);
        context.restore();
      });
      if (running) {
        rafId = requestAnimationFrame(frame);
      }
    }
    rafId = requestAnimationFrame(frame);

    const onResize = () => resize();
    window.addEventListener('resize', onResize);

    return function stop() {
      running = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      window.removeEventListener('resize', onResize);
      context.clearRect(0, 0, canvas.width, canvas.height);
    };
  }

  function initQuiz(module) {
    module.querySelectorAll('[data-checkin]').forEach((quiz) => {
      const feedback = quiz.querySelector('[data-feedback]');
      const input = quiz.querySelector('[data-response-input]');
      const saveButton = quiz.querySelector('[data-save-response]');
      // Loading/auto-saving the textarea is handled by initResponses; the Save
      // button just writes immediately and confirms.
      const storageKey = input && input.dataset.answerKey
        ? `lidar-learning-note-${input.dataset.answerKey}`
        : `lidar-learning-note-${quiz.dataset.checkin}`;

      quiz.querySelectorAll('[data-choice]').forEach((button) => {
        button.addEventListener('click', () => {
          quiz.querySelectorAll('[data-choice]').forEach((choice) => {
            choice.classList.remove('is-correct', 'is-incorrect');
          });

          const isCorrect = button.dataset.choice === 'correct';
          button.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
          if (feedback) {
            feedback.textContent = isCorrect
              ? button.dataset.correctFeedback || 'Yes. LiDAR directly measures distance, which helps build depth and 3D structure.'
              : button.dataset.incorrectFeedback || 'Not quite. The key is what the sensor directly measures.';
          }
        });
      });

      if (saveButton && input) {
        saveButton.addEventListener('click', () => {
          saveStoredNote(storageKey, input.value);
          if (feedback) {
            feedback.textContent = 'Your note has been saved in this browser.';
          }
        });
      }
    });
  }

  // Load + auto-save every written response (including the Section 3 prediction,
  // the Section 5 case study, and the Final Task fields that previously had no
  // way to persist) so nothing is lost on refresh.
  function initResponses(module) {
    module.querySelectorAll('[data-answer-key]').forEach((field) => {
      const key = `lidar-learning-note-${field.dataset.answerKey}`;
      const stored = getStoredNote(key);
      if (stored) {
        field.value = stored;
      }
      field.addEventListener('input', () => saveStoredNote(key, field.value));
    });
  }

  // Build a Google Forms "pre-filled" URL from the learner's name + the Final
  // Assessment answers, so the form opens with everything already typed in.
  function buildPrefillUrl(scope, name) {
    const base = `https://docs.google.com/forms/d/e/${GOOGLE_FORM.formId}/viewform`;
    const params = new URLSearchParams({ usp: 'pp_url' });
    const nameEntry = GOOGLE_FORM.entries.name;
    if (nameEntry && name) {
      params.set(nameEntry, name);
    }
    scope.querySelectorAll('[data-answer-key]').forEach((field) => {
      const entryId = GOOGLE_FORM.entries[field.dataset.answerKey];
      const value = field.value.trim();
      if (entryId && value) {
        params.set(entryId, value);
      }
    });
    return `${base}?${params.toString()}`;
  }

  function submitAnswers(module, name, notify) {
    const finalPanel = module.querySelector('[data-panel="final"]');
    const fields = finalPanel
      ? Array.from(finalPanel.querySelectorAll('[data-answer-key]'))
      : [];
    const answered = fields.filter((field) => field.value.trim()).length;

    if (!GOOGLE_FORM.enabled || GOOGLE_FORM.formId === 'PASTE_FORM_ID_HERE') {
      notify('Submission isn’t set up yet — for now use “Export / print my answers” to hand in your work.');
      return;
    }
    if (answered === 0) {
      notify('Write at least one answer before submitting.');
      return;
    }
    if (answered < fields.length) {
      const ok = window.confirm(
        `You've answered ${answered} of ${fields.length} questions. Submit anyway? You can still finish the rest in the form before sending.`
      );
      if (!ok) {
        return;
      }
    }

    const url = buildPrefillUrl(finalPanel, name);
    const win = window.open(url, '_blank', 'noopener');
    if (win) {
      notify('Opened the submission form pre-filled with your answers — review and press Submit there.');
    } else {
      notify('Pop-up blocked — allow pop-ups, then click “Submit my answers” again.');
    }
  }

  function exportAnswers(module, name, notify) {
    const learner = (name || '').trim();
    const date = new Date().toLocaleDateString();

    const answers = Array.from(module.querySelectorAll('[data-answer-key]')).map((field) => ({
      label: field.dataset.answerLabel || field.dataset.answerKey,
      value: field.value.trim(),
    }));

    const checkins = Array.from(module.querySelectorAll('[data-checkin]')).map((quiz) => {
      const question = quiz.querySelector('p');
      const chosen = quiz.querySelector('[data-choice].is-correct, [data-choice].is-incorrect');
      if (!chosen) {
        return null;
      }
      return {
        question: question ? question.textContent.trim() : '',
        answer: chosen.textContent.trim(),
        correct: chosen.classList.contains('is-correct'),
      };
    }).filter(Boolean);

    const selectedCase = module.querySelector('[data-case-option].is-selected');
    const html = buildAnswerSheet({
      learner,
      date,
      answers,
      checkins,
      caseFocus: selectedCase ? selectedCase.dataset.caseOption : '',
    });

    const win = window.open('', '_blank');
    if (win && win.document) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      return;
    }
    // Pop-up blocked → download the same sheet as an HTML file instead.
    downloadHtml(html, 'lidar-module-answers.html');
    if (typeof notify === 'function') {
      notify('Pop-up blocked — your answer sheet was downloaded instead.');
    }
  }

  function buildAnswerSheet(data) {
    const esc = (value) => String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    const multiline = (value) => esc(value).replace(/\n/g, '<br>');

    const metaBits = [];
    if (data.learner) {
      metaBits.push(`Name: <strong>${esc(data.learner)}</strong>`);
    }
    metaBits.push(`Date: ${esc(data.date)}`);
    if (data.caseFocus) {
      metaBits.push(`Case study focus: ${esc(data.caseFocus)}`);
    }

    const checkinHtml = data.checkins.length
      ? `<h2>Check-in answers</h2>${data.checkins.map((item) => `
        <div class="qa">
          <p class="q">${esc(item.question)}</p>
          <p class="a">Selected: ${esc(item.answer)} <span class="tag ${item.correct ? 'ok' : 'redo'}">${item.correct ? 'correct' : 'reconsider'}</span></p>
        </div>`).join('')}`
      : '';

    const writtenHtml = data.answers.map((answer) => `
        <div class="qa">
          <p class="q">${esc(answer.label)}</p>
          <p class="a">${answer.value ? multiline(answer.value) : '<em>(not answered yet)</em>'}</p>
        </div>`).join('');

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>How LiDAR Measures the World — My Answers</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; line-height: 1.55; margin: 0; padding: 32px; max-width: 760px; }
  h1 { font-size: 1.5rem; margin: 0 0 4px; }
  h2 { font-size: 1.05rem; margin: 28px 0 8px; border-bottom: 2px solid #17635b; padding-bottom: 4px; color: #0c3f3a; }
  .meta { color: #444; font-size: 0.9rem; margin: 0 0 8px; }
  .qa { margin: 0 0 14px; }
  .q { font-weight: 600; margin: 0 0 2px; }
  .a { margin: 0; }
  .tag { font-size: 0.72rem; font-weight: 700; padding: 1px 7px; border-radius: 999px; }
  .tag.ok { background: #e6f4ec; color: #1e4d30; }
  .tag.redo { background: #fdeaea; color: #6b1f1f; }
  .toolbar { margin: 0 0 20px; }
  .toolbar button { font: inherit; cursor: pointer; border: 1px solid #17635b; background: #17635b; color: #fff; border-radius: 6px; padding: 8px 14px; }
  .foot { color: #777; font-size: 0.8rem; margin-top: 28px; }
  @media print { .toolbar { display: none; } body { padding: 0; } }
</style>
</head>
<body>
  <div class="toolbar"><button type="button" onclick="window.print()">Print / Save as PDF</button></div>
  <h1>How LiDAR Measures the World — My Answers</h1>
  <p class="meta">${metaBits.join(' · ')}</p>
  ${checkinHtml}
  <h2>Written responses</h2>
  ${writtenHtml}
  <p class="foot">Generated from the interactive LiDAR learning module.</p>
</body>
</html>`;
  }

  function downloadHtml(html, filename) {
    try {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      /* ignore download errors */
    }
  }

  function initTimeOfFlight(module) {
    module.querySelectorAll('[data-tof-calculator]').forEach((calculator) => {
      const range = calculator.querySelector('[data-tof-range]');
      const timeLabel = calculator.querySelector('[data-tof-time-label]');
      const totalDistance = calculator.querySelector('[data-tof-total-distance]');
      const distance = calculator.querySelector('[data-tof-distance]');
      const pulse = calculator.querySelector('[data-tof-pulse]');

      function syncFrom(value) {
        const clamped = clamp(Number(value) || 600, 100, 1600);
        const totalMeters = clamped * 0.3;
        const oneWayMeters = totalMeters / 2;

        if (range) range.value = String(clamped);
        if (timeLabel) timeLabel.textContent = `${clamped} ns`;
        if (totalDistance) totalDistance.textContent = `${formatMeters(totalMeters)} m`;
        if (distance) distance.textContent = `${formatMeters(oneWayMeters)} m`;
        if (pulse) pulse.style.setProperty('--tof-duration', `${Math.max(0.8, clamped / 500).toFixed(2)}s`);
      }

      if (range) range.addEventListener('input', () => syncFrom(range.value));
      syncFrom(range ? range.value : 600);
    });
  }

  function initPointExperiment(module, registerRedraw) {
    module.querySelectorAll('[data-point-experiment]').forEach((experiment) => {
      const density = experiment.querySelector('[data-density-control]');
      const error = experiment.querySelector('[data-error-control]');
      const angle = experiment.querySelector('[data-angle-control]');
      const densityLabel = experiment.querySelector('[data-density-label]');
      const errorLabel = experiment.querySelector('[data-error-label]');
      const angleLabel = experiment.querySelector('[data-angle-label]');
      const qualityLabel = experiment.querySelector('[data-quality-label]');
      const description = experiment.querySelector('[data-cloud-description]');
      const canvas = experiment.querySelector('[data-mini-cloud-canvas]');
      const runButton = experiment.querySelector('[data-run-point-experiment]');
      const controls = [density, error, angle].filter(Boolean);

      function updateLabels() {
        const densityText = ['Low', 'Medium', 'High'][Number(density ? density.value : 2) - 1] || 'Medium';
        const errorText = ['Low', 'Medium', 'High'][Number(error ? error.value : 0)] || 'Low';
        const angleText = { '-1': 'Left side', 0: 'Front', 1: 'Right side' }[angle ? angle.value : '0'] || 'Front';
        if (densityLabel) densityLabel.textContent = densityText;
        if (errorLabel) errorLabel.textContent = errorText;
        if (angleLabel) angleLabel.textContent = angleText;
      }

      function render() {
        updateLabels();
        const settings = {
          density: Number(density ? density.value : 2),
          error: Number(error ? error.value : 0),
          angle: Number(angle ? angle.value : 0),
        };
        drawMiniPointCloud(canvas, settings);
        const summary = describePointCloud(settings);
        if (qualityLabel) qualityLabel.textContent = summary.quality;
        if (description) description.textContent = summary.description;
        // Keep the canvas's accessible name in sync with the generated result.
        if (canvas) canvas.setAttribute('aria-label', `Generated point cloud — ${summary.description}`);
      }

      updateLabels();
      drawExperimentPlaceholder(canvas, 'Predict, then generate the point cloud');

      if (runButton) {
        runButton.addEventListener('click', () => {
          experiment.dataset.hasRun = 'true';
          render();
          if (canvas && window.matchMedia('(max-width: 920px)').matches) {
            canvas.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
          }
        });
      }

      controls.forEach((control) => {
        control.addEventListener('input', () => {
          updateLabels();
          if (experiment.dataset.hasRun === 'true') {
            render();
          }
        });
      });

      if (registerRedraw) {
        registerRedraw('section-3', () => {
          if (experiment.dataset.hasRun === 'true') {
            render();
          } else {
            drawExperimentPlaceholder(canvas, 'Predict, then generate the point cloud');
          }
        });
      }
    });
  }

  function initErrorExperiment(module, registerRedraw) {
    module.querySelectorAll('[data-error-experiment]').forEach((experiment) => {
      const gps = experiment.querySelector('[data-gps-error]');
      const imu = experiment.querySelector('[data-imu-error]');
      const laser = experiment.querySelector('[data-laser-error]');
      const gpsLabel = experiment.querySelector('[data-gps-label]');
      const imuLabel = experiment.querySelector('[data-imu-label]');
      const laserLabel = experiment.querySelector('[data-laser-label]');
      const totalError = experiment.querySelector('[data-total-error]');
      const imuShift = experiment.querySelector('[data-imu-shift]');
      const largestError = experiment.querySelector('[data-largest-error]');
      const description = experiment.querySelector('[data-error-description]');
      const canvas = experiment.querySelector('[data-error-canvas]');

      function render() {
        const gpsValue = Number(gps ? gps.value : 0.5);
        const imuValue = Number(imu ? imu.value : 0.25);
        const laserValue = Number(laser ? laser.value : 0.1);
        const imuShiftValue = Math.tan((imuValue * Math.PI) / 180) * 80;
        const total = Math.sqrt((gpsValue ** 2) + (imuShiftValue ** 2) + (laserValue ** 2));
        const contributors = [
          ['GPS/GNSS', gpsValue],
          ['IMU angle', imuShiftValue],
          ['Laser timing', laserValue],
        ].sort((a, b) => b[1] - a[1]);

        if (gpsLabel) gpsLabel.textContent = `${formatMeters(gpsValue)} m`;
        if (imuLabel) imuLabel.textContent = `${formatMeters(imuValue)} degrees`;
        if (laserLabel) laserLabel.textContent = `${formatMeters(laserValue)} m`;
        if (totalError) totalError.textContent = `${formatMeters(total)} m`;
        if (imuShift) imuShift.textContent = `${formatMeters(imuShiftValue)} m`;
        if (largestError) largestError.textContent = `${contributors[0][0]} contributes most`;
        const summaryText = `The measured point is shifted about ${formatMeters(total)} m from the target. ${contributors[0][0]} is the largest contributor in this setup.`;
        if (description) {
          description.textContent = summaryText;
        }
        // Keep the canvas's accessible name in sync with the current shift.
        if (canvas) canvas.setAttribute('aria-label', `Error propagation display — ${summaryText}`);
        drawErrorPropagation(canvas, { gpsValue, imuShiftValue, laserValue, total });
      }

      [gps, imu, laser].filter(Boolean).forEach((control) => control.addEventListener('input', render));
      render();

      if (registerRedraw) {
        registerRedraw('section-4', render);
      }
    });
  }

  function initCaseOptions(module) {
    const descriptions = {
      'Flood mapping': 'Decision prompt: Which areas are shown as flood-prone, and how could elevation or position error change that boundary?',
      Forestry: 'Decision prompt: How many trees or how much canopy height is estimated, and how could poor point density affect the result?',
      'Urban planning': 'Decision prompt: Where can new roads or buildings fit, and how could inaccurate surface models affect design choices?',
      'Infrastructure inspection': 'Decision prompt: Which bridge, road, or powerline features need maintenance, and how could missed points hide a problem?',
    };

    function select(button, persist) {
      const container = button.closest('.lidar-card');
      const description = container ? container.querySelector('[data-case-description]') : null;
      if (description) {
        description.textContent = descriptions[button.dataset.caseOption] || 'Explain how accurate 3D data supports this decision.';
      }
      if (container) {
        container.querySelectorAll('[data-case-option]').forEach((option) => option.classList.toggle('is-selected', option === button));
      }
      if (persist) {
        saveStoredNote(CASE_KEY, button.dataset.caseOption);
      }
    }

    module.querySelectorAll('[data-case-option]').forEach((button) => {
      button.addEventListener('click', () => select(button, true));
    });

    // Restore a previously chosen case so the selection + prompt survive refresh.
    const storedCase = getStoredNote(CASE_KEY);
    if (storedCase) {
      const match = module.querySelector(`[data-case-option="${storedCase}"]`);
      if (match) {
        select(match, false);
      }
    }
  }

  function drawExperimentPlaceholder(canvas, message) {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f6f6f6';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#e4e4e4';
    context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
    context.fillStyle = '#595959';
    context.font = '600 20px system-ui, sans-serif';
    context.textAlign = 'center';
    context.fillText(message, canvas.width / 2, canvas.height / 2);
    context.textAlign = 'start';
  }

  function drawMiniPointCloud(canvas, settings) {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const pointCounts = { 1: 70, 2: 150, 3: 280 };
    const errorAmounts = { 0: 2, 1: 8, 2: 18 };
    const count = pointCounts[settings.density] || 150;
    const noise = errorAmounts[settings.error] || 2;
    const angleShift = settings.angle * 52;

    context.clearRect(0, 0, width, height);
    context.fillStyle = '#071f24';
    context.fillRect(0, 0, width, height);

    context.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    context.lineWidth = 1;
    for (let x = 44; x < width; x += 48) {
      context.beginPath();
      context.moveTo(x, height - 34);
      context.lineTo(x + 130, 70);
      context.stroke();
    }

    const objectPoints = buildObjectPoints(count);
    objectPoints.forEach((point, index) => {
      const pseudo = Math.sin(index * 12.9898) * 43758.5453;
      const offset = (pseudo - Math.floor(pseudo) - 0.5) * noise;
      const sideCompression = settings.angle === 0 ? 1 : 0.72;
      const x = width * 0.5 + (point.x * sideCompression) + angleShift + offset;
      const y = height * 0.56 + point.y + (Math.cos(index * 3.1) * noise * 0.45);
      const color = point.group === 'edge' ? '#ffd29a' : '#8be0d3';
      drawPoint(context, x, y, color, settings.density === 1 ? 2.3 : 2);
    });

    context.fillStyle = '#ffffff';
    context.font = '700 13px system-ui, sans-serif';
    context.fillText('mini point cloud', 24, 32);
  }

  function buildObjectPoints(count) {
    const points = [];
    const width = 190;
    const height = 130;
    for (let i = 0; i < count; i += 1) {
      const ratio = i / Math.max(1, count - 1);
      let x;
      let y;
      let group = 'surface';
      if (i % 4 === 0) {
        x = -width / 2 + ratio * width;
        y = -height / 2;
        group = 'edge';
      } else if (i % 4 === 1) {
        x = -width / 2 + ratio * width;
        y = height / 2;
        group = 'edge';
      } else if (i % 4 === 2) {
        x = -width / 2;
        y = -height / 2 + ratio * height;
        group = 'edge';
      } else {
        x = -width / 2 + (Math.sin(i * 4.17) * 0.5 + 0.5) * width;
        y = -height / 2 + (Math.cos(i * 2.91) * 0.5 + 0.5) * height;
      }
      points.push({ x, y, group });
    }
    return points;
  }

  function describePointCloud(settings) {
    const densityText = { 1: 'low density', 2: 'medium density', 3: 'high density' }[settings.density] || 'medium density';
    const errorText = { 0: 'low measurement error', 1: 'medium measurement error', 2: 'high measurement error' }[settings.error] || 'low measurement error';
    const angleText = { '-1': 'left-side view', 0: 'front view', 1: 'right-side view' }[settings.angle] || 'front view';
    const qualityScore = settings.density - settings.error - Math.abs(settings.angle) * 0.35;
    let quality = 'Hard to interpret';
    if (qualityScore >= 2.4) quality = 'Clear shape';
    else if (qualityScore >= 1.1) quality = 'Partly clear';

    return {
      quality,
      description: `The cloud uses ${densityText}, ${errorText}, and a ${angleText}. ${quality === 'Clear shape' ? 'Edges and surfaces are easy to recognize.' : quality === 'Partly clear' ? 'The object is recognizable, but some edges are less certain.' : 'The object shape is difficult to trust without more points or less error.'}`,
    };
  }

  function drawErrorPropagation(canvas, settings) {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width * 0.48;
    const centerY = height * 0.52;
    const shiftScale = 48;
    const shiftX = (settings.gpsValue + settings.laserValue * 0.8) * shiftScale;
    const shiftY = settings.imuShiftValue * shiftScale;
    const radius = Math.max(18, Math.min(150, settings.total * shiftScale));

    context.clearRect(0, 0, width, height);
    context.fillStyle = '#f6f6f6';
    context.fillRect(0, 0, width, height);

    context.strokeStyle = '#d0d0d0';
    context.lineWidth = 1;
    for (let x = 40; x < width; x += 40) {
      context.beginPath();
      context.moveTo(x, 32);
      context.lineTo(x, height - 32);
      context.stroke();
    }
    for (let y = 40; y < height; y += 40) {
      context.beginPath();
      context.moveTo(32, y);
      context.lineTo(width - 32, y);
      context.stroke();
    }

    context.fillStyle = 'rgba(23, 99, 91, 0.12)';
    context.strokeStyle = '#17635b';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(centerX + shiftX, centerY + shiftY, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.fillStyle = '#111111';
    context.beginPath();
    context.arc(centerX, centerY, 7, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = '#d85c5c';
    context.beginPath();
    context.arc(centerX + shiftX, centerY + shiftY, 7, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = '#d85c5c';
    context.setLineDash([8, 6]);
    context.beginPath();
    context.moveTo(centerX, centerY);
    context.lineTo(centerX + shiftX, centerY + shiftY);
    context.stroke();
    context.setLineDash([]);

    context.fillStyle = '#111111';
    context.font = '700 13px system-ui, sans-serif';
    context.fillText('target point', centerX + 12, centerY - 12);
    context.fillText('measured point', centerX + shiftX + 12, centerY + shiftY + 18);
  }

  function drawPointCloud(canvas) {
    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    context.clearRect(0, 0, width, height);
    context.fillStyle = '#071f24';
    context.fillRect(0, 0, width, height);

    drawGrid(context, width, height);
    drawTerrainPoints(context, width, height);
    drawBuildingPoints(context, width, height);
    drawTreePoints(context, width, height);
    drawAxes(context, width, height);
  }

  function drawGrid(context, width, height) {
    context.strokeStyle = 'rgba(151, 205, 199, 0.18)';
    context.lineWidth = 1;
    for (let x = 40; x < width; x += 48) {
      context.beginPath();
      context.moveTo(x, height - 32);
      context.lineTo(x + 150, 70);
      context.stroke();
    }
    for (let y = height - 40; y > 70; y -= 42) {
      context.beginPath();
      context.moveTo(22, y);
      context.lineTo(width - 36, y - 26);
      context.stroke();
    }
  }

  function drawTerrainPoints(context, width, height) {
    for (let i = 0; i < 260; i += 1) {
      const ratio = i / 260;
      const x = 34 + ratio * (width - 80);
      const wave = Math.sin(ratio * Math.PI * 4.5) * 18;
      const y = height - 80 - ratio * 42 + wave;
      drawPoint(context, x + jitter(8), y + jitter(7), '#7ad9bd', 2.2);
    }
  }

  function drawBuildingPoints(context, width, height) {
    const left = width * 0.42;
    const base = height * 0.68;
    for (let row = 0; row < 11; row += 1) {
      for (let col = 0; col < 8; col += 1) {
        drawPoint(context, left + col * 12 + jitter(2), base - row * 15 + jitter(2), '#f6c66d', 2.4);
      }
    }
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        drawPoint(context, left + 96 + col * 11 + jitter(2), base - row * 15 + jitter(2), '#d95735', 2.2);
      }
    }
  }

  function drawTreePoints(context, width, height) {
    const trunks = [
      [width * 0.24, height * 0.68],
      [width * 0.72, height * 0.61],
    ];

    trunks.forEach(([cx, cy], index) => {
      for (let i = 0; i < 44; i += 1) {
        drawPoint(context, cx + jitter(6), cy + i * 2.2 + jitter(2), '#b47a45', 2);
      }
      for (let i = 0; i < 150; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const radius = Math.sqrt(Math.random()) * (index === 0 ? 48 : 40);
        const x = cx + Math.cos(angle) * radius;
        const y = cy - 48 + Math.sin(angle) * radius * 0.78;
        drawPoint(context, x, y, index === 0 ? '#67d06d' : '#8dd36a', 2.1);
      }
    });
  }

  function drawAxes(context, width, height) {
    context.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    context.fillStyle = '#ffffff';
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(40, height - 34);
    context.lineTo(116, height - 34);
    context.moveTo(40, height - 34);
    context.lineTo(40, height - 112);
    context.moveTo(40, height - 34);
    context.lineTo(86, height - 76);
    context.stroke();
    context.font = '700 13px system-ui, sans-serif';
    context.fillText('x', 122, height - 30);
    context.fillText('y', 30, height - 118);
    context.fillText('z', 91, height - 80);
  }

  function initHeroCanvas(canvas) {
    if (!canvas) {
      return null;
    }

    const context = canvas.getContext('2d');
    let frame = 0;
    let rafId = null;
    let running = false;
    const terrainPoints = Array.from({ length: 220 }, (_, index) => {
      const x = 24 + Math.random() * (canvas.width - 48);
      const y = canvas.height * 0.58 + Math.random() * (canvas.height * 0.34);
      return { x, y, color: index % 3 === 0 ? '#ffd29a' : '#8be0d3' };
    });

    function draw() {
      const width = canvas.width;
      const height = canvas.height;
      context.clearRect(0, 0, width, height);
      context.fillStyle = 'rgba(5, 30, 34, 0.36)';
      context.fillRect(0, 0, width, height);

      drawHeroTerrain(context, width, height, terrainPoints);
      drawScanner(context, width, height);
      drawPulseFan(context, width, height, frame);

      frame += 1;
      if (running) {
        rafId = requestAnimationFrame(draw);
      }
    }

    function start() {
      if (running) {
        return;
      }
      if (prefersReducedMotion()) {
        draw();
        return;
      }
      running = true;
      draw();
    }

    function stop() {
      running = false;
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    }

    return { start, stop };
  }

  function drawHeroTerrain(context, width, height, terrainPoints) {
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    context.lineWidth = 1;
    for (let y = height * 0.54; y < height; y += 34) {
      context.beginPath();
      context.moveTo(22, y);
      for (let x = 22; x < width - 22; x += 28) {
        context.lineTo(x, y + Math.sin((x + y) / 55) * 15);
      }
      context.stroke();
    }

    terrainPoints.forEach((point) => drawPoint(context, point.x, point.y, point.color, 1.8));
  }

  function drawScanner(context, width) {
    const x = width * 0.5;
    const y = 94;
    context.fillStyle = '#f7f7ef';
    context.beginPath();
    roundedRect(context, x - 70, y - 18, 140, 36, 12);
    context.fill();

    context.fillStyle = '#d95735';
    context.beginPath();
    context.arc(x, y + 20, 12, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = 'rgba(255, 255, 255, 0.78)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(x - 110, y);
    context.lineTo(x + 110, y);
    context.stroke();
  }

  function drawPulseFan(context, width, height, frame) {
    const originX = width * 0.5;
    const originY = 118;
    const pulse = (frame % 90) / 90;
    const angles = [-0.44, -0.27, -0.1, 0.08, 0.25, 0.42];
    angles.forEach((angle, index) => {
      const length = height * (0.56 + index * 0.035);
      const endX = originX + Math.sin(angle) * length;
      const endY = originY + Math.cos(angle) * length;
      context.strokeStyle = `rgba(255, 210, 154, ${0.25 + pulse * 0.55})`;
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(originX, originY);
      context.lineTo(endX, endY);
      context.stroke();

      const dotX = originX + (endX - originX) * pulse;
      const dotY = originY + (endY - originY) * pulse;
      drawPoint(context, dotX, dotY, '#ffffff', 3.8);
    });
  }

  function drawPoint(context, x, y, color, radius) {
    context.fillStyle = color;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  function jitter(amount) {
    return (Math.random() - 0.5) * amount;
  }

  function roundedRect(context, x, y, width, height, radius) {
    if (typeof context.roundRect === 'function') {
      context.roundRect(x, y, width, height, radius);
      return;
    }

    const safeRadius = Math.min(radius, width / 2, height / 2);
    context.moveTo(x + safeRadius, y);
    context.lineTo(x + width - safeRadius, y);
    context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
    context.lineTo(x + width, y + height - safeRadius);
    context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
    context.lineTo(x + safeRadius, y + height);
    context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
    context.lineTo(x, y + safeRadius);
    context.quadraticCurveTo(x, y, x + safeRadius, y);
  }

  function getStoredNote(key) {
    try {
      return window.localStorage.getItem(key) || '';
    } catch (error) {
      return '';
    }
  }

  function saveStoredNote(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      return false;
    }
    return true;
  }

  function loadCompleted() {
    try {
      const raw = window.localStorage.getItem(PROGRESS_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return new Set(Array.isArray(parsed) ? parsed : []);
    } catch (error) {
      return new Set();
    }
  }

  function saveCompleted(set) {
    try {
      window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(Array.from(set)));
    } catch (error) {
      return false;
    }
    return true;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function formatMeters(value) {
    if (Number.isInteger(value)) {
      return String(value);
    }
    return value.toFixed(1);
  }

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  window.LidarLearningModule = { initAll };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
