const crypto = require('node:crypto');
const { nazmiRoster } = require('./nazmi-roster.cjs');
const { atagenRoster } = require('./atagen-roster.cjs');

const schools = [
  { id: 'nazmi', name: 'Kağıthane Nazmi Arıkan Fen Bilimleri İlkokulu' },
  { id: 'atagen', name: 'Kağıthane Atagen İlkokulu' }
];

const nazmiClassTeachers = {
  'Anaokulu 3 Yaş': 'Sıla Konukçu',
  'Anaokulu 4 Yaş': 'Elif Gaye Dingil',
  'Anaokulu 5 Yaş A': 'Esra Derebaşı',
  'Anaokulu 5 Yaş B': 'Sema Kesik',
  '1-A': 'Berkay Meç',
  '1-B': 'Mehmet Baytekin',
  '2-A': 'Hüsniye Berk',
  '2-B': 'Beste Gülçiçek',
  '3-A': 'Doğuş Aydın',
  '3-B': 'Dilek Güngör',
  '3-C': 'İlker Bayraktar',
  '4-A': 'Çiğdem Uzunçakmak',
  '4-B': 'Fadime Karataş'
};

const atagenClassTeachers = {
  'Anaokulu 3 Yaş': 'Yaren Palalıoğlu',
  'Anaokulu 4 Yaş': 'Rabia Akgül',
  'Anaokulu 5 Yaş': 'Hazal Durgut',
  '1-A': 'Şahinde Köksal',
  '2-A': 'Rozerin Furan',
  '3-A': 'Mehtap Duyan',
  '4-A': 'Hamit Sarı',
  '4-B': 'Zeynep Betül Şimşek'
};

const definitions = [
  ...['Anaokulu 3 Yaş', 'Anaokulu 4 Yaş', 'Anaokulu 5 Yaş A', 'Anaokulu 5 Yaş B', '1-A', '1-B', '2-A', '2-B', '3-A', '3-B', '3-C', '4-A', '4-B']
    .map(name => ({ schoolId: 'nazmi', name, teacher: nazmiClassTeachers[name] })),
  ...['Anaokulu 3 Yaş', 'Anaokulu 4 Yaş', 'Anaokulu 5 Yaş', '1-A', '2-A', '3-A', '4-A', '4-B']
    .map(name => ({ schoolId: 'atagen', name, teacher: atagenClassTeachers[name] }))
];

const legacyNazmiIds = { 'Anaokulu 3 Yaş': 'ana3', 'Anaokulu 4 Yaş': 'ana4', 'Anaokulu 5 Yaş A': 'ana5', '1-A': '1a', '1-B': '1b' };
const slug = name => name.toLocaleLowerCase('tr').replaceAll('ı', 'i').replaceAll('ş', 's').replaceAll('ğ', 'g').replaceAll('ü', 'u').replaceAll('ö', 'o').replaceAll('ç', 'c').replace(/[^a-z0-9]+/g, '');

const classes = definitions.map(item => {
  const id = `${item.schoolId}-${slug(item.name)}`;
  const legacyId = item.schoolId === 'nazmi' ? legacyNazmiIds[item.name] : undefined;
  const students = item.schoolId === 'nazmi' ? nazmiRoster[item.name] : atagenRoster[item.name];
  return {
    id,
    schoolId: item.schoolId,
    name: item.name,
    teacher: item.teacher || '',
    legacyId,
    students,
    studentIds: students.map(name => `${item.schoolId}-${crypto.createHash('sha256').update(`${id}\0${name}`).digest('hex').slice(0, 16)}`)
  };
});

const editorTeachers = [
  'İlayda Hisarbeyli',
  'Tuğba Saygı',
  'Kübra Kaban',
  'Selin Ak'
];
const atagenTeachers = [
  ...editorTeachers,
  'Mehtap Duyan',
  'Hamit Sarı',
  'Şahinde Köksal',
  'Zeynep Betül Şimşek',
  'Rozerin Furan',
  'Rabia Akgül',
  'Hazal Durgut',
  'Yaren Palalıoğlu',
  'Büşra Önder',
  'Melisa Yıldırım',
  'Cihat Karadeniz',
  'Mazi Babi',
  'Merve Akdağ',
  'Hande Karaca',
  'Irmak Sel',
  'Aleyna Suberk',
  'Büşra Sezen Kaya',
  'Keziban Zeynep Saltık',
  'Beyza Es',
  'Özgür Emil',
  'Onur Ayar'
];
const nazmiTeachers = [
  ...editorTeachers,
  'Esra Derebaşı',
  'Sema Kesik',
  'Elif Gaye Dingil',
  'Sıla Konukçu',
  'Berkay Meç',
  'Mehmet Baytekin',
  'Hüsniye Berk',
  'Beste Gülçiçek',
  'Doğuş Aydın',
  'Dilek Güngör',
  'İlker Bayraktar',
  'Çiğdem Uzunçakmak',
  'Fadime Karataş',
  'Selen Doğan',
  'Sevda Sakarya',
  'Necip Can Bek',
  'Esra Coşkun',
  'Çisem Çil',
  'Esma Bozkurt',
  'Irmak Sel',
  'Gamze Karahan',
  'Zeynep Kuleci',
  'Taylan Öztürk',
  'Aleyna Süberk',
  'Seren Konyalı Şimşek',
  'Muhteşem Merve Eraslan',
  'Seda Şallıel',
  'Filiz Gülen',
  'Eda Aktaş',
  'Özgür Emil',
  'Beyza Es'
];
const teachersBySchool = { nazmi: nazmiTeachers, atagen: atagenTeachers };
const teachersForSchool = schoolId => teachersBySchool[schoolId] || [];
const teachers = [...new Set(Object.values(teachersBySchool).flat())];
module.exports = { schools, classes, teachers, teachersBySchool, teachersForSchool };
