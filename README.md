# discord-service-shop

Project web bán hàng **Super Order** dùng Node.js + Express + EJS, lưu dữ liệu bằng file JSON.

## Chạy local

```bash
npm install
cp .env.example .env
npm start
```

Mở:

```text
http://localhost:3000
```

Admin:

```text
http://localhost:3000/admin/login
```

Tài khoản mặc định nằm trong `data/admin.json`:

```text
admin / admin123
```

## QR thanh toán và bill

Ảnh QR mẫu nằm ở `public/images/payment-qr.svg`. Bạn có thể thay file này bằng QR thật của bạn, hoặc đổi đường dẫn ảnh trong `views/order.ejs`.

Ảnh bill khách upload sẽ được lưu vào `public/uploads/proofs`. Thư mục này có `.gitkeep` để giữ cấu trúc, còn ảnh upload thật đã được ignore trong `.gitignore` để tránh đẩy bill khách lên GitHub.

Khi gửi Discord webhook, nếu khách có upload bill thì embed sẽ kèm link/ảnh bill. Nếu không có ảnh, embed sẽ ghi `Khách chưa up ảnh`.

## Biến môi trường

```env
PORT=3000
SESSION_SECRET=change-this-secret
DISCORD_WEBHOOK_URL=
```

`DISCORD_WEBHOOK_URL` có thể để trống. Khi có đơn mới, app vẫn lưu đơn bình thường nếu webhook không được cấu hình.

## Bảo mật

Form đặt hàng không thu mật khẩu, token, mã 2FA hoặc thông tin đăng nhập nhạy cảm. Dữ liệu đơn hàng được lưu tại `data/orders.json`.
