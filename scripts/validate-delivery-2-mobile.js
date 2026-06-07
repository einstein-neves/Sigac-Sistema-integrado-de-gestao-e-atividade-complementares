const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertContains(relativePath, needles) {
  const content = read(relativePath);
  for (const needle of needles) {
    if (!content.includes(needle)) {
      throw new Error(`${relativePath} nao contem: ${needle}`);
    }
  }
}

function assertJsonDependency(relativePath, dependency) {
  const pkg = JSON.parse(read(relativePath));
  if (!pkg.dependencies || !pkg.dependencies[dependency]) {
    throw new Error(`${relativePath} nao declara dependencia ${dependency}`);
  }
}

function main() {
  assertJsonDependency('mobile/sigac-mobile/package.json', 'expo-image-picker');
  assertJsonDependency('mobile/sigac-mobile/package.json', '@react-native-async-storage/async-storage');
  assertJsonDependency('mobile/sigac-mobile/package.json', '@react-native-community/netinfo');
  assertJsonDependency('mobile/sigac-mobile/package.json', 'expo-notifications');

  assertContains('mobile/sigac-mobile/app.json', [
    'expo-image-picker',
    'cameraPermission',
    'photosPermission',
  ]);

  assertContains('mobile/sigac-mobile/src/utils/files.js', [
    'pickImageFromCameraAsDataUrl',
    'pickImageFromLibraryAsDataUrl',
    'pickDocumentAsDataUrl',
    'ALLOWED_UPLOAD_TYPES',
  ]);

  assertContains('mobile/sigac-mobile/src/screens/NovaAtividadeScreen.jsx', [
    'Tirar foto com a câmera',
    'Selecionar da galeria',
    'Selecionar PDF/arquivo',
    'Categoria do curso',
    'Rascunho encontrado',
    'Corrigir e reenviar',
  ]);

  assertContains('mobile/sigac-mobile/src/screens/DashboardAlunoScreen.jsx', [
    'Progresso por categoria',
    'Limite da categoria atingido',
    'Você está offline',
  ]);

  assertContains('mobile/sigac-mobile/src/screens/CertificadosScreen.jsx', [
    'Tirar foto com a câmera',
    'Selecionar PDF/documento',
    'Título detectado',
  ]);

  assertContains('mobile/sigac-mobile/src/navigation/RootNavigator.js', [
    'StatusSolicitacoesScreen',
    '<Tab.Screen name="Status"',
  ]);

  assertContains('mobile/sigac-mobile/src/contexts/AuthContext.js', [
    'SecureStore',
    'switchActiveCourse',
    'invalidateCachedResource',
    'registerPushToken',
    'syncQueuedSubmissions',
  ]);

  assertContains('server.js', [
    "pathname === '/api/student/active-course'",
    "pathname === '/api/mobile/student/push-token'",
    'categoryProgress',
    'activity_rules',
    'confirmacao-envio-aluno',
    '^\\/api\\/mobile\\/student\\/submissions\\/[^/]+\\/file',
    'includeActivity: true',
  ]);

  assertContains('docs/entrega-2-mobile.md', [
    'Entrega 2 - Mobile',
    'camera',
    'troca de curso',
    'SMTP',
    'OCR',
  ]);

  assertContains('docs/checklist-entrega-2-mobile.md', [
    'login como aluno',
    'foto da camera',
    'controle de acesso',
  ]);

  console.log('Entrega 2 Mobile: validacao estrutural concluida.');
}

main();
