// Spread onto plain text inputs/textareas that aren't credential fields (page
// names, wall messages, and the like — the Super Powers sign-in/up form uses
// real password fields instead). Password managers use their own heuristics
// beyond `type`/`name` and will still offer to fill/save on a bare text box;
// these are each vendor's documented opt-out marker for a single field.
export const NO_PASSWORD_MANAGER_ATTRS = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
  "data-protonpass-ignore": "true",
} as const;
