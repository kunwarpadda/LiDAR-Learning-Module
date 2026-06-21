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
    initPointExperiment(module);
    initErrorExperiment(module);
    initCaseOptions(module);
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

  function initPointExperiment(module) {
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
      }

      updateLabels();
      drawExperimentPlaceholder(canvas, 'Predict, then generate the point cloud');

      if (runButton) {
        runButton.addEventListener('click', () => {
          experiment.dataset.hasRun = 'true';
          render();
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
    });
  }

  function initErrorExperiment(module) {
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
        if (description) {
          description.textContent = `The measured point is shifted about ${formatMeters(total)} m from the target. ${contributors[0][0]} is the largest contributor in this setup.`;
        }
        drawErrorPropagation(canvas, { gpsValue, imuShiftValue, laserValue, total });
      }

      [gps, imu, laser].filter(Boolean).forEach((control) => control.addEventListener('input', render));
      render();
    });
  }

  function initCaseOptions(module) {
    const descriptions = {
      'Flood mapping': 'Decision prompt: Which areas are shown as flood-prone, and how could elevation or position error change that boundary?',
      Forestry: 'Decision prompt: How many trees or how much canopy height is estimated, and how could poor point density affect the result?',
      'Urban planning': 'Decision prompt: Where can new roads or buildings fit, and how could inaccurate surface models affect design choices?',
      'Infrastructure inspection': 'Decision prompt: Which bridge, road, or powerline features need maintenance, and how could missed points hide a problem?',
    };

    module.querySelectorAll('[data-case-option]').forEach((button) => {
      button.addEventListener('click', () => {
        const container = button.closest('.lidar-card');
        const description = container ? container.querySelector('[data-case-description]') : null;
        if (description) {
          description.textContent = descriptions[button.dataset.caseOption] || 'Explain how accurate 3D data supports this decision.';
        }
        if (container) {
          container.querySelectorAll('[data-case-option]').forEach((option) => option.classList.toggle('is-selected', option === button));
        }
      });
    });
  }

  function drawExperimentPlaceholder(canvas, message) {
    if (!canvas) return;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#f6f6f6';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#e4e4e4';
    context.strokeRect(18, 18, canvas.width - 36, canvas.height - 36);
    context.fillStyle = '#6b6b6b';
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
