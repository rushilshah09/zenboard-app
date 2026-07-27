# components/ds/ui — GENERATED, do not edit

This folder is a **generated mirror** of the design system's primitive components.
The single source of truth is:

    ../../../design-system/src/components/ui

Do **not** hand-edit files here — changes will be overwritten on the next sync.
To change a component, edit it in `design-system/src/components/ui`, then run
from the `design-system/` directory:

    npm run sync:web          # regenerate this mirror
    npm run sync:web:check    # verify this mirror matches the source (CI)

The sync applies one runtime adaptation for Next.js: Vite's `import.meta.env.DEV`
becomes `process.env.NODE_ENV !== "production"`.
