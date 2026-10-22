import { DatabaseSync } from 'node:sqlite';

// Хранилище групп. Сервер не знает ни названий групп, ни ников, ни координат: всё это
// приходит зашифрованным ключом группы, которого у сервера нет. В открытом виде — только
// случайные идентификаторы, роли, время и хэши токенов.
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS groups (
    id TEXT PRIMARY KEY,
    name_enc TEXT NOT NULL,
    key_version INTEGER NOT NULL,
    owner_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    last_activity INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS members (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    pub TEXT NOT NULL,
    nick_enc TEXT NOT NULL,
    role TEXT NOT NULL,
    joined_at INTEGER NOT NULL,
    wrapped_key TEXT,
    wrapped_version INTEGER
  );
  CREATE INDEX IF NOT EXISTS members_group ON members(group_id);
  CREATE TABLE IF NOT EXISTS positions (
    member_id TEXT PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    key_version INTEGER NOT NULL,
    received_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS positions_group ON positions(group_id);
  CREATE TABLE IF NOT EXISTS invites (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS requests (
    member_id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    secret_hash TEXT NOT NULL,
    pub TEXT NOT NULL,
    nick_enc TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    status TEXT NOT NULL,
    member_token TEXT
  );
  CREATE INDEX IF NOT EXISTS requests_group ON requests(group_id);
`;

function openDatabase(path) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON;');
  if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  return db;
}

// Несколько изменений как одно целое: либо все, либо ни одного
function transaction(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export { openDatabase, transaction };
