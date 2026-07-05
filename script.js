document.addEventListener('DOMContentLoaded', () => {
  const apiUrl = 'https://fedskills-api.coalitiontechnologies.com/patients';
  const refreshButton = document.getElementById('refresh-data');
  const statusPill = document.getElementById('status-pill');
  const chartCanvas = document.getElementById('blood-pressure-chart');
  const chartContext = chartCanvas?.getContext('2d');
  let chartInstance = null;

  const fallbackPatient = {
    name: 'Jessica Taylor',
    age: 34,
    gender: 'Female',
    phone: '(555) 014-2211',
    insurance: 'BlueCross PPO',
    condition: 'Hypertension monitoring',
    diagnosis: 'Essential hypertension',
    medication: 'Lisinopril 10mg daily',
    priority: 'Routine follow-up',
    heart_rate: 78,
    respiratory_rate: 16,
    temperature: '98.4°F',
    blood_pressure: '118/76',
    blood_pressure_history: [
      { label: 'Jan', value: '118/76' },
      { label: 'Feb', value: '122/80' },
      { label: 'Mar', value: '124/82' },
      { label: 'Apr', value: '120/78' },
      { label: 'May', value: '118/76' }
    ],
    diagnosis_history: ['Essential hypertension', 'Seasonal allergies', 'Mild migraine'],
    diagnostic_list: ['Elevated blood pressure trend', 'No acute distress', 'Medication adherence stable'],
    lab_results: [
      { test: 'Hemoglobin', value: '13.8 g/dL', range: '12.0-16.0' },
      { test: 'Glucose', value: '94 mg/dL', range: '70-100' },
      { test: 'Cholesterol', value: '186 mg/dL', range: '<200' }
    ]
  };

  function updateStatus(message, type = 'default') {
    if (!statusPill) return;
    statusPill.textContent = message;
    statusPill.className = 'status-pill';
    if (type === 'success') {
      statusPill.style.background = '#dcfce7';
      statusPill.style.color = '#166534';
    } else if (type === 'fallback') {
      statusPill.style.background = '#fef3c7';
      statusPill.style.color = '#92400e';
    }
  }

  function normalizeName(value) {
    return String(value || '').toLowerCase().trim();
  }

  function getNestedValue(object, keys) {
    return keys.reduce((current, key) => (current && current[key] !== undefined ? current[key] : undefined), object);
  }

  function getArrayValue(object, keys) {
    for (const key of keys) {
      const value = getNestedValue(object, [key]);
      if (Array.isArray(value)) {
        return value;
      }
    }
    return [];
  }

  function extractHistory(patient) {
    const candidates = [
      patient?.blood_pressure_history,
      patient?.bloodPressureHistory,
      patient?.history?.blood_pressure,
      patient?.vitals?.blood_pressure
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate
          .map((entry, index) => {
            if (typeof entry === 'string') {
              return { label: `Point ${index + 1}`, value: entry };
            }
            if (entry && typeof entry === 'object') {
              const value = entry.value || entry.reading || entry.bp || entry.blood_pressure || entry.systolic;
              return {
                label: entry.label || entry.date || entry.day || entry.timestamp || `Point ${index + 1}`,
                value
              };
            }
            return null;
          })
          .filter(Boolean);
      }
    }

    if (patient?.blood_pressure_history && typeof patient.blood_pressure_history === 'object') {
      return Object.entries(patient.blood_pressure_history).map(([label, value]) => ({ label, value }));
    }

    return [];
  }

  function parseBloodPressure(value) {
    if (typeof value === 'number') {
      return { systolic: value, diastolic: value };
    }

    if (typeof value === 'string') {
      const match = value.match(/(\d{2,3})\s*\/\s*(\d{2,3})/);
      if (match) {
        return { systolic: Number(match[1]), diastolic: Number(match[2]) };
      }
      const numeric = Number(value);
      if (!Number.isNaN(numeric)) {
        return { systolic: numeric, diastolic: numeric };
      }
    }

    return null;
  }

  function renderList(container, items, fallbackLabel) {
    if (!container) return;
    container.innerHTML = '';
    const values = items.length ? items : [fallbackLabel];
    values.forEach((item) => {
      const entry = document.createElement('li');
      entry.textContent = typeof item === 'string' ? item : item.name || item.label || item.test || 'Item';
      container.appendChild(entry);
    });
  }

  function renderLabResults(items) {
    const tbody = document.getElementById('lab-results-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    const rows = items.length ? items : fallbackPatient.lab_results;
    rows.forEach((item) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.test || item.name || 'Test'}</td>
        <td>${item.value || item.result || '--'}</td>
        <td>${item.range || item.reference || '--'}</td>
      `;
      tbody.appendChild(row);
    });
  }

  function renderPatient(patient, source = 'live') {
    const latestReading = parseBloodPressure(patient?.blood_pressure || patient?.latest_bp || '118/76');
    const history = extractHistory(patient);
    const diagnosisHistory = getArrayValue(patient, ['diagnosis_history', 'diagnosisHistory', 'history', 'conditions']);
    const diagnostics = getArrayValue(patient, ['diagnostic_list', 'diagnosticList', 'diagnostics']);
    const labs = getArrayValue(patient, ['lab_results', 'labResults', 'labs']);

    document.getElementById('patient-title').textContent = `${patient.name || 'Jessica Taylor'} • ${patient.condition || 'Care plan'}`;
    document.getElementById('patient-name').textContent = patient.name || 'Jessica Taylor';
    document.getElementById('patient-meta').textContent = `${patient.age ? `Age ${patient.age}` : 'Age unavailable'} • ${patient.condition || 'Care plan'}`;
    document.getElementById('patient-gender').textContent = patient.gender || '--';
    document.getElementById('patient-phone').textContent = patient.phone || '--';
    document.getElementById('patient-insurance').textContent = patient.insurance || '--';
    document.getElementById('heart-rate').textContent = patient.heart_rate ? `${patient.heart_rate} bpm` : '--';
    document.getElementById('respiratory-rate').textContent = patient.respiratory_rate ? `${patient.respiratory_rate}` : '--';
    document.getElementById('blood-pressure').textContent = patient.blood_pressure || (latestReading ? `${latestReading.systolic}/${latestReading.diastolic}` : '--');
    document.getElementById('bp-caption').textContent = patient.blood_pressure ? 'Latest reading' : 'Latest reading';
    document.getElementById('temperature').textContent = patient.temperature || '--';

    renderList(document.getElementById('history-list'), diagnosisHistory, 'No diagnosis history');
    renderList(document.getElementById('diagnostic-list'), diagnostics, 'No diagnostic findings');
    renderLabResults(labs);

    renderChart(history);

    const latestSystolic = history.length ? parseBloodPressure(history[history.length - 1].value)?.systolic : latestReading?.systolic;
    const previousSystolic = history.length > 1 ? parseBloodPressure(history[history.length - 2].value)?.systolic : null;
    if (latestSystolic && previousSystolic) {
      const difference = latestSystolic - previousSystolic;
      document.getElementById('bp-trend').textContent = difference <= 0 ? 'Improving trend' : 'Watch trend';
    } else {
      document.getElementById('bp-trend').textContent = 'Stable trend';
    }

    updateStatus(source === 'live' ? 'Live data loaded' : 'Using sample data', source === 'live' ? 'success' : 'fallback');
  }

  function renderChart(history) {
    if (!chartCanvas) return;

    if (chartInstance) {
      chartInstance.destroy();
    }

    const labels = history.map((entry) => entry.label || '');
    const systolic = history.map((entry) => parseBloodPressure(entry.value)?.systolic || null);
    const diastolic = history.map((entry) => parseBloodPressure(entry.value)?.diastolic || null);

    if (!history.length || typeof Chart === 'undefined') {
      const parent = chartCanvas.parentElement;
      if (parent) {
        parent.innerHTML = '<p class="chart-empty">No blood pressure history available.</p>';
      }
      return;
    }

    chartCanvas.parentElement.innerHTML = '<canvas id="blood-pressure-chart"></canvas>';
    const freshContext = document.getElementById('blood-pressure-chart')?.getContext('2d');
    if (!freshContext) return;

    chartInstance = new Chart(freshContext, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Systolic',
            data: systolic,
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.16)',
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Diastolic',
            data: diastolic,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.16)',
            tension: 0.35,
            pointRadius: 4,
            pointHoverRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top' }
        },
        scales: {
          y: {
            beginAtZero: false,
            suggestedMin: 90,
            suggestedMax: 140
          }
        }
      }
    });
  }

  async function loadPatientData() {
    updateStatus('Syncing data');

    try {
      const response = await fetch(apiUrl, {
        headers: {
          Authorization: `Basic ${btoa('coalition:skills-test')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const payload = await response.json();
      const patients = Array.isArray(payload)
        ? payload
        : Array.isArray(payload?.patients)
          ? payload.patients
          : Array.isArray(payload?.data)
            ? payload.data
            : [];

      const patient = patients.find((entry) => normalizeName(getNestedValue(entry, ['name', 'patientName', 'fullName'])) === 'jessica taylor') || patients[0] || fallbackPatient;
      renderPatient(patient, 'live');
    } catch (error) {
      console.error(error);
      renderPatient(fallbackPatient, 'fallback');
    }
  }

  refreshButton?.addEventListener('click', loadPatientData);
  loadPatientData();
});
