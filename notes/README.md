# Ders notları / Course notes

Bu klasördeki dosyalar `teaching.html` (Dersler) sayfasında listelenir.

## Yeni materyal eklemek (GitHub web arayüzünden, kod bilgisi gerekmez)

1. **Dosyayı yükleyin.** Repoda `notes/` klasörüne girin, **Add file → Upload files** deyin.
   Dosyayı dersin klasörüne koymak için yükleme ekranında dosya adının başına klasör adını yazın,
   ör. `ml-python/hafta01.pdf`. Klasör yoksa kendiliğinden oluşur. **Commit changes** ile kaydedin.
2. **Listeye ekleyin.** `assets/js/data.js` dosyasını açın (kalem simgesi → düzenle), en alttaki
   `courses` bölümünde ilgili dersin `materials` listesine bir satır ekleyin:

   ```js
   { week: 1, type: "slides", title: { en: "Introduction", tr: "Giriş" }, file: "notes/ml-python/hafta01.pdf", date: "2026-09-29" },
   ```

   Dış bağlantı (Colab, YouTube, GitHub…) için `file` yerine `url` kullanın:

   ```js
   { week: 2, type: "code", title: "Colab: ilk model", url: "https://colab.research.google.com/..." },
   ```

3. **Commit changes.** Birkaç dakika içinde sitede görünür.

| Alan | Açıklama |
|---|---|
| `week` | Hafta numarası (ör. `3`) ya da metin (ör. `{ en: "Midterm", tr: "Vize" }`). İsteğe bağlı. |
| `type` | `slides` (Sunum), `notes` (Not), `lab`, `homework` (Ödev), `code` (Kod), `exam` (Sınav), `video`, `link` |
| `title` | `{ en: "...", tr: "..." }` ya da tek bir metin |
| `file` / `url` | Site içindeki dosya yolu ya da dış bağlantı |
| `date` | `YYYY-AA-GG`. Son 10 günde eklenenler **Yeni** etiketiyle gösterilir. İsteğe bağlı. |

## Yeni ders eklemek

`courses` listesine yeni bir blok ekleyin. `id` klasör adıyla aynı olsun (ör. `notes/signals/` için `id: "signals"`).
Dönem bittiğinde `active: false` yaparak dersi "Geçmiş dersler" altına taşıyabilirsiniz.

## Notlar

- Tek dosya en fazla **100 MB** olabilir (GitHub sınırı). Büyük videoları YouTube'a yükleyip `url` ile bağlayın.
- Dosya adlarında Türkçe karakter ve boşluk kullanmamak bağlantı sorunlarını önler (`hafta-01.pdf` gibi).
- Repo herkese açık olduğu için buraya yüklenen her dosyayı herkes indirebilir. Sınav cevapları gibi gizli içerik koymayın.
