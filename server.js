require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const authRoutes = require('./routes/auth');
const scheduleRoutes = require('./routes/schedules');
const listRoutes = require('./routes/lists');
const { startScheduler } = require('./services/cronService');

const app = express();
const port = process.env.PORT || 3000;

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/schedules', scheduleRoutes);
app.use('/api/lists', listRoutes);

app.get('/', (req, res) => res.send('EchoSend Server is live and running!'));

startScheduler();

app.listen(port, () => console.log(`Server running on port ${port}`));
