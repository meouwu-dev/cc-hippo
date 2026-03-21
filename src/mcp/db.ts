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

    CREATE TABLE IF NOT EXISTS pages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL DEFAULT 'Page 1',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sections (
      id TEXT PRIMARY KEY,
      page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position_x REAL NOT NULL DEFAULT 0,
      position_y REAL NOT NULL DEFAULT 0,
      width REAL NOT NULL DEFAULT 800,
      height REAL NOT NULL DEFAULT 600,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      thinking TEXT,
      artifacts TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS canvas_state (
      project_id TEXT NOT NULL,
      page_id TEXT NOT NULL,
      nodes TEXT NOT NULL DEFAULT '[]',
      edges TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, page_id),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `)

  // Add columns to artifacts if they don't exist yet
  const cols = db.prepare('PRAGMA table_info(artifacts)').all() as {
    name: string
  }[]
  const colNames = new Set(cols.map((c) => c.name))
  if (!colNames.has('page_id')) {
    db.exec('ALTER TABLE artifacts ADD COLUMN page_id TEXT')
  }
  if (!colNames.has('section_id')) {
    db.exec('ALTER TABLE artifacts ADD COLUMN section_id TEXT')
  }
  if (!colNames.has('device_preset')) {
    db.exec('ALTER TABLE artifacts ADD COLUMN device_preset TEXT')
  }

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
  db.prepare(`INSERT INTO projects (id, name) VALUES (?, ?)`).run(id, name)
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow
}

export function getAllProjects(): ProjectRow[] {
  const db = getDb()
  return db
    .prepare('SELECT * FROM projects ORDER BY created_at')
    .all() as ProjectRow[]
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
  page_id: string | null
  section_id: string | null
  device_preset: string | null
  created_at: string
  updated_at: string
}

export function upsertArtifact(
  projectId: string,
  artifactPath: string,
  filename: string,
  content: string,
  type = 'other',
  pageId?: string | null,
  sectionId?: string | null,
  devicePreset?: string | null,
) {
  const db = getDb()
  db.prepare(
    `INSERT INTO artifacts (id, project_id, path, filename, content, type, page_id, section_id, device_preset)
     VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(project_id, path) DO UPDATE SET
       filename = excluded.filename,
       content = excluded.content,
       type = excluded.type,
       page_id = COALESCE(excluded.page_id, page_id),
       section_id = COALESCE(excluded.section_id, section_id),
       device_preset = COALESCE(excluded.device_preset, device_preset),
       updated_at = datetime('now')`,
  ).run(
    projectId,
    artifactPath,
    filename,
    content,
    type,
    pageId ?? null,
    sectionId ?? null,
    devicePreset ?? null,
  )
}

export function getAllArtifacts(
  projectId: string,
  type?: string,
): ArtifactRow[] {
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

export function getAllEdges(
  projectId: string,
  artifactPath?: string,
): EdgeRow[] {
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

// ---- Pages ----

export interface PageRow {
  id: string
  project_id: string
  name: string
  sort_order: number
  created_at: string
}

export function createPage(
  projectId: string,
  name: string,
  sortOrder = 0,
): PageRow {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(
    'INSERT INTO pages (id, project_id, name, sort_order) VALUES (?, ?, ?, ?)',
  ).run(id, projectId, name, sortOrder)
  return db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as PageRow
}

export function getPages(projectId: string): PageRow[] {
  const db = getDb()
  return db
    .prepare(
      'SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order, created_at',
    )
    .all(projectId) as PageRow[]
}

export function renamePage(pageId: string, name: string): void {
  const db = getDb()
  db.prepare('UPDATE pages SET name = ? WHERE id = ?').run(name, pageId)
}

export function deletePage(pageId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM pages WHERE id = ?').run(pageId)
}

export function ensureDefaultPage(projectId: string): PageRow {
  const db = getDb()
  const existing = db
    .prepare(
      'SELECT * FROM pages WHERE project_id = ? ORDER BY sort_order LIMIT 1',
    )
    .get(projectId) as PageRow | undefined
  if (existing) return existing

  const page = createPage(projectId, 'Page 1', 0)
  // Migrate orphaned artifacts to this page
  db.prepare(
    'UPDATE artifacts SET page_id = ? WHERE project_id = ? AND page_id IS NULL',
  ).run(page.id, projectId)
  return page
}

// ---- Sections ----

export interface SectionRow {
  id: string
  page_id: string
  project_id: string
  name: string
  position_x: number
  position_y: number
  width: number
  height: number
  created_at: string
}

export function createSection(
  pageId: string,
  projectId: string,
  name: string,
  x = 0,
  y = 0,
): SectionRow {
  const db = getDb()
  const id = crypto.randomUUID()
  db.prepare(
    'INSERT INTO sections (id, page_id, project_id, name, position_x, position_y) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(id, pageId, projectId, name, x, y)
  return db.prepare('SELECT * FROM sections WHERE id = ?').get(id) as SectionRow
}

export function getSections(projectId: string, pageId?: string): SectionRow[] {
  const db = getDb()
  if (pageId) {
    return db
      .prepare('SELECT * FROM sections WHERE project_id = ? AND page_id = ?')
      .all(projectId, pageId) as SectionRow[]
  }
  return db
    .prepare('SELECT * FROM sections WHERE project_id = ?')
    .all(projectId) as SectionRow[]
}

export function updateSection(
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const db = getDb()
  db.prepare(
    'UPDATE sections SET position_x = ?, position_y = ?, width = ?, height = ? WHERE id = ?',
  ).run(x, y, w, h, id)
}

export function deleteSection(id: string): void {
  const db = getDb()
  db.prepare('UPDATE artifacts SET section_id = NULL WHERE section_id = ?').run(
    id,
  )
  db.prepare('DELETE FROM sections WHERE id = ?').run(id)
}

// ---- Chat Messages ----

export interface ChatMessageRow {
  id: string
  project_id: string
  role: string
  content: string
  thinking: string | null
  artifacts: string | null
  created_at: string
}

export function getChatMessages(projectId: string): ChatMessageRow[] {
  const db = getDb()
  return db
    .prepare(
      'SELECT * FROM chat_messages WHERE project_id = ? ORDER BY created_at',
    )
    .all(projectId) as ChatMessageRow[]
}

export function saveChatMessages(
  projectId: string,
  messages: {
    id: string
    role: string
    content: string
    thinking?: string
    artifacts?: unknown[]
  }[],
): void {
  const db = getDb()
  const upsert = db.prepare(
    `INSERT INTO chat_messages (id, project_id, role, content, thinking, artifacts)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       content = excluded.content,
       thinking = excluded.thinking,
       artifacts = excluded.artifacts`,
  )
  const tx = db.transaction(() => {
    for (const msg of messages) {
      upsert.run(
        msg.id,
        projectId,
        msg.role,
        msg.content,
        msg.thinking ?? null,
        JSON.stringify(msg.artifacts ?? []),
      )
    }
  })
  tx()
}

export function deleteChatMessages(projectId: string): void {
  const db = getDb()
  db.prepare('DELETE FROM chat_messages WHERE project_id = ?').run(projectId)
}

// ---- Canvas State ----

export function getCanvasState(
  projectId: string,
  pageId: string,
): { nodes: string; edges: string } | undefined {
  const db = getDb()
  return db
    .prepare(
      'SELECT nodes, edges FROM canvas_state WHERE project_id = ? AND page_id = ?',
    )
    .get(projectId, pageId) as { nodes: string; edges: string } | undefined
}

export function saveCanvasState(
  projectId: string,
  pageId: string,
  nodes: unknown[],
  edges: unknown[],
): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO canvas_state (project_id, page_id, nodes, edges)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(project_id, page_id) DO UPDATE SET
       nodes = excluded.nodes,
       edges = excluded.edges,
       updated_at = datetime('now')`,
  ).run(projectId, pageId, JSON.stringify(nodes), JSON.stringify(edges))
}

export function deleteCanvasState(projectId: string, pageId: string): void {
  const db = getDb()
  db.prepare(
    'DELETE FROM canvas_state WHERE project_id = ? AND page_id = ?',
  ).run(projectId, pageId)
}
