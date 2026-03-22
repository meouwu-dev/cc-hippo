import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import {
  upsertArtifact,
  insertEdgeByPath,
  getAllArtifacts,
  getAllEdges,
  getPages,
  createPage,
  renamePage,
} from './db.js'

const projectId = process.env.SEAL_PROJECT_ID || 'default'

const server = new McpServer({
  name: 'seal',
  version: '1.0.0',
})

server.registerTool(
  'askUser',
  {
    description:
      "Ask the user one or more questions with predefined options. The user will see clickable buttons for each option and can also type a custom answer. Use this whenever you need user input to decide between alternatives. The tool returns the user's answers formatted as Q&A pairs.",
    inputSchema: {
      questions: z
        .array(
          z.object({
            question: z.string().describe('The question to ask'),
            options: z
              .array(z.string())
              .describe('List of options (keep under 50 chars each)'),
            allowCustom: z
              .boolean()
              .optional()
              .default(false)
              .describe('Whether to show a text input for custom answers'),
          }),
        )
        .describe('One or more questions to ask the user'),
    },
  },
  async ({ questions }) => {
    // The actual interaction is handled by the client intercepting this tool call.
    // The MCP tool just returns a placeholder — the server will pause claude
    // and resume with the user's answers.
    return {
      content: [
        {
          type: 'text',
          text: `Waiting for user to answer ${questions.length} question(s)...`,
        },
      ],
    }
  },
)

server.registerTool(
  'listPages',
  {
    description:
      'List all pages in the project. Use this to see what pages exist before creating artifacts or new pages. Each page represents a major feature area (e.g. "Auth Flow", "Dashboard", "Settings").',
    inputSchema: {},
  },
  async () => {
    const pages = getPages(projectId)
    const summary = pages
      .map(
        (p) =>
          `- ${p.name} (id: ${p.id})${p.user_renamed ? ' [named by user]' : ' [auto-named, can rename]'}`,
      )
      .join('\n')
    return {
      content: [
        {
          type: 'text',
          text: pages.length
            ? `${pages.length} page(s):\n${summary}`
            : 'No pages yet.',
        },
      ],
    }
  },
)

server.registerTool(
  'createPage',
  {
    description:
      'Create a new page (canvas tab) in the project. Pages organize work by feature area, following professional design workflow (e.g. "Auth Flow", "Dashboard", "Onboarding", "Settings"). Check listPages first to avoid duplicates.',
    inputSchema: {
      name: z
        .string()
        .describe(
          'Page name — use feature area names like "Auth Flow", "Dashboard", "Settings"',
        ),
    },
  },
  async ({ name }) => {
    const existing = getPages(projectId)
    const sortOrder = existing.length
    const page = createPage(projectId, name, sortOrder)
    return {
      content: [
        {
          type: 'text',
          text: `Created page: ${page.name} (id: ${page.id})`,
        },
      ],
    }
  },
)

server.registerTool(
  'renamePage',
  {
    description:
      'Rename a page to better reflect its content. Only allowed if the user has NOT manually renamed the page — check listPages for "[named by user]" vs "[auto-named, can rename]" status. Use this to give auto-created pages meaningful names like "Auth Flow" or "Dashboard".',
    inputSchema: {
      pageId: z.string().describe('ID of the page to rename'),
      name: z.string().describe('New page name'),
    },
  },
  async ({ pageId, name }) => {
    const pages = getPages(projectId)
    const page = pages.find((p) => p.id === pageId)
    if (!page) {
      return {
        content: [{ type: 'text', text: `Page not found: ${pageId}` }],
      }
    }
    if (page.user_renamed) {
      return {
        content: [
          {
            type: 'text',
            text: `Cannot rename: "${page.name}" was named by the user. Respect their choice.`,
          },
        ],
      }
    }
    renamePage(pageId, name)
    return {
      content: [{ type: 'text', text: `Renamed page to: ${name}` }],
    }
  },
)

server.registerTool(
  'switchPage',
  {
    description:
      'Navigate the user to a specific page. Use this after creating artifacts on a page so the user can see the results. Also useful when discussing work on a specific page.',
    inputSchema: {
      pageId: z.string().describe('ID of the page to switch to'),
    },
  },
  async ({ pageId }) => {
    const pages = getPages(projectId)
    const page = pages.find((p) => p.id === pageId)
    if (!page) {
      return {
        content: [{ type: 'text', text: `Page not found: ${pageId}` }],
      }
    }
    // The actual navigation is handled by the client intercepting this tool call
    return {
      content: [{ type: 'text', text: `Navigated user to page: ${page.name}` }],
    }
  },
)

server.registerTool(
  'saveArtifact',
  {
    description:
      'Save or update an artifact in the database. Call this after writing a file to register its metadata and type. Specify pageId to place the artifact on a specific page — use listPages to find available pages, or createPage to make a new one.',
    inputSchema: {
      path: z.string().describe('Relative file path (e.g. "requirements.md")'),
      filename: z
        .string()
        .describe('Just the filename (e.g. "requirements.md")'),
      content: z.string().describe('Full file content'),
      type: z
        .enum(['requirement', 'design', 'preview', 'component', 'other'])
        .default('other')
        .describe('Artifact type'),
      pageId: z
        .string()
        .optional()
        .describe(
          'ID of the page to place this artifact on. If omitted, uses the default page.',
        ),
      devicePreset: z
        .enum(['desktop', 'tablet', 'mobile'])
        .optional()
        .describe(
          'Device viewport preset for this artifact. Sets the node size on the canvas. Use "desktop" (1440×1024) for full-width layouts, "tablet" (768×1024) for tablet views, "mobile" (390×844) for mobile-first designs.',
        ),
    },
  },
  async ({ path, filename, content, type, pageId, devicePreset }) => {
    upsertArtifact(
      projectId,
      path,
      filename,
      content,
      type,
      pageId,
      undefined,
      devicePreset,
    )
    return {
      content: [{ type: 'text', text: `Saved artifact: ${path} (${type})` }],
    }
  },
)

server.registerTool(
  'linkArtifacts',
  {
    description:
      'Create a directional relationship between two artifacts. The edge flows from source (left) to target (right) on the canvas. For "implements": source is the spec/design, target is the implementation. For "derives": source is the original, target is the derivative.',
    inputSchema: {
      source_path: z
        .string()
        .describe('Path of the source artifact (appears on the left)'),
      target_path: z
        .string()
        .describe('Path of the target artifact (appears on the right)'),
      kind: z
        .enum(['references', 'implements', 'derives', 'extends'])
        .default('references')
        .describe('Relationship type'),
    },
  },
  async ({ source_path, target_path, kind }) => {
    insertEdgeByPath(projectId, source_path, target_path, kind)
    return {
      content: [
        {
          type: 'text',
          text: `Linked: ${source_path} --${kind}--> ${target_path}`,
        },
      ],
    }
  },
)

server.registerTool(
  'getArtifacts',
  {
    description:
      'List all existing artifacts, optionally filtered by type. Use this to see what artifacts already exist before creating new ones.',
    inputSchema: {
      type: z
        .enum(['requirement', 'design', 'preview', 'component', 'other'])
        .optional()
        .describe('Filter by artifact type'),
    },
  },
  async ({ type }) => {
    const artifacts = getAllArtifacts(projectId, type)
    const summary = artifacts.map((a) => `[${a.type}] ${a.path}`).join('\n')
    return {
      content: [
        {
          type: 'text',
          text: artifacts.length
            ? `Found ${artifacts.length} artifact(s):\n${summary}`
            : 'No artifacts found.',
        },
      ],
    }
  },
)

server.registerTool(
  'getRelationships',
  {
    description:
      'List all relationships between artifacts, optionally filtered to a specific artifact path.',
    inputSchema: {
      path: z
        .string()
        .optional()
        .describe('Filter relationships involving this artifact path'),
    },
  },
  async ({ path }) => {
    const allArtifacts = getAllArtifacts(projectId)
    const byId = new Map(allArtifacts.map((a) => [a.id, a.path]))
    const edges = getAllEdges(projectId, path)
    const summary = edges
      .map(
        (e) =>
          `${byId.get(e.source_artifact_id) ?? e.source_artifact_id} --${e.kind}--> ${byId.get(e.target_artifact_id) ?? e.target_artifact_id}`,
      )
      .join('\n')
    return {
      content: [
        {
          type: 'text',
          text: edges.length
            ? `Found ${edges.length} relationship(s):\n${summary}`
            : 'No relationships found.',
        },
      ],
    }
  },
)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('MCP server error:', err)
  process.exit(1)
})
