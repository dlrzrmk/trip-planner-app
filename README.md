# Seyahat Planlayıcı (Trip Planner)

Arkadaşlarınla sıfırdan tatil planı oluşturabildiğin, harita üzerinde konum
işaretleyip gün gün program/ücret/saat girebildiğin, planı isimlendirip
kaydedip arkadaşlarınla paylaşabildiğin bir web uygulaması.

> Not: Bu, isteğin **planlama** kısmının ilk sürümü. "Seyahat deneyimlerini
> arkadaşlara aktarma" (sosyal akış / anı paylaşımı) kısmı ayrı bir ek olarak
> sonra eklenecek — bu sürümde yok.

## Özellikler

- E-posta/şifre ile hesap oluşturma ve giriş (JWT tabanlı oturum)
- Google Maps üzerinde arama + tıklayarak konum seçme
- Plan adı, toplam gün sayısı, para birimi
- Gün gün etkinlik ekleme: başlık, saat, ücret, konum, not
- Planı taslak/tamamlandı olarak işaretleme
- Planı düzenleme ve salt-okunur görüntüleme
- Arkadaşları e-posta ile davet edip "düzenleyici" veya "sadece görüntüleyici"
  yetkisiyle plana ortak etme (hesap tabanlı gerçek paylaşım — davet edilen
  kişi kendi hesabıyla giriş yapınca planı görür/düzenler)
- Paylaşılan planlarda ~8 saniyede bir otomatik yenileme, böylece diğer
  kişinin yaptığı değişiklikler kısa sürede görünür

## Mimari

- `server/` — Node.js + Express API, veritabanı olarak SQLite
  (`better-sqlite3`, tek dosyalık `data.sqlite`, ekstra kurulum gerektirmez)
- `client/` — React + Vite tek sayfa uygulaması, harita için
  `@react-google-maps/api`

## Kurulum

### 1) Google Maps API anahtarı alın

1. https://console.cloud.google.com/google/maps-apis adresine gidin, bir
   proje oluşturun (veya var olanı seçin).
2. **Maps JavaScript API** ve **Places API**'yi etkinleştirin.
3. "Credentials" (Kimlik bilgileri) bölümünden bir API anahtarı oluşturun.
4. Anahtarı, uygulamanızın çalışacağı alan adlarıyla (örn. `localhost`,
   sonradan gerçek domaininiz) kısıtlamanız önerilir.
5. Faturalandırmayı (billing) etkinleştirmeniz gerekir; Google her ay ücretsiz
   kullanım kotası sağlar, küçük ölçekli kullanım genelde ücretsiz kota
   içinde kalır.

### 2) Backend'i çalıştırın

```bash
cd server
cp .env.example .env
# .env içindeki JWT_SECRET değerini rastgele uzun bir metinle değiştirin
npm install
npm start
```

API varsayılan olarak `http://localhost:4000` adresinde çalışır.

### 3) Frontend'i çalıştırın

```bash
cd client
cp .env.example .env
# .env içine Google Maps API anahtarınızı yazın
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` adresini açın.

## Arkadaşlarla gerçekten paylaşmak için (deploy)

Uygulama şu an bilgisayarınızda (localhost) çalışıyor — bu haliyle sadece siz
erişebilirsiniz. Arkadaşlarınızın da plana gerçekten girip görebilmesi için
uygulamayı internete açık bir adrese **deploy** etmeniz gerekir. Basit ve
ücretsiz/uygun fiyatlı seçenekler:

- **Backend (`server/`)**: Render.com, Railway.app veya Fly.io — Node.js
  projelerini birkaç tıkla barındırırlar. `PORT`, `JWT_SECRET`,
  `CLIENT_ORIGIN` ortam değişkenlerini panelden ayarlayın.
- **Frontend (`client/`)**: Vercel veya Netlify — `npm run build` komutuyla
  oluşan statik dosyaları barındırır. `VITE_API_URL` ve
  `VITE_GOOGLE_MAPS_API_KEY` ortam değişkenlerini panelden ayarlayın ve
  `VITE_API_URL`'i backend'inizin deploy edilmiş adresine göre güncelleyin.

Deploy ettikten sonra backend'deki `.env` dosyasında `CLIENT_ORIGIN`
değerini frontend'inizin gerçek adresiyle güncellemeyi unutmayın (CORS
hatası almamak için).

> Not: Şu anki paylaşım "yaklaşık gerçek zamanlı" — sayfa her 8 saniyede bir
> kendini tazeliyor. Anlık (websocket tabanlı) gerçek zamanlı güncelleme
> istenirse sonraki adımda eklenebilir.

## Veri modeli (özet)

- `users` — hesap bilgileri
- `trips` — plan adı, toplam gün, genel konum, para birimi, durum
- `trip_items` — her gün için etkinlikler (başlık, saat, ücret, konum, not)
- `trip_members` — planı kimlerle, hangi yetkiyle (editor/viewer) paylaşıldığı

## Sıradaki adım (ayrı ek olarak konuşulan kısım)

Seyahat sırasında/sonrasında yaşanan deneyimleri (fotoğraf, not, anı) planla
ilişkilendirip arkadaşlara akış (feed) şeklinde gösterme özelliği bu sürümde
yok — ayrıca ele alınacak.
