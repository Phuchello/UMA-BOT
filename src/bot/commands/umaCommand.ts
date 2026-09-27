import { SlashCommandBuilder } from 'discord.js';

export const umaCommand = new SlashCommandBuilder()
  .setName('uma')
  .setDescription('Các chức năng điều hành và tham gia giải đấu UMA CUP')
  .addSubcommand(sub =>
    sub
      .setName('panel')
      .setDescription('Xuất bảng đăng ký giải đấu (Dành cho Ban Tổ Chức)')
  )
  .addSubcommand(sub =>
    sub
      .setName('teams')
      .setDescription('Xem danh sách tất cả các đội đã đăng ký và đã duyệt')
  )
  .addSubcommand(sub =>
    sub
      .setName('my-team')
      .setDescription('Xem thông tin và chỉnh sửa đơn đăng ký đội của bạn')
  )
  .addSubcommand(sub =>
    sub
      .setName('status')
      .setDescription('Xem thống kê và tiến độ giải đấu hiện tại')
  )
  .addSubcommand(sub => sub.setName('checkin-open').setDescription('Khóa đăng ký và mở check-in (BTC)'))
  .addSubcommand(sub => sub.setName('check-in').setDescription('Đội trưởng điểm danh đội đã được duyệt'))
  .addSubcommand(sub => sub.setName('checkins').setDescription('Xem tình hình điểm danh đội'))
  .addSubcommand(sub => sub.setName('draw').setDescription('Bốc thăm nhánh đấu cho đội đã check-in (BTC)'))
  .addSubcommand(sub => sub.setName('bracket').setDescription('Xem nhánh đấu UMA CUP')
  )
  .addSubcommand(sub => sub.setName('start').setDescription('Bắt đầu vận hành giải đấu (BTC)'))
  .addSubcommand(sub => sub.setName('match-referee').setDescription('Gán trọng tài cho trận (BTC)')
    .addIntegerOption(option => option.setName('round').setDescription('Số vòng').setRequired(true).setMinValue(1))
    .addIntegerOption(option => option.setName('match').setDescription('Số trận trong vòng').setRequired(true).setMinValue(1))
    .addUserOption(option => option.setName('referee').setDescription('Trọng tài Discord').setRequired(true)))
  .addSubcommand(sub => sub.setName('rooms-create').setDescription('Tạo phòng riêng cho các trận sẵn sàng (BTC)'))
  .addSubcommand(sub => sub.setName('match-schedule').setDescription('Lên lịch trận theo giờ Việt Nam (BTC)')
    .addIntegerOption(option => option.setName('round').setDescription('Số vòng').setRequired(true).setMinValue(1))
    .addIntegerOption(option => option.setName('match').setDescription('Số trận trong vòng').setRequired(true).setMinValue(1))
    .addStringOption(option => option.setName('time').setDescription('YYYY-MM-DD HH:mm, giờ Việt Nam').setRequired(true)))
  .addSubcommand(sub => sub.setName('matches').setDescription('Xem trạng thái các trận đấu')
  )
  .addSubcommand(sub => sub.setName('report-result').setDescription('Báo kết quả BO3 trong phòng trận')
    .addIntegerOption(option => option.setName('my-score').setDescription('Số ván đội bạn thắng').setRequired(true).setMinValue(0).setMaxValue(2))
    .addIntegerOption(option => option.setName('opponent-score').setDescription('Số ván đối thủ thắng').setRequired(true).setMinValue(0).setMaxValue(2))
    .addAttachmentOption(option => option.setName('evidence').setDescription('Ảnh chụp kết quả').setRequired(true)))
  .addSubcommand(sub => sub.setName('result-resolve').setDescription('Trọng tài xử lý kết quả tranh chấp')
    .addIntegerOption(option => option.setName('team1-score').setDescription('Số ván Team A thắng').setRequired(true).setMinValue(0).setMaxValue(2))
    .addIntegerOption(option => option.setName('team2-score').setDescription('Số ván Team B thắng').setRequired(true).setMinValue(0).setMaxValue(2))
    .addStringOption(option => option.setName('reason').setDescription('Lý do xử lý').setRequired(true).setMinLength(3).setMaxLength(500)))
  .addSubcommand(sub => sub.setName('result-refresh').setDescription('Làm mới thẻ trận/kết quả từ dữ liệu đã lưu (BTC/trọng tài)'))
  .addSubcommand(sub => sub.setName('results').setDescription('Xem kết quả chính thức')
  );
