<%@ page language="java" contentType="text/html; charset=UTF-8" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Chọn Ghế LumiAI</title>
    <style>
        body { background: #0f172a; color: white; text-align: center; font-family: Arial, sans-serif; }
        .screen { background: #00f2fe; height: 10px; width: 50%; margin: 30px auto; box-shadow: 0 3px 20px #00f2fe; }
        .row { margin: 15px 0; }
        .seat { background: #475569; width: 45px; height: 45px; display: inline-block; margin: 6px; border-radius: 5px; cursor: pointer; line-height: 45px; font-weight: bold; }
        .seat.selected { background: #10b981; transform: scale(1.1); }
    </style>
</head>
<body>
    <h1>MÀN HÌNH RẠP PHIM LUMIAI</h1>
    <div class="screen"></div>

    <!-- Sơ đồ ghế demo cho Vy bấm thử -->
    <div class="row">
        <div class="seat" onclick="this.classList.toggle('selected')">A1</div>
        <div class="seat" onclick="this.classList.toggle('selected')">A2</div>
        <div class="seat" onclick="this.classList.toggle('selected')">A3</div>
        <div class="seat" onclick="this.classList.toggle('selected')">A4</div>
    </div>
    <div class="row">
        <div class="seat" onclick="this.classList.toggle('selected')">B1</div>
        <div class="seat" onclick="this.classList.toggle('selected')">B2</div>
        <div class="seat" onclick="this.classList.toggle('selected')">B3</div>
        <div class="seat" onclick="this.classList.toggle('selected')">B4</div>
    </div>
    
    <p><small><i>*Người đẹp bấm thử vào mấy cái ô vuông xem nó có đổi sang màu xanh lá cây chưa nha!*</i></small></p>
</body>
</html>