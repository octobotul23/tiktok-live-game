// Construiește APK-ul pentru telefon: `npm run apk`. Merge la fel pe Windows și pe Mac.
// 1. crește versiunea (package.json din rădăcină: 0.0.1 → 0.0.2), singurul loc unde stă;
// 2. construiește jocul pentru aplicație (game/dist-app) și îl copiază în proiectul Android (Capacitor);
// 3. compilează APK-ul cu Gradle și îl pune în release/LiveGame-v<versiune>.apk (folder care nu se urcă pe git).
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const gameDir = path.join(root, 'game');
const androidDir = path.join(gameDir, 'android');
const isWin = process.platform === 'win32';
const home = os.homedir();

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

function run(cmd, args, cwd, env = process.env) {
  console.log(`\n▶ ${cmd} ${args.join(' ')}`);
  // Pe Windows, npm/npx/gradlew sunt fișiere .cmd/.bat și au nevoie de shell.
  const r = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: isWin });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} a ieșit cu codul ${r.status}`);
}

const exists = (p) => !!p && fs.existsSync(p);

/** Java 21: JAVA_HOME, apoi locurile obișnuite pe Windows și Mac. */
function findJava() {
  const javaBin = (dir) => path.join(dir, 'bin', isWin ? 'java.exe' : 'java');
  const candidates = [process.env.JAVA_HOME];
  if (isWin) candidates.push(path.join(process.env.LOCALAPPDATA ?? '', 'Programs', 'jdk21'));
  if (process.platform === 'darwin') {
    try {
      candidates.push(execFileSync('/usr/libexec/java_home', ['-v', '21'], { encoding: 'utf8' }).trim());
    } catch {
      // nu e instalat prin pachetul standard
    }
    candidates.push('/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home');
    candidates.push('/Applications/Android Studio.app/Contents/jbr/Contents/Home');
  }
  if (isWin) candidates.push('C:\\Program Files\\Android\\Android Studio\\jbr');
  return candidates.find((d) => exists(d) && exists(javaBin(d)));
}

/** Android SDK: ANDROID_HOME / ANDROID_SDK_ROOT, apoi locul implicit pe fiecare sistem. */
function findSdk() {
  const candidates = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT];
  if (isWin) candidates.push(path.join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk'));
  else if (process.platform === 'darwin') candidates.push(path.join(home, 'Library', 'Android', 'sdk'));
  else candidates.push(path.join(home, 'Android', 'Sdk'));
  return candidates.find((d) => exists(d) && exists(path.join(d, 'platforms')));
}

const javaHome = findJava();
if (!javaHome) fail('Nu găsesc Java 21. Instalează un JDK 21 (ex. Microsoft OpenJDK 21) sau setează JAVA_HOME. Detalii în README, „Aplicația de telefon”.');
const sdkDir = findSdk();
if (!sdkDir) fail('Nu găsesc Android SDK. Instalează-l (vezi README, „Aplicația de telefon”) sau setează ANDROID_HOME.');

// --- versiunea -------------------------------------------------------------------------
const pkgPath = path.join(root, 'package.json');
const pkgText = fs.readFileSync(pkgPath, 'utf8');
const pkg = JSON.parse(pkgText);
const [maj, min, pat] = String(pkg.version ?? '0.0.0').split('.').map((n) => Number(n) || 0);
const version = `${maj}.${min}.${pat + 1}`;
const versionCode = maj * 1_000_000 + min * 1_000 + pat + 1; // Android vrea un număr care tot crește
fs.writeFileSync(pkgPath, pkgText.replace(/"version":\s*"[^"]*"/, `"version": "${version}"`));

const gradlePath = path.join(androidDir, 'app', 'build.gradle');
const gradleText = fs.readFileSync(gradlePath, 'utf8');

try {
  fs.writeFileSync(
    gradlePath,
    gradleText.replace(/versionCode \d+/, `versionCode ${versionCode}`).replace(/versionName "[^"]*"/, `versionName "${version}"`),
  );
  // Gradle citește calea SDK-ului din local.properties (fișier local, nu se urcă pe git).
  const escaped = sdkDir.replace(/\\/g, '\\\\').replace(/:/g, '\\:');
  fs.writeFileSync(path.join(androidDir, 'local.properties'), `sdk.dir=${escaped}\n`);

  console.log(`Construiesc v${version} (Java: ${javaHome}, Android SDK: ${sdkDir})`);
  run('npm', ['run', 'build:app'], gameDir);
  run('npx', ['cap', 'sync', 'android'], gameDir);
  const env = { ...process.env, JAVA_HOME: javaHome, ANDROID_HOME: sdkDir };
  // Cale relativă explicită: cmd.exe nu caută mereu în folderul curent.
  run(isWin ? '.\\gradlew.bat' : './gradlew', ['assembleDebug', '--console=plain'], androidDir, env);
} catch (err) {
  // Build eșuat: versiunea rămâne cea veche, ca să nu sară numere.
  fs.writeFileSync(pkgPath, pkgText);
  fs.writeFileSync(gradlePath, gradleText);
  fail(err instanceof Error ? err.message : String(err));
}

const built = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const outDir = path.join(root, 'release');
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, `LiveGame-v${version}.apk`);
fs.copyFileSync(built, out);
console.log(`\n✔ APK gata: ${out}`);
console.log('  Pune-l pe telefon (cablu USB, Google Drive sau `tailscale file cp`) și deschide-l; vezi README, „Aplicația de telefon”.\n');
