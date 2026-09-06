const editorProfiles = [
  {
    username: 'ilaydahisarbeyli',
    name: 'İlayda Hisarbeyli',
    schoolIds: null,
    grades: null,
    scopeLabel: 'Her iki okul · Tüm kademeler',
    passwordEnv: 'EDITOR_PASSWORD',
    fallbackPassword: '123456'
  },
  {
    username: 'tugbasaygi',
    name: 'Tuğba Saygı',
    schoolIds: ['nazmi'],
    grades: ['anaokulu'],
    scopeLabel: 'Kağıthane Nazmi Arıkan · Fen Bilimleri · Anaokulu kademesi',
    passwordEnv: 'TUGBA_EDITOR_PASSWORD',
    fallbackSalt: 'ec518102f8f07be500dfd6e4bf63edd2',
    fallbackHash: '41f93d4fb45779033353ca763ca9f55e9bff9e0f56df1fb4a48ccfc003e0b77e6c14254f079b4be15b5699e84fd5d24350565b6d040c8dab39c4d34babeb1900'
  },
  {
    username: 'kubrakaban',
    name: 'Kübra Kaban',
    schoolIds: ['nazmi'],
    grades: ['1', '2'],
    scopeLabel: 'Kağıthane Nazmi Arıkan · Fen Bilimleri · 1. ve 2. sınıflar',
    passwordEnv: 'KUBRA_EDITOR_PASSWORD',
    fallbackSalt: '00dbc4681c9799623f24ff15365540ed',
    fallbackHash: '59e8d9ff1ceec255a72da378fbff2666fb2a984181911034be89f1bdd55e3c733181c0b7fe7b8030470e48b2f067dc8388f891305a8d76ceed01960c6555ce4a'
  },
  {
    username: 'selinak',
    name: 'Selin Ak',
    schoolIds: ['nazmi'],
    grades: ['3', '4'],
    scopeLabel: 'Kağıthane Nazmi Arıkan · Fen Bilimleri · 3. ve 4. sınıflar',
    passwordEnv: 'SELIN_EDITOR_PASSWORD',
    fallbackSalt: '77d38e8c09666298679c933b0a1dfe6d',
    fallbackHash: '00b830b2589ad1b5d4286e254992229674abe535ee64f12253eb88e5882f8c7361f7801e813aceeed6b77db68fc95ac60c6ee8672db1e53e9273a071b144be4b'
  }
];

function editorProfile(username) {
  return editorProfiles.find(profile => profile.username === username) || null;
}

function classGrade(classItem) {
  if (classItem.name.startsWith('Anaokulu')) return 'anaokulu';
  return classItem.name.match(/^(\d+)/)?.[1] || '';
}

function canAccessClass(username, classItem) {
  const profile = editorProfile(username);
  return Boolean(profile && (profile.schoolIds === null || profile.schoolIds.includes(classItem.schoolId)) && (profile.grades === null || profile.grades.includes(classGrade(classItem))));
}

function publicEditorProfile(username) {
  const profile = editorProfile(username);
  return profile ? { username: profile.username, name: profile.name, scopeLabel: profile.scopeLabel } : null;
}

module.exports = { editorProfiles, editorProfile, canAccessClass, publicEditorProfile };
