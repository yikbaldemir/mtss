const crypto = require('node:crypto');
const { nazmiRoster } = require('./nazmi-roster.cjs');

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

const definitions = [
  ...['Anaokulu 3 Yaş', 'Anaokulu 4 Yaş', 'Anaokulu 5 Yaş A', 'Anaokulu 5 Yaş B', '1-A', '1-B', '2-A', '2-B', '3-A', '3-B', '3-C', '4-A', '4-B']
    .map(name => ({ schoolId: 'nazmi', name, teacher: nazmiClassTeachers[name] })),
  ...['Anaokulu 3 Yaş', 'Anaokulu 4 Yaş', 'Anaokulu 5 Yaş', '1-A', '2-A', '3-A', '4-A', '4-B']
    .map(name => ({ schoolId: 'atagen', name }))
];

const firstNames = [
  'Ada', 'Aras', 'Defne', 'Ege', 'Lina', 'Mert', 'Mira', 'Poyraz', 'Selin', 'Uras',
  'Alin', 'Atlas', 'Duru', 'Emir', 'İpek', 'Kerem', 'Lara', 'Mete', 'Nehir', 'Rüzgar'
];
const surnames = ['Yılmaz', 'Demir', 'Kaya', 'Aydın', 'Şahin', 'Arslan', 'Çelik', 'Koç', 'Aksoy', 'Yalçın'];
const legacyNazmiIds = { 'Anaokulu 3 Yaş': 'ana3', 'Anaokulu 4 Yaş': 'ana4', 'Anaokulu 5 Yaş A': 'ana5', '1-A': '1a', '1-B': '1b' };
const slug = name => name.toLocaleLowerCase('tr').replaceAll('ı', 'i').replaceAll('ş', 's').replaceAll('ğ', 'g').replaceAll('ü', 'u').replaceAll('ö', 'o').replaceAll('ç', 'c').replace(/[^a-z0-9]+/g, '');

const classes = definitions.map((item, classIndex) => {
  const id = `${item.schoolId}-${slug(item.name)}`;
  const legacyId = item.schoolId === 'nazmi' ? legacyNazmiIds[item.name] : undefined;
  const students = item.schoolId === 'nazmi' ? nazmiRoster[item.name] : Array.from({ length: 10 }, (_, studentIndex) => {
    const index = classIndex * 10 + studentIndex;
    return `${firstNames[index % firstNames.length]} ${surnames[Math.floor(index / firstNames.length) % surnames.length]}`;
  });
  return {
    id,
    schoolId: item.schoolId,
    name: item.name,
    teacher: item.teacher || '',
    legacyId,
    students,
    studentIds: students.map((name, index) => item.schoolId === 'nazmi' ? `nazmi-${crypto.createHash('sha256').update(`${id}\0${name}`).digest('hex').slice(0, 16)}` : `${legacyId || id}-${index}`)
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
  'Ayşe Kaya',
  'Burcu Demir',
  'Emre Yıldız',
  'Merve Çelik',
  'Selin Arslan'
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
  'Din Kültürü Öğretmeni',
  'Özgür — Buz Pateni',
  'Beyza — Yüzme'
];
const teachersBySchool = { nazmi: nazmiTeachers, atagen: atagenTeachers };
const teachersForSchool = schoolId => teachersBySchool[schoolId] || [];
const teachers = [...new Set(Object.values(teachersBySchool).flat())];
module.exports = { schools, classes, teachers, teachersBySchool, teachersForSchool };
