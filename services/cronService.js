const cron = require('node-cron');
const db = require('../db');
const { sendMessage, sendMediaMessage } = require('./whatsappService');

const processSendJob = async (jobData) => {
    console.log(`Processing job: Send to ${jobData.recipient}`);
    if (jobData.mediaUrl) {
        return await sendMediaMessage(jobData.recipient, jobData.mediaUrl, jobData.caption, jobData.filename);
    } else if (jobData.message) {
        return await sendMessage(jobData.recipient, jobData.message);
    }
    return false;
};

const processSchedule = async (schedule) => {
    const recipients = schedule.recipient_list_id
        ? (await db.query('SELECT phone_number FROM list_members WHERE list_id = $1', [schedule.recipient_list_id])).rows.map(m => m.phone_number)
        : [schedule.recipient_number];

    if (recipients.length > 0) {
        console.log(`Dispatching ${recipients.length} jobs for schedule ID ${schedule.id}.`);
        const sendPromises = recipients.map(recipient => processSendJob({
            recipient, message: schedule.message, mediaUrl: schedule.media_url, caption: schedule.message, filename: schedule.media_filename
        }));
        await Promise.all(sendPromises);
    }
    await handlePostSend(schedule);
};

const handlePostSend = async (schedule) => {
    const now = new Date();
    const clearMediaSQL = schedule.is_magic_folder ? ", media_url = NULL, media_filename = NULL" : "";

    if (schedule.frequency === 'once') {
        await db.query(`UPDATE schedules SET status = 'sent', last_sent_at = $1 ${clearMediaSQL} WHERE id = $2`, [now, schedule.id]);
        return;
    }
    let nextRunTime = new Date(schedule.send_at);
    if (schedule.frequency === 'daily') nextRunTime.setDate(nextRunTime.getDate() + 1);
    else if (schedule.frequency === 'weekly') nextRunTime.setDate(nextRunTime.getDate() + 7);
    else if (schedule.frequency === 'weekdays') {
        do { nextRunTime.setDate(nextRunTime.getDate() + 1); } while (nextRunTime.getDay() % 6 === 0);
    }
    await db.query(`UPDATE schedules SET status = 'scheduled', send_at = $1, last_sent_at = $2 ${clearMediaSQL} WHERE id = $3`, [nextRunTime, now, schedule.id]);
};

const checkSchedules = async () => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const res = await client.query("SELECT * FROM schedules WHERE status = 'scheduled' AND send_at <= NOW() FOR UPDATE SKIP LOCKED");
        if (res.rows.length > 0) {
            console.log(`[${new Date().toLocaleString()}] Found ${res.rows.length} schedules to process.`);
            const scheduleIds = res.rows.map(r => r.id);
            await client.query("UPDATE schedules SET status = 'processing' WHERE id = ANY($1::int[])", [scheduleIds]);
        }
        await client.query('COMMIT');
        for (const schedule of res.rows) await processSchedule(schedule);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error in cron job:', error);
    } finally {
        client.release();
    }
};

const startScheduler = () => {
    cron.schedule('* * * * *', checkSchedules);
    console.log('Premium Message Scheduler started. Checking every minute.');
};

module.exports = { startScheduler };
