# Komisi Account Manager & Sales Manager 2026

Dokumen ini fokus pada **aturan bisnis perhitungan komisi**.

## Aturan dan Perhitungan Komisi Sales & Manager

### 1. Dasar Pengenaan Komisi & Penalti (Base Commission)

- **Commission Basis**: Jika tipe referral pelanggan adalah `Cashback` atau `Monthly`, dasar pengenaan komisi adalah `Subscription - Referral Fee`. Selain dari tipe itu, dasar komisi dihitung full dari `Subcription`.
- **Penalti Persentase (Percentage Deductions)**: Dasar Komisi dikurangi oleh penalti berikut sebelum dikalikan rate komisi:
  1. **Late Payment Penalty (Keterlambatan Pelunasan)**:
     - Berlaku untuk **semua jenis invoice** (New, Recurring, Upgrade, Prorate, dll).
     - Potongan **10% per bulan** keterlambatan (`late_month`), maksimal **50%**.
     - **Pengecualian**: Penalti ini **TIDAK BERLAKU** jika invoice ditandai sebagai disetujui (`is_approved == true`) di database.
  2. **Performance Penalty (Gagal Target Aktivitas)**:
     - Berlaku khusus untuk pegawai berstatus **Permanent** pada layanan tipe **New** (Pemasangan Baru).
     - Jika New Achievement < 12, maka dikenakan penalti sebesar **70%** (Sales hanya mendapatkan komisi dari 30% Dasar Komisi).
     - **Pengecualian**: Produk tipe **Prorate**, **Upgrade**, dan **Recurring** dibebaskan dari penalti performa ini (langsung mengambil Dasar Komisi tanpa potongan 70%).
- **Base Commission (Dasar Komisi Akhir)**: Dihitung dengan rumus:
  `Base Commission = Commission Basis * (1 - Total Persentase Penalti)`.

### 2. Aturan Komisi Sales

**A. Kategori Layanan "Home"**

- **Prorate (Prorata)**: Komisi flat **10%** dari Base Commission.
- **Upgrade**: Komisi berdasarkan rate `Service ID` dan durasi kontrak. Bebas dari penalti performa 70%.
- **Recurring (Langganan Berulang)**:
  - Bebas dari penalti performa 70%.
  - Persentase Komisi:
    - **0.5%**: Jika Sales berstatus **Permanent** dan gagal target (< 12 activity).
    - **1.5%**: Jika Sales berstatus **Probation** ATAU Sales Permanent yang **capai target** (>= 12 activity).
  - **⚠️ Pengecualian NusaSelecta**: Invoice **recurring** untuk paket NusaSelecta (`NFSP030`, `NFSP100`, `NFSP200`) **TIDAK dihitung sama sekali** — difilter langsung di query (`getSnapshotBySales`). Jadi paket NusaSelecta **tidak menerima komisi recurring**, hanya komisi New/Upgrade/Prorate.
- **New (Pemasangan Baru)**: Persentase komisi ditentukan dari `Service ID` dan lama masa kontrak (`months`). Dikenakan penalti performa 70% jika Sales Permanent gagal target.

**Tabel Rate Komisi (New & Upgrade):**

- **Nusafiber (BFLITE)**: 1 bln (28.38%), 6 bln (6.55%), 12 bln (5.09%)
- **NusaFiber (NFSP030, NFSP100)**: < 6 bln (20.00%), 6 bln (5.56%), 12 bln (4.44%)
- **NusaFiber (NFSP200)**: < 6 bln (26.00%), 6 bln (6.00%), 12 bln (4.67%)
- **Home100, HomeSTD100**: 1 bln (28.57%), 6 bln (5.95%), 12 bln (4.76%)
- **HomeADV200, HomeADV**: 1 bln (27.78%), 6 bln (5.56%), 12 bln (4.63%)
- **HomePrem300**: 1 bln (31.25%), 6 bln (6.25%), 12 bln (5.21%)
- **LITE100**: 1 bln (27%), 6 bln (5.56%), 12 bln (4.63%)
- **LITE100**: 1 bln (28%), 6 bln (5.95%), 12 bln (4.76%)

> **⚠️ Batas tier durasi kontrak (`months`) berbeda antar service** — lihat `getCommissionRates()` di `commission.helper.ts`:
>
> - **NusaSelecta (`NFSP030/100/200`)**: rate 6-bulan baru dipakai bila `months >= 6`. Kontrak 2–5 bulan tetap pakai rate **1 bulan** (kolom `< 6 bln`).
> - **Service lain (BFLITE, HOME\*, LITE\*)**: rate 6-bulan dipakai bila `months > 1`. Artinya kontrak **2–11 bulan** langsung memakai rate **6 bulan**; rate "1 bln" hanya berlaku untuk kontrak tepat 1 bulan.
> - Rate 12-bulan dipakai bila `months >= 12` untuk semua service.
>
> **⚠️ Service tanpa entri rate → komisi 0%**: Query crawl menarik service `CBSHM, HOME30, HOME50, HOME300, BOOSTER100, BOOSTER200, BOOSTER300`, **tetapi service ini TIDAK punya rate** di `getCommissionRates()`. Untuk tipe `new`/`upgrade`, `commissionPercentage` mereka = **0** sehingga **tidak menghasilkan komisi** (kecuali lewat jalur prorate 10%, recurring, setup/alat). Hanya service yang tercantum di tabel rate di atas yang menghasilkan komisi New/Upgrade.

**B. Kategori Layanan Lainnya ("Setup" & "Alat")**

- **Setup**: Komisi flat **5%**.
- **Alat**:
  - Jika pembelian alat dibundel bersamaan dengan Setup pemasangan pelanggan: komisi **2%**.
  - Jika pembelian alat tersendiri (standalone): komisi **1%**.

_Total Pembayaran Komisi Sales (per item) = `Base Commission` x `Persentase Komisi` / 100._

---

### 3. Perhitungan New Achievement

Pencapaian "New Achievement" didasarkan khusus pada produk tipe baru (New) setelah dikurangi **Churn**.

- **Layanan standar** (selain NusaSelecta): 1 Pelanggan Baru = 1 New Achievement.
- **Layanan NusaSelecta** (`NFSP030`/Basic 30, `NFSP100`/Prime 100, `NFSP200`/Ultra 200) — dihitung dengan aturan pengelompokan berikut (lihat `calculateNusaSelectaActivity` di `commission.helper.ts`):
  1. Setiap **3 unit** Basic 30 (`NFSP030`) dan/atau Prime 100 (`NFSP100`) = **1 Achievement** (berlaku kelipatan).
  2. Setiap **2 unit** Ultra 200 (`NFSP200`) = **1 Achievement** (berlaku kelipatan).
  3. **Kombinasi sisa**: apabila tersisa **2 unit** Basic/Prime **dan** **1 unit** Ultra 200, kombinasi ketiga unit tersebut = **1 Achievement**.
  4. Sisa unit yang **tidak** memenuhi ketentuan di atas **tidak** dihitung ke target bulanan — komisinya tetap dibayar, tapi tidak menambah New Achievement.

  > **Contoh:** 5 Basic + 3 Ultra → `floor(5/3)=1` + `floor(3/2)=1` = 2, lalu sisa `2 Basic + 1 Ultra` → +1 = **3 Achievement**. (Aturan lama: Basic/Prime per 2, Ultra 200 dihitung 1:1 — kini sudah tidak berlaku.)

- **Deduction (Churn)**:
  - Setiap pelanggan yang berhenti berlangganan (Churn) dan tidak disetujui pembatalannya akan **mengurangi** unit pada bucket yang sesuai (Basic/Prime, Ultra, atau standar) **sebelum** pengelompokan dihitung.
- **New Achievement (Net)**: dihitung dari unit **net** (setelah churn). Hasil inilah yang menentukan Achievement Goal dan Rate Recurring.

> **Catatan implementasi:** Angka **NET** (setelah churn) dipakai untuk `activityCount` (penentu target), sedangkan angka **GROSS** dipakai untuk kolom `count` tampilan tabel — keduanya memakai rumus pengelompokan yang sama. Untuk NusaSelecta, `count` di tabel = jumlah **Achievement**, bukan jumlah unit.

---

### 4. Churn & Deductions

Setiap record Churn yang masuk (dan bukan `is_approved`) akan mengurangi total pendapatan sales pada periode tersebut:

- **Count**: Mengurangi New Achievement (mempengaruhi target).
- **MRC**: Mengurangi total MRC bulanan.
- **Commission**: Mengurangi total komisi (Dihitung setara rate 'New' pada target 12).
- **Subscription**: Mengurangi total volume penjualan.

**⚠️ Syarat eligibilitas Churn** (difilter di query `getChurnbyDateRange`, `is.service.ts`) — tidak semua pelanggan berhenti dihitung sebagai churn. Sebuah record baru dianggap churn bila memenuhi **semua** syarat berikut:

1. Status pelanggan `CustStatus = 'NA'` (non-aktif).
2. Tanggal berhenti (`CustUnregDate`) berada dalam **periode berjalan**.
3. **Berhenti ≤ 1 tahun sejak registrasi** (`CustUnregDate <= CustRegDate + 1 tahun`). Pelanggan yang berhenti setelah > 1 tahun **tidak** dihitung sebagai churn.
4. Pelanggan **pernah memiliki minimal 1 invoice** (`HAVING TotalInvoice > 0`).
5. Berada dalam cakupan cabang yang valid (lihat _Cakupan Data_ di bawah).

**Perhitungan nominal churn per record:**

- `price = (Subscription − Discount) / periode(bulan)`, minimal periode 1.
- `MRC churn = price / periode`.
- `Commission churn` dihitung memakai `calculateCommission` dengan asumsi kategori `home`, tipe `new`, dan `activityCount = 12` (dianggap capai target, tanpa penalti performa & tanpa late penalty).

---

### 5. Level Prestasi (Achievement) & Skema Bonus Sales

**A. Status Pegawai Permanent**

- `>= 15 aktivitas` : **Capai target Bonus** _("Congratulations on your outstanding achievement!")_
- `12 - 14 aktivitas` : **Capai target** _("Bravo! Keep up the great work!")_
- `3 - 11 aktivitas` : **Tidak Capai target** _("Just a little more fights, go on!")_
- `< 3 aktivitas` : **SP1** _("Keep fighting and don't give up!")_

**B. Status Pegawai Probation / Contract**

- `>= 8 aktivitas` : **Excellent**
- `5 - 7 aktivitas` : **Very Good**
- `3 - 4 aktivitas` : **Average**
- `< 3 aktivitas` : **Below Average**

**C. Skema Bonus Uang Tambahan (Dibayarkan dari total New Achievement bulanan)**

- `New Achievement > 20` : **Rp 1.500.000** + _(Setiap kelipatan di atas 20 dinilai ekstra Rp 150.000)_
- `New Achievement = 20` : **Rp 1.500.000**
- `New Achievement 17 - 19` : **Rp 1.000.000**
- `New Achievement 15 - 16` : **Rp 500.000**
- `New Achievement < 15` : Tidak ada bonus pendanaan bulanan ekstra.

---

### 6. Komisi & Performa Manager Area

**A. Persentase Performa Bulanan Manager (Achievement Percentage)**

- **Target Total Tim** = `Jumlah Pegawai Permanent Tim x 12 (karena minimal aktivitas adalah 12)`.
- **Persentase Capaian** = `(Total Activity Semua Anggota Tim / Target Total Tim) x 100%`.
- Jika tidak ada pegawai Permanent satupun dalam tim: Target dianggap 100% (kalau ada tim probation) atau 0% (kalau tim kosong).

**B. Ambang Batas Target Tim (Target Threshold)**
Status "Capai Target" Manager bersifat dinamis mengikuti total anggota tim di bawah binaannya:

- Bawahan 1 orang = Target **120%** minimum
- Bawahan 2 orang = Target **115%** minimum
- ...
- Bawahan 5 orang = Target **100%** minimum
- ...
- Bawahan >= 10 orang = Target hanya **85%** minimum

**C. Komisi New (Akuisisi Pelanggan Baru dari Tim)**
Manager mengambil komisi overriding yang diproses dari total "New Commission" uang pegawainya sebulan, dipotong berdasarkan capaian target:

- Jika Capaian `>= 150%` = Manager dikalikan **60%** dari kue New Commission.
- Jika Capaian `>= 125%` = Manager dikalikan **50%**.
- Jika Capaian `>= 100%` = Manager dikalikan **40%**.
- Jika Capaian `>= 50%` = Manager dikalikan **25%**.
- Jika Capaian `< 50%` = Manager mendapatkan **0%** bagian dari produk New.

**D. Komisi Recurring (Pemasukan Berulang dari Tim)**
Dihitung flat bulanan sebagai overriding insentif pendapatan pasif:

- Apabila Manager berstatus **Capai Target**, Rate Recurring Manager adalah **0.90%** dari total uang _Recurring Subscription_ timnya.
- Apabila Manager berstatus **Tidak Capai Target**, Rate Recurring diturunkan menjadi **0.50%** dari total pengumpulan langganan anggota timnya.

_Total Komisi Manager akhir bulan = `Total Overriding Komisi New` + `Komisi Overriding Recurring`._
_Semua perhitungan Manager menggunakan angka **NET** (setelah dikurangi churn dan penalti masing-masing anggota tim)._

**E. Cakupan Anggota Tim yang Dihitung**

- **⚠️ Anggota tanpa `status_period` dilewati**: Dalam perhitungan manager, anggota tim yang **belum memiliki catatan status** (Permanent/Probation) untuk periode tersebut akan **dilewati sepenuhnya** (`if (!status) continue;`) — tidak masuk hitungan target tim, tidak masuk komisi tim, dan tidak muncul di rincian. Pastikan `employee.crawl` sudah dijalankan agar `status_period` tiap anggota terisi sebelum periode dihitung.
- **Cakupan tim**: hierarki tim ditarik rekursif (`getHierarchy`) dan hanya mencakup pegawai dengan `has_dashboard = true`.

---

### Hierarki Pegawai (Employee Crawl)

Proses ini berjalan pada (`src/crawl/employee.crawl.ts`) dan menunjang keabsahan _target komisi dan besaran tier persentase_:

- **Sinkronisasi Endpoint Eksternal**: Sistem memanggil API dari layanan SDM (Nusawork) untuk mengambil data terbaru dari Pegawai level _Sales_ maupun level pendukung _Admin_.
- **Catatan Historis Kontrak Pegawai**: Seluruh pegawai akan di-insert, dan untuk Sales diberikan log _Status Period (Permanent, Probation, Contract, dll)_ atas periode berjalan tersebut. Hal ini guna memastikan jika ada karyawan kontrak yang promosi (menjadi permanen) di bulan depan, perhitungan komisi di masa periode komisi ini tidak berubah dan tetap mengacu pada _status kontrak saat periode berjalan tersebut_.
