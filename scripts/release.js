import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
  readFileSync(join(__dirname, '..', 'package.json'), 'utf-8')
);

const version = packageJson.version;
const tag = `v${version}`;

console.log(`🚀 Releasing version ${version}...`);

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });

try {
  // Проверяем, что мы внутри git-репозитория
  run('git rev-parse --is-inside-work-tree');

  // Проверяем, не существует ли уже такой тег
  const existingTags = execSync('git tag --list', { encoding: 'utf-8' })
    .split('\n')
    .map((t) => t.trim());
  if (existingTags.includes(tag)) {
    throw new Error(`Тег ${tag} уже существует. Обновите version в package.json.`);
  }

  // Коммитим изменения (если есть)
  run('git add .');
  const hasStagedChanges = (() => {
    try {
      execSync('git diff --cached --quiet');
      return false;
    } catch {
      return true;
    }
  })();

  if (hasStagedChanges) {
    run(`git commit -m "chore: bump version to ${version}"`);
  } else {
    console.log('ℹ️  Нет изменений для коммита, пропускаем commit.');
  }

  // Создаём аннотированный тег
  run(`git tag -a "${tag}" -m "Release version ${version}"`);

  // Пушим ветку и теги
  run('git push origin dev');
  run('git push origin --tags');

  console.log(`✅ Successfully released ${tag}`);
} catch (error) {
  console.error('❌ Release failed:', error.message);
  process.exit(1);
}
