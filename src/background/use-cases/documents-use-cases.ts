import {
  DocumentEntry,
  DocumentVersionEntry,
  SaveDocumentRequest,
  SaveDocumentVersionRequest
} from '../../shared/models'
import {
  IDocumentService,
  IDocumentVersionService,
  ITaskService,
  ITabManagementService
} from '../../shared/services/interfaces'

export class DocumentsUseCases {
  constructor(
    private documentService: IDocumentService,
    private documentVersionService: IDocumentVersionService,
    private taskService: ITaskService,
    private tabManagementService: ITabManagementService,
    private backgroundStore?: any
  ) {}

  async createDocument(request: SaveDocumentRequest): Promise<{ document: DocumentEntry; version?: DocumentVersionEntry }> {
    if (request.taskId) {
      await this.ensureTaskExists(request.taskId)
    }

    const document = await this.documentService.create(request)

    let version: DocumentVersionEntry | undefined
    if (request.initialContent) {
      version = await this.documentVersionService.create({
        documentId: document.id,
        content: request.initialContent,
        createdBy: 'user'
      })
    }

    this.notifyDocumentUpdate(document)

    return { document, version }
  }

  async updateDocument(documentId: string, updates: Partial<DocumentEntry>): Promise<DocumentEntry> {
    const updated = await this.documentService.update(documentId, updates)
    this.notifyDocumentUpdate(updated)
    return updated
  }

  async createVersion(request: SaveDocumentVersionRequest): Promise<DocumentVersionEntry> {
    const version = await this.documentVersionService.create(request)

    const document = await this.documentService.getById(request.documentId)
    if (document) {
      this.notifyDocumentUpdate(document)
    }

    return version
  }

  async deleteVersion(versionId: string): Promise<void> {
    console.log('[DocumentsUseCases] Deleting version:', versionId)

    // Get the version before deleting to find the document
    const version = await this.documentVersionService.getById(versionId)
    if (!version) {
      throw new Error(`Version ${versionId} not found`)
    }

    await this.documentVersionService.delete(versionId)

    // Notify about document update since version list changed
    const document = await this.documentService.getById(version.documentId)
    if (document) {
      this.notifyDocumentUpdate(document)
    }

    console.log('[DocumentsUseCases] Version deleted successfully:', versionId)
  }

  async updateVersion(versionId: string, updates: { tags?: string[]; title?: string; metadata?: any }): Promise<DocumentVersionEntry> {
    console.log('[DocumentsUseCases] Updating version:', versionId, updates)

    const version = await this.documentVersionService.getById(versionId)
    if (!version) {
      throw new Error(`Version not found: ${versionId}`)
    }

    // Update the version with new metadata
    const updatedVersion = await this.documentVersionService.update(versionId, updates)

    // Notify about document update since version changed
    const document = await this.documentService.getById(version.documentId)
    if (document) {
      this.notifyDocumentUpdate(document)
    }

    console.log('[DocumentsUseCases] Version updated successfully:', versionId)
    return updatedVersion
  }

  async duplicateVersion(versionId: string, options?: { title?: string; tags?: string[] }): Promise<DocumentVersionEntry> {
    console.log('[DocumentsUseCases] Duplicating version:', versionId)

    const originalVersion = await this.documentVersionService.getById(versionId)
    if (!originalVersion) {
      throw new Error(`Version not found: ${versionId}`)
    }

    // Create a new version with the same content but updated metadata
    const duplicateRequest: SaveDocumentVersionRequest = {
      documentId: originalVersion.documentId,
      content: originalVersion.content,
      createdBy: 'user',
      isAutoSaved: false,
      isMilestone: false,
      tags: options?.tags || originalVersion.tags
    }

    const newVersion = await this.documentVersionService.create(duplicateRequest)

    // Update title if provided
    if (options?.title) {
      await this.documentVersionService.update(newVersion.id, { title: options.title })
    }

    // Notify about document update
    const document = await this.documentService.getById(originalVersion.documentId)
    if (document) {
      this.notifyDocumentUpdate(document)
    }

    console.log('[DocumentsUseCases] Version duplicated successfully:', newVersion.id)
    return newVersion
  }

  async getDocument(
    documentId: string,
    options: { versionLimit?: number } = {}
  ): Promise<{ document: DocumentEntry; versions: DocumentVersionEntry[] } | null> {
    console.log('[DocumentsUseCases] Getting document:', documentId, 'limit:', options.versionLimit)

    const document = await this.documentService.getById(documentId)
    if (!document) {
      console.log('[DocumentsUseCases] Document not found:', documentId)
      return null
    }

    console.log('[DocumentsUseCases] Document found:', document.id, 'activeVersionId:', document.activeVersionId)

    const versions = await this.documentVersionService.getByDocument(documentId, options.versionLimit)
    console.log('[DocumentsUseCases] Versions found:', versions.length, versions.map(v => ({ id: v.id, createdAt: v.createdAt })))

    return { document, versions }
  }

  async listDocumentsByTask(taskId: string): Promise<DocumentEntry[]> {
    return this.documentService.getByTask(taskId)
  }

  async listAllDocuments(params?: { taskId?: string; limit?: number; offset?: number }): Promise<DocumentEntry[]> {
    return this.documentService.list(params)
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.documentService.delete(documentId)

    // Close any open authoring workspace tabs for this document
    await this.tabManagementService.closeDocumentTabs(documentId)

    if (this.backgroundStore) {
      try {
        this.backgroundStore.broadcastStateUpdate?.(`document.${documentId}.deleted`, Date.now())
      } catch (error) {
        console.warn('Failed to broadcast document deletion:', error)
      }
    }
  }

  private async ensureTaskExists(taskId: string) {
    try {
      const task = await this.taskService.getById(taskId)
      if (!task) {
        throw new Error(`Task ${taskId} does not exist`)
      }
    } catch (error) {
      throw new Error(`Unable to locate task ${taskId}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private notifyDocumentUpdate(document: DocumentEntry) {
    if (!this.backgroundStore) {
      return
    }

    try {
      this.backgroundStore.broadcastStateUpdate?.(`document.${document.id}.updated`, document)
      if (document.taskId) {
        this.backgroundStore.broadcastStateUpdate?.(`task.${document.taskId}.documents.updated`, document)
      }
    } catch (error) {
      console.warn('Failed to broadcast document update:', error)
    }
  }
}
