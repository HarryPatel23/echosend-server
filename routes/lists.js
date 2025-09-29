const express = require('express');
const router = express.Router();
const auth = require('../middleware/authMiddleware');
const db = require('../db');

router.get('/', auth, async (req, res) => {
    try {
        const lists = await db.query(
            `SELECT rl.id, rl.list_name, COUNT(lm.id) as member_count 
             FROM recipient_lists rl 
             LEFT JOIN list_members lm ON rl.id = lm.list_id 
             WHERE rl.user_id = $1 GROUP BY rl.id ORDER BY rl.list_name`,
            [req.user.id]
        );
        res.json(lists.rows);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

router.post('/', auth, async (req, res) => {
    const { list_name, members } = req.body;
    if (!list_name || !members || members.length === 0) {
        return res.status(400).json({ msg: 'List name and members are required.' });
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const newList = await client.query(
            'INSERT INTO recipient_lists (user_id, list_name) VALUES ($1, $2) RETURNING id',
            [req.user.id, list_name]
        );
        const listId = newList.rows[0].id;
        const insertPromises = members.map(member => 
            client.query('INSERT INTO list_members (list_id, phone_number, member_name) VALUES ($1, $2, $3)', [listId, member.phone_number, member.member_name])
        );
        await Promise.all(insertPromises);
        await client.query('COMMIT');
        res.status(201).json({ id: listId, list_name, members });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err.message);
        res.status(500).send('Server Error');
    } finally {
        client.release();
    }
});

module.exports = router;
