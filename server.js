const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const nodemailer = require('nodemailer'); // Khai báo thư viện gửi mail

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CẤU HÌNH TRẠM GỬI MAIL TỰ ĐỘNG (Sử dụng Gmail SMTP cá nhân)
// Bạn cần vào tài khoản Google -> Security -> 2-Step Verification -> App Passwords để sinh mật khẩu 16 ký tự
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'hoang2026@gmail.com', // Thay bằng Email hệ thống rạp của bạn
        pass: '1'  // Thay bằng Mật khẩu ứng dụng (App Password) 16 ký tự
    }
});

// KHO DỮ LIỆU PHIM ĐỒNG BỘ FRONTEND
const movies = [
    { id: 1, title: "MA XÓ", genre: "Kinh Dị", status: "now_showing" },
    { id: 2, title: "Phim Điện Ảnh Doraemon: Nobita và Lâu Đài Dưới Đáy Biển (Phiên bản mới)", genre: "Hoạt Hình, Phiêu Lưu", status: "now_showing" },
    { id: 3, title: "TÊN CẬU LÀ GÌ.", genre: "Hoạt Hình", status: "now_showing" },
    { id: 4, title: "HE-MAN VÀ NHỮNG CHIẾN BINH VŨ TRỤ", genre: "Hành Động, Khoa Học Viễn Tưởng", status: "now_showing" },
    { id: 5, title: "Avengers: Secret Wars", genre: "Siêu Anh Hùng", status: "coming_soon" }
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

// Tự động quét giải phóng ghế giữ sau 5 phút
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

// API 1: Giữ ghế tạm thời
app.post('/api/seats/hold', (req, res) => {
    const { movie, showtime, seats } = req.body;
    const currentSeats = masterSeatStore[movie]?.[showtime];

    if (!currentSeats) return res.status(400).json({ success: false, message: "Suất chiếu không tồn tại!" });

    const isConflict = seats.some(id => currentSeats[id] && currentSeats[id].status !== 'available');
    if (isConflict) return res.status(400).json({ success: false, message: "Ghế đã bị giữ hoặc đã bán!" });

    const expiresAt = Date.now() + 5 * 60 * 1000;
    seats.forEach(id => { currentSeats[id] = { status: 'holding', expiresAt }; });

    broadcast('SYNC_DATA', { masterSeatStore, movies, showtimes });
    res.json({ success: true, expiresAt });
});

// API 2: Thanh toán & Gửi mail hóa đơn thực tế
app.post('/api/seats/checkout', (req, res) => {
    const { movie, showtime, seats, email } = req.body; // Lấy thêm Email người nhận từ Frontend truyền lên
    const currentSeats = masterSeatStore[movie]?.[showtime];

    if (!currentSeats) return res.status(400).json({ success: false });

    seats.forEach(id => {
        if (currentSeats[id] && currentSeats[id].status === 'holding') {
            currentSeats[id] = { status: 'sold', expiresAt: null };
        }
    });

    const ticketId = 'CGV-' + Math.random().toString(36).substr(2, 9).toUpperCase();
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${ticketId}`;
    
    broadcast('SYNC_DATA', { masterSeatStore, movies, showtimes });

    // HÀM KÍCH HOẠT GỬI EMAIL THỰC TẾ
    if (email) {
        const mailOptions = {
            from: '"CGV Cinemas Vietnam" <hoang2026@gmail.com>',
            to: email, // Địa chỉ email của khách hàng nhập lúc đăng nhập/đặt vé
            subject: `[CGV Cinemas] Xác nhận đặt vé thành công đơn hàng #${ticketId}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; border: 1px solid #ddd; padding: 20px; background-color: #fdfcf7;">
                    <h2 style="color: #e71a0f; text-align: center;">CGV E-TICKET WALLET</h2>
                    <p>Chào bạn,</p>
                    <p>Hệ thống CGV Cinemas Vietnam xác nhận bạn đã thanh toán thành công đơn hàng đặt vé xem phim trực tuyến.</p>
                    <hr style="border-color: #eee;">
                    <p>🎬 <b>Bộ phim:</b> ${movie}</p>
                    <p>🕒 <b>Suất chiếu:</b> ${showtime}</p>
                    <p>💺 <b>Vị trí ghế ngồi:</b> ${seats.join(', ')}</p>
                    <p>🎟️ <b>Mã đặt vé bí mật:</b> <span style="font-size: 18px; color: #e5a93b; font-weight: bold;">${ticketId}</span></p>
                    <hr style="border-color: #eee;">
                    <div style="text-align: center; margin-top: 15px;">
                        <p sưtyle="font-size: 12px; color: #666;">Vui lòng đưa mã QR bên dưới cho nhân viên soát cửa rạp phim:</p>
                        <img src="${qrCodeUrl}" alt="QR Code Vé">
                    </div>
                </div>
            `
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) console.log("Lỗi gửi mail: ", error);
            else console.log("Email đã được gửi thành công: " + info.response);
        });
    }

    res.json({ success: true, ticketId, qrCodeUrl });
});
// API 3: Hủy giao dịch - Giải phóng ghế đang giữ
app.post('/api/seats/cancel', (req, res) => {
    const { movie, showtime, seats } = req.body;
    const currentSeats = masterSeatStore[movie]?.[showtime];

    if (currentSeats) {
        seats.forEach(id => {
            if (currentSeats[id] && currentSeats[id].status === 'holding') {
                currentSeats[id] = { status: 'available', expiresAt: null };
            }
        });
        broadcast('SYNC_DATA', { masterSeatStore, movies, showtimes });
    }
    res.json({ success: true });
});
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Hệ thống chạy tại: http://127.0.0.1:${PORT}`);
});
