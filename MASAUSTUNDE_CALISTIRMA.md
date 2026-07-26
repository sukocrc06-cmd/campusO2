# CampusO'yu Windows masaüstünde çalıştırma

## 1. Gerekli programlar

- Node.js 22.13 veya daha yeni bir sürüm
- Visual Studio Code (önerilir)

## 2. Projeyi açma

1. `CampusO_Masaustu_Paketi.zip` dosyasını masaüstüne çıkarın.
2. Çıkarılan `CampusO_Masaustu_Paketi` klasörünü Visual Studio Code ile açın.
3. Visual Studio Code içinde **Terminal > New Terminal** seçeneğine tıklayın.

## 3. Bağımlılıkları kurma

Terminalde aşağıdaki komutu çalıştırın:

```powershell
npm install
```

## 4. Siteyi başlatma

Kurulum bittikten sonra:

```powershell
npm run dev
```

Terminalde gösterilen yerel adresi tarayıcıda açın. Genellikle:

```text
http://localhost:5173
```

Terminal farklı bir port gösterirse ekrandaki adresi kullanın.

## 5. Siteyi durdurma

Terminal açıkken `Ctrl + C` tuşlarına basın.

## Önemli

- `node_modules` klasörü pakete eklenmemiştir; `npm install` komutu bu klasörü bilgisayarınızda yeniden oluşturur.
- Yayındaki CampusO sitesi bu paketten bağımsız olarak çalışmaya devam eder.
- Ana sayfa kodu `app/page.tsx`, genel tasarım kodu ise `app/globals.css` dosyasındadır.
