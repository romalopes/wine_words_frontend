# Article Projects — Phase 0: Repository Inspection

## Status

Complete on October 5, 2026. This is an inspection record only; no Article Project feature code was changed.

## Repository identity

| Canonical repository             | Local checkout                                                              | Responsibility |
| -------------------------------- | --------------------------------------------------------------------------- | -------------- |
| `romalopes/wine_words_front_end` | `/Users/romalopes/Documents/studies/my_project/wine_project/wine_words`     | React frontend |
| `romalopes/wine_words_api`       | `/Users/romalopes/Documents/studies/my_project/wine_project/wine_words_api` | Rails API      |

The local Git remotes retain pre-rename names. The API's shared `WINE_WORDS_README.md` confirms that these local checkouts are the intended Wine Words applications.

## Verified frontend findings

- The frontend uses React 19, Vite 6, React Router 7, TypeScript, Bootstrap/react-bootstrap, Vitest, and Testing Library.
- The feature must follow the existing TypeScript conventions. The specification's instruction not to migrate to TypeScript is already satisfied because this repository is TypeScript.
- Routes are declared in `src/components/AppRoutes.tsx`.
- Navigation is implemented in `src/components/Header.tsx`.
- API modules are composed in `src/services/api.ts`; content service factories are in `src/services/contentApi.ts`.
- Authentication state comes from `src/contexts/AuthContext.tsx`.
- Existing role helpers are in `src/constants/roles.ts`.
- There is no configured Playwright or Cypress browser-test runner. Current UI testing is Vitest plus Testing Library.

## Verified authorization presentation pattern

The frontend currently treats `Admin`, `Editor`, and `Reviewer` as content managers through `canManageWinesRole`. This is presentation-only. The API remains authoritative for Article Project authorization and record scope.

For Article Project navigation, all three roles should see Article Projects. Reviewer-specific ownership must not be inferred from the client; it is supplied by API-scoped results.

## Reusable frontend patterns

| Need                                        | Existing implementation                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| API request client and error transport      | `src/services/api.ts`, `src/services/apiClient.ts`                                |
| Content API factory conventions             | `src/services/contentApi.ts`                                                      |
| Routes                                      | `src/components/AppRoutes.tsx`                                                    |
| Header navigation and role gating           | `src/components/Header.tsx`                                                       |
| Debounced article picker search             | `src/components/LinkArticleDialog.tsx`                                            |
| Debounced producer picker search            | `src/components/LinkProducerDialog.tsx`                                           |
| Debounced review picker search              | `src/components/LinkReviewDialog.tsx`                                             |
| Cancellable stale-response prevention       | `src/components/Articles.tsx`                                                     |
| Form loading/error/retry patterns           | `src/components/WinePackageForm.tsx`                                              |
| Existing package list/detail/form structure | `src/components/WinePackages.tsx`, `WinePackageDetail.tsx`, `WinePackageForm.tsx` |

## Required adaptations

- Existing link dialogs immediately persist category links. Article Project forms need picker UI patterns only: association changes must remain form state and be saved atomically with the Article Project.
- The picker UI must preserve Article Project join IDs for edits; existing dialogs do not manage join-row tracking fields.
- The API has no verified generic `article projects.*` permission payload. UI visibility uses role helpers and must gracefully handle backend 401/403/404 responses.
- Browser E2E requirements must be addressed explicitly in Phase 6 because no browser framework is currently configured.

## Exit gate

Proceed only with the confirmed Article Project API contract: separate drafting status, server-controlled ownership, join-ID mutation contract, scoped picker results, lock version, and structured validation/conflict responses.
