# HƯỚNG DẪN THIẾT LẬP KHU VỰC BẮT ĐẦU — UMA GAMING DISCORD
## (DISCORD START HERE SETUP RUNBOOK)

---

## 1. Kiến trúc phân định trách nhiệm (Architecture & Tool Allocation)

Nhằm giữ cho hệ thống tinh gọn, ổn định và tập trung vào thế mạnh cốt lõi, cộng đồng **UMA GAMING** phân chia trách nhiệm rõ ràng giữa các công cụ:

| Công cụ / Nền tảng | Trách nhiệm được giao | Phạm vi TUYỆT ĐỐI KHÔNG can thiệp |
| :--- | :--- | :--- |
| **Discord Native** | • Cấu trúc kênh, danh mục (`Category`)<br>• Ma trận phân quyền (`Channel Permissions`)<br>• Tiêu đề chủ đề kênh (`Channel Topics`)<br>• Bảng nội quy chính thức & thông báo ghim | Không dùng bot can thiệp khi tính năng Discord đã đáp ứng tốt. |
| **Dyno Bot** | • Chào mừng thành viên mới (`Welcome Messages`)<br>• Thông báo thành viên rời (`Leave / Goodbye Notices`)<br>• Tự động kiểm duyệt cơ bản (`Auto-mod`, chống link rác, spam mentions) | Không can thiệp vào phòng thi đấu, giải đấu hay bốc thăm. |
| **TempVoice Bot** | • Quản lý các phòng thoại tạm thời tự động xóa khi trống | Chỉ xử lý Voice Channels; không tham gia Text/Giải đấu. |
| **UMA Tournament Bot** | • Đăng ký đội tuyển, duyệt đơn BTC, kiểm tra trùng UID<br>• Điểm danh, bốc thăm nhánh đấu (Single Elimination)<br>• Tạo và quản lý phòng thi đấu riêng tư (`Private Threads`)<br>• Báo cáo kết quả, lưu trữ ảnh bằng chứng, xử lý tranh chấp<br>• Đồng bộ kết quả công khai, lễ trao giải vô địch, lịch stream | **TUYỆT ĐỐI KHÔNG** làm các tính năng máy chủ chung (welcome, goodbye, auto-role, phân quyền voice). |

---

## 2. Cấu trúc danh mục 📌・BẮT ĐẦU

Khu vực cửa ngõ máy chủ được tổ chức thành đúng 3 kênh tinh gọn, sắc sảo, không tạo thêm kênh thừa:

```
📌・BẮT ĐẦU
  ├── 👋・chào-mừng
  ├── 📢・thông-báo
  └── 📜・nội-quy
```

### Tiêu đề chủ đề kênh (Channel Topics)

1. **`👋・chào-mừng`**:
   > `Chào mừng bạn đến với UMA GAMING — nơi hội tụ game thủ, tìm đồng đội và tranh tài tại Đấu Trường UMA.`

2. **`📢・thông-báo`**:
   > `Kênh phát ngôn và thông báo chính thức từ Ban Quản Trị UMA GAMING. Lịch thi đấu xem tại ĐẤU TRƯỜNG UMA.`

3. **`📜・nội-quy`**:
   > `Bộ quy tắc cộng đồng UMA GAMING — vui lòng đọc kỹ để cùng xây dựng sân chơi văn minh, lành mạnh và Fair Play.`

---

## 3. Ma trận phân quyền các kênh (Channel Permission Matrix)

| Vai trò / Đối tượng | `👋・chào-mừng` | `📢・thông-báo` | `📜・nội-quy` |
| :--- | :---: | :---: | :---: |
| **`@everyone`** (Thành viên) | Xem kênh: ✅<br>Xem lịch sử: ✅<br>Gửi tin nhắn: ❌<br>Tạo thread: ❌<br>Thêm reaction: ✅ | Xem kênh: ✅<br>Xem lịch sử: ✅<br>Gửi tin nhắn: ❌<br>Tạo thread: ❌<br>Thêm reaction: ✅ | Xem kênh: ✅<br>Xem lịch sử: ✅<br>Gửi tin nhắn: ❌<br>Tạo thread: ❌<br>Thêm reaction: ✅ |
| **Ban Quản Trị / Staff** | Toàn quyền quản trị kênh | Gửi tin nhắn: ✅<br>Đính kèm tệp: ✅<br>Ghim tin nhắn: ✅ | Gửi tin nhắn: ✅<br>Đính kèm tệp: ✅<br>Ghim tin nhắn: ✅ |
| **Dyno Bot** | Xem kênh: ✅<br>Gửi tin nhắn: ✅<br>Nhúng liên kết: ✅ | Xem kênh: ✅<br>Gửi tin nhắn: ❌ | Xem kênh: ✅<br>Gửi tin nhắn: ❌ |
| **TempVoice Bot** | Xem kênh: ❌ | Xem kênh: ❌ | Xem kênh: ❌ |
| **UMA Tournament Bot** | Xem kênh: ❌ | Xem kênh: ❌ | Xem kênh: ❌ |

---

## 4. Thiết lập Dyno — Chào mừng thành viên (Welcome Message)

### Vị trí cấu hình trên Dyno Dashboard
1. Truy cập [Dyno Dashboard](https://dyno.gg/manage).
2. Chọn máy chủ **UMA GAMING**.
3. Vào mục **Modules** → Chọn **Welcome**.
4. Chọn kênh phát tin: `#👋・chào-mừng`.
5. Đảm bảo bật: **Send message as an embed**.
6. Tùy chọn **Send when a user joins**: Bật.

### Cấu hình Embed Dyno

- **Title:** `🎉 CHÀO MỪNG ĐẾN UMA GAMING!`
- **Color:** `#FF4655` (Mã màu đỏ Esports năng động)
- **Thumbnail URL:** `{user.avatar}`
- **Description:**

```text
👋 Chào mừng {user} đã gia nhập **UMA GAMING**!

🔥 Anh em mới đã cập bến chiến tuyến!

🎮 **Tại UMA bạn có thể:**
• Tìm đồng đội & kết nối chiến hữu
• Giao lưu, chia sẻ kinh nghiệm chơi game
• Tham gia các sự kiện cộng đồng sôi động
• Tranh tài tại **Đấu Trường UMA**

📜 Nhớ đọc nội quy tại <#RULES_CHANNEL_ID> trước khi bắt đầu.
🏆 Đừng quên theo dõi khu vực **ĐẤU TRƯỜNG UMA** để cập nhật các giải đấu đỉnh cao.

👥 UMA hiện có **{membercount}** thành viên.

Chúc bạn có những trận game thật cháy cùng UMA! 🎮🔥
```

- **Footer:** `UMA GAMING • Play Together. Compete Together.`
- **Footer Icon:** Biểu tượng UMA hoặc để trống.

*(Lưu ý: Thay thế `<#RULES_CHANNEL_ID>` bằng mã mention thực tế của kênh `#📜・nội-quy` trong Discord, ví dụ `<#1435984350020898890>`)*

---

## 5. Thiết lập Dyno — Thông báo rời máy chủ (Goodbye / Leave Message)

### Vị trí cấu hình trên Dyno Dashboard
1. Trong mục **Modules** → **Welcome** trên Dyno.
2. Chọn tab / mục **Leave Messages** (hoặc kích hoạt thông báo rời).
3. Chọn kênh: `#👋・chào-mừng` (hoặc kênh log riêng của Staff nếu không muốn hiển thị công khai).
4. Thiết lập dạng Embed nhẹ nhàng, không gây ồn.

### Cấu hình Embed Dyno

- **Title:** `👋 HẸN GẶP LẠI`
- **Color:** `#72767D` (Xám slate trầm, trang nhã)
- **Description:**

```text
**{username}** vừa rời UMA GAMING.

Cảm ơn bạn vì đã từng đồng hành cùng cộng đồng.
Chúc bạn mọi điều tốt đẹp và hẹn gặp lại trên chiến trường! 🎮

Hiện tại cộng đồng còn **{membercount}** thành viên.
```

- **Footer:** `UMA GAMING`
- **Lưu ý bảo mật & an toàn:**
  - Tuyệt đối **không dùng `{user}`** trong Leave message để tránh lỗi ping hoặc ghost ping. Dùng biến `{username}`.
  - Không suy đoán lý do kick/ban. Giữ giọng văn lịch thiệp và tôn trọng.

---

## 6. Bảng nội quy chuẩn tại 📜・nội-quy (Discord Native)

Admin/Staff gửi một tin nhắn định dạng Embed hoặc Markdown trực tiếp vào kênh `#📜・nội-quy`, sau đó bấm **Ghim tin nhắn (Pin Message)**.

```markdown
# 📜 NỘI QUY CỘNG ĐỒNG UMA GAMING
Chào mừng bạn đến với **UMA GAMING**! Để xây dựng một sân chơi văn minh, công bằng và gắn kết cho mọi game thủ, tất cả thành viên vui lòng tuân thủ 8 điều quy định sau:

### 1️⃣ Tôn trọng thành viên
Không xúc phạm, miệt thị, công kích cá nhân, phân biệt đối xử, quấy rối hoặc cố tình gây mâu thuẫn, tranh cãi độc hại.

### 2️⃣ Không spam & quảng cáo trái phép
Không spam tin nhắn, emoji, mention vô cớ; không gửi liên kết mời tham gia máy chủ khác hoặc nội dung thương mại khi chưa có sự đồng ý của Ban Quản Trị.

### 3️⃣ Đúng kênh – đúng nội dung
Giao lưu đúng chủ đề kênh: trò chuyện chung, tìm team, chia sẻ kinh nghiệm và tôn trọng không gian phòng thoại.

### 4️⃣ Tinh thần Fair Play
Nghiêm cấm mọi hành vi hack, cheat, gian lận phần mềm, buff sao/elo hoặc cố tình phá hoại trận đấu trong mọi hoạt động của UMA.

### 5️⃣ Không scam, lừa đảo & mã độc
Tuyệt đối không chia sẻ liên kết độc hại (phishing, malware), lừa đảo mua bán tài khoản, nạp tiền hoặc phát tán phần mềm nguy hiểm.

### 6️⃣ Bảo vệ thông tin cá nhân
Nghiêm cấm hành vi tiết lộ thông tin cá nhân (doxxing), hình ảnh riêng tư hoặc dữ liệu bảo mật của người khác khi chưa được phép.

### 7️⃣ Tôn trọng quyết định điều hành
Tuân thủ sự hướng dẫn của Moderator và Ban Quản Trị. Khi xảy ra tranh chấp, vui lòng liên hệ BQT qua kênh hỗ trợ để được xử lý văn minh thay vì tranh cãi công khai.

### 8️⃣ Quy định Đấu Trường UMA
Khi tham gia các giải đấu chính thức do UMA tổ chức, vận động viên và đội trưởng phải tuân thủ nghiêm ngặt điều lệ riêng của từng giải đấu và quyết định của Trọng tài.

---
🛡️ *Việc tiếp tục tham gia UMA GAMING đồng nghĩa với việc bạn đồng ý tuân thủ toàn bộ quy định trên. Chúc anh em có những giờ phút chơi game thật vui và cháy hết mình!*
```

---

## 7. Giới thiệu chính thức tại 📢・thông-báo (Discord Native)

Admin/Staff gửi tin nhắn mở đầu định dạng trang trọng và bấm **Ghim (Pin Message)**:

```markdown
# 📢 THÔNG BÁO CHÍNH THỨC — UMA GAMING

Chào mừng anh em game thủ đến với kênh thông tin chính thức của **Ban Quản Trị UMA GAMING**.

Đây là kênh phát ngôn duy nhất dành cho:
• Các sự kiện, hoạt động và minigame cộng đồng
• Thông báo bảo trì, cập nhật tính năng và cơ cấu server
• Quyết định quan trọng từ Ban Quản Trị

---
🏆 **LƯU Ý VỀ KHU VỰC GIẢI ĐẤU:**
Mọi thông tin liên quan đến giải đấu UMA (thể thức, bảng đấu, phòng đấu riêng tư, lịch thi đấu, xác nhận kết quả và trao giải) được quản lý chuyên biệt tại khu vực **ĐẤU TRƯỜNG UMA** bởi **UMA Tournament Bot**.

🔔 *Anh em vui lòng bật thông báo cho kênh này để không bỏ lỡ các quyền lợi và thông tin quan trọng nhất từ BQT!*
```

---

## 8. Bảng biến số / Placeholders được Dyno hỗ trợ chính thức

Để tránh lỗi cú pháp, chỉ sử dụng các biến số Dyno sau:

| Biến Dyno | Ý nghĩa hiển thị | Ví dụ thực tế |
| :--- | :--- | :--- |
| `{user}` | Mention thành viên tham gia | `@ThànhViên` |
| `{username}` | Tên tài khoản (không ping) | `GamerPro99` |
| `{user.avatar}` | Đường dẫn ảnh đại diện avatar | `https://cdn.discordapp.com/avatars/...` |
| `{user.id}` | ID Discord của người dùng | `994820818993418240` |
| `{server}` | Tên máy chủ Discord | `UMA GAMING` |
| `{membercount}` | Tổng số thành viên trong máy chủ | `152` |

> [!WARNING]
> **Không sử dụng:** `{everyone}`, `{here}` trong welcome/leave message.
> **Không bịa đặt:** `{member_number}`, `{user.rank}`, `{user.level}` (Dyno không hỗ trợ các biến này trong module Welcome tiêu chuẩn).

---

## 9. Danh mục kiểm tra thủ công (Manual Verification Checklist)

- [ ] Phân quyền danh mục `📌・BẮT ĐẦU`: `@everyone` chỉ có quyền đọc (`ViewChannel` ✅, `SendMessages` ❌).
- [ ] Kênh `#👋・chào-mừng`: Cấp quyền `SendMessages` và `EmbedLinks` cho Dyno Bot.
- [ ] Kênh `#📢・thông-báo`: Chỉ cấp quyền gửi tin cho Staff / Admin. Đăng và ghim thông báo chào đầu.
- [ ] Kênh `#📜・nội-quy`: Chỉ cấp quyền gửi tin cho Staff / Admin. Đăng và ghim bảng 8 điều nội quy.
- [ ] Dyno Dashboard: Cấu hình Welcome Embed với biến `{user}`, `{membercount}` và thumbnail `{user.avatar}`.
- [ ] Dyno Dashboard: Cấu hình Leave Embed với biến `{username}` và `{membercount}` (không ping).
- [ ] Thử nghiệm với tài khoản phụ: Xác nhận tin nhắn chào mừng xuất hiện đẹp mắt, đầy đủ avatar và sĩ số, không xuất hiện ping thừa.
- [ ] Xác nhận UMA Tournament Bot không can thiệp, không lắng nghe sự kiện join/leave của máy chủ chung.
