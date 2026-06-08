const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// KHO DỮ LIỆU PHIM CHIA TRẠNG THÁI (CẬP NHẬT PHIM SẮP CHIẾU)
const movies = [
    { id: 1, title: "Doctor Strange 2026", genre: "Hành Động", status: "now_showing" },
    { id: 2, title: "Avatar: Thủy Đạo", genre: "Viễn Tưởng", status: "now_showing" },
    { id: 3, title: "Avengers: Secret Wars", genre: "Siêu Anh Hùng", status: "coming_soon" },
    { id: 4, title: "Shrek 5 (Hoạt Hình)", genre: "Hài Hước/Gia Đình", status: "coming_soon" }
];

const showtimes = ["14:30", "17:15", "19:45"];
let masterSeatStore = {};

function initSeatMap() {
    const ROWS = ['A', 'B', 'C', 'D'];
    let seatMap = {};
    for (let r of ROWS) {
        for (let c = 1; c <= 6; c++) {
            seatMap[`${r}${c}`] = { status: 'available', expiresAt: null };
        }
    }
    return seatMap;
}

// Chỉ khởi tạo lịch chiếu cho phim ĐANG CHIẾU (Phim Sắp Chiếu sẽ không có lịch đặt vé)
movies.forEach(m => {
    if (m.status === "now_showing") {
        masterSeatStore[m.title] = {};
        showtimes.forEach(t => {
            masterSeatStore[m.title][t] = initSeatMap();
        });
    }
});

function broadcast(type, data) {
    const message = JSON.stringify({ type, data });
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) client.send(message);
    });
}

// Giải phóng ghế quá hạn giữ
setInterval(() => {
    let hasChanges = false;
    const now = Date.now();

    Object.keys(masterSeatStore).forEach(movie => {
        Object.keys(masterSeatStore[movie]).forEach(time => {
            let seats = masterSeatStore[movie][time];
            Object.keys(seats).forEach(id => {
                if (seats[id].status === 'holding' && seats[id].expiresAt < now) {
                    seats[id] = { status: 'available', expiresAt: null };
                    hasChanges = true;
                }
            });
        });
    });

    if (hasChanges) {
        broadcast('SYNC_DATA', { masterSeatStore, movies, showtimes });
    }
}, 2000);

wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'SYNC_DATA', data: { masterSeatStore, movies, showtimes } }));
});

// API Giữ ghế
app.post('/api/seats/hold', (req, res) => {
    const { movie, showtime, seats } = req.body;
    const currentSeats = masterSeatStore[movie]?.[showtime];

    if (!currentSeats) return res.status(400).json({ success: false, message: "Suất chiếu không tồn tại hoặc phim chưa mở bán!" });

    const isConflict = seats.some(id => currentSeats[id] && currentSeats[id].status !== 'available');
    if (isConflict) {
        return res.status(400).json({ success: false, message: "Ghế bạn chọn vừa có người giữ hoặc đã bán!" });
    }

    const expiresAt = Date.now() + 5 * 60 * 1000;
    seats.forEach(id => { currentSeats[id] = { status: 'holding', expiresAt }; });

    broadcast('SYNC_DATA', { masterSeatStore, movies, showtimes });
    res.json({ success: true, expiresAt });
});

// API Checkout
app.post('/api/seats/checkout', (req, res) => {
    const { movie, showtime, seats } = req.body;
    const currentSeats = masterSeatStore[movie]?.[showtime];

    if (!currentSeats) return res.status(400).json({ success: false });

    seats.forEach(id => {
        if (currentSeats[id] && currentSeats[id].status === 'holding') {
            currentSeats[id] = { status: 'sold', expiresAt: null };
        }
    });

    const ticketId = 'CGV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    broadcast('SYNC_DATA', { masterSeatStore, movies, showtimes });

    res.json({ success: true, ticketId, qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ticketId}` });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Hệ thống chạy tại: http://127.0.0.1:${PORT}`);
});