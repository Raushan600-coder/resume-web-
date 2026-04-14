const resumeForm = document.getElementById('resume-form');
const experienceList = document.getElementById('experience-list');
const addExperienceBtn = document.getElementById('add-experience-btn');
const resetResumeBtn = document.getElementById('reset-resume');
const saveJobBtn = document.getElementById('save-job-btn');
const searchJobBtn = document.getElementById('search-job-btn');
const jobListEl = document.getElementById('job-list');
const applicationTableBody = document.querySelector('#application-table tbody');
const statusSummaryEl = document.getElementById('status-summary');
const selectedAppIdInput = document.getElementById('selected-app-id');
const responseText = document.getElementById('response-text');
const sendResponseBtn = document.getElementById('send-response-btn');
const markRepliedBtn = document.getElementById('mark-replied-btn');
const interviewDateInput = document.getElementById('interview-date');
const interviewTimeInput = document.getElementById('interview-time');
const setInterviewBtn = document.getElementById('set-interview-btn');
const clearInterviewBtn = document.getElementById('clear-interview-btn');
const interviewInfo = document.getElementById('interview-info');
const jobCompanyInput = document.getElementById('job-company');
const jobPositionInput = document.getElementById('job-position');
const jobLocationInput = document.getElementById('job-location');
const jobEmailInput = document.getElementById('job-email');

const apiBase = '/api';
let experienceCount = 0;
let selectedApplicationId = null;

async function apiGet(path) {
  const response = await fetch(`${apiBase}${path}`);
  if (!response.ok) {
    throw new Error(`API GET ${path} failed`);
  }
  return response.json();
}

async function apiPost(path, body) {
  const response = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`API POST ${path} failed`);
  }
  return response.json();
}

function renderExperienceFields(items = []) {
  experienceList.innerHTML = '';
  items.forEach((item, index) => addExperienceRow(item, index));
  if (items.length === 0) {
    addExperienceRow();
  }
}

function addExperienceRow(data = {}, index = null) {
  const rowIndex = index !== null ? index : experienceCount++;
  const card = document.createElement('div');
  card.className = 'experience-card';
  card.innerHTML = `
    <h4>Experience ${rowIndex + 1}</h4>
    <label>Company<input type="text" class="exp-company" placeholder="Company name" value="${data.company || ''}" /></label>
    <label>Role<input type="text" class="exp-role" placeholder="Role title" value="${data.role || ''}" /></label>
    <label>Responsibilities<textarea class="exp-responsibilities" rows="3" placeholder="Roles and responsibilities">${data.responsibilities || ''}</textarea></label>
    <button type="button" class="remove-experience secondary">Remove</button>
  `;
  const removeBtn = card.querySelector('.remove-experience');
  removeBtn.addEventListener('click', () => card.remove());
  experienceList.appendChild(card);
}

function getResumeFormData() {
  const experiences = Array.from(experienceList.querySelectorAll('.experience-card')).map(card => ({
    company: card.querySelector('.exp-company').value,
    role: card.querySelector('.exp-role').value,
    responsibilities: card.querySelector('.exp-responsibilities').value,
  })).filter(exp => exp.company || exp.role || exp.responsibilities);

  return {
    name: document.getElementById('resume-name').value,
    email: document.getElementById('resume-email').value,
    phone: document.getElementById('resume-phone').value,
    role: document.getElementById('resume-role').value,
    summary: document.getElementById('resume-summary').value,
    experiences,
  };
}

function fillResumeForm(data) {
  document.getElementById('resume-name').value = data.name || '';
  document.getElementById('resume-email').value = data.email || '';
  document.getElementById('resume-phone').value = data.phone || '';
  document.getElementById('resume-role').value = data.role || '';
  document.getElementById('resume-summary').value = data.summary || '';
  renderExperienceFields(data.experiences || []);
}

function resetResume() {
  resumeForm.reset();
  renderExperienceFields([]);
}

function renderJobList(jobs) {
  jobListEl.innerHTML = '';
  jobs.forEach(job => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>
        <strong>${job.position}</strong> @ ${job.company}<br />
        <small>${job.location} • ${job.email}</small>
      </div>
      <button type="button" data-job-id="${job.id}">Apply</button>
    `;
    const applyButton = li.querySelector('button');
    applyButton.addEventListener('click', () => handleApply(job));
    jobListEl.appendChild(li);
  });
}

function renderApplications(applications) {
  applicationTableBody.innerHTML = '';
  applications.forEach(app => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${app.company}</td>
      <td>${app.position}</td>
      <td><span class="status-pill status-${app.status.replace(/ /g, '\\ ')}">${app.status}</span></td>
      <td>${app.interviewDate ? `${app.interviewDate} ${app.interviewTime}` : 'Not scheduled'}</td>
      <td>
        <button type="button" data-action="select" data-id="${app.id}">Select</button>
        <button type="button" data-action="hr-replied" data-id="${app.id}" class="secondary">HR Replied</button>
        <button type="button" data-action="interview" data-id="${app.id}" class="secondary">Set Interview</button>
      </td>
    `;
    applicationTableBody.appendChild(row);
  });
  renderStatusSummary(applications);
}

function renderStatusSummary(applications) {
  const stats = applications.reduce((acc, app) => {
    acc[app.status] = (acc[app.status] || 0) + 1;
    return acc;
  }, {});
  statusSummaryEl.innerHTML = Object.entries(stats).map(([status, count]) => `
    <span class="status-pill status-${status.replace(/ /g, '\\ ')}">${status}: ${count}</span>
  `).join(' ');
}

async function handleApply(job) {
  const resume = getResumeFormData();
  if (!resume.name || !resume.email || !resume.phone || !resume.role) {
    alert('Please fill out your resume details before applying.');
    return;
  }
  try {
    const response = await apiPost('/apply', { job, resume });
    await loadApplications();
    if (response.emailResult && response.emailResult.sent) {
      alert('Application sent by backend email service.');
    } else if (response.mailto) {
      window.location.href = response.mailto;
    } else {
      alert('Application saved, but email could not be sent automatically.');
    }
  } catch (error) {
    alert(error.message);
  }
}

async function handleJobSave() {
  const company = jobCompanyInput.value.trim();
  const position = jobPositionInput.value.trim();
  const location = jobLocationInput.value.trim();
  const email = jobEmailInput.value.trim();
  if (!company || !position || !email) {
    alert('Please enter company, position, and email to save a job.');
    return;
  }
  try {
    await apiPost('/jobs', { company, position, location, email });
    jobCompanyInput.value = '';
    jobPositionInput.value = '';
    jobLocationInput.value = '';
    jobEmailInput.value = '';
    await loadJobs();
  } catch (error) {
    alert(error.message);
  }
}

async function handleSearchJobs() {
  const company = jobCompanyInput.value.trim();
  const position = jobPositionInput.value.trim();
  const location = jobLocationInput.value.trim();
  const query = new URLSearchParams({ company, position, location });
  try {
    const jobs = await apiGet(`/jobs?${query.toString()}`);
    renderJobList(jobs);
  } catch (error) {
    alert(error.message);
  }
}

function attachAppTableHandlers() {
  applicationTableBody.addEventListener('click', async event => {
    const button = event.target.closest('button');
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id;
    if (!action || !id) return;
    selectedApplicationId = id;
    if (action === 'select') {
      selectedAppIdInput.value = id;
      responseText.value = `Hi,\n\nThank you for your message. I am very interested in this role and would like to confirm next steps.`;
    } else if (action === 'hr-replied') {
      await updateApplicationStatus(id, 'HR Replied');
    } else if (action === 'interview') {
      const date = new Date().toISOString().slice(0, 10);
      const time = '11:00';
      await updateApplicationStatus(id, 'Interview Scheduled', '', date, time);
      await setInterviewAlarmBackend(id, date, time);
    }
  });
}

async function updateApplicationStatus(id, status, message = '', interviewDate = '', interviewTime = '') {
  try {
    await apiPost(`/applications/${id}/status`, { status, message, interviewDate, interviewTime });
    await loadApplications();
  } catch (error) {
    alert(error.message);
  }
}

async function handleSendResponse() {
  if (!selectedApplicationId) {
    alert('Select an application first.');
    return;
  }
  const message = responseText.value.trim();
  if (!message) {
    alert('Write a reply message before sending.');
    return;
  }
  await updateApplicationStatus(selectedApplicationId, 'Replied', message);
  alert('Reply saved to backend and status updated.');
}

function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

async function setInterviewAlarmBackend(applicationId, date, time) {
  try {
    await apiPost('/interview', { applicationId, date, time });
    await loadInterview();
  } catch (error) {
    alert(error.message);
  }
}

async function clearInterviewAlarmBackend() {
  try {
    await fetch(`${apiBase}/interview`, { method: 'DELETE' });
    interviewInfo.textContent = 'No interview scheduled.';
  } catch (error) {
    alert(error.message);
  }
}

function updateInterviewInfoView(interview) {
  if (!interview || !interview.date || !interview.time) {
    interviewInfo.textContent = 'No interview scheduled.';
    return;
  }
  interviewInfo.innerHTML = `<strong>Interview scheduled:</strong> ${interview.date} at ${interview.time}`;
  scheduleNotification(interview);
}

function scheduleNotification(interview) {
  const interviewDateTime = new Date(`${interview.date}T${interview.time}:00`);
  const now = new Date();
  const diffMs = interviewDateTime - now;
  if (diffMs <= 0 || Notification.permission !== 'granted') return;
  if (diffMs <= 1000 * 60 * 60 * 24) {
    new Notification('Interview Reminder', {
      body: `Interview at ${interview.time} on ${interview.date}. Prepare and join on time.`,
    });
  }
}

async function loadResume() {
  try {
    const resume = await apiGet('/resume');
    if (resume && Object.keys(resume).length) {
      fillResumeForm(resume);
    } else {
      renderExperienceFields([]);
    }
  } catch (error) {
    alert(error.message);
  }
}

async function loadJobs() {
  try {
    const jobs = await apiGet('/jobs');
    renderJobList(jobs);
  } catch (error) {
    alert(error.message);
  }
}

async function loadApplications() {
  try {
    const applications = await apiGet('/applications');
    renderApplications(applications);
  } catch (error) {
    alert(error.message);
  }
}

async function loadInterview() {
  try {
    const interview = await apiGet('/interview');
    updateInterviewInfoView(interview);
  } catch (error) {
    alert(error.message);
  }
}

async function init() {
  addExperienceBtn.addEventListener('click', () => addExperienceRow());
  resetResumeBtn.addEventListener('click', resetResume);
  resumeForm.addEventListener('submit', async event => {
    event.preventDefault();
    const resume = getResumeFormData();
    try {
      await apiPost('/resume', resume);
      alert('Resume saved to backend.');
    } catch (error) {
      alert(error.message);
    }
  });
  saveJobBtn.addEventListener('click', handleJobSave);
  searchJobBtn.addEventListener('click', handleSearchJobs);
  sendResponseBtn.addEventListener('click', handleSendResponse);
  markRepliedBtn.addEventListener('click', async () => {
    if (!selectedApplicationId) {
      alert('Select an application first.');
      return;
    }
    await updateApplicationStatus(selectedApplicationId, 'Replied');
  });
  setInterviewBtn.addEventListener('click', async () => {
    const date = interviewDateInput.value;
    const time = interviewTimeInput.value;
    if (!date || !time) {
      alert('Enter interview date and time.');
      return;
    }
    if (!selectedApplicationId) {
      alert('Select an application first to attach the interview.');
      return;
    }
    await setInterviewAlarmBackend(selectedApplicationId, date, time);
  });
  clearInterviewBtn.addEventListener('click', clearInterviewAlarmBackend);
  attachAppTableHandlers();
  requestNotificationPermission();
  await loadResume();
  await loadJobs();
  await loadApplications();
  await loadInterview();
}

window.addEventListener('DOMContentLoaded', init);
