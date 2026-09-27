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
  );
