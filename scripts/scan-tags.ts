import Dexie from 'dexie'

const tag = process.argv[2]
if (!tag) {
  console.error('Usage: ts-node scripts/scan-tags.ts <tag>')
  process.exit(1)
}

interface PageEntry {
  id: string
  url: string
  title: string
  tags?: string[]
  createdAt?: Date
  updatedAt?: Date
}

interface NoteEntry {
  id: string
  pageId?: string
  content: string
  tags?: string[]
  createdAt?: Date
  updatedAt?: Date
}

class SuperowserDB extends Dexie {
  pages!: Dexie.Table<PageEntry, string>
  notes!: Dexie.Table<NoteEntry, string>
}

async function main() {
  const db = new SuperowserDB('SuperowserDB')
  db.version(2).stores({
    pages: 'id,url,title,*tags,shortcut,*tasks,createdAt,updatedAt',
    notes: 'id,pageId,content,*tags,*tasks,createdAt,updatedAt'
  })

  const needle = tag.replace(/^#/, '')

  const pageMatches = await db.pages.filter(page => {
    if (!page.tags) return false
    return page.tags.some(t => t === tag || t === needle)
  }).toArray()

  const noteMatches = await db.notes.filter(note => {
    if (!note.tags) return false
    return note.tags.some(t => t === tag || t === needle)
  }).toArray()

  console.log('Pages:', pageMatches.map(page => ({ id: page.id, url: page.url, tags: page.tags })))
  console.log('Notes:', noteMatches.map(note => ({ id: note.id, pageId: note.pageId, tags: note.tags })))
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
