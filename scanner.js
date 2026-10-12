(() => {
  const storageKey = 'himalayanops-demo-scan-history-v1';
  const form = document.getElementById('scanForm');
  const targetInput = document.getElementById('target');
  const modeSelect = document.getElementById('scanMode');
  const startButton = document.getElementById('startScan');
  const targetError = document.getElementById('targetError');
  const status = document.getElementById('scanStatus');
  const dataError = document.getElementById('dataError');
  const progressTrack = document.getElementById('progressTrack');
  const progressBar = document.getElementById('progressBar');
  const tabs = Array.from(document.querySelectorAll('.scanner-tab'));
  const panels = {
    scan: document.getElementById('panel-scan'),
    results: document.getElementById('panel-results'),
    history: document.getElementById('panel-history')
  };
  const historyList = document.getElementById('historyList');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let sampleData = null;
  let currentReport = null;
  let history = readHistory();

  function readHistory() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(saved)) return [];
      return saved.filter((item) => item && ['quick', 'service', 'full'].includes(item.mode) && typeof item.timestamp === 'string')
        .slice(0, 8);
    } catch {
      return [];
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(history.slice(0, 8)));
      return true;
    } catch {
      return false;
    }
  }

  function setStatus(message, state = 'default') {
    status.textContent = message;
    status.dataset.state = state;
  }

  function setTab(name, focus = false) {
    tabs.forEach((tab) => {
      const selected = tab.dataset.tab === name;
      tab.classList.toggle('active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    });
    Object.entries(panels).forEach(([key, panel]) => {
      panel.hidden = key !== name;
    });
  }

  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setTab(tab.dataset.tab));
    tab.addEventListener('keydown', (event) => {
      let nextIndex = index;
      if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') nextIndex = 0;
      else if (event.key === 'End') nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      setTab(tabs[nextIndex].dataset.tab, true);
    });
  });

  function validTarget(value) {
    const candidate = value.trim();
    if (!candidate || candidate.length > 253 || /\s|[/\\:@?#]/.test(candidate)) return false;
    const octets = candidate.split('.');
    if (octets.length === 4 && octets.every((part) => /^\d{1,3}$/.test(part))) {
      return octets.every((part) => Number(part) <= 255);
    }
    if (candidate.length > 253) return false;
    return candidate.split('.').every((label) =>
      label.length > 0 && label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label)
    );
  }

  function getSummary(sample) {
    const hosts = sample.hosts || [];
    const records = hosts.flatMap((host) => (host.ports || []).map((port) => ({ host, port })));
    const openPorts = records.filter(({ port }) => port.state === 'open').length;
    const services = new Set(records.filter(({ port }) => port.state === 'open').map(({ port }) => port.service));
    return {
      hostsFound: hosts.length,
      openPorts,
      servicesDetected: services.size,
      durationSeconds: sample.durationSeconds,
      records
    };
  }

  function showReport(mode, sample) {
    const summary = getSummary(sample);
    currentReport = { mode, sample, summary };
    const names = { quick: 'Quick Scan', service: 'Service Detection', full: 'Full Scan' };
    document.getElementById('resultsTitle').textContent = `${names[mode]} sample`;
    document.getElementById('resultsSubtitle').textContent = 'Fictional sample dataset: demo.example.invalid. These records are not based on the target entered.';
    document.getElementById('hostsFound').textContent = summary.hostsFound;
    document.getElementById('openPorts').textContent = summary.openPorts;
    document.getElementById('servicesDetected').textContent = summary.servicesDetected;
    document.getElementById('scanDuration').textContent = `${summary.durationSeconds.toFixed(1)} s`;
    document.getElementById('resultCount').textContent = `${summary.records.length} sample port records`;

    const body = document.getElementById('resultsBody');
    body.replaceChildren();
    summary.records.forEach(({ host, port }) => {
      const row = document.createElement('tr');
      const values = [
        `${host.ip} / ${host.hostname}`,
        String(port.port),
        port.protocol,
        port.service,
        port.version,
        port.state
      ];
      values.forEach((value, columnIndex) => {
        const cell = document.createElement('td');
        if (columnIndex === 5) {
          const state = document.createElement('span');
          state.className = `state-label${value === 'filtered' ? ' filtered' : ''}`;
          state.textContent = value;
          cell.append(state);
        } else {
          cell.textContent = value;
        }
        row.append(cell);
      });
      body.append(row);
    });
    document.getElementById('exportJson').disabled = false;
    document.getElementById('exportTxt').disabled = false;
  }

  function renderHistory() {
    document.getElementById('historyCount').textContent = String(history.length);
    historyList.replaceChildren();
    if (history.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-history';
      empty.textContent = 'No demo sessions yet.';
      historyList.append(empty);
      return;
    }

    const names = { quick: 'Quick Scan', service: 'Service Detection', full: 'Full Scan' };
    history.forEach((entry) => {
      const row = document.createElement('article');
      row.className = 'history-item';
      const title = document.createElement('strong');
      title.textContent = `${names[entry.mode]} · simulated`;
      row.append(title);
      ['hostsFound', 'openPorts', 'servicesDetected'].forEach((key) => {
        const metric = document.createElement('span');
        const label = { hostsFound: 'hosts', openPorts: 'open ports', servicesDetected: 'services' }[key];
        metric.textContent = `${entry.summary?.[key] ?? 0} ${label}`;
        row.append(metric);
      });
      const time = document.createElement('time');
      time.dateTime = entry.timestamp;
      time.textContent = new Date(entry.timestamp).toLocaleString();
      row.append(time);
      historyList.append(row);
    });
  }

  function downloadFile(filename, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    if (!currentReport) return;
    const payload = {
      label: 'DEMO DATA - SIMULATED RESULTS - NO NETWORK SCAN PERFORMED',
      simulated: true,
      profile: currentReport.mode,
      source: 'data/demo-scans.json',
      summary: {
        hostsFound: currentReport.summary.hostsFound,
        openPorts: currentReport.summary.openPorts,
        servicesDetected: currentReport.summary.servicesDetected,
        durationSeconds: currentReport.summary.durationSeconds
      },
      results: currentReport.summary.records.map(({ host, port }) => ({
        ip: host.ip,
        hostname: host.hostname,
        ...port
      }))
    };
    downloadFile(`himalayanops-demo-data-${currentReport.mode}.json`, JSON.stringify(payload, null, 2), 'application/json');
  }

  function exportTxt() {
    if (!currentReport) return;
    const { mode, summary } = currentReport;
    const lines = [
      'HIMALAYANOPS NETWORK SCANNER - DEMO DATA',
      'DEMO MODE - SIMULATED RESULTS - NO NETWORK SCAN PERFORMED',
      `Profile: ${mode}`,
      'Sample dataset host: demo.example.invalid',
      `Hosts found: ${summary.hostsFound}`,
      `Open ports: ${summary.openPorts}`,
      `Services detected: ${summary.servicesDetected}`,
      `Sample duration: ${summary.durationSeconds.toFixed(1)} seconds`,
      '',
      'IP / Hostname | Port | Protocol | Service | Version | State'
    ];
    summary.records.forEach(({ host, port }) => {
      lines.push(`${host.ip} / ${host.hostname} | ${port.port} | ${port.protocol} | ${port.service} | ${port.version} | ${port.state}`);
    });
    downloadFile(`himalayanops-demo-data-${mode}.txt`, lines.join('\n'), 'text/plain;charset=utf-8');
  }

  document.getElementById('exportJson').addEventListener('click', exportJson);
  document.getElementById('exportTxt').addEventListener('click', exportTxt);
  document.getElementById('clearHistory').addEventListener('click', () => {
    history = [];
    saveHistory();
    renderHistory();
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    targetError.textContent = '';
    targetInput.removeAttribute('aria-invalid');
    if (!validTarget(targetInput.value)) {
      targetError.textContent = 'Enter a valid hostname or IPv4 address, for example demo.example.invalid.';
      targetInput.setAttribute('aria-invalid', 'true');
      setStatus('Please correct the target format. Nothing has been sent.', 'error');
      targetInput.focus();
      return;
    }
    if (!sampleData) {
      dataError.hidden = false;
      setStatus('The local sample fixture is unavailable. No scan was performed.', 'error');
      return;
    }

    const mode = modeSelect.value;
    const sample = sampleData.samples[mode];
    if (!sample) {
      setStatus('This demo profile has no sample data.', 'error');
      return;
    }

    startButton.disabled = true;
    progressTrack.hidden = false;
    progressTrack.classList.remove('is-running');
    progressBar.style.width = '0';
    setStatus('Preparing fictional sample report in this browser…', 'loading');
    requestAnimationFrame(() => progressTrack.classList.add('is-running'));
    await new Promise((resolve) => window.setTimeout(resolve, reducedMotion ? 80 : 950));

    showReport(mode, sample);
    const summary = getSummary(sample);
    history.unshift({
      mode,
      timestamp: new Date().toISOString(),
      summary: {
        hostsFound: summary.hostsFound,
        openPorts: summary.openPorts,
        servicesDetected: summary.servicesDetected
      }
    });
    history = history.slice(0, 8);
    const saved = saveHistory();
    renderHistory();
    progressTrack.classList.remove('is-running');
    progressTrack.hidden = true;
    startButton.disabled = false;
    setStatus(saved
      ? 'Sample report ready. It is fictional and unrelated to the entered target.'
      : 'Sample report ready. Browser storage is unavailable, so this session was not added to history.', 'complete');
    setTab('results');
  });

  renderHistory();
  fetch(new URL('./data/demo-scans.json', window.location.href))
    .then((response) => {
      if (!response.ok) throw new Error('Could not load local demo fixture');
      return response.json();
    })
    .then((data) => {
      if (data.simulated !== true || !data.samples) throw new Error('Invalid local demo fixture');
      sampleData = data;
      setStatus('Sample data is ready. Choose a profile to preview its report.');
    })
    .catch(() => {
      sampleData = null;
      dataError.hidden = false;
      startButton.disabled = true;
      setStatus('Could not load the local sample file. No scan was performed.', 'error');
    });
})();