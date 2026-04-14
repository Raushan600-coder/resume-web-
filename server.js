const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const nodemailer = require('nodemailer');

const app = express();
const port = process.env.PORT || 3000;
const storeFile = path.join(__dirname, 'data', 'store.json');
const staticFolder = __dirname;

const sampleJobs = [
  { id: 'j1', company: 'TechWave', position: 'Frontend Engineer', location: 'Remote', email: 'hr@techwave.com' },
  { id: 'j2', company: 'NextGen Labs', position: 'UI Developer', location: 'Chennai', email: 'careers@nextgenlabs.com' },
  { id: 'j3', company: 'GreenByte', position: 'React Developer', location: 'Bangalore', email: 'jobs@greenbyte.ai' },
];

app.use(cors());
app.use(express.json());
app.use(express.static(staticFolder));

async function loadStore() {
  try {
    const raw = await fs.readFile(storeFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return { resume: null, savedJobs: [], applications: [], interview: null };
  }
}

async function saveStore(store) {
  await fs.mkdir(path.dirname(storeFile), { recursive: true });
  await fs.writeFile(storeFile, JSON.stringify(store, null, 2), 'utf8');
}

function buildMailto(job, resume) {
  const subject = encodeURIComponent(`Application for ${job.position} at ${job.company}`);
  let body = `Hello HR team,%0D%0A%0D%0AMy name is ${resume.name}. I am applying for the ${job.position} position at ${job.company}.`;
  if (resume.summary) {
    body += `%0D%0A%0D%0A${resume.summary}`;
  }
  body += `%0D%0A%0D%0AExperience:%0D%0A`;
  (resume.experiences || []).forEach(exp => {
    body += `- ${exp.role} at ${exp.company}: ${exp.responsibilities}%0D%0A`;
  });
  body += `%0D%0AContact: ${resume.email} | ${resume.phone}%0D%0A%0D%0AThank you,%0D%0A${resume.name}`;
  return `mailto:${job.email}?subject=${subject}&body=${body}`;
}

async function createTransporter() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_PORT) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER && process.env.SMTP_PASS ? {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    } : undefined,
  });
}

app.get('/api/resume', async (req, res) => {
  const store = await loadStore();
  res.json(store.resume || {});
});

app.post('/api/resume', async (req, res) => {
  const store = await loadStore();
  store.resume = req.body;
  await saveStore(store);
  res.json({ ok: true });
});

app.get('/api/jobs', async (req, res) => {
  const store = await loadStore();
  const queryCompany = (req.query.company || '').toLowerCase();
  const queryPosition = (req.query.position || '').toLowerCase();
  const queryLocation = (req.query.location || '').toLowerCase();
  const jobs = [...store.savedJobs, ...sampleJobs].filter(job => {
    return (!queryCompany || job.company.toLowerCase().includes(queryCompany)) &&
      (!queryPosition || job.position.toLowerCase().includes(queryPosition)) &&
      (!queryLocation || job.location.toLowerCase().includes(queryLocation));
  });
  res.json(jobs);
});

app.post('/api/jobs', async (req, res) => {
  const store = await loadStore();
  const job = { id: `job-${Date.now()}`, ...req.body };
  store.savedJobs.unshift(job);
  await saveStore(store);
  res.json(job);
});

app.get('/api/applications', async (req, res) => {
  const store = await loadStore();
  res.json(store.applications || []);
});

app.post('/api/apply', async (req, res) => {
  const store = await loadStore();
  const { job, resume } = req.body;
  if (!job || !resume) {
    return res.status(400).json({ error: 'Missing job or resume details.' });
  }
  const application = {
    id: `app-${Date.now()}`,
    company: job.company,
    position: job.position,
    location: job.location,
    email: job.email,
    status: 'Applied',
    interviewDate: '',
    interviewTime: '',
    message: '',
    appliedAt: new Date().toISOString(),
  };
  store.applications.unshift(application);
  await saveStore(store);
  const mailto = buildMailto(job, resume);
  const transporter = await createTransporter();
  let emailResult = null;
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: process.env.FROM_EMAIL || resume.email,
        to: job.email,
        subject: `Application for ${job.position} at ${job.company}`,
        text: `Hello HR team,\n\nMy name is ${resume.name}. I am applying for the ${job.position} position at ${job.company}.\n\n${resume.summary || ''}\n\nExperience:\n${(resume.experiences || []).map(exp => `- ${exp.role} at ${exp.company}: ${exp.responsibilities}`).join('\n')}\n\nContact: ${resume.email} | ${resume.phone}\n\nThank you,\n${resume.name}`,
      });
      emailResult = { sent: true, info };
    } catch (error) {
      emailResult = { sent: false, error: error.message };
    }
  }
  res.json({ application, mailto, emailResult });
});

app.post('/api/applications/:id/status', async (req, res) => {
  const store = await loadStore();
  const application = (store.applications || []).find(item => item.id === req.params.id);
  if (!application) {
    return res.status(404).json({ error: 'Application not found.' });
  }
  if (req.body.status) application.status = req.body.status;
  if (req.body.message !== undefined) application.message = req.body.message;
  if (req.body.interviewDate) application.interviewDate = req.body.interviewDate;
  if (req.body.interviewTime) application.interviewTime = req.body.interviewTime;
  await saveStore(store);
  res.json({ ok: true, application });
});

app.get('/api/interview', async (req, res) => {
  const store = await loadStore();
  res.json(store.interview || {});
});

app.post('/api/interview', async (req, res) => {
  const store = await loadStore();
  const { applicationId, date, time } = req.body;
  store.interview = { applicationId, date, time, setAt: new Date().toISOString() };
  const application = (store.applications || []).find(item => item.id === applicationId);
  if (application) {
    application.status = 'Interview Scheduled';
    application.interviewDate = date;
    application.interviewTime = time;
  }
  await saveStore(store);
  res.json(store.interview);
});

app.delete('/api/interview', async (req, res) => {
  const store = await loadStore();
  store.interview = null;
  await saveStore(store);
  res.json({ ok: true });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(staticFolder, 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
