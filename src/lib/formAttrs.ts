// Spread onto every plain text input/textarea in the app — none of them are
// login or payment fields (this site has no auth at all), but password
// managers use their own heuristics beyond just `type`/`name` and will still
// offer to fill/save on a bare text box. These are each vendor's documented
// opt-out marker for a single field.
export const NO_PASSWORD_MANAGER_ATTRS = {
  autoComplete: "off",
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
  "data-protonpass-ignore": "true",
} as const;
