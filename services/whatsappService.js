const axios = require('axios');
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const WHATSAPP_API_URL = `https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`;

const sendMessage = async (recipient, message) => {
    if (!WHATSAPP_API_TOKEN || !PHONE_NUMBER_ID) {
        console.log(`[DRY RUN] Would send TEXT to ${recipient}: ${message}`);
        return true;
    }
    try {
        await axios.post(WHATSAPP_API_URL, { messaging_product: 'whatsapp', to: recipient, type: 'text', text: { body: message } }, { headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } });
        return true;
    } catch (error) {
        console.error(`Error sending TEXT to ${recipient}:`, error.response?.data?.error);
        return false;
    }
};

const sendMediaMessage = async (recipient, mediaUrl, caption, filename) => {
    if (!WHATSAPP_API_TOKEN || !PHONE_NUMBER_ID) {
        console.log(`[DRY RUN] Would send MEDIA to ${recipient}: ${filename}`);
        return true;
    }
    const extension = filename.split('.').pop().toLowerCase();
    let type = ['jpg', 'jpeg', 'png', 'webp'].includes(extension) ? 'image' : ['mp4', '3gpp'].includes(extension) ? 'video' : ['mp3', 'aac', 'ogg', 'amr'].includes(extension) ? 'audio' : 'document';
    const payload = {
        messaging_product: 'whatsapp', to: recipient, type,
        [type]: { link: mediaUrl, caption: caption || '', ...(type === 'document' && { filename }) }
    };
    try {
        await axios.post(WHATSAPP_API_URL, payload, { headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } });
        return true;
    } catch (error) {
        console.error(`Error sending MEDIA to ${recipient}:`, error.response?.data?.error);
        return false;
    }
};

module.exports = { sendMessage, sendMediaMessage };
