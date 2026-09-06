# MTSS · Öğrenci Takip Sistemi

Girişten sonra Kağıthane Nazmi Arıkan İlkokulu veya Kağıthane Atagen İlkokulu seçilir. İki okulun sınıfları, öğrencileri, formları, görüşmeleri ve Excel çıktıları birbirinden ayrı gösterilir. Gerçek öğrenci listeleri eklenene kadar her sınıfta 10 geçici örnek öğrenci vardır.

## Yerelde çalıştırma

Node.js 24 kullanın:

```powershell
npm ci
npm start
```

http://localhost:3000 adresini açın. `Baslat.cmd` de aynı uygulamayı başlatır. Ortam değişkenleri tanımlı değilse mevcut `data/rehberlik.sqlite` dosyası kullanılır; yerel kayıtlar silinmez. HTML dosyasını çift tıklamak sunucuyu başlatmaz.

Düzenleyici hesapları ve erişimleri:

- `ilaydahisarbeyli`: Her iki okul ve tüm kademeler.
- `tugbasaygi`: Yalnızca Kağıthane Nazmi Arıkan İlkokulunda Fen Bilimleri, anaokulu kademesi.
- `kubrakaban`: Yalnızca Kağıthane Nazmi Arıkan İlkokulunda Fen Bilimleri, 1. ve 2. sınıflar.
- `selinak`: Yalnızca Kağıthane Nazmi Arıkan İlkokulunda Fen Bilimleri, 3. ve 4. sınıflar.

Boş veritabanında İlayda hesabının ilk şifresi `123456` olur. İlk kurulum şifreleri `EDITOR_PASSWORD`, `TUGBA_EDITOR_PASSWORD`, `KUBRA_EDITOR_PASSWORD` ve `SELIN_EDITOR_PASSWORD` ortam değişkenleriyle değiştirilebilir. Bu değişkenler yalnızca veritabanında henüz bulunmayan hesabı oluştururken kullanılır; mevcut hesabın şifresini değiştirmez.

## Vercel'e dağıtım

1. Bu proje yapısının tamamını Git deposuna gönderin. Eski dağıtımdaki kök `app.cjs` ve eski `builds`/yönlendirme ayarlarını taşımayın. Tarayıcı kodu yalnızca `public/app.js` dosyasındadır.
2. Vercel projesinde Root Directory, bu `package.json` ve `vercel.json` dosyalarının olduğu klasör olsun. Framework Preset: **Other**, Node.js: **24.x**. Build Command: `npm run build`, Output Directory: `public` (ikisi de `vercel.json` içinde tanımlıdır). Eski dashboard komut override'larını kaldırın.
3. Kalıcı bir Turso veritabanı oluşturun. Vercel Settings → Environment Variables bölümüne `TURSO_DATABASE_URL` ve `TURSO_AUTH_TOKEN` ekleyin. URL `libsql://...` veya `https://...` biçiminde olmalıdır. Değerleri ihtiyaç duyulan Production/Preview ortamlarına tanımlayın; öğrenci kayıtlarını ayırmak için Preview'da ayrı veritabanı kullanın. Anahtarları Git'e veya tarayıcı dosyalarına koymayın.
4. İlk düzenleyici şifrelerini değiştirmek isterseniz ilk çalıştırmadan önce `.env.example` içinde belirtilen dört şifre değişkenini tanımlayın. Bu ayarlar veritabanında daha önce oluşturulmuş hesapların şifrelerini değiştirmez.
5. Yeniden deploy edin; eski build cache'ini kullanmadan dağıtın. Ana sayfa, `/app.js` ve `/api/session` yanıtlarını kontrol edin. İlk API isteği tabloları ve örnek öğrencileri bir kez oluşturur.

**Kalıcı veritabanı bağlantısı zorunludur.** Vercel dosya sistemi SQLite kayıtları için kalıcı/paylaşılan depolama sağlamaz. Geçici `/tmp` veritabanı kullanmak kayıtları ve oturumları kaybettirir; bu uygulama böyle bir geri dönüş yapmaz. Bağlantı değişkenleri eksikse statik giriş ekranı açılır, API yapılandırma açıklamasıyla `503` döndürür. Bu, çalışan bir dağıtım olarak değerlendirilmemelidir; iki bağlantı değişkenini tanımlayıp yeniden deploy etmek gerekir.

Yerel veritabanınız otomatik olarak internete yüklenmez. Vercel'deki veritabanı ayrıdır; yerelde önceden girilmiş gerçek kayıtların ayrıca aktarılması gerekir. Aynı uzak veritabanıyla yerel çalışmayı denemek için `.env.example` dosyasını `.env` olarak kopyalayıp bağlantı değerlerini oraya yazabilirsiniz.

## Dosya yapısı

- `public/index.html`: mevcut MTSS görünümü ve stilleri.
- `public/app.js`: yalnızca tarayıcıda çalışan DOM kodu. Node.js tarafından import edilmez.
- `api/index.mjs`: Vercel'in çalıştırdığı sunucu fonksiyonu; port dinlemez.
- `server/handler.cjs`: yerel sunucunun ve Vercel'in paylaştığı API/yetki mantığı.
- `server/database.cjs`: yerelde SQLite, Vercel'de HTTP üzerinden Turso/libSQL.
- `server/local.cjs`: yerel HTTP sunucusu ve statik dosya servisi.
- `seed.cjs`: okul, sınıf, geçici öğrenci ve öğretmen tanımları.
- `vercel.json`: yalnızca `public` dizinini statik yayınlar; `/api/*` isteklerini API fonksiyonuna gönderir. `/preview.html` adresi korunur.
- `original-preview.html`: ilk prototipin arşivi; Vercel'e yayınlanmaz.

## Korunan işlevler

Misafirler öğrenci profillerini görüntüler; Gözlem Formu ile 21 ölçütlü MTSS Öğrenci Takip Formuna yanıt ekleyebilir. Gözlem Formu; gözlem türünü, gözlemin ne zamandır ve ne sıklıkta yapıldığını, daha önce uygulanan yaklaşımı ve değerlendirmeyi kaydeder. MTSS Öğrenci Takip Formundaki her ölçüt 1–4 veya G seçeneğiyle tek tıklamayla işaretlenir; kaydedilen yanıtlarda soru metniyle puanın açıklaması birlikte gösterilir. Düzenleyici, Tüm Değerlendirmeler ekranında formları ayrı ayrı seçebilir ve seçili forma özel Excel çıktısı alabilir. Excel'de her doldurulan form tek satırdır; MTSS ölçütlerinin cevapları aynı satırdaki ayrı sütunlarda yer alır. Misafirler kaydedilmiş form yanıtlarını, Tüm Değerlendirmeler ekranını ve Excel çıktısını göremez. Kişisel bilgileri yalnızca düzenleyici değiştirir. Öğrenci ve veli görüşmelerini yalnızca düzenleyici okuyabilir, ekleyebilir ve silebilir; misafirlere veya Excel çıktısına gönderilmez.

Oturumlar 8 saat geçerlidir. Sınırlı düzenleyicilerin yetkileri öğrenci profili, kayıtlı form yanıtı, görüşme ve Excel uçlarında sunucu tarafından sınıf bazında doğrulanır. Oturumlar ve giriş deneme sınırı paylaşılan veritabanındadır; yeniden başlatma veya başka Vercel fonksiyon örneği oturumu kaybettirmez. Çıkış, oturumu tüm örnekler için iptal eder. Vercel çerezleri `HttpOnly`, `SameSite=Strict` ve `Secure` kullanır.

## Kontroller

```powershell
npm run build
npm test
```

Testler geçici veritabanı kullanır. Yerel sunucu ve gerçek Vercel API export'u üzerinden giriş, misafir yetkileri, profil düzenleme, iki gözlem formu, iki görüşme türü, silme, Excel ve yeniden başlatma sonrası kayıt/oturum kalıcılığı kontrol edilir. Vercel test sunucusu rewrite ve önceden ayrıştırılmış JSON gövdesini taklit eder; gerçek bulut dağıtımının yerine geçmez. Uzak Turso bağlantısını canlı doğrulamak için ilgili ortam değişkenleri gerekir.

Referanslar: [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js), [Vercel yapılandırması](https://vercel.com/docs/project-configuration/vercel-json), [Vercel SQLite kısıtı](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel), [Turso HTTP istemcisi](https://docs.turso.tech/sdk/http/quickstart).
