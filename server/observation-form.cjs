const rubricScale = [
  { value: '1', label: 'Destekle Deneyimliyor', help: 'Davranışı çoğunlukla yetişkin desteğiyle gösteriyor.' },
  { value: '2', label: 'Geliştiriyor', help: 'Bazı durumlarda gösterebiliyor ancak henüz tutarlı değil.' },
  { value: '3', label: 'Bağımsız Sergiliyor', help: 'Çoğu durumda yetişkin desteği olmadan gösteriyor.' },
  { value: '4', label: 'Tutarlı ve Aktarıyor', help: 'Farklı ders, ortam ve kişilerle de kullanıyor.' },
  { value: 'G', label: 'Gözlenmedi', help: 'Yeterli gözlem fırsatı olmadığı için değerlendirilmedi.' }
];

const rubricCriteria = [
  { code: 'A1', section: 'A', area: 'Hazır Bulunuşluk ve Okul Olgunluğu', behavior: 'Sınıf rutinlerine katılır ve verilen yönerge doğrultusunda öğrenme sürecine başlayabilir.', prompt: 'Sınıfa uyum sağlıyor mu? Yönerge sonrası ne yapacağını biliyor mu? Materyalini hazırlayabiliyor mu? Geçişlerde yoğun yetişkin desteğine ihtiyaç duyuyor mu?' },
  { code: 'A2', section: 'A', area: 'Temel Taşıyıcı Beceriler', behavior: 'Yaşına uygun okuma anlama, sözlü ve yazılı ifade ile temel matematik becerilerini kullanır.', prompt: 'Okuduğunu anlayabiliyor mu? Düşüncesini sözlü ifade edebiliyor mu? Yazma veya motor becerileri çalışmasını engelliyor mu? Temel sayı ve işlem becerilerini kullanabiliyor mu?' },
  { code: 'A3', section: 'A', area: 'Ders Bazlı Güncel Performans', behavior: 'Derse katılır, verilen etkinliği sürdürebilir ve tamamlamaya çalışır.', prompt: 'Derse katılıyor mu? Göreve ne kadar hızlı başlıyor? Etkinliği yarım mı bırakıyor? Kavrama güçlüğü nedeniyle sık sık öğretmene ihtiyaç duyuyor mu?' },
  { code: 'A4', section: 'A', area: 'Kalıcılık Kavrama ve Transfer', behavior: 'Öğrendiğini hatırlar, anlamlandırır ve farklı bir durumda kullanabilir.', prompt: 'Dün öğrendiğini bugün hatırlıyor mu? Bilgiyi yalnızca aynı soruda mı kullanıyor? Yeni bir problemde, günlük yaşamda veya başka derste bağlantı kurabiliyor mu?' },
  { code: 'A5', section: 'A', area: 'Yabancı Dil İngilizce Düzeyi', behavior: 'Yaşına uygun İngilizce yönergeleri ve temel iletişim ifadelerini anlayıp kullanır.', prompt: 'Basit yönergeleri takip ediyor mu? Kendisine yöneltilen soruya sözlü veya jestsel yanıt veriyor mu? Temel kelimeleri anlayıp kullanabiliyor mu?' },
  { code: 'B1', section: 'B', area: 'Öğrenme Niyeti ve Merak', behavior: 'Yeni öğrenmelere ilgi gösterir, soru sorar ve keşfetmeye isteklidir.', prompt: 'Yeni etkinliğe istekle yaklaşıyor mu? Neden, nasıl ve acaba gibi sorular soruyor mu? Kendiliğinden inceleme ve keşfetme davranışı gösteriyor mu?' },
  { code: 'B2', section: 'B', area: 'Çalışma Alışkanlığı ve Odaklanma', behavior: 'Yaşına uygun süre boyunca dikkatini göreve yöneltir ve başladığı işi sürdürür.', prompt: 'Göreve başlayabiliyor mu? Dikkati ne kadar kolay dağılıyor? Hatırlatma sonrası geri dönebiliyor mu? Çalışmayı bağımsız tamamlıyor mu?' },
  { code: 'B3', section: 'B', area: 'Öğrenen Profili Özellikleri', behavior: 'PYP öğrenen profiline uygun tutum ve davranışları günlük yaşamda göstermeye çalışır.', prompt: 'Soru soruyor mu? Fikrini ifade ediyor mu? Başkasının duygusunu fark ediyor mu? Hata yapmayı göze alıyor mu? Sorumluluk alıyor ve farklı düşüncelere açık davranıyor mu?' },
  { code: 'B4', section: 'B', area: 'Düşünme ve Keşif Becerileri', behavior: 'Gözlem yapar, bağlantı kurar, tahminde bulunur ve farklı çözüm yolları dener.', prompt: 'Tek bir cevaba mı bağlı kalıyor? Başka nasıl olabilir diye düşünüyor mu? Parçalar arasında ilişki kurabiliyor mu? Deneyerek çözüm arıyor mu?' },
  { code: 'B5', section: 'B', area: 'İletişim ve Akran İş Birliği', behavior: 'Kendini uygun biçimde ifade eder, arkadaşını dinler ve ortak çalışmaya katkıda bulunur.', prompt: 'Söz sırası bekliyor mu? Arkadaşının sözünü kesiyor mu? Fikrini ifade edebiliyor mu? Grup içinde görev alıyor, malzeme paylaşıyor ve uzlaşabiliyor mu?' },
  { code: 'B6', section: 'B', area: 'Duygusal Güvenlik ve İyi Oluş', behavior: 'Duygularını fark eder, ifade eder ve gerektiğinde yardım isteyebilir.', prompt: 'Okulda rahat görünüyor mu? Hata yaptığında aşırı kaygılanıyor mu? Üzüldüğünde veya gerildiğinde yetişkinden yardım isteyebiliyor mu? Duygusunu sözlü ifade edebiliyor mu?' },
  { code: 'B7', section: 'B', area: 'Sosyal İlişkiler ve Oyun Dinamiği', behavior: 'Oyuna ve gruba katılır, karşılıklı ilişki kurar ve sosyal sınırları gözetir.', prompt: 'Oyuna nasıl katılıyor? Arkadaş edinebiliyor mu? Sürekli yalnız mı kalıyor? Oyun kurallarını sürdürebiliyor, çatışmada çözüm arıyor ve sınırları gözetiyor mu?' },
  { code: 'B8', section: 'B', area: 'Davranış Örüntüleri ve Öz Denetim', behavior: 'Dürtülerini kontrol eder, bekler, sınırları gözetir ve yoğun duygularda davranışını düzenlemeye çalışır.', prompt: 'Sırasını bekleyebiliyor mu? Aniden hareket ediyor mu? Öfkelendiğinde ne yapıyor? Uyarı sonrası davranışını düzenleyebiliyor mu? Aynı davranış sürekli tekrar ediyor mu?' },
  { code: 'C1', section: 'C', area: 'Devam Süreklilik ve Zamanındalık', behavior: 'Okula düzenli devam eder ve derslere zamanında, öğrenmeye hazır biçimde katılır.', prompt: 'Devamsızlık sık mı? Sabah ilk derslere yetişiyor mu? Geç kalma düzenli bir örüntü mü? Devamsızlık öğrenme sürekliliğini etkiliyor mu?' },
  { code: 'C2', section: 'C', area: 'Ev Halkası ve Aile Rutinleri', behavior: 'Evdeki rutinler öğrencinin okul yaşamını ve öğrenmesini destekler görünmektedir.', prompt: 'Öğrenci sürekli uykusuz mu geliyor? Ödev veya çanta hazırlığı sürekli aksıyor mu? Aile okul iletişimi düzenli mi? Ev rutinleri öğrenmeye destek mi engel mi oluşturuyor?' },
  { code: 'C3', section: 'C', area: 'İlgi Alanları ve Güçlü Yanlar', behavior: 'İlgi duyduğu ve güçlü olduğu alanları ortaya koyar ve öğrenme sürecinde kullanır.', prompt: 'Nelerden heyecanlanıyor? Hangi etkinliklerde daha uzun süre odaklanıyor? Spor, sanat, müzik, doğa, lego veya teknoloji gibi hangi alanlarda güç gösteriyor?' },
  { code: 'C4', section: 'C', area: 'Fiziksel İhtiyaç ve Yaşam Sinyalleri', behavior: 'Fiziksel ihtiyaçları öğrenmeye katılımını destekleyecek düzeydedir ve gerektiğinde ihtiyacını ifade eder.', prompt: 'Sürekli yorgun mu? Açlık veya susuzluk belirtileri var mı? Görme ya da işitmede zorlanıyor olabilir mi? Yoğun hareket ihtiyacı veya ifade ettiği fiziksel bir rahatsızlık var mı?' },
  { code: 'D1', section: 'D', area: 'Okul Kültürü ve Temel Ritüeller', behavior: 'Okulun ortak değerlerine, rutinlerine ve günlük yaşamına katılım gösterir.', prompt: 'Sabah rutini, tören, koridor, bahçe ve yemekhanedeki ortak uygulamalara uyum gösteriyor mu? Okula ait olduğunu gösteren davranışları var mı?' },
  { code: 'D2', section: 'D', area: 'Sınıf Sözleşmesi ve Yaşam Görgüsü', behavior: 'Sınıfın ortak kurallarına uyar ve başkalarının öğrenme hakkını gözetir.', prompt: 'Söz almadan konuşuyor mu? Arkadaşını dinliyor mu? Ders akışını bozuyor mu? Hatırlatma olmadan sınıf sözleşmesine uygun davranıyor mu?' },
  { code: 'D3', section: 'D', area: 'Ortak Eşya ve Mekâna Özen', behavior: 'Kendi eşyasına, ortak materyallere ve okul alanlarına özen gösterir.', prompt: 'Sırasını ve çevresini düzenli bırakıyor mu? Ortak materyali amacı dışında kullanıyor mu? Başkasının eşyasını izin almadan alıyor mu? Ortak alanı sahipleniyor mu?' },
  { code: 'D4', section: 'D', area: 'Çocuk Kültürü ve Sanat Merakı', behavior: 'Kitap, hikâye, sanat, müzik, doğa ve kültürel etkinliklere yaşına uygun merak gösterir.', prompt: 'Hikâyeye veya kitaba ilgi gösteriyor mu? Resim, müzik ve drama etkinliklerinde kendini ifade ediyor mu? Çevresini merak ederek gözlemliyor ve yeni kültürel deneyimlere açık davranıyor mu?' }
];

const rubricSections = [
  { id: 'A', name: 'Öğrenmeye Hazır Oluş ve Akademik Beceriler' },
  { id: 'B', name: 'Öğrenme Sosyal Duygusal Gelişim ve Öz Denetim' },
  { id: 'C', name: 'Süreklilik Aile Güçlü Yanlar ve Fiziksel İhtiyaçlar' },
  { id: 'D', name: 'Okul Kültürü ve Ortak Yaşam' }
];

module.exports = { rubricScale, rubricCriteria, rubricSections };
