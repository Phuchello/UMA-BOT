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
      .setName('status')
      .setDescription('Xem thống kê và tiến độ giải đấu hiện tại')
  );
