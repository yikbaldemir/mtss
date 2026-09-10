const PDFDocument = require('pdfkit');
const embeddedFonts = require('pdfmake/build/vfs_fonts.js');

const fontFiles = embeddedFonts.pdfMake?.vfs || embeddedFonts;
const regularFont = Buffer.from(fontFiles['Roboto-Regular.ttf'], 'base64');
const boldFont = Buffer.from(fontFiles['Roboto-Medium.ttf'], 'base64');

function turkishDate(value) {
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? value || 'Belirtilmedi' : parsed.toLocaleDateString('tr-TR');
}

function parseNote(record) {
  try { return JSON.parse(record.note); } catch { return {}; }
}

function safeFilename(record) {
  const prefix = record.kind === 'rubric' ? 'mtss-ogrenci-takip-formu' : record.kind === 'parent' ? 'veli-bilgi-formu' : 'gozlem-formu';
  return `${prefix}-${String(record.id).replace(/[^a-zA-Z0-9-]/g, '')}.pdf`;
}

function recordPdf({ record, school, className, rubricCriteria, rubricScale }) {
  return new Promise((resolve, reject) => {
    const title = record.kind === 'rubric' ? 'MTSS Öğrenci Takip Formu' : record.kind === 'parent' ? 'Veli Bilgi Formu' : 'Gözlem Formu';
    const doc = new PDFDocument({ size: 'A4', font: regularFont, margins: { top: 46, right: 48, bottom: 54, left: 48 }, bufferPages: true, info: { Title: `${title} - ${record.student}`, Author: 'MTSS' } });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve({ bytes: Buffer.concat(chunks), filename: safeFilename(record) }));
    doc.registerFont('Regular', regularFont);
    doc.registerFont('Bold', boldFont);
    let activeFont = 'Regular';
    const font = name => { activeFont = name; doc.font(name); return doc; };
    const write = (value, x, y, options) => {
      const positioned = typeof x === 'number' && typeof y === 'number';
      const textOptions = positioned ? options || {} : (x && typeof x === 'object' ? x : {});
      doc.font(activeFont);
      if (positioned) doc.text(String(value ?? ''), x, y, textOptions);
      else doc.text(String(value ?? ''), textOptions);
      return doc;
    };
    font('Regular');

    const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const ensureSpace = height => { if (doc.y + height > doc.page.height - doc.page.margins.bottom) doc.addPage(); };
    const heading = text => {
      ensureSpace(42);
      doc.moveDown(0.5); font('Bold').fontSize(12).fillColor('#1f2937'); write(text);
      doc.moveDown(0.35).strokeColor('#dbe2ea').lineWidth(1).moveTo(doc.x, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke().moveDown(0.7);
    };
    const answer = (label, value) => {
      const text = String(value || 'Belirtilmedi');
      const height = doc.heightOfString(label, { width: contentWidth }) + doc.heightOfString(text, { width: contentWidth }) + 18;
      ensureSpace(height);
      font('Bold').fontSize(9).fillColor('#64748b'); write(label.toLocaleUpperCase('tr'));
      doc.moveDown(0.2); font('Regular').fontSize(10.5).fillColor('#111827'); write(text, { lineGap: 2 });
      doc.moveDown(0.65);
    };

    doc.roundedRect(doc.page.margins.left, doc.y, contentWidth, 84, 12).fill('#3459d1');
    font('Bold').fontSize(20).fillColor('#ffffff'); write(title, doc.page.margins.left + 20, doc.y + 20, { width: contentWidth - 40 });
    font('Regular').fontSize(9.5).fillColor('#dbe5ff'); write('MTSS · Öğrenci Takip Sistemi', doc.page.margins.left + 20, doc.y + 8, { width: contentWidth - 40 });
    doc.y = doc.page.margins.top + 104;

    const meta = record.kind === 'parent'
      ? [['Okul', school], ['Sınıf', className], ['Öğrenci', record.student], ['Veli adı soyadı', record.respondentName], ['Öğrenciye yakınlığı', record.relationship], ['Gönderim tarihi', turkishDate(record.date)]]
      : [['Okul', school], ['Sınıf', className], ['Öğrenci', record.student], ['Dolduran öğretmen', record.teacher], ['Tarih', turkishDate(record.date)]];
    for (let index = 0; index < meta.length; index += 2) {
      const rowY = doc.y;
      for (let column = 0; column < 2; column++) {
        const item = meta[index + column];
        if (!item) continue;
        const x = doc.page.margins.left + column * (contentWidth / 2);
        font('Bold').fontSize(8.5).fillColor('#64748b'); write(item[0].toLocaleUpperCase('tr'), x, rowY, { width: contentWidth / 2 - 18 });
        font('Regular').fontSize(10.5).fillColor('#111827'); write(String(item[1] || 'Belirtilmedi'), x, rowY + 15, { width: contentWidth / 2 - 18 });
      }
      doc.y = rowY + 43;
    }

    const value = parseNote(record);
    if (record.kind === 'parent') {
      heading('Form Yanıtları');
      for (const item of record.answers) answer(item.label, item.value || 'Yanıt verilmedi.');
    } else if (record.kind === 'observation') {
      heading('Form Yanıtları');
      answer('Gözlem türü', record.type);
      answer('Ne zamandır / ne sıklıkta gözlemliyorsunuz?', value.frequency);
      answer('Değerlendirme', value.version === 1 ? value.note : record.note);
      answer('Bu konuda daha önce ne yaptınız?', value.previousActions);
    } else {
      const scaleLabel = raw => {
        const option = rubricScale.find(item => item.value === raw);
        return option ? `${option.value} — ${option.label}` : raw || 'Yanıt verilmedi';
      };
      heading('Soru ve Cevaplar');
      for (const item of rubricCriteria) {
        const response = scaleLabel(value.ratings?.[item.code]);
        const estimated = doc.heightOfString(item.behavior, { width: contentWidth - 20 }) + doc.heightOfString(response, { width: contentWidth - 20 }) + 50;
        ensureSpace(estimated);
        doc.roundedRect(doc.page.margins.left, doc.y, contentWidth, estimated - 8, 8).fillAndStroke('#f8fafc', '#e2e8f0');
        const boxY = doc.y;
        font('Bold').fontSize(9.5).fillColor('#3459d1'); write(`${item.code} · ${item.area}`, doc.page.margins.left + 12, boxY + 11, { width: contentWidth - 24 });
        font('Regular').fontSize(9.5).fillColor('#111827'); write(item.behavior, doc.page.margins.left + 12, doc.y + 5, { width: contentWidth - 24, lineGap: 1.5 });
        font('Bold').fontSize(9.5).fillColor('#166534'); write(`Cevap: ${response}`, doc.page.margins.left + 12, doc.y + 7, { width: contentWidth - 24 });
        doc.y = boxY + estimated;
      }
      if (value.note) { heading('Genel Not'); answer('Genel not', value.note); }
    }

    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page++) {
      doc.switchToPage(page);
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 10;
      font('Regular').fontSize(8).fillColor('#94a3b8'); write(`MTSS · ${page + 1} / ${range.count}`, doc.page.margins.left, doc.page.height - 30, { width: contentWidth, align: 'center', lineBreak: false });
      doc.page.margins.bottom = bottomMargin;
    }
    doc.end();
  });
}

module.exports = { recordPdf };
