const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const db = require('../db');
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
    destination: './uploads/',
    filename: (req, file, cb) => cb(null, `file-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage });

router.get('/', auth, async (req, res) => {
    try {
        const schedules = await db.query(
            `SELECT s.*, rl.list_name 
             FROM schedules s LEFT JOIN recipient_lists rl ON s.recipient_list_id = rl.id
             WHERE s.user_id = $1 AND s.status IN ('scheduled', 'processing')
             ORDER BY s.send_at ASC`,
            [req.user.id]
        );
        res.json(schedules.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.post('/', auth, upload.single('media'), async (req, res) => {
    const { recipient_number, recipient_list_id, message, send_at, frequency, is_magic_folder, file_search_pattern } = req.body;
    if (!recipient_number && !recipient_list_id) {
        return res.status(400).json({ msg: 'A recipient number or list is required.' });
    }
    const mediaUrl = req.file ? `${process.env.APP_BASE_URL}/uploads/${req.file.filename}` : null;
    const mediaFilename = req.file ? req.file.originalname : null;
    try {
        const newSchedule = await db.query(
            `INSERT INTO schedules (user_id, recipient_number, recipient_list_id, message, media_url, media_filename, send_at, frequency, is_magic_folder, file_search_pattern) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
            [req.user.id, recipient_number || null, recipient_list_id || null, message, mediaUrl, mediaFilename, send_at, frequency, is_magic_folder || false, file_search_pattern]
        );
        res.status(201).json(newSchedule.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.patch('/:id/media', auth, upload.single('media'), async (req, res) => {
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
    const mediaUrl = `${process.env.APP_BASE_URL}/uploads/${req.file.filename}`;
    const mediaFilename = req.file.originalname;
    try {
        const result = await db.query(
            "UPDATE schedules SET media_url = $1, media_filename = $2 WHERE id = $3 AND user_id = $4 RETURNING *",
            [mediaUrl, mediaFilename, req.params.id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ msg: 'Schedule not found or user not authorized' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
