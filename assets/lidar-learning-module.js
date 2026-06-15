(function () {
  const panelOrder = ['home', 'section-1', 'section-2', 'section-3', 'section-4', 'section-5', 'final'];
  const panelLabels = {
    home: 'Home',
    'section-1': 'Section 1',
    'section-2': 'Section 2',
    'section-3': 'Section 3',
    'section-4': 'Section 4',
    'section-5': 'Section 5',
    final: 'Final Task',
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

    function openPanel(panelName) {
      panels.forEach((panel) => {
        const isActive = panel.dataset.panel === panelName;
        panel.classList.toggle('is-active', isActive);
        panel.hidden = !isActive;
      });

      tabs.forEach((tab) => {
        const isActive = tab.dataset.panelTarget === panelName;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
      });

      const panelIndex = Math.max(0, panelOrder.indexOf(panelName));
      const progress = ((panelIndex + 1) / panelOrder.length) * 100;
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
      if (progressLabel) {
        progressLabel.textContent = panelLabels[panelName] || panelName;
      }

      module.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => openPanel(tab.dataset.panelTarget));
    });

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

    initQuiz(module);
    initTimeOfFlight(module);
    drawPointCloud(module.querySelector('[data-point-cloud-canvas]'));
    initHeroCanvas(module.querySelector('[data-lidar-hero-canvas]'));
  }

  function initQuiz(module) {
    module.querySelectorAll('[data-checkin]').forEach((quiz) => {
      const feedback = quiz.querySelector('[data-feedback]');
      const input = quiz.querySelector('[data-response-input]');
      const saveButton = quiz.querySelector('[data-save-response]');
      const storageKey = `lidar-learning-note-${quiz.dataset.checkin}`;

      if (input) {
        input.value = getStoredNote(storageKey);
      }

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
      return;
    }

    const context = canvas.getContext('2d');
    let frame = 0;
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
      if (!prefersReducedMotion()) {
        requestAnimationFrame(draw);
      }
    }

    draw();
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
