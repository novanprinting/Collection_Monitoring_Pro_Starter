# COLLECTION CONTROL PRO — Panduan instalasi

## Paket ini berisi
- PWA web app (index.html, app.js, style.css)
- Supabase schema (schema.sql)
- Konfigurasi koneksi (config.js)
- Manifest, service worker, ikon aplikasi

## A. Siapkan Supabase
Proyek yang direncanakan:
`https://jhvicoeixhgmlxjgeast.supabase.co`

1. Buka Supabase Dashboard > SQL Editor.
2. Buka file `schema.sql`, salin seluruh isinya, lalu jalankan sekali.
3. Buka Authentication > Users, buat akun admin menggunakan email dan password.
4. Ambil UUID akun admin dari Authentication > Users.
5. Di SQL Editor jalankan:
```sql
insert into public.profiles(id,full_name,role)
values ('UUID_ADMIN','Administrator','admin');
```
6. Buka Project Settings > API Keys. Salin **Publishable key** (bukan Secret key/service_role).
7. Buka `config.js`, ganti `ISI_PUBLISHABLE_KEY_SUPABASE_DI_SINI` dengan Publishable key.

## B. Deploy ke GitHub Pages
1. Ekstrak ZIP ini.
2. Upload seluruh isi folder (bukan folder induknya) ke repository `Collection_Monitoring_Pro_Starter` branch `main`.
3. Pastikan `index.html` berada di root repository.
4. GitHub > Settings > Pages > Deploy from a branch > `main` > `/ (root)` > Save.
5. Tunggu deployment selesai. URL Pages biasanya `https://novanprinting.github.io/Collection_Monitoring_Pro_Starter/` (ikuti URL yang ditampilkan GitHub).

## C. Login dan buat profil PIC
1. Login menggunakan akun admin.
2. Master PIC awal: UUD, ADI, RIZAL, RADIT, NONAME.
3. Buat akun Auth untuk setiap PIC di Supabase Authentication > Users.
4. Kaitkan akun dengan PIC melalui SQL Editor, contoh:
```sql
insert into public.profiles(id,full_name,role,pic_id)
select 'UUID_AO','Nama AO','pic',id
from public.pic_master where pic_code='UUD';
```
5. Untuk pimpinan, gunakan role `pimpinan` dan `pic_id` NULL.

## D. Format file Excel
### Nominatif
Header yang didukung: `PIC`, `NO_CIF`, `KOLEK`, `NOREKENING`, `NAMA`, `PLAFOND`, `BAKIDEBET`, `ANGSURPK`, `ANGSURBUNGA`, `ANGSURAN`, `TGTPOKOK`, `TGTBUNGA`, `HR_TGKP`, `HR_TGKB`, `STATUS`.
Baris data harus memiliki `NOREKENING` dan PIC yang sudah terdaftar. Nominatif kredit + WO boleh satu workbook/sheet; nilai KOLEK `WO` dikenali sebagai WO; kolek 3, 4, 5 masuk NPL; kolek 1 dan 2 dicatat sebagai LANCAR (tidak dijumlahkan sebagai NPL). Untuk penandaan WO dengan kolom lain, pastikan kolom `PORTFOLIO` bernilai `WO`.

### Pembayaran
Header didukung: `ID TRANSAKSI` (atau `NO_SLIP` sebagai fallback), `NO_REK`, `KONDISI HB`, `JNS_PRODUK`, `NAMA`, `KETERANGAN`, `ANGSURAN`, `NILAI_DEBET`, `NILAI_KREDIT`, `ANGS_POKOK`, `ANGS_BUNGA`, `ANGS_DENDA`, `PENALTI`, `TGL_TRANS`, `TGL_EFEKTIF`, `KOLEK`.
Setiap transaksi harus mempunyai identitas transaksi yang stabil dan unik. Bila ID TRANSAKSI tidak tersedia, NO_SLIP dipakai sebagai fallback dan harus unik. Pembayaran memerlukan riwayat penugasan rekening pada TGL_TRANS; transaksi tanpa PIC tidak disimpan dan harus diperiksa admin.

## E. Atribusi PIC dan pergantian PIC
- Saat import nominatif, sistem membuat riwayat penugasan dengan tanggal awal periode (tanggal 1).
- Saat ada perpindahan PIC di tengah bulan, admin harus menambahkan penugasan baru dengan tanggal mulai yang tepat dan mengakhiri penugasan sebelumnya sehari sebelum tanggal mulai baru.
- Recovery transaksi menggunakan PIC yang berlaku pada `TGL_TRANS`.
- PIC snapshot transaksi tidak berubah jika rekening pindah PIC setelah transaksi.

## F. Catatan versi awal
- Aplikasi membutuhkan internet untuk login, sinkronisasi Supabase, dan memuat library Excel. Shell PWA dapat dibuka offline setelah pernah dimuat, tetapi data cloud memerlukan internet.
- Replace nominatif hanya untuk periode terpilih dan dijalankan melalui fungsi database atomik (gagal berarti perubahan tidak disimpan). Transaksi pembayaran di-append dan duplikat dicegah dengan unique ID transaksi.
- Jalankan uji coba dengan salinan data terlebih dahulu. Pastikan backup sebelum import nominatif pertama.
- Untuk data produksi, lakukan verifikasi pemetaan kolom dan hasil total terhadap laporan sumber sebelum digunakan sebagai dasar keputusan operasional.
