# COLLECTION MONITORING PRO — Panduan pemasangan

## Status paket
Ini adalah **starter aplikasi yang dapat dipasang dan diuji**, bukan sistem produksi yang sudah tersambung ke database milik Anda. Sebelum digunakan dengan data nasabah sungguhan, selesaikan konfigurasi Supabase, uji akun admin/AO, dan uji backup.

## Isi paket
- `index.html`, `styles.css`, `app.js`: aplikasi web.
- `manifest.webmanifest`, `sw.js`: dukungan PWA dan cache shell aplikasi.
- `schema.sql`: struktur database dan kebijakan Row Level Security (RLS).
- `template_collection.xlsx`: template input admin.
- `config.js.example`: contoh konfigurasi Supabase.

## A. Siapkan Supabase
1. Buat project Supabase menggunakan akun/organisasi resmi perusahaan dan persetujuan pengelola TI/kepatuhan.
2. Buka SQL Editor, jalankan seluruh isi `schema.sql`.
3. Jalankan juga `seed_ao.sql` untuk mendaftarkan AO UUD, ADI, RIZAL, RADIT, dan NONAME.
4. Di Authentication > Providers, aktifkan Email/Password. Untuk aplikasi internal, matikan public sign-up.
5. Di Authentication > Users, buat akun admin dan akun masing-masing AO. Gunakan email kerja, password kuat, dan prosedur reset password resmi.
6. Catat UUID setiap pengguna dari daftar Users.
7. AO awal sudah dimasukkan oleh `seed_ao.sql`. Untuk menambah/mengubah AO, gunakan SQL Editor:
   ```sql
   insert into public.ao_team(name) values ('AO 01'),('AO 02');
   ```
   Ganti nama sesuai daftar AO resmi. Nama harus sama dengan kolom Nama AO di Excel.
8. Buat profil admin (ganti UUID dan nama):
   ```sql
   insert into public.profiles(user_id,full_name,role,ao_id)
   values ('UUID-AUTH-ADMIN','Admin Collection','admin',null);
   ```
9. Buat profil AO dengan UUID AO yang sesuai:
   ```sql
   insert into public.profiles(user_id,full_name,role,ao_id)
   select 'UUID-AUTH-AO','Nama AO 01','ao',id
   from public.ao_team where name='AO 01';
   ```
10. Pastikan semua tabel memiliki RLS aktif. Jangan pernah memakai `service_role` key di browser.

## B. Hubungkan aplikasi
1. Salin `config.js.example` menjadi `config.js`.
2. Isi `SUPABASE_URL` dan publishable/anon key dari Project Settings > API.
3. Pemanggilan `config.js` sudah disiapkan di `index.html`; cukup buat file tersebut dari contoh dan isi URL serta publishable/anon key.
4. Jangan mengunggah file konfigurasi berisi rahasia. Publishable/anon key memang dapat terlihat di browser; keamanan harus bergantung pada Auth + RLS. Jangan masukkan service_role key.

## C. Publikasikan di GitHub Pages
1. Buat repository privat jika kebijakan organisasi mengharuskan. GitHub Pages untuk repository privat bergantung pada paket/izin organisasi; jangan jadikan repository publik berisi data nasabah.
2. Unggah file aplikasi ke root repository.
3. Di Settings > Pages, pilih Deploy from a branch, branch `main`, folder `/root`.
4. Buka URL Pages melalui HTTPS. Login dan uji PWA.
5. Tambahkan ke layar utama Android melalui menu browser > Install app/Add to Home Screen.

## D. Format Excel
Gunakan `template_collection.xlsx`. Kolom wajib:
- Nama nasabah
- Nomor rekening
- Nama AO
- Angsuran
- Tanggal jatuh tempo
- Jumlah tunggakan
- Status pembayaran
- Kolektibilitas

Status Excel yang diterima: `Lunas`, `Bayar sebagian`, `Belum bayar`. Aplikasi menentukan label `Menunggak`, `Jatuh tempo hari ini`, atau `Belum jatuh tempo` berdasarkan tanggal jatuh tempo.
Tanggal jatuh tempo sebaiknya format tanggal Excel. Nomor rekening diformat sebagai **Text** agar angka nol di depan tidak hilang.
Setiap import menghasilkan snapshot berdasarkan tanggal laporan. Import ulang tanggal yang sama memperbarui snapshot tanggal itu; tanggal berbeda menjadi histori baru.

## E. Catatan penting sebelum produksi
- Aplikasi saat ini mengimpor data Excel ketika perangkat admin online. Data yang sudah pernah termuat dapat dibuka dari cache browser, tetapi sinkronisasi lintas perangkat membutuhkan internet.
- Browser offline tidak dapat mengambil perubahan Excel terbaru dari perangkat admin.
- Histori snapshot adalah histori posisi data yang diimpor, bukan bukti transaksi pembayaran individual. Untuk audit pembayaran per transaksi, tambahkan tabel transaksi pembayaran dan kolom tanggal/jumlah pembayaran.
- Status otomatis menunggak dihitung dari tanggal jatuh tempo dan status pembayaran. Pastikan definisi bisnis dan cut-off tanggal disetujui.
- Jangan memasukkan nama, nomor rekening, alamat, atau data nasabah sungguhan ke repository GitHub, log, atau contoh pengujian.
- Uji dengan data dummy. Minta persetujuan TI, keamanan informasi, dan kepatuhan perusahaan sebelum mengolah data nasabah nyata.
- Lakukan backup database berkala dan uji pemulihan.

## F. Batasan versi awal
- Login memakai email/password Supabase Auth (bukan PIN).
- Admin import Excel; AO hanya membaca data sesuai AO ID.
- Ekspor laporan dan histori transaksi pembayaran per transaksi belum termasuk versi awal.
- Library Supabase dan XLSX dimuat dari CDN saat online; cache aplikasi tidak menjamin kedua library tersedia saat offline pada kunjungan pertama.
