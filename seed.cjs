const schools = [
  { id: 'nazmi', name: 'Kağıthane Nazmi Arıkan Fen Bilimleri İlkokulu' },
  { id: 'atagen', name: 'Kağıthane Atagen İlkokulu' }
];

const definitions = [
  ...['Anaokulu 3 Yaş', 'Anaokulu 4 Yaş', 'Anaokulu 5 Yaş A', 'Anaokulu 5 Yaş B', '1-A', '1-B', '2-A', '2-B', '3-A', '3-B', '3-C', '4-A', '4-B']
    .map(name => ({ schoolId: 'nazmi', name })),
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

const classes = definitions.map((item, classIndex) => ({
  id: `${item.schoolId}-${slug(item.name)}`,
  schoolId: item.schoolId,
  name: item.name,
  legacyId: item.schoolId === 'nazmi' ? legacyNazmiIds[item.name] : undefined,
  students: Array.from({ length: 10 }, (_, studentIndex) => {
    const index = classIndex * 10 + studentIndex;
    return `${firstNames[index % firstNames.length]} ${surnames[Math.floor(index / firstNames.length) % surnames.length]}`;
  })
}));

const teachers = [
  'İlayda Hisarbeyli',
  'Tuğba Saygı',
  'Kübra Kaban',
  'Selin Ak',
  'Ayşe Kaya',
  'Burcu Demir',
  'Emre Yıldız',
  'Merve Çelik',
  'Selin Arslan'
];
module.exports = { schools, classes, teachers };
