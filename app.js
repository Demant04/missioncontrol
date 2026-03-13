const STORAGE_KEY = 'krabbe-mission-board-v1';

const lanes = [
  { id: 'capture', label: 'Capture', subtitle: 'Raw ideas, leads, and possibilities' },
  { id: 'qualify', label: 'Qualify', subtitle: 'Check fit, pain, urgency, and money' },
  { id: 'proposal', label: 'Proposal', subtitle: 'Shape the offer and package the win' },
  { id: 'build', label: 'Build', subtitle: 'Execution, frontend, systems, and delivery' },
  { id: 'ship', label: 'Ship', subtitle: 'Go live, QA, invoice, and next step' },
];

const defaultState = {
  meta: {
    northStar: 'Build a freelance machine that finds work, ships fast, and compounds trust.',
    quarterGoal: 'Land the first repeatable frontend + automation offer.',
    weeklyTarget: '5 leads qualified · 2 proposals sent · 1 live proof-of-concept',
    nextMeeting: '2026-03-14 · 14:00 UTC · Company future meeting',
  },
  notes: {
    captainsLog:
      'Control principle: keep the board brutally clear. No vanity tasks. Every card should either make money, create leverage, or improve delivery quality.',
    meetingAgenda:
      '1) Pick the first offer\n2) Decide who we sell to\n3) Define how Krabbe delegates to a programmer agent\n4) Set next 14 days of outreach + building',
    offerThesis:
      'Position the company around fast frontend builds, clean offer packaging, and lightweight automation that makes small businesses look sharper and move faster.',
  },
  crew: [
    {
      name: 'Krabbe',
      role: 'Formand / Orchestrator',
      status: 'Online',
      mission: 'Holds direction, allocates work, keeps the company pointed at revenue.',
      focus: 'Strategy, prioritisation, client-facing structure',
    },
    {
      name: 'Programmør',
      role: 'Technical build brain',
      status: 'Planned',
      mission: 'Will build frontends, prototypes, automations, and polish the product layer.',
      focus: 'Frontend, systems, QA, implementation',
    },
    {
      name: 'Future sales wingman',
      role: 'Pipeline support',
      status: 'Optional',
      mission: 'Could later qualify leads, help write proposals, and keep outreach moving.',
      focus: 'Lead research, messaging, proposal prep',
    },
  ],
  timeline: [
    {
      title: 'Week 1 · Clarify the offer',
      body: 'Choose one offer to sell first: landing pages, micro-sites, or frontend + automation upgrades for small businesses.',
    },
    {
      title: 'Week 2 · Build the internal stack',
      body: 'Set up the programmer brain, define delegation rules, and create a repeatable pipeline from lead to shipped work.',
    },
    {
      title: 'Week 3 · Outreach sprint',
      body: 'Collect leads, qualify them, send offers, and track every conversation inside the board.',
    },
    {
      title: 'Week 4 · Ship proof',
      body: 'Launch a polished proof-of-concept or internal demo that shows the firm can design, build, and close.',
    },
  ],
  exam: [
    {
      title: 'Visual hierarchy is clear',
      body: 'The page needs a strong hero, obvious metrics, and lanes that are readable at a glance.',
      pass: true,
    },
    {
      title: 'Frontend is writeable',
      body: 'Notes, agendas, and missions can all be written directly into the interface.',
      pass: true,
    },
    {
      title: 'Pipeline matches the business',
      body: 'The board is not generic project sludge — it maps to sales, proposals, building, and shipping work.',
      pass: true,
    },
    {
      title: 'Ready for screenshot QA',
      body: 'The layout is designed to render nicely in headless Chromium so Krabbe can inspect it after changes.',
      pass: true,
    },
  ],
  missions: [
    {
      id: crypto.randomUUID(),
      title: 'Design the Krabbe mission board',
      client: 'Internal',
      lane: 'build',
      value: 0,
      owner: 'Krabbe',
      priority: 'high',
      dueDate: '2026-03-14',
      progress: 90,
      notes: 'The board should feel like a premium command center, not a bland to-do app. It must support writing, overview, and future team expansion.',
    },
    {
      id: crypto.randomUUID(),
      title: 'Package first offer for local businesses',
      client: 'Freelance offer',
      lane: 'proposal',
      value: 15000,
      owner: 'Krabbe',
      priority: 'high',
      dueDate: '2026-03-18',
      progress: 55,
      notes: 'Build a clean offer around fast landing pages + frontend cleanup + simple automations. Keep it easy to explain and easy to buy.',
    },
    {
      id: crypto.randomUUID(),
      title: 'List 20 warm prospect types',
      client: 'Pipeline',
      lane: 'qualify',
      value: 25000,
      owner: 'Krabbe',
      priority: 'medium',
      dueDate: '2026-03-16',
      progress: 35,
      notes: 'Focus on service businesses that benefit from strong web presence: trades, consultants, clinics, and local premium operators.',
    },
    {
      id: crypto.randomUUID(),
      title: 'Define programmør-agent spec',
      client: 'Internal systems',
      lane: 'capture',
      value: 0,
      owner: 'Krabbe',
      priority: 'medium',
      dueDate: '2026-03-20',
      progress: 20,
      notes: 'Lock down what the programmer brain should own: frontend, automation, QA, and technical delivery.',
    },
    {
      id: crypto.randomUUID(),
      title: 'Ship screenshot-tested frontend sample',
      client: 'Exam build',
      lane: 'ship',
      value: 0,
      owner: 'Krabbe',
      priority: 'low',
      dueDate: '2026-03-13',
      progress: 100,
      notes: 'Use headless Chromium to confirm the machine can render and inspect a frontend without a full desktop GUI.',
    },
  ],
};

let state = loadState();
let activeMissionId = null;
let saveMessageTimeout = null;

const board = document.getElementById('board');
const crewList = document.getElementById('crewList');
const timelineList = document.getElementById('timelineList');
const examList = document.getElementById('examList');
const saveState = document.getElementById('saveState');
const missionForm = document.getElementById('missionForm');
const exportButton = document.getElementById('exportButton');
const importInput = document.getElementById('importInput');
const resetButton = document.getElementById('resetButton');
const editorDrawer = document.getElementById('editorDrawer');
const editorForm = document.getElementById('editorForm');
const closeDrawerButton = document.getElementById('closeDrawerButton');
const notesFields = {
  captainsLog: document.getElementById('captainsLog'),
  meetingAgenda: document.getElementById('meetingAgenda'),
  offerThesis: document.getElementById('offerThesis'),
};

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(defaultState);
    const parsed = JSON.parse(raw);
    return mergeState(parsed);
  } catch (error) {
    console.warn('Failed to load stored board state:', error);
    return structuredClone(defaultState);
  }
}

function mergeState(loaded) {
  return {
    ...structuredClone(defaultState),
    ...loaded,
    meta: { ...structuredClone(defaultState).meta, ...(loaded.meta || {}) },
    notes: { ...structuredClone(defaultState).notes, ...(loaded.notes || {}) },
    crew: Array.isArray(loaded.crew) && loaded.crew.length ? loaded.crew : structuredClone(defaultState).crew,
    timeline: Array.isArray(loaded.timeline) && loaded.timeline.length ? loaded.timeline : structuredClone(defaultState).timeline,
    exam: Array.isArray(loaded.exam) && loaded.exam.length ? loaded.exam : structuredClone(defaultState).exam,
    missions: Array.isArray(loaded.missions) && loaded.missions.length ? loaded.missions : structuredClone(defaultState).missions,
  };
}

function persistState(message = 'Saved.') {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  saveState.textContent = message;
  if (saveMessageTimeout) window.clearTimeout(saveMessageTimeout);
  saveMessageTimeout = window.setTimeout(() => {
    saveState.textContent = 'Board ready. Changes save automatically.';
  }, 1800);
}

function currency(value) {
  return new Intl.NumberFormat('da-DK', { style: 'currency', currency: 'DKK', maximumFractionDigits: 0 }).format(Number(value || 0));
}

function shortDate(value) {
  if (!value) return 'No due date';
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short' }).format(date);
}

function dueSoon(value) {
  if (!value) return false;
  const today = new Date();
  const target = new Date(`${value}T23:59:59`);
  const diffDays = (target - today) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
}

function renderMeta() {
  document.getElementById('northStarText').textContent = state.meta.northStar;
  document.getElementById('quarterGoalText').textContent = state.meta.quarterGoal;
  document.getElementById('weeklyTargetText').textContent = state.meta.weeklyTarget;
  document.getElementById('nextMeetingText').textContent = state.meta.nextMeeting;
}

function renderStats() {
  const openMissions = state.missions.filter((mission) => mission.lane !== 'ship' || Number(mission.progress) < 100);
  const pipeline = openMissions.reduce((sum, mission) => sum + Number(mission.value || 0), 0);
  const shipsSoon = state.missions.filter((mission) => dueSoon(mission.dueDate)).length;
  const passed = state.exam.filter((item) => item.pass).length;
  const examScore = Math.round((passed / state.exam.length) * 100);

  document.getElementById('pipelineValue').textContent = currency(pipeline);
  document.getElementById('activeMissionCount').textContent = `${openMissions.length}`;
  document.getElementById('shipCount').textContent = `${shipsSoon}`;
  document.getElementById('examScore').textContent = `${examScore}%`;
}

function renderBoard() {
  board.innerHTML = '';

  lanes.forEach((lane) => {
    const laneMissions = state.missions.filter((mission) => mission.lane === lane.id);
    const laneValue = laneMissions.reduce((sum, mission) => sum + Number(mission.value || 0), 0);

    const laneElement = document.createElement('section');
    laneElement.className = 'board-lane';
    laneElement.dataset.lane = lane.id;

    laneElement.innerHTML = `
      <div class="lane-header">
        <div>
          <div class="lane-title-row">
            <span class="lane-dot"></span>
            <h4>${lane.label}</h4>
          </div>
          <p class="lane-subtitle">${lane.subtitle}</p>
        </div>
        <span class="lane-count">${laneMissions.length} · ${currency(laneValue)}</span>
      </div>
      <div class="card-stack"></div>
    `;

    const stack = laneElement.querySelector('.card-stack');

    if (!laneMissions.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-lane';
      empty.textContent = 'No missions here yet. Add one below and keep the machine moving.';
      stack.appendChild(empty);
    } else {
      laneMissions.forEach((mission) => stack.appendChild(createMissionCard(mission)));
    }

    board.appendChild(laneElement);
  });
}

function createMissionCard(mission) {
  const card = document.createElement('article');
  card.className = 'mission-card';

  const nextLaneIndex = lanes.findIndex((lane) => lane.id === mission.lane) + 1;
  const nextLane = lanes[nextLaneIndex];
  const progress = Math.max(0, Math.min(100, Number(mission.progress || 0)));

  card.innerHTML = `
    <div class="card-top">
      <div>
        <h4 class="card-title">${escapeHtml(mission.title)}</h4>
        <p class="card-client">${escapeHtml(mission.client || 'No client')}</p>
      </div>
      <span class="meta-chip ${priorityClass(mission.priority)}"><span class="priority-dot"></span>${labelPriority(mission.priority)}</span>
    </div>

    <div class="card-meta">
      <span class="meta-chip">${escapeHtml(mission.owner || 'Unassigned')}</span>
      <span class="meta-chip">Due ${shortDate(mission.dueDate)}</span>
      <span class="meta-chip">${currency(mission.value || 0)}</span>
    </div>

    <div class="progress-shell"><div class="progress-fill" style="width: ${progress}%"></div></div>

    <p class="card-notes">${escapeHtml(mission.notes || 'No notes yet.')}</p>

    <div class="card-footer">
      <div class="card-actions">
        <button class="card-button" data-action="edit" data-id="${mission.id}">Edit</button>
        ${nextLane ? `<button class="card-button promote" data-action="promote" data-id="${mission.id}">Move to ${nextLane.label}</button>` : ''}
        <button class="card-button delete" data-action="delete" data-id="${mission.id}">Delete</button>
      </div>
    </div>
  `;

  return card;
}

function renderCrew() {
  crewList.innerHTML = '';
  state.crew.forEach((member) => {
    const card = document.createElement('article');
    card.className = 'crew-card';
    card.innerHTML = `
      <h4>${escapeHtml(member.name)}</h4>
      <p>${escapeHtml(member.mission)}</p>
      <div class="crew-meta">
        <span class="meta-chip">${escapeHtml(member.role)}</span>
        <span class="meta-chip">${escapeHtml(member.status)}</span>
        <span class="meta-chip">${escapeHtml(member.focus)}</span>
      </div>
    `;
    crewList.appendChild(card);
  });
}

function renderTimeline() {
  timelineList.innerHTML = '';
  state.timeline.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'timeline-item';
    li.innerHTML = `
      <div class="timeline-step">0${index + 1}</div>
      <h4>${escapeHtml(item.title)}</h4>
      <p>${escapeHtml(item.body)}</p>
    `;
    timelineList.appendChild(li);
  });
}

function renderExam() {
  examList.innerHTML = '';
  state.exam.forEach((item) => {
    const card = document.createElement('article');
    card.className = `exam-item ${item.pass ? 'good' : ''}`;
    card.innerHTML = `
      <h4>${escapeHtml(item.title)}</h4>
      <p>${escapeHtml(item.body)}</p>
      <div class="exam-meta">
        <span class="meta-chip">${item.pass ? 'Pass' : 'Review needed'}</span>
      </div>
    `;
    examList.appendChild(card);
  });
}

function renderNotes() {
  Object.entries(notesFields).forEach(([key, field]) => {
    field.value = state.notes[key] || '';
  });
}

function renderAll() {
  renderMeta();
  renderStats();
  renderBoard();
  renderCrew();
  renderTimeline();
  renderExam();
  renderNotes();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('\n', '<br />');
}

function labelPriority(priority) {
  if (priority === 'high') return 'High';
  if (priority === 'low') return 'Low';
  return 'Medium';
}

function priorityClass(priority) {
  if (priority === 'high') return 'priority-high';
  if (priority === 'low') return 'priority-low';
  return 'priority-medium';
}

missionForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(missionForm);

  state.missions.unshift({
    id: crypto.randomUUID(),
    title: formData.get('title')?.toString().trim() || 'Untitled mission',
    client: formData.get('client')?.toString().trim() || '',
    value: Number(formData.get('value') || 0),
    lane: formData.get('lane')?.toString() || 'capture',
    owner: formData.get('owner')?.toString().trim() || 'Krabbe',
    dueDate: formData.get('dueDate')?.toString() || '',
    priority: formData.get('priority')?.toString() || 'medium',
    progress: Number(formData.get('progress') || 0),
    notes: formData.get('notes')?.toString().trim() || '',
  });

  missionForm.reset();
  missionForm.elements.namedItem('progress').value = 35;
  renderAll();
  persistState('Mission added and saved.');
});

board.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;

  const { action, id } = button.dataset;
  const mission = state.missions.find((item) => item.id === id);
  if (!mission) return;

  if (action === 'delete') {
    state.missions = state.missions.filter((item) => item.id !== id);
    renderAll();
    persistState('Mission deleted.');
    return;
  }

  if (action === 'promote') {
    const laneIndex = lanes.findIndex((lane) => lane.id === mission.lane);
    const nextLane = lanes[laneIndex + 1];
    if (!nextLane) return;
    mission.lane = nextLane.id;
    mission.progress = Math.min(100, Number(mission.progress || 0) + 15);
    renderAll();
    persistState(`Moved to ${nextLane.label}.`);
    return;
  }

  if (action === 'edit') {
    openDrawer(mission.id);
  }
});

function openDrawer(missionId) {
  const mission = state.missions.find((item) => item.id === missionId);
  if (!mission) return;

  activeMissionId = missionId;
  editorForm.elements.id.value = mission.id;
  editorForm.elements.title.value = mission.title;
  editorForm.elements.client.value = mission.client;
  editorForm.elements.value.value = mission.value;
  editorForm.elements.lane.value = mission.lane;
  editorForm.elements.owner.value = mission.owner;
  editorForm.elements.dueDate.value = mission.dueDate;
  editorForm.elements.priority.value = mission.priority;
  editorForm.elements.progress.value = mission.progress;
  editorForm.elements.notes.value = mission.notes;

  editorDrawer.classList.remove('hidden');
  editorDrawer.setAttribute('aria-hidden', 'false');
}

function closeDrawer() {
  activeMissionId = null;
  editorDrawer.classList.add('hidden');
  editorDrawer.setAttribute('aria-hidden', 'true');
}

closeDrawerButton.addEventListener('click', closeDrawer);

editorForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!activeMissionId) return;

  const mission = state.missions.find((item) => item.id === activeMissionId);
  if (!mission) return;

  mission.title = editorForm.elements.title.value.trim() || 'Untitled mission';
  mission.client = editorForm.elements.client.value.trim();
  mission.value = Number(editorForm.elements.value.value || 0);
  mission.lane = editorForm.elements.lane.value;
  mission.owner = editorForm.elements.owner.value.trim() || 'Krabbe';
  mission.dueDate = editorForm.elements.dueDate.value;
  mission.priority = editorForm.elements.priority.value;
  mission.progress = Number(editorForm.elements.progress.value || 0);
  mission.notes = editorForm.elements.notes.value.trim();

  renderAll();
  persistState('Mission updated.');
  closeDrawer();
});

Object.entries(notesFields).forEach(([key, field]) => {
  field.addEventListener('input', () => {
    state.notes[key] = field.value;
    persistState('Notes saved.');
  });
});

exportButton.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'krabbe-mission-board.json';
  anchor.click();
  URL.revokeObjectURL(url);
  persistState('Export generated.');
});

importInput.addEventListener('change', async (event) => {
  const [file] = event.target.files || [];
  if (!file) return;
  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    state = mergeState(parsed);
    renderAll();
    persistState('Imported board data.');
    closeDrawer();
  } catch (error) {
    alert('That file is not valid mission board JSON.');
  }
  event.target.value = '';
});

resetButton.addEventListener('click', () => {
  const okay = window.confirm('Reset the board back to the polished demo state?');
  if (!okay) return;
  state = structuredClone(defaultState);
  renderAll();
  persistState('Board reset to demo state.');
  closeDrawer();
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeDrawer();
});

renderAll();
persistState('Mission board loaded.');
