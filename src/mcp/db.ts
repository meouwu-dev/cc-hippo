import Database from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'

const DB_DIR = path.resolve(import.meta.dirname ?? '.', '../../data')
const DB_PATH = path.join(DB_DIR, 'seal.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true })
  }

  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      session_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS artifacts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      path TEXT NOT NULL,
      filename TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'other',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, path)
    );

    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      source_path TEXT NOT NULL,
      target_path TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'references',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(project_id, source_path, target_path)
    );
  `)

  return db
}

// ---- Projects ----

export interface ProjectRow {
  id: string
  name: string
  session_id: string | null
  created_at: string
}

export function createProject(name: string): ProjectRow {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(
    `INSERT INTO projects (id, name) VALUES (?, ?)`,
  ).run(id, name)
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow
}

export function getAllProjects(): ProjectRow[] {
  const db = getDb()
  return db.prepare('SELECT * FROM projects ORDER BY created_at').all() as ProjectRow[]
}

export function deleteProject(projectId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM projects WHERE id = ?').run(projectId)
}

export function getOrCreateSessionId(projectId: string): string {
  const db = getDb()
  const row = db
    .prepare('SELECT session_id FROM projects WHERE id = ?')
    .get(projectId) as { session_id: string | null } | undefined
  if (row?.session_id) return row.session_id
  const sessionId = crypto.randomUUID()
  db.prepare('UPDATE projects SET session_id = ? WHERE id = ?').run(
    sessionId,
    projectId,
  )
  return sessionId
}

// ---- Artifacts ----

export interface ArtifactRow {
  id: string
  project_id: string
  path: string
  filename: string
  content: string
  type: string
  created_at: string
  updated_at: string
}

export function upsertArtifact(
  projectId: string,
  artifactPath: string,
  filename: string,
  content: string,
  type = 'other',
) {
  const db = getDb()
  db.prepare(
    `INSERT INTO artifacts (id, project_id, path, filename, content, type)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET
       filename = excluded.filename,
       content = excluded.content,
       type = excluded.type,
       updated_at = datetime('now')`,
  ).run(projectId, artifactPath, filename, content, type)
}

export function getAllArtifacts(projectId: string, type?: string): ArtifactRow[] {
  const db = getDb()
  if (type) {
    return db
      .prepare('SELECT * FROM artifacts WHERE project_id = ? AND type = ?')
      .all(projectId, type) as ArtifactRow[]
  }
  return db
    .prepare('SELECT * FROM artifacts WHERE project_id = ?')
    .all(projectId) as ArtifactRow[]
}

export function getArtifactByPath(
  projectId: string,
  artifactPath: string,
): ArtifactRow | undefined {
  const db = getDb()
  return db
    .prepare('SELECT * FROM artifacts WHERE project_id = ? AND path = ?')
    .get(projectId, artifactPath) as ArtifactRow | undefined
}

// ---- Edges ----

export interface EdgeRow {
  id: string
  project_id: string
  source_path: string
  target_path: string
  kind: string
  created_at: string
}

export function insertEdge(
  projectId: string,
  sourcePath: string,
  targetPath: string,
  kind = 'references',
) {
  const db = getDb()
  db.prepare(
    `INSERT OR IGNORE INTO edges (id, project_id, source_path, target_path, kind)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?)`,
  ).run(projectId, sourcePath, targetPath, kind)
}

export function getAllEdges(projectId: string, artifactPath?: string): EdgeRow[] {
  const db = getDb()
  if (artifactPath) {
    return db
      .prepare(
        'SELECT * FROM edges WHERE project_id = ? AND (source_path = ? OR target_path = ?)',
      )
      .all(projectId, artifactPath, artifactPath) as EdgeRow[]
  }
  return db
    .prepare('SELECT * FROM edges WHERE project_id = ?')
    .all(projectId) as EdgeRow[]
}
