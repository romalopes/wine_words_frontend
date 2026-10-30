# Article and review writing

Both forms use the shared Trix editor. Trix 2.1.15 is installed through npm and loaded as a local Vite chunk; the browser no longer downloads editor scripts or styles from a CDN. A failed chunk load displays a retry button while preserving the form's text.

## Writing and preview

- Article bodies have a larger editing area; review comments use a compact editor.
- Word count includes writing, excluding attachment figures, and separates words across paragraphs and line breaks.
- Preview uses the same HTML normalization and DOMPurify sanitization as detail pages. It does not save or publish.
- External value changes (including restored writing) load into Trix. Parent updates that echo typing do not reset selection or undo history.

## Local recovery

Title and body/comment are autosaved to localStorage after 750 ms without a change. Articles also include their abstract. Pending edits are flushed when the form unmounts or the page exits. Keys are scoped to the signed-in user and article/review; new reviews also include their wine/vintage or package-item context.

A previous local copy is offered through **Restore writing** or **Keep current writing**, rather than silently replacing server content. A successful explicit form save clears its recovery copy; failed saves preserve it. Writing entered while a save request is in flight remains recoverable. Storage failures are shown without preventing editing.

This is device-local text recovery, not server autosave or publishing. Categories, scores, status, relationships, and selected files still require explicit form submission. Local copies do not synchronize between devices. Multiple tabs editing the same record share a recovery key, so the most recent write wins. Cancel leaves the writing recoverable.

## Inline images

The image API requires an existing record. Save a new draft and reopen it before inserting inline images. Images selected through the existing gallery can still be included in the first save.

Saved articles and reviews support image insertion through Trix's attachment button, drop, or paste. The frontend accepts JPG, PNG, WebP, and GIF up to 10 MB, matching the backend image model. Uploads use the authenticated `/images` endpoint and existing record authorization.

The API now returns `uploaded_image_ids` alongside the existing `images` gallery. The frontend uses the exact uploaded ID to find the URL; it does not infer it from filename or gallery order. Deploy the backend response addition before or alongside the frontend. Existing clients remain compatible. A frontend talking to the old API reports a missing URL instead of embedding an unrelated image.

Saving the form is blocked while inline uploads are pending. Failures remove the pending attachment and display an error. Removing an attachment during upload prevents its later insertion. Uploaded files remain in the record's gallery even if removed from the text or if editing is cancelled. Deleting a file from the gallery also invalidates any inline reference to that file.

## Verification

```sh
# Frontend
npx vitest run src/components/RichTextEditor.test.tsx src/components/RichTextEditor.integration.test.tsx src/components/WritingForms.test.tsx src/hooks/useWritingDraft.test.ts src/services/inlineImages.test.ts src/utils/articleHtml.test.ts
npm run build

# Backend, from wine_words_api
bundle exec rspec spec/requests/api/v1/images_spec.rb
```

The integration test loads the real bundled Trix engine. jsdom-only stubs supply missing form-validation and layout APIs; the wrapper tests cover loading failures, synchronization, preview sanitization, file validation, and upload cancellation/failure. Form and hook tests cover restoration, save failures, upload blocking, account isolation, storage failure, and clearing recovery.
