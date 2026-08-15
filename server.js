const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDb } = require('./src/db');

const authRoutes = require('./src/routes/auth');
const scoreRoutes = require('./src/routes/scores');
const socialRoutes = require('./src/routes/social');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api', scoreRoutes);
app.use('/api', socialRoutes);

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize Database & Start Server
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`====================================================`);
      console.log(` 🪝 ONE HOOK Game Server running on http://localhost:${PORT}`);
      console.log(`====================================================`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
  });
